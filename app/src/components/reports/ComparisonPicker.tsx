"use client";

import { useState, useRef } from "react";
import { useClickOutside } from "@/hooks/useClickOutside";

export type ComparisonType = "previous-period" | "previous-year";

interface ComparisonPickerProps {
  value: ComparisonType;
  onChange: (value: ComparisonType) => void;
}

export function ComparisonPicker({ value, onChange }: ComparisonPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useClickOutside(dropdownRef, () => setIsOpen(false), isOpen);

  const labels: Record<ComparisonType, string> = {
    "previous-period": "Previous Period",
    "previous-year": "Previous Year",
  };

  const handleSelect = (type: ComparisonType) => {
    onChange(type);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="flex items-center gap-2">
        <span className="text-[13px] text-[var(--text-muted)]">vs</span>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="
            flex items-center gap-2 px-3 py-1.5 rounded
            bg-[var(--bg-surface)] border border-[var(--border-subtle)]
            text-[13px] text-[var(--text-secondary)]
            hover:border-[var(--border-accent)] hover:text-[var(--text-primary)]
            transition-all duration-200
          "
        >
          {labels[value]}
          <svg className={`w-3 h-3 transition-transform ${isOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {isOpen && (
        <div className="absolute top-full right-0 mt-1 z-50 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded shadow-lg animate-fade-up">
          <div className="p-2 space-y-1">
            <button
              onClick={() => handleSelect("previous-period")}
              className={`
                w-full text-left px-3 py-1.5 rounded text-[13px] whitespace-nowrap
                ${value === "previous-period"
                  ? "bg-[var(--accent-pink)] text-[var(--bg-deep)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]"
                }
              `}
            >
              Previous Period
            </button>
            <button
              onClick={() => handleSelect("previous-year")}
              className={`
                w-full text-left px-3 py-1.5 rounded text-[13px] whitespace-nowrap
                ${value === "previous-year"
                  ? "bg-[var(--accent-pink)] text-[var(--bg-deep)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]"
                }
              `}
            >
              Previous Year
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
