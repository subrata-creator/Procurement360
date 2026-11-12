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

function loadSavedPosition(): Position | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Position>;
    if (typeof parsed?.x === "number" && Number.isFinite(parsed.x) && typeof parsed?.y === "number" && Number.isFinite(parsed.y)) {
      return clampPosition(parsed.x, parsed.y, DEFAULT_BUTTON_SIZE, DEFAULT_BUTTON_SIZE);
    }
  } catch {
    // Ignore storage read errors and fall back to CSS default position.
  }
  return null;
}

interface FloatingCopilotButtonProps {
  isOpen: boolean;
  onOpen: () => void;
}

/**
 * Draggable floating launcher for the PR Assistant Copilot panel.
 * Distinguishes short clicks (opens panel) from pointer drags (repositions within viewport).
 */
export default function FloatingCopilotButton({ isOpen, onOpen }: FloatingCopilotButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState<Position | null>(loadSavedPosition);
  const [isDragging, setIsDragging] = useState(false);

  const didDragRef = useRef(false);

  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => {
        if (!prev) return null;
        const w = buttonRef.current?.offsetWidth || DEFAULT_BUTTON_SIZE;
        const h = buttonRef.current?.offsetHeight || DEFAULT_BUTTON_SIZE;
        return clampPosition(prev.x, prev.y, w, h);
      });
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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
    let lastClamped: Position | null = null;

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
      lastClamped = clamped;
      setPosition(clamped);
    };

    const cleanup = (endEvent: PointerEvent) => {
      if (endEvent.pointerId !== pointerId) return;
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", cleanup);
      window.removeEventListener("pointercancel", cleanup);

      if (moved) {
        setIsDragging(false);
        if (lastClamped) {
          try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lastClamped));
          } catch {
            // Ignore storage write errors.
          }
        }
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
