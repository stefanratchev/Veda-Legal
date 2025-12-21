"use client";

import { useState, useRef, forwardRef, useImperativeHandle, useCallback } from "react";
import { useClickOutside } from "@/hooks/useClickOutside";

interface DurationPickerProps {
  hours: number;
  minutes: number;
  onChange: (hours: number, minutes: number) => void;
  disabled?: boolean;
  className?: string;
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
}, ref) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<"hours" | "minutes">("hours");
  const [pendingHours, setPendingHours] = useState(hours);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Expose open() method to parent
  useImperativeHandle(ref, () => ({
    open: () => {
      if (!disabled) {
        setStep("hours");
        setPendingHours(hours);
        setIsOpen(true);
      }
    },
  }), [disabled, hours]);

  // Close dropdown on outside click
  const handleClickOutside = useCallback(() => {
    setIsOpen(false);
    setStep("hours");
  }, []);
  useClickOutside(dropdownRef, handleClickOutside, isOpen);

  // Handle toggle - reset state when opening
  const handleToggle = () => {
    if (disabled) return;
    if (!isOpen) {
      // Opening: reset to hours step and sync pending hours with prop
      setStep("hours");
      setPendingHours(hours);
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
  };

  const handleSelectMinutes = (m: number) => {
    onChange(pendingHours, m);
    setIsOpen(false);
    setStep("hours");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsOpen(false);
      setStep("hours");
    }
  };

  const hourOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9]; // Phone keypad layout (0 separate)
  const minuteOptions = [0, 15, 30, 45];

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        className={`
          w-full px-3 py-2 rounded text-sm font-medium
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
          className="absolute z-50 mt-1 left-0 w-[200px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded shadow-xl overflow-hidden animate-fade-up"
          onKeyDown={handleKeyDown}
        >
          {step === "hours" ? (
            /* Step 1: Select Hours */
            <div className="p-2">
              <div className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider mb-2 px-1">
                Select hours
              </div>
              <div className="grid grid-cols-3 gap-1">
                {hourOptions.map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => handleSelectHours(h)}
                    className={`
                      py-2 rounded text-sm font-medium
                      transition-all duration-150
                      ${h === hours
                        ? "bg-[var(--accent-pink)] text-[var(--bg-deep)]"
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
                  className={`
                    py-2 rounded text-sm font-medium
                    transition-all duration-150
                    ${0 === hours
                      ? "bg-[var(--accent-pink)] text-[var(--bg-deep)]"
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
                  className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider">
                  {pendingHours}h — Select minutes
                </div>
              </div>
              <div className="grid grid-cols-3 gap-1">
                {minuteOptions.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => handleSelectMinutes(m)}
                    className={`
                      py-2 rounded text-sm font-medium
                      transition-all duration-150
                      ${m === minutes
                        ? "bg-[var(--accent-pink)] text-[var(--bg-deep)]"
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
