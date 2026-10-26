import { useEffect, useRef, useState } from "react";
import { Bot, ExternalLink, RotateCcw, X } from "lucide-react";
import "../Styles/CreatePRModal.css";

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
  onClose: () => void;
  /** Kept so existing callers (<CreatePRModal onCreate=... />) still compile. */
  onCreate?: () => void;
};

export default function CreatePRModal({ onClose }: Props) {
  const dialogRef = useRef<HTMLElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [slow, setSlow] = useState(false);
  const [session, setSession] = useState(0); // bump to start a fresh conversation

  // (re)start the "taking too long" timer for every new frame
  useEffect(() => {
    setLoaded(false);
    setSlow(false);
    const timer = window.setTimeout(() => setSlow(true), SLOW_LOAD_MS);
    return () => window.clearTimeout(timer);
  }, [session]);

  // Esc closes, page behind does not scroll
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="pr-chat-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        tabIndex={-1}
        className="pr-chat-window"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pr-chat-title"
      >
        <header className="pr-chat-header">
          <div className="pr-chat-brand-icon">
            <Bot size={22} />
          </div>

          <div className="pr-chat-heading">
            <span className="pr-chat-eyebrow">Create Purchase Request</span>
            <h2 id="pr-chat-title">PR Assistant</h2>
            <span className="pr-chat-status">
              <span className="pr-chat-status-dot" />
              Copilot Studio
            </span>
          </div>

          <div className="pr-chat-header-actions">
            <a
              className="pr-chat-icon-button"
              href={COPILOT_WEBCHAT_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open assistant in a new tab"
              title="Open in new tab"
            >
              <ExternalLink size={16} />
            </a>
            <button
              className="pr-chat-icon-button"
              type="button"
              onClick={() => setSession((current) => current + 1)}
              aria-label="Start a new conversation"
              title="New conversation"
            >
              <RotateCcw size={16} />
            </button>
            <button className="pr-chat-icon-button" type="button" onClick={onClose} aria-label="Close assistant" title="Close">
              <X size={20} />
            </button>
          </div>
        </header>

        <div className="pr-chat-frame-wrap">
          {!loaded && (
            <div className="pr-chat-loading" role="status" aria-live="polite">
              <span className="pr-chat-spinner" aria-hidden="true" />
              <p>Connecting to PR Assistant…</p>
              {slow && (
                <p className="pr-chat-slow">
                  Taking longer than usual. If this stays blank,{" "}
                  <a href={COPILOT_WEBCHAT_URL} target="_blank" rel="noopener noreferrer">
                    open the assistant in a new tab
                  </a>{" "}
                  and check the browser console (F12) for a blocked-frame message.
                </p>
              )}
            </div>
          )}

          <iframe
            key={session}
            className="pr-chat-frame"
            src={COPILOT_WEBCHAT_URL}
            title="PR Assistant"
            frameBorder="0"
            onLoad={() => setLoaded(true)}
          />
        </div>
      </section>
    </div>
  );
}