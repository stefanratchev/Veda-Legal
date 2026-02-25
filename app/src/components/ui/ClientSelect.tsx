"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useClickOutside } from "@/hooks/useClickOutside";

type ClientType = "REGULAR" | "INTERNAL" | "MANAGEMENT";

interface Client {
  id: string;
  name: string;
  clientType?: ClientType;
}

interface ClientSelectProps {
  clients: Client[];
  value: string;
  onChange: (clientId: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function ClientSelect({
  clients,
  value,
  onChange,
  placeholder = "Select client...",
  disabled = false,
  className = "",
}: ClientSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Find selected client
  const selectedClient = useMemo(
    () => clients.find((c) => c.id === value),
    [clients, value]
  );

  // Filter clients by search
  const filteredClients = useMemo(() => {
    if (!search.trim()) return clients;
    const searchLower = search.toLowerCase();
    return clients.filter((c) => c.name.toLowerCase().includes(searchLower));
  }, [clients, search]);

  // Reset highlighted index when filtered list changes
  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredClients.length, search]);

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
      const highlightedElement = listRef.current.children[highlightedIndex] as HTMLElement;
      if (highlightedElement) {
        highlightedElement.scrollIntoView({ block: "nearest" });
      }
    }
  }, [highlightedIndex, isOpen]);

  const handleSelect = (clientId: string) => {
    onChange(clientId);
    setIsOpen(false);
    setSearch("");
    setHighlightedIndex(0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsOpen(false);
      setSearch("");
      setHighlightedIndex(0);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < filteredClients.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredClients.length > 0 && filteredClients[highlightedIndex]) {
        handleSelect(filteredClients[highlightedIndex].id);
      }
    }
  };

  return (
    <div ref={dropdownRef} className={`relative ${className}`} data-testid="client-select">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          w-full px-3 py-2.5 min-h-[44px] rounded text-left text-sm
          bg-[var(--bg-surface)] border border-[var(--border-subtle)]
          text-[var(--text-primary)]
          focus:border-[var(--border-accent)] focus:ring-[2px] focus:ring-[var(--accent-pink-glow)]
          focus:outline-none transition-all duration-200
          flex items-center justify-between gap-2
          disabled:opacity-50 disabled:cursor-not-allowed
        `}
      >
        <span className={`truncate ${selectedClient ? "" : "text-[var(--text-muted)]"}`}>
          {selectedClient ? selectedClient.name : placeholder}
        </span>
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
          className="absolute z-50 mt-1 left-0 min-w-full w-[320px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded shadow-xl overflow-hidden animate-fade-up"
          onKeyDown={handleKeyDown}
        >
          {/* Search Input */}
          <div className="p-2 border-b border-[var(--border-subtle)]">
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search clients..."
              className="
                w-full px-3 py-2.5 min-h-[44px] rounded-sm text-sm
                bg-[var(--bg-surface)] border border-[var(--border-subtle)]
                text-[var(--text-primary)] placeholder-[var(--text-muted)]
                focus:border-[var(--border-accent)] focus:outline-none
                transition-all duration-200
              "
            />
          </div>

          {/* Client List */}
          <div ref={listRef} className="max-h-56 overflow-y-auto">
            {filteredClients.length === 0 ? (
              <div className="px-3 py-2 text-[13px] text-[var(--text-muted)]">
                No clients found
              </div>
            ) : (
              filteredClients.map((client, index) => (
                <button
                  key={client.id}
                  type="button"
                  onClick={() => handleSelect(client.id)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={`
                    w-full px-3 py-2.5 min-h-[44px] text-left text-sm
                    transition-colors flex items-center justify-between gap-2
                    ${index === highlightedIndex ? "bg-[var(--bg-surface)]" : ""}
                    ${value === client.id ? "text-[var(--accent-pink)]" : ""}
                  `}
                >
                  <span className="text-[var(--text-primary)] truncate">{client.name}</span>
                  {client.clientType && client.clientType !== "REGULAR" && (
                    <span className={`
                      px-1.5 py-0.5 text-[10px] font-medium rounded flex-shrink-0
                      ${client.clientType === "INTERNAL"
                        ? "bg-[var(--info-bg)] text-[var(--info)]"
                        : "bg-[var(--warning-bg)] text-[var(--warning)]"}
                    `}>
                      {client.clientType === "INTERNAL" ? "Internal" : "Mgmt"}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
