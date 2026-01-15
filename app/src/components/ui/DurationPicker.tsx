"use client";

import { useState, useRef, forwardRef, useImperativeHandle, useCallback, useEffect } from "react";
import { useClickOutside } from "@/hooks/useClickOutside";

interface DurationPickerProps {
  hours: number;
  minutes: number;
  onChange: (hours: number, minutes: number) => void;
  disabled?: boolean;
  className?: string;
  align?: "left" | "right";
}

export interface DurationPickerRef {
  open: () => void;
}

export const DurationPicker = forwardRef<DurationPickerRef, DurationPickerProps>(function DurationPicker({
  hours,
  minutes,
  onChange,
  disabled = false,
  className = "",
  align = "left",
}, ref) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<"hours" | "minutes">("hours");
  const [pendingHours, setPendingHours] = useState(hours);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Hour options in grid order (for keyboard navigation)
  // Grid layout: [1,2,3], [4,5,6], [7,8,9], [_,0,_]
  const hourOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];
  const minuteOptions = [0, 15, 30, 45];

  // Expose open() method to parent
  useImperativeHandle(ref, () => ({
    open: () => {
      if (!disabled) {
        setStep("hours");
        setPendingHours(hours);
        setHighlightedIndex(0);
        setIsOpen(true);
      }
    },
  }), [disabled, hours]);

  // Reset highlighted index when step changes
  useEffect(() => {
    setHighlightedIndex(0);
  }, [step]);

  // Close dropdown on outside click
  const handleClickOutside = useCallback(() => {
    setIsOpen(false);
    setStep("hours");
    setHighlightedIndex(0);
  }, []);
  useClickOutside(dropdownRef, handleClickOutside, isOpen);

  // Handle toggle - reset state when opening
  const handleToggle = () => {
    if (disabled) return;
    if (!isOpen) {
      // Opening: reset to hours step and sync pending hours with prop
      setStep("hours");
      setPendingHours(hours);
      setHighlightedIndex(0);
    }
    setIsOpen(!isOpen);
  };

  // Format display text
  const displayText = (() => {
    if (hours === 0 && minutes === 0) return "0h 0m";
    if (minutes === 0) return `${hours}h`;
    if (hours === 0) return `${minutes}m`;
    return `${hours}h ${minutes}m`;
  })();

  const handleSelectHours = (h: number) => {
    setPendingHours(h);
    setStep("minutes");
    setHighlightedIndex(0);
  };

  const handleSelectMinutes = (m: number) => {
    onChange(pendingHours, m);
    setIsOpen(false);
    setStep("hours");
    setHighlightedIndex(0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      if (step === "minutes") {
        setStep("hours");
        setHighlightedIndex(0);
      } else {
        setIsOpen(false);
        setStep("hours");
        setHighlightedIndex(0);
      }
      return;
    }

    if (step === "hours") {
      // Hours grid navigation (3 columns, 4 rows with special handling for row 4)
      // Indices: 0-8 for 1-9, 9 for 0 (centered)
      const currentOptions = hourOptions;
      const cols = 3;

      if (e.key === "ArrowRight") {
        e.preventDefault();
        if (highlightedIndex < 9) {
          // In main grid (0-8)
          if ((highlightedIndex + 1) % cols !== 0) {
            setHighlightedIndex(highlightedIndex + 1);
          }
        }
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (highlightedIndex < 9) {
          if (highlightedIndex % cols !== 0) {
            setHighlightedIndex(highlightedIndex - 1);
          }
        }
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (highlightedIndex < 6) {
          // Rows 0-1 can go down normally
          setHighlightedIndex(highlightedIndex + cols);
        } else if (highlightedIndex >= 6 && highlightedIndex <= 8) {
          // Row 2 (indices 6,7,8) - go to 0
          setHighlightedIndex(9);
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (highlightedIndex === 9) {
          // From 0, go to center of row above (index 7)
          setHighlightedIndex(7);
        } else if (highlightedIndex >= cols) {
          setHighlightedIndex(highlightedIndex - cols);
        }
      } else if (e.key === "Enter") {
        e.preventDefault();
        handleSelectHours(currentOptions[highlightedIndex]);
      }
    } else {
      // Minutes navigation (single row of 4)
      const currentOptions = minuteOptions;

      if (e.key === "ArrowRight") {
        e.preventDefault();
        if (highlightedIndex < currentOptions.length - 1) {
          setHighlightedIndex(highlightedIndex + 1);
        }
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (highlightedIndex > 0) {
          setHighlightedIndex(highlightedIndex - 1);
        }
      } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        // No vertical navigation in minutes, but ArrowUp could go back
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setStep("hours");
          setHighlightedIndex(0);
        }
      } else if (e.key === "Enter") {
        e.preventDefault();
        handleSelectMinutes(currentOptions[highlightedIndex]);
      }
    }
  };

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        className={`
          w-full px-3 py-2.5 min-h-[44px] rounded text-sm font-medium
          bg-[var(--bg-surface)] border border-[var(--border-subtle)]
          text-[var(--text-primary)]
          focus:border-[var(--border-accent)] focus:ring-[2px] focus:ring-[var(--accent-pink-glow)]
          focus:outline-none transition-all duration-200
          flex items-center justify-between gap-2
          disabled:opacity-50 disabled:cursor-not-allowed
        `}
      >
        <span className="font-heading">{displayText}</span>
        <svg
          className={`w-4 h-4 flex-shrink-0 text-[var(--text-muted)] transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          className={`absolute z-50 mt-1 w-[200px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded shadow-xl overflow-hidden animate-fade-up ${align === "right" ? "right-0" : "left-0"}`}
          onKeyDown={handleKeyDown}
          tabIndex={-1}
          ref={(el) => el?.focus()}
        >
          {step === "hours" ? (
            /* Step 1: Select Hours */
            <div className="p-2">
              <div className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider mb-2 px-1">
                Select hours
              </div>
              <div className="grid grid-cols-3 gap-1">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((h, idx) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => handleSelectHours(h)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={`
                      py-2.5 min-h-[44px] rounded text-sm font-medium
                      transition-all duration-150
                      ${idx === highlightedIndex
                        ? "bg-[var(--accent-pink)] text-[var(--bg-deep)]"
                        : h === hours
                        ? "bg-[var(--bg-hover)] text-[var(--accent-pink)]"
                        : "bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                      }
                    `}
                  >
                    {h}
                  </button>
                ))}
                {/* Zero centered below */}
                <div />
                <button
                  type="button"
                  onClick={() => handleSelectHours(0)}
                  onMouseEnter={() => setHighlightedIndex(9)}
                  className={`
                    py-2.5 min-h-[44px] rounded text-sm font-medium
                    transition-all duration-150
                    ${9 === highlightedIndex
                      ? "bg-[var(--accent-pink)] text-[var(--bg-deep)]"
                      : 0 === hours
                      ? "bg-[var(--bg-hover)] text-[var(--accent-pink)]"
                      : "bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                    }
                  `}
                >
                  0
                </button>
                <div />
              </div>
            </div>
          ) : (
            /* Step 2: Select Minutes */
            <div className="p-2">
              <div className="flex items-center gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => setStep("hours")}
                  className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider">
                  {pendingHours}h — Select minutes
                </div>
              </div>
              <div className="grid grid-cols-4 gap-1">
                {minuteOptions.map((m, idx) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => handleSelectMinutes(m)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={`
                      py-2.5 min-h-[44px] rounded text-sm font-medium
                      transition-all duration-150
                      ${idx === highlightedIndex
                        ? "bg-[var(--accent-pink)] text-[var(--bg-deep)]"
                        : m === minutes
                        ? "bg-[var(--bg-hover)] text-[var(--accent-pink)]"
                        : "bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                      }
                    `}
                  >
                    {m.toString().padStart(2, "0")}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});
