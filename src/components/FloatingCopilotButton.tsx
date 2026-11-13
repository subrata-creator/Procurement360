import React, { useEffect, useRef, useState } from "react";
import { Bot } from "lucide-react";

const STORAGE_KEY = "procurement_copilot_launcher_pos";
const VIEWPORT_MARGIN = 12;
const DEFAULT_BUTTON_SIZE = 54;
const DRAG_THRESHOLD_PX = 5;

interface Position {
  x: number;
  y: number;
}

function clampPosition(x: number, y: number, width: number, height: number): Position {
  if (typeof window === "undefined") return { x, y };
  const maxX = Math.max(VIEWPORT_MARGIN, window.innerWidth - width - VIEWPORT_MARGIN);
  const maxY = Math.max(VIEWPORT_MARGIN, window.innerHeight - height - VIEWPORT_MARGIN);
  return {
    x: Math.min(Math.max(VIEWPORT_MARGIN, x), maxX),
    y: Math.min(Math.max(VIEWPORT_MARGIN, y), maxY),
  };
}

interface FloatingCopilotButtonProps {
  isOpen: boolean;
  onOpen: () => void;
  /** Route or view key; changing it resets the launcher to its default bottom-right anchor. */
  resetKey?: string;
}

/**
 * Draggable floating launcher for the PR Assistant Copilot panel.
 * Defaults to the bottom-right corner (`right: 24px; bottom: 24px`) and resets
 * there on navigation, while remaining freely draggable within the viewport.
 */
export default function FloatingCopilotButton({ isOpen, onOpen, resetKey }: FloatingCopilotButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dragState, setDragState] = useState<{ key: string | undefined; pos: Position | null }>({
    key: resetKey,
    pos: null,
  });
  const [isDragging, setIsDragging] = useState(false);

  const didDragRef = useRef(false);
  const position = dragState.key === resetKey ? dragState.pos : null;

  useEffect(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage cleanup errors.
    }
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setDragState((prev) => {
        if (prev.key !== resetKey || !prev.pos) return prev;
        const w = buttonRef.current?.offsetWidth || DEFAULT_BUTTON_SIZE;
        const h = buttonRef.current?.offsetHeight || DEFAULT_BUTTON_SIZE;
        return { key: resetKey, pos: clampPosition(prev.pos.x, prev.pos.y, w, h) };
      });
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [resetKey]);

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (isOpen) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;

    const btn = buttonRef.current;
    if (!btn) return;

    const rect = btn.getBoundingClientRect();
    const pointerId = event.pointerId;
    const startClientX = event.clientX;
    const startClientY = event.clientY;
    const startX = rect.left;
    const startY = rect.top;
    const width = rect.width || DEFAULT_BUTTON_SIZE;
    const height = rect.height || DEFAULT_BUTTON_SIZE;
    let moved = false;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      const dx = moveEvent.clientX - startClientX;
      const dy = moveEvent.clientY - startClientY;

      if (!moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;

      if (!moved) {
        moved = true;
        didDragRef.current = true;
        setIsDragging(true);
      }

      const clamped = clampPosition(startX + dx, startY + dy, width, height);
      setDragState({ key: resetKey, pos: clamped });
    };

    const cleanup = (endEvent: PointerEvent) => {
      if (endEvent.pointerId !== pointerId) return;
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", cleanup);
      window.removeEventListener("pointercancel", cleanup);

      if (moved) {
        setIsDragging(false);
        window.setTimeout(() => {
          didDragRef.current = false;
        }, 0);
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", cleanup);
    window.addEventListener("pointercancel", cleanup);
  };

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (didDragRef.current) {
      event.preventDefault();
      didDragRef.current = false;
      return;
    }
    onOpen();
  };

  const positionStyle: React.CSSProperties | undefined = position
    ? { left: position.x, top: position.y, right: "auto", bottom: "auto" }
    : undefined;

  return (
    <button
      ref={buttonRef}
      type="button"
      className={`dashboard-chatbot-button global-chatbot-button${isOpen ? " launcher-hidden" : ""}${isDragging ? " is-dragging" : ""}`}
      style={positionStyle}
      aria-label="Open PR Assistant (drag to move)"
      aria-expanded={isOpen}
      aria-hidden={isOpen}
      tabIndex={isOpen ? -1 : 0}
      title="Open PR Assistant (drag to move)"
      onPointerDown={handlePointerDown}
      onClick={handleClick}
    >
      <Bot size={24} strokeWidth={1.9} />
    </button>
  );
}
