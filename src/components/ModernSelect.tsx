import React, { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export interface ModernSelectOption {
  value: string | number;
  label: string;
  icon?: React.ReactNode;
  badge?: string;
  color?: string;
}

export interface ModernSelectProps {
  id?: string;
  placeholder?: string;
  value: string | number;
  options: ModernSelectOption[];
  onChange: (value: string) => void;
  icon?: React.ReactNode;
  disabled?: boolean;
  error?: boolean;
  size?: "sm" | "md";
  placement?: "auto" | "top" | "bottom";
  className?: string;
  title?: string;
  style?: React.CSSProperties;
}

export const ModernSelect: React.FC<ModernSelectProps> = ({
  id,
  placeholder = "Select...",
  value,
  options,
  onChange,
  icon,
  disabled = false,
  error = false,
  size = "md",
  placement = "auto",
  className = "",
  title,
  style,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [effectivePlacement, setEffectivePlacement] = useState<"bottom" | "top">("bottom");
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => String(opt.value) === String(value));

  // Determine placement when opening
  useEffect(() => {
    if (!isOpen || !containerRef.current) return;

    if (placement === "top") {
      setEffectivePlacement("top");
      return;
    }
    if (placement === "bottom") {
      setEffectivePlacement("bottom");
      return;
    }

    // Auto placement: check bounds relative to parent modal body and viewport
    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    const modalBody = container.closest(".admin-modal-body");

    if (modalBody) {
      const bodyRect = modalBody.getBoundingClientRect();
      const spaceBelowInBody = bodyRect.bottom - rect.bottom;
      // If remaining space below in modal body is under 190px, flip to top
      if (spaceBelowInBody < 190) {
        setEffectivePlacement("top");
        return;
      }
    }

    const spaceBelowViewport = window.innerHeight - rect.bottom;
    if (spaceBelowViewport < 210) {
      setEffectivePlacement("top");
      return;
    }

    setEffectivePlacement("bottom");
  }, [isOpen, placement]);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const handleSelect = (optValue: string | number) => {
    onChange(String(optValue));
    setIsOpen(false);
  };

  return (
    <div
      ref={containerRef}
      className={`modern-select-wrap size-${size} ${className}`}
      style={style}
    >
      <button
        id={id}
        type="button"
        className={`modern-select-trigger ${isOpen ? "active" : ""} ${
          error ? "error" : ""
        }`}
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        title={title}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="modern-select-trigger-content">
          {selectedOption?.icon ? (
            <span className="modern-select-trigger-icon">
              {selectedOption.icon}
            </span>
          ) : icon ? (
            <span className="modern-select-trigger-icon">{icon}</span>
          ) : null}

          <span
            className={`modern-select-trigger-label ${
              !selectedOption ? "placeholder" : ""
            }`}
          >
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>

        <ChevronDown
          size={size === "sm" ? 13 : 15}
          className={`modern-select-arrow ${isOpen ? "open" : ""}`}
        />
      </button>

      {isOpen && (
        <div
          className={`modern-select-menu placement-${effectivePlacement}`}
          role="listbox"
        >
          {options.map((opt) => {
            const isSelected = String(opt.value) === String(value);
            return (
              <button
                key={String(opt.value)}
                type="button"
                className={`modern-select-option ${
                  isSelected ? "selected" : ""
                }`}
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(opt.value)}
              >
                <div className="modern-select-option-main">
                  {opt.icon && (
                    <span className="modern-select-option-icon">
                      {opt.icon}
                    </span>
                  )}
                  <span>{opt.label}</span>
                </div>

                {isSelected && (
                  <Check
                    size={size === "sm" ? 12 : 14}
                    className="modern-select-check"
                  />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ModernSelect;
