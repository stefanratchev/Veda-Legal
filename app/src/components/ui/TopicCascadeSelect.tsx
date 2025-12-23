"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import { useClickOutside } from "@/hooks/useClickOutside";
import type { Topic, Subtopic } from "@/types";

interface TopicCascadeSelectProps {
  topics: Topic[];
  value: string; // subtopicId
  onChange: (subtopicId: string, subtopic: Subtopic, topic: Topic) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export interface TopicCascadeSelectRef {
  open: () => void;
}

export const TopicCascadeSelect = forwardRef<
  TopicCascadeSelectRef,
  TopicCascadeSelectProps
>(function TopicCascadeSelect(
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
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Expose open() method to parent
  useImperativeHandle(
    ref,
    () => ({
      open: () => {
        if (!disabled) {
          setIsOpen(true);
          setSelectedTopicId(null);
          setSearch("");
          setHighlightedIndex(0);
        }
      },
    }),
    [disabled]
  );

  // Find selected subtopic and its topic
  const selectedTopic = topics.find((t) =>
    t.subtopics.some((s) => s.id === value)
  );
  const selectedSubtopic = selectedTopic?.subtopics.find((s) => s.id === value);
  const selectedData =
    selectedTopic && selectedSubtopic
      ? { topic: selectedTopic, subtopic: selectedSubtopic }
      : null;

  // Get current topic (when drilling into subtopics)
  const currentTopic = topics.find((t) => t.id === selectedTopicId);

  // Filter items by search
  const searchLower = search.toLowerCase().trim();
  const filteredItems = (() => {
    if (!searchLower) {
      return currentTopic ? currentTopic.subtopics : topics;
    }
    if (currentTopic) {
      return currentTopic.subtopics.filter((s) =>
        s.name.toLowerCase().includes(searchLower)
      );
    }
    return topics.filter((t) => t.name.toLowerCase().includes(searchLower));
  })();

  // Reset highlighted index when filtered list changes or view changes
  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredItems.length, search, selectedTopicId]);

  // Close dropdown on outside click
  const handleClickOutside = useCallback(() => {
    setIsOpen(false);
    setSelectedTopicId(null);
    setSearch("");
    setHighlightedIndex(0);
  }, []);
  useClickOutside(dropdownRef, handleClickOutside, isOpen);

  // Focus search input when opened or view changes
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen, selectedTopicId]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && listRef.current) {
      const highlightedElement = listRef.current.children[highlightedIndex] as HTMLElement;
      if (highlightedElement) {
        highlightedElement.scrollIntoView({ block: "nearest" });
      }
    }
  }, [highlightedIndex, isOpen]);

  const handleTopicClick = (topicId: string) => {
    setSelectedTopicId(topicId);
    setSearch("");
    setHighlightedIndex(0);
  };

  const handleSubtopicClick = (subtopic: Subtopic) => {
    if (!currentTopic) return;
    onChange(subtopic.id, subtopic, currentTopic);
    setIsOpen(false);
    setSelectedTopicId(null);
    setSearch("");
    setHighlightedIndex(0);
  };

  const handleBack = () => {
    setSelectedTopicId(null);
    setSearch("");
    setHighlightedIndex(0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      if (selectedTopicId) {
        handleBack();
      } else {
        setIsOpen(false);
        setSearch("");
        setHighlightedIndex(0);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < filteredItems.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === "ArrowLeft" && selectedTopicId) {
      e.preventDefault();
      handleBack();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredItems.length > 0 && filteredItems[highlightedIndex]) {
        if (currentTopic) {
          // We're in subtopic view - select the subtopic
          handleSubtopicClick(filteredItems[highlightedIndex] as Subtopic);
        } else {
          // We're in topic view - drill into the topic
          handleTopicClick((filteredItems[highlightedIndex] as Topic).id);
        }
      }
    } else if (e.key === "ArrowRight" && !currentTopic) {
      // In topic view, arrow right also drills into topic
      e.preventDefault();
      if (filteredItems.length > 0 && filteredItems[highlightedIndex]) {
        handleTopicClick((filteredItems[highlightedIndex] as Topic).id);
      }
    }
  };

  // Display text for button
  const displayText = selectedData
    ? `${selectedData.topic.name} > ${selectedData.subtopic.name}`
    : placeholder;

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
        title={
          selectedData
            ? `${selectedData.topic.name} > ${selectedData.subtopic.name}`
            : undefined
        }
      >
        <span
          className={`truncate ${selectedData ? "" : "text-[var(--text-muted)]"}`}
        >
          {displayText}
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
          className="absolute z-50 mt-1 left-0 min-w-full w-[320px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded shadow-xl overflow-hidden animate-fade-up"
          onKeyDown={handleKeyDown}
        >
          {/* Header with back button when viewing subtopics */}
          {currentTopic && (
            <div className="px-3 py-2 border-b border-[var(--border-subtle)] flex items-center gap-2">
              <button
                type="button"
                onClick={handleBack}
                className="p-1 rounded hover:bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.5"
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
              <span className="text-sm font-medium text-[var(--text-primary)] truncate">
                {currentTopic.name}
              </span>
            </div>
          )}

          {/* Search Input */}
          <div className="p-2 border-b border-[var(--border-subtle)]">
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                currentTopic ? "Search subtopics..." : "Search topics..."
              }
              className="
                w-full px-3 py-2 rounded-sm text-sm
                bg-[var(--bg-surface)] border border-[var(--border-subtle)]
                text-[var(--text-primary)] placeholder-[var(--text-muted)]
                focus:border-[var(--border-accent)] focus:outline-none
                transition-all duration-200
              "
            />
          </div>

          {/* List */}
          <div ref={listRef} className="max-h-56 overflow-y-auto">
            {filteredItems.length === 0 ? (
              <div className="px-3 py-2 text-[13px] text-[var(--text-muted)]">
                {currentTopic ? "No subtopics found" : "No topics found"}
              </div>
            ) : currentTopic ? (
              // Subtopic list
              (filteredItems as Subtopic[]).map((subtopic, index) => (
                <button
                  key={subtopic.id}
                  type="button"
                  onClick={() => handleSubtopicClick(subtopic)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={`
                    w-full px-3 py-2 text-left text-sm
                    transition-colors
                    flex items-center gap-2
                    ${index === highlightedIndex ? "bg-[var(--bg-surface)]" : ""}
                    ${value === subtopic.id ? "text-[var(--accent-pink)]" : ""}
                  `}
                >
                  <span className="text-[var(--text-primary)]">
                    {subtopic.name}
                  </span>
                  {subtopic.isPrefix && (
                    <span className="text-[10px] text-[var(--text-muted)] bg-[var(--bg-surface)] px-1.5 py-0.5 rounded">
                      +details
                    </span>
                  )}
                </button>
              ))
            ) : (
              // Topic list
              (filteredItems as Topic[]).map((topic, index) => (
                <button
                  key={topic.id}
                  type="button"
                  onClick={() => handleTopicClick(topic.id)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={`
                    w-full px-3 py-2 text-left text-sm
                    transition-colors
                    flex items-center justify-between
                    ${index === highlightedIndex ? "bg-[var(--bg-surface)]" : ""}
                  `}
                >
                  <span className="text-[var(--text-primary)]">
                    {topic.name}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-[var(--text-muted)]">
                      {topic.subtopics.length}
                    </span>
                    <svg
                      className="w-4 h-4 text-[var(--text-muted)]"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.5"
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
});
