"use client";

import {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import { useClickOutside } from "@/hooks/useClickOutside";

interface Topic {
  id: string;
  name: string;
  code: string;
}

interface TopicSelectProps {
  topics: Topic[];
  value: string;
  onChange: (topicId: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export interface TopicSelectRef {
  open: () => void;
}

export const TopicSelect = forwardRef<TopicSelectRef, TopicSelectProps>(
  function TopicSelect(
    {
      topics,
      value,
      onChange,
      placeholder = "Select topic...",
      disabled = false,
      className = "",
    },
    ref
  ) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const dropdownRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Expose open() method to parent
    useImperativeHandle(
      ref,
      () => ({
        open: () => {
          if (!disabled) {
            setIsOpen(true);
          }
        },
      }),
      [disabled]
    );

    // Find selected topic
    const selectedTopic = useMemo(
      () => topics.find((t) => t.id === value),
      [topics, value]
    );

    // Filter topics by search
    const filteredTopics = useMemo(() => {
      if (!search.trim()) return topics;
      const searchLower = search.toLowerCase();
      return topics.filter(
        (t) =>
          t.name.toLowerCase().includes(searchLower) ||
          t.code.toLowerCase().includes(searchLower)
      );
    }, [topics, search]);

    // Close dropdown on outside click
    const handleClickOutside = useCallback(() => {
      setIsOpen(false);
      setSearch("");
    }, []);
    useClickOutside(dropdownRef, handleClickOutside, isOpen);

    // Focus search input when opened
    useEffect(() => {
      if (isOpen && searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }, [isOpen]);

    const handleSelect = (topicId: string) => {
      onChange(topicId);
      setIsOpen(false);
      setSearch("");
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        setSearch("");
      }
    };

    return (
      <div ref={dropdownRef} className={`relative ${className}`}>
        {/* Trigger Button */}
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={`
            w-full px-3 py-2 rounded text-left text-sm
            bg-[var(--bg-surface)] border border-[var(--border-subtle)]
            text-[var(--text-primary)]
            focus:border-[var(--border-accent)] focus:ring-[2px] focus:ring-[var(--accent-pink-glow)]
            focus:outline-none transition-all duration-200
            flex items-center justify-between gap-2
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
        >
          <span
            className={`truncate ${selectedTopic ? "" : "text-[var(--text-muted)]"}`}
          >
            {selectedTopic
              ? `${selectedTopic.code} — ${selectedTopic.name}`
              : placeholder}
          </span>
          <svg
            className={`w-4 h-4 flex-shrink-0 text-[var(--text-muted)] transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
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
        {isOpen && (
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
                placeholder="Search topics..."
                className="
                  w-full px-3 py-2 rounded-sm text-sm
                  bg-[var(--bg-surface)] border border-[var(--border-subtle)]
                  text-[var(--text-primary)] placeholder-[var(--text-muted)]
                  focus:border-[var(--border-accent)] focus:outline-none
                  transition-all duration-200
                "
              />
            </div>

            {/* Topic List */}
            <div className="max-h-56 overflow-y-auto">
              {filteredTopics.length === 0 ? (
                <div className="px-3 py-2 text-[13px] text-[var(--text-muted)]">
                  No topics found
                </div>
              ) : (
                filteredTopics.map((topic) => (
                  <button
                    key={topic.id}
                    type="button"
                    onClick={() => handleSelect(topic.id)}
                    className={`
                      w-full px-3 py-2 text-left text-sm
                      hover:bg-[var(--bg-surface)] transition-colors
                      flex items-center gap-2
                      ${value === topic.id ? "bg-[var(--bg-surface)]" : ""}
                    `}
                  >
                    <span className="text-[var(--accent-pink)] font-mono text-xs">
                      {topic.code}
                    </span>
                    <span className="text-[var(--text-primary)] truncate">
                      {topic.name}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    );
  }
);
