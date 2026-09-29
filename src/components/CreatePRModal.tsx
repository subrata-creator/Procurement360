import { useEffect, useRef, useState } from "react";
import { Bot, Check, Plus, RotateCcw, Send, Sparkles, X } from "lucide-react";

type Product = {
  code: string;
  name: string;
  unitPrice: number;
};

const products: Product[] = [
  { code: "PDT-2025-05", name: "Laser Printer", unitPrice: 1000 },
  { code: "PDT-2025-04", name: "Document Trays", unitPrice: 500 },
  { code: "PDT-2025-06", name: "Flatbed Scanner", unitPrice: 500 },
  { code: "PDT-2025-013", name: "Dell Inspiron 15 3530", unitPrice: 1200 },
  { code: "PDT-2025-015", name: "Logitech MX Master 3S", unitPrice: 10 },
];

type Props = {
  onClose: () => void;
};

type RequestLine = {
  product: Product;
  quantity: number;
};

type Message = {
  id: number;
  role: "assistant" | "user";
  text: string;
  insightLabel?: string;
};

type Stage = "product" | "quantity" | "more" | "title" | "review" | "done";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const initialMessages: Message[] = [
  {
    id: 1,
    role: "assistant",
    text: "Hi, I can help you put together a purchase request. Choose a catalog item to get started.",
  },
  {
    id: 2,
    role: "assistant",
    insightLabel: "APPROVAL INSIGHT",
    text: "PR approval time is 30% faster this month, down from 5 days to 3.5 days.",
  },
  {
    id: 3,
    role: "assistant",
    insightLabel: "BUDGET INSIGHT",
    text: "The IT department is at 85% of its allocation. Consider upcoming requests when choosing quantities.",
  },
];

export default function CreatePRModal({ onClose }: Props) {
  const [messages, setMessages] = useState(initialMessages);
  const [stage, setStage] = useState<Stage>("product");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [requestLines, setRequestLines] = useState<RequestLine[]>([]);
  const [requestTitle, setRequestTitle] = useState("");
  const [input, setInput] = useState("");
  const nextMessageId = useRef(4);
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
  }, [messages, stage]);

  const addMessages = (...pending: Omit<Message, "id">[]) => {
    setMessages((current) => [
      ...current,
      ...pending.map((message) => ({ ...message, id: nextMessageId.current++ })),
    ]);
  };

  const selectProduct = (product: Product) => {
    setSelectedProduct(product);
    setStage("quantity");
    addMessages(
      { role: "user", text: `Add ${product.name}` },
      { role: "assistant", text: `How many ${product.name} do you need?` },
    );
  };

  const reviewRequest = () => {
    if (requestLines.length === 0) {
      addMessages({ role: "assistant", text: "Choose at least one catalog item before reviewing your request." });
      setStage("product");
      return;
    }
    setStage("title");
    addMessages({ role: "user", text: "Review my request" }, { role: "assistant", text: "What would you like to call this purchase request?" });
  };

  const submitInput = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = input.trim();
    if (!value) return;
    setInput("");

    if (stage === "product") {
      const query = value.toLowerCase();
      const match = products.find((product) =>
        product.name.toLowerCase().includes(query) || product.code.toLowerCase().includes(query),
      );
      if (match) {
        selectProduct(match);
      } else {
        addMessages(
          { role: "user", text: value },
          { role: "assistant", text: "I couldn't find that item in this catalog. Choose one of the available products below." },
        );
      }
      return;
    }

    if (stage === "quantity") {
      const quantity = Number(value);
      if (!Number.isSafeInteger(quantity) || quantity < 1 || !selectedProduct) {
        addMessages({ role: "assistant", text: "Enter a whole-number quantity greater than zero." });
        return;
      }
      setRequestLines((current) => [...current, { product: selectedProduct, quantity }]);
      setSelectedProduct(null);
      setStage("more");
      addMessages(
        { role: "user", text: `${quantity}` },
        { role: "assistant", text: `Added ${quantity} × ${selectedProduct.name}. Would you like to add another item or review the request?` },
      );
      return;
    }

    if (stage === "title") {
      setRequestTitle(value);
      setStage("review");
      addMessages(
        { role: "user", text: value },
        { role: "assistant", text: "Here is your draft. You can review it before finishing." },
      );
    }
  };

  const handleQuickAction = (action: string) => {
    if (stage === "quantity") {
      setInput(action);
      const quantity = Number(action);
      if (!selectedProduct || !Number.isSafeInteger(quantity) || quantity < 1) return;
      setRequestLines((current) => [...current, { product: selectedProduct, quantity }]);
      setSelectedProduct(null);
      setStage("more");
      addMessages(
        { role: "user", text: action },
        { role: "assistant", text: `Added ${quantity} × ${selectedProduct.name}. Would you like to add another item or review the request?` },
      );
      setInput("");
      return;
    }

    if (action === "Add another item") {
      setStage("product");
      addMessages({ role: "user", text: action }, { role: "assistant", text: "Sure. Which product should I add next?" });
    } else if (action === "Review request") {
      reviewRequest();
    } else if (action === "Edit items") {
      setStage("more");
      addMessages({ role: "user", text: action }, { role: "assistant", text: "You can add another product, then review the updated draft." });
    } else if (action === "Finish draft") {
      setStage("done");
      addMessages({ role: "user", text: action }, { role: "assistant", text: "Your purchase request draft is ready. Submission is not connected in this demo yet." });
    } else if (action === "Start another request") {
      nextMessageId.current = 4;
      setMessages(initialMessages);
      setStage("product");
      setSelectedProduct(null);
      setRequestLines([]);
      setRequestTitle("");
      setInput("");
    }
  };

  const total = requestLines.reduce((sum, line) => sum + line.product.unitPrice * line.quantity, 0);

  const inputPlaceholder = stage === "quantity"
    ? "Type a quantity..."
    : stage === "title"
      ? "Type a request title..."
      : "Search or type a product name...";

  const canType = stage === "product" || stage === "quantity" || stage === "title";

  const finishRequestLine = (line: RequestLine) => line.product.unitPrice * line.quantity;

  const finishMessageLog = (
    <div ref={threadEndRef} />
  );

  return (
    <div
      className="pr-chat-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="pr-chat-window" role="dialog" aria-modal="true" aria-labelledby="pr-chat-title">
        <header className="pr-chat-header">
          <span className="pr-chat-brand-icon"><Bot size={21} /></span>
          <div className="pr-chat-heading">
            <span className="pr-chat-eyebrow">PURCHASE REQUEST ASSISTANT</span>
            <h2 id="pr-chat-title">Let's build your request</h2>
            <span className="pr-chat-status"><i /> Guided draft builder</span>
          </div>
          <button className="pr-chat-close" type="button" onClick={onClose} aria-label="Close assistant">
            <X size={19} />
          </button>
        </header>

        <div className="pr-chat-thread" role="log" aria-live="polite" aria-relevant="additions text">
          {messages.map((message) => (
            <div className={`pr-chat-message ${message.role}`} key={message.id}>
              {message.role === "assistant" && <span className="pr-chat-avatar"><Bot size={15} /></span>}
              <div className="pr-chat-message-content">
                {message.insightLabel && (
                  <span className="pr-chat-insight-label"><Sparkles size={11} /> {message.insightLabel}</span>
                )}
                <div className={message.insightLabel ? "pr-chat-insight" : "pr-chat-bubble"}>
                  {message.text}
                </div>
              </div>
            </div>
          ))}

          {(stage === "review" || stage === "done") && (
            <div className="pr-chat-summary">
              <div className="pr-chat-summary-heading">
                <span>REQUEST DRAFT</span>
                <strong>{requestTitle}</strong>
              </div>
              <div className="pr-chat-summary-lines">
                {requestLines.map((line) => (
                  <div className="pr-chat-summary-line" key={line.product.code}>
                    <span>{line.quantity} × {line.product.name}</span>
                    <strong>{currency.format(finishRequestLine(line))}</strong>
                  </div>
                ))}
              </div>
              <div className="pr-chat-summary-total">
                <span>Estimated total</span>
                <strong>{currency.format(total)}</strong>
              </div>
            </div>
          )}
          {finishMessageLog}
        </div>

        <div className="pr-chat-actions">
          {stage === "product" && (
            <div className="pr-chat-product-options" aria-label="Available products">
              {products.map((product) => (
                <button className="pr-chat-product-option" type="button" key={product.code} onClick={() => selectProduct(product)}>
                  <span><Plus size={13} />{product.name}</span>
                  <small>{product.code} · {currency.format(product.unitPrice)} / unit</small>
                </button>
              ))}
            </div>
          )}

          {stage === "quantity" && (
            <div className="pr-chat-quick-replies" aria-label="Suggested quantities">
              {[1, 2, 5, 10].map((quantity) => (
                <button className="pr-chat-quick" type="button" key={quantity} onClick={() => handleQuickAction(String(quantity))}>
                  {quantity}
                </button>
              ))}
            </div>
          )}

          {stage === "more" && (
            <div className="pr-chat-quick-replies">
              <button className="pr-chat-quick" type="button" onClick={() => handleQuickAction("Add another item")}><Plus size={13} /> Add another item</button>
              <button className="pr-chat-quick primary" type="button" onClick={() => handleQuickAction("Review request")}>Review request</button>
            </div>
          )}

          {stage === "review" && (
            <div className="pr-chat-quick-replies">
              <button className="pr-chat-quick" type="button" onClick={() => handleQuickAction("Edit items")}><Plus size={13} /> Edit items</button>
              <button className="pr-chat-quick primary" type="button" onClick={() => handleQuickAction("Finish draft")}><Check size={14} /> Finish draft</button>
            </div>
          )}

          {stage === "done" && (
            <div className="pr-chat-done-actions">
              <p>This is a local preview. No request has been submitted.</p>
              <button className="pr-chat-quick" type="button" onClick={() => handleQuickAction("Start another request")}><RotateCcw size={13} /> Start another request</button>
            </div>
          )}
        </div>

        {canType && (
          <form className="pr-chat-composer" onSubmit={submitInput}>
            <input
              autoFocus
              type={stage === "quantity" ? "number" : "text"}
              min={stage === "quantity" ? 1 : undefined}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={inputPlaceholder}
              aria-label={inputPlaceholder}
            />
            <button type="submit" disabled={!input.trim()} aria-label="Send message">
              <Send size={17} />
            </button>
          </form>
        )}
      </section>
    </div>
  );
}