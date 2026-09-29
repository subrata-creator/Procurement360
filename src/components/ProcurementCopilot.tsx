import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { ArrowUpRight, Bot, FileText, Send, Sparkles, X } from "lucide-react";
import "../Styles/Copilot.css";

type Props = {
  onClose: () => void;
  onViewPending: () => void;
};

type CopilotMessage = {
  id: number;
  role: "assistant" | "user";
  text: string;
  sources?: string[];
  action?: "pending";
};

const suggestions = [
  "Why are purchase requests delayed?",
  "Identify procurement bottlenecks",
  "Show suppliers with the highest order value",
  "Summarize this month's procurement performance",
  "Identify potential budget risks",
];

const initialMessage: CopilotMessage = {
  id: 1,
  role: "assistant",
  text: "Hello. I can summarize current procurement activity and highlight areas that may need attention. Choose a prompt or ask a question.",
};

function answerFor(question: string): Omit<CopilotMessage, "id" | "role"> {
  const normalized = question.toLowerCase();

  if (normalized.includes("delay") || normalized.includes("pending")) {
    return {
      text: "The Purchase Request Journey flags 3 PRs pending review for more than 7 days. A follow-up may help prevent further cycle delays.",
      sources: ["Purchase Request Journey"],
      action: "pending",
    };
  }

  if (normalized.includes("bottleneck")) {
    return {
      text: "Under Review is the largest active queue: 8 requests are in review, compared with 42 created. Review capacity is the clearest visible bottleneck.",
      sources: ["Purchase Request Journey"],
      action: "pending",
    };
  }

  if (normalized.includes("supplier") || normalized.includes("order value")) {
    return {
      text: "The current dashboard reports order counts, not supplier order values. By count, ITC leads with 100 orders, followed by Logitech with 92.",
      sources: ["Suppliers By Orders chart"],
    };
  }

  if (normalized.includes("summarize") || normalized.includes("performance")) {
    return {
      text: "Current KPI snapshot: 42 purchase requests (+12%), 43 RFQs (+8%), 20 orders (down 5%), and 18 invoice submissions (+20%).",
      sources: ["Dashboard KPI cards"],
    };
  }

  if (normalized.includes("budget") || normalized.includes("risk")) {
    return {
      text: "The budget insight flags IT at 85% of its allocation. Review upcoming IT requests before approval to reduce the chance of exceeding plan.",
      sources: ["Allocated Budget KPI", "Budget Utilization Insight"],
    };
  }

  return {
    text: "I can answer from the current dashboard data. Try a prompt about delayed PRs, review bottlenecks, supplier order counts, monthly performance, or budget risk.",
    sources: ["Procurement dashboard"],
  };
}

export default function ProcurementCopilot({ onClose, onViewPending }: Props) {
  const [messages, setMessages] = useState<CopilotMessage[]>([initialMessage]);
  const [input, setInput] = useState("");
  const nextId = useRef(2);
  const threadEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const ask = (question: string) => {
    const cleanedQuestion = question.trim();
    if (!cleanedQuestion) return;
    const answer = answerFor(cleanedQuestion);
    setMessages((current) => [
      ...current,
      { id: nextId.current++, role: "user", text: cleanedQuestion },
      { id: nextId.current++, role: "assistant", ...answer },
    ]);
    setInput("");
  };

  const submitQuestion = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    ask(input);
  };

  return (
    <div
      className="copilot-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside className="copilot-panel" role="dialog" aria-modal="true" aria-labelledby="copilot-title">
        <header className="copilot-header">
          <span className="copilot-mark"><Bot size={19} /></span>
          <div className="copilot-heading">
            <h2 id="copilot-title">Procurement Copilot</h2>
            <p>Ask questions about your procurement data</p>
          </div>
          <button className="copilot-close" type="button" onClick={onClose} aria-label="Close Procurement Copilot">
            <X size={18} />
          </button>
        </header>

        <div className="copilot-context-note">
          <Sparkles size={13} />
          <span>Answers reference the current dashboard data</span>
        </div>

        <div className="copilot-thread" role="log" aria-live="polite" aria-relevant="additions text">
          {messages.map((message) => (
            <article className={`copilot-message ${message.role}`} key={message.id}>
              {message.role === "assistant" && <span className="copilot-avatar"><Bot size={14} /></span>}
              <div className="copilot-message-body">
                <p>{message.text}</p>
                {message.sources && (
                  <div className="copilot-sources" aria-label="Sources">
                    {message.sources.map((source) => (
                      <span className="copilot-source" key={source}><FileText size={10} />{source}</span>
                    ))}
                  </div>
                )}
                {message.action === "pending" && (
                  <button className="copilot-action" type="button" onClick={onViewPending}>
                    View Pending PRs <ArrowUpRight size={13} />
                  </button>
                )}
              </div>
            </article>
          ))}
          <div ref={threadEndRef} />
        </div>

        {messages.length === 1 && (
          <section className="copilot-suggestions" aria-label="Suggested questions">
            <h3>Suggested questions</h3>
            {suggestions.map((suggestion) => (
              <button type="button" key={suggestion} onClick={() => ask(suggestion)}>
                <span>{suggestion}</span><ArrowUpRight size={13} />
              </button>
            ))}
          </section>
        )}

        <form className="copilot-composer" onSubmit={submitQuestion}>
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask about requests, suppliers, or budget..."
            aria-label="Ask Procurement Copilot"
          />
          <button type="submit" disabled={!input.trim()} aria-label="Send question">
            <Send size={16} />
          </button>
        </form>
      </aside>
    </div>
  );
}