"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useClickOutside } from "@/hooks/useClickOutside";

interface MultiSelectFilterProps {
  options: { id: string; label: string }[];
  selected: Set<string>;
  onChange: (selected: Set<string>) => void;
  label: string;
  placeholder?: string;
}

export function MultiSelectFilter({
  options,
  selected,
  onChange,
  label,
  placeholder,
}: MultiSelectFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const searchPlaceholder = placeholder ?? `Search ${label}...`;

  // Filter options by search
  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options;
    const searchLower = search.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(searchLower));
  }, [options, search]);

  // Reset highlighted index when search text changes
  useEffect(() => {
    setHighlightedIndex(0);
  }, [search]);

  // Close dropdown on outside click
  const handleClickOutside = useCallback(() => {
    setIsOpen(false);
    setSearch("");
    setHighlightedIndex(0);
  }, []);
  useClickOutside(dropdownRef, handleClickOutside, isOpen);

  // Focus search input when opened
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && listRef.current) {
      const highlightedElement = listRef.current.children[
        highlightedIndex
      ] as HTMLElement;
      if (highlightedElement) {
        highlightedElement.scrollIntoView({ block: "nearest" });
      }
    }
  }, [highlightedIndex, isOpen]);

  const handleToggle = useCallback(
    (id: string) => {
      const next = new Set(selected);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      onChange(next);
    },
    [selected, onChange]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsOpen(false);
      setSearch("");
      setHighlightedIndex(0);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < filteredOptions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === " ") {
      e.preventDefault();
      if (filteredOptions[highlightedIndex]) {
        handleToggle(filteredOptions[highlightedIndex].id);
      }
    }
  };

  const hasSelections = selected.size > 0;

  return (
    <div
      ref={dropdownRef}
      className="relative"
      data-testid="multi-select-filter"
    >
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`
          px-3 py-2 rounded text-[13px] font-medium
          bg-[var(--bg-surface)]
          text-[var(--text-secondary)]
          transition-all duration-200
          flex items-center gap-2
          ${
            hasSelections
              ? "border border-[var(--border-accent)]"
              : "border border-[var(--border-subtle)]"
          }
        `}
      >
        <span>{label}</span>
        {hasSelections ? (
          <span
            className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-[var(--accent-pink)] text-[var(--bg-deep)]"
            data-testid="count-badge"
          >
            {selected.size}
          </span>
        ) : null}
        <svg
          className={`w-3.5 h-3.5 text-[var(--text-muted)] transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Dropdown Panel */}
      {isOpen ? (
        <div
          className="absolute z-50 mt-1 left-0 min-w-full w-[280px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded shadow-xl overflow-hidden animate-fade-up"
          onKeyDown={handleKeyDown}
        >
          {/* Search Input */}
          <div className="p-2 border-b border-[var(--border-subtle)]">
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="
                w-full px-3 py-2 rounded-sm text-sm
                bg-[var(--bg-surface)] border border-[var(--border-subtle)]
                text-[var(--text-primary)] placeholder-[var(--text-muted)]
                focus:border-[var(--border-accent)] focus:outline-none
                transition-all duration-200
              "
            />
          </div>

          {/* Options List */}
          <div ref={listRef} className="max-h-70 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-[13px] text-[var(--text-muted)]">
                No results
              </div>
            ) : (
              filteredOptions.map((option, index) => {
                const isChecked = selected.has(option.id);
                return (
                  <button
                    key={option.id}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleToggle(option.id);
                    }}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={`
                      w-full px-3 py-2 text-left text-[13px]
                      transition-colors flex items-center gap-2.5
                      ${index === highlightedIndex ? "bg-[var(--bg-surface)]" : ""}
                    `}
                  >
                    {/* Checkbox indicator */}
                    <span
                      className={`
                        w-4 h-4 rounded-sm border flex-shrink-0 flex items-center justify-center
                        ${
                          isChecked
                            ? "bg-[var(--accent-pink)] border-[var(--accent-pink)]"
                            : "border-[var(--text-muted)]"
                        }
                      `}
                    >
                      {isChecked ? (
                        <svg
                          className="w-3 h-3 text-[var(--bg-deep)]"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="3"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      ) : null}
                    </span>
                    <span className="text-[var(--text-primary)] truncate">
                      {option.label}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
