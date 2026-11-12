import { useEffect, useRef, useState } from "react";
import { Bot, Maximize2, Minimize2, RotateCcw, X } from "lucide-react";
import "../Styles/Copilot.css";

/**
 * Copilot Studio "Embed code" iframe URL.
 * Copy it from:  Copilot Studio -> your agent -> Channels -> (Custom website / Web app) -> Embed code
 * It is the value of  src="..."  inside the snippet.
 *
 * Optional: put it in .env as  VITE_COPILOT_WEBCHAT_URL=...  and it overrides the fallback below.
 */
const COPILOT_WEBCHAT_URL: string =
  import.meta.env.VITE_COPILOT_WEBCHAT_URL ??
  "https://copilotstudio.microsoft.com/environments/d342b729-49aa-ebca-8ede-9a148dc57d52/bots/cr665_Procurement/webchat?__version__=2&enableFileAttachment=false&cliAgent=true";

/** If the frame has not reported "loaded" after this long, show a help message. */
const SLOW_LOAD_MS = 12_000;

type Props = {
  isOpen?: boolean;
  mountFrame?: boolean;
  onClose: () => void;
  /** Kept so existing callers (<CreatePRModal onCreate=... /> or onViewPending) still compile. */
  onCreate?: () => void;
  onViewPending?: () => void;
};

export default function ProcurementCopilot({
  isOpen = true,
  mountFrame = isOpen,
  onClose,
}: Props) {
  const panelRef = useRef<HTMLElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [slow, setSlow] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [session, setSession] = useState(0); // bump to reset/start a fresh conversation

  const shouldRenderFrame = isOpen || mountFrame;

  const handleResetSession = () => {
    setLoaded(false);
    setSlow(false);
    setIsExpanded(false);
    setSession((current) => current + 1);
  };

  // Start slow-load helper timer when the iframe session connects and is not loaded yet
  useEffect(() => {
    if (!shouldRenderFrame || loaded) return;
    const timer = window.setTimeout(() => setSlow(true), SLOW_LOAD_MS);
    return () => window.clearTimeout(timer);
  }, [shouldRenderFrame, session, loaded]);

  // Smoothly return panel to compact launch size after closing finishes
  // while keeping the Copilot Studio iframe live so conversation state is preserved
  useEffect(() => {
    if (isOpen || !isExpanded) return;
    const timer = window.setTimeout(() => setIsExpanded(false), 320);
    return () => window.clearTimeout(timer);
  }, [isOpen, isExpanded]);

  // Detect when user clicks/focuses inside the iframe composer to start typing,
  // smoothly expanding the widget from its compact state to full size
  useEffect(() => {
    if (!isOpen || isExpanded) return;

    const checkIframeFocus = () => {
      if (document.activeElement === iframeRef.current) {
        setIsExpanded(true);
      }
    };

    let rafId = 0;

    const onWindowBlur = () => {
      checkIframeFocus();
      rafId = window.requestAnimationFrame(checkIframeFocus);
    };

    window.addEventListener("blur", onWindowBlur);
    return () => {
      window.removeEventListener("blur", onWindowBlur);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [isOpen, isExpanded]);

  // Esc closes the panel when focus is on the app; background remains scrollable and interactive
  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, onClose]);

  return (
    <aside
      ref={panelRef}
      className={`pr-chat-panel ${isOpen ? "is-open" : "is-closed"}${isExpanded ? " is-expanded" : ""}`}
      role="complementary"
      aria-label="PR Assistant Copilot"
      aria-hidden={!isOpen}
    >
      <header className="pr-chat-header">
        <div className="pr-chat-brand-wrap" aria-hidden="true">
          <span className="pr-chat-brand-orbit" />
          <div className="pr-chat-brand-icon">
            <Bot size={16} strokeWidth={2.2} />
          </div>
        </div>

        <div className="pr-chat-heading">
          <h2>PR Assistant</h2>
          <span className="pr-chat-status">
            <span className="pr-chat-status-dot" />
            Copilot Studio
          </span>
        </div>

        <div className="pr-chat-header-actions">
          <button
            className="pr-chat-icon-button"
            type="button"
            tabIndex={isOpen ? 0 : -1}
            onClick={() => setIsExpanded((prev) => !prev)}
            aria-label={isExpanded ? "Compact window" : "Expand window"}
            title={isExpanded ? "Compact window" : "Expand window"}
          >
            {isExpanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
          <button
            className="pr-chat-icon-button"
            type="button"
            tabIndex={isOpen ? 0 : -1}
            onClick={handleResetSession}
            aria-label="Start new conversation"
            title="Start new conversation"
          >
            <RotateCcw size={15} />
          </button>
          <button
            className="pr-chat-icon-button"
            type="button"
            tabIndex={isOpen ? 0 : -1}
            onClick={onClose}
            aria-label="Close assistant"
            title="Close"
          >
            <X size={17} />
          </button>
        </div>
      </header>

      <div className="pr-chat-frame-wrap">
        {shouldRenderFrame && !loaded && (
          <div className="pr-chat-loading" role="status" aria-live="polite">
            <div className="pr-chat-loading-orb" aria-hidden="true">
              <span className="pr-chat-loading-ring" />
              <span className="pr-chat-loading-core">
                <Bot size={17} strokeWidth={2.2} />
              </span>
            </div>
            <p>Waking up PR Assistant…</p>
            {slow && (
              <p className="pr-chat-slow">
                Taking longer than usual. If this stays blank,{" "}
                <a
                  href={COPILOT_WEBCHAT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  tabIndex={isOpen ? 0 : -1}
                >
                  open in a new tab
                </a>{" "}
                or check your network connection.
              </p>
            )}
          </div>
        )}

        {shouldRenderFrame && (
          <iframe
            ref={iframeRef}
            key={session}
            className="pr-chat-frame"
            src={COPILOT_WEBCHAT_URL}
            title="PR Assistant"
            frameBorder="0"
            tabIndex={isOpen ? 0 : -1}
            onLoad={() => setLoaded(true)}
          />
        )}
      </div>
    </aside>
  );
}

export { ProcurementCopilot as CreatePRChatbotModal };
