"use client";

import { useState, useRef, useEffect, useMemo } from "react";

interface Client {
  id: string;
  name: string;
  timesheetCode: string;
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
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Find selected client
  const selectedClient = useMemo(
    () => clients.find((c) => c.id === value),
    [clients, value]
  );

  // Filter clients by search
  const filteredClients = useMemo(() => {
    if (!search.trim()) return clients;
    const searchLower = search.toLowerCase();
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(searchLower) ||
        c.timesheetCode.toLowerCase().includes(searchLower)
    );
  }, [clients, search]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Focus search input when opened
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const handleSelect = (clientId: string) => {
    onChange(clientId);
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
        <span className={`truncate ${selectedClient ? "" : "text-[var(--text-muted)]"}`}>
          {selectedClient
            ? `${selectedClient.timesheetCode} — ${selectedClient.name}`
            : placeholder}
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
                w-full px-3 py-2 rounded-sm text-sm
                bg-[var(--bg-surface)] border border-[var(--border-subtle)]
                text-[var(--text-primary)] placeholder-[var(--text-muted)]
                focus:border-[var(--border-accent)] focus:outline-none
                transition-all duration-200
              "
            />
          </div>

          {/* Client List */}
          <div className="max-h-56 overflow-y-auto">
            {filteredClients.length === 0 ? (
              <div className="px-3 py-2 text-[13px] text-[var(--text-muted)]">
                No clients found
              </div>
            ) : (
              filteredClients.map((client) => (
                <button
                  key={client.id}
                  type="button"
                  onClick={() => handleSelect(client.id)}
                  className={`
                    w-full px-3 py-2 text-left text-sm
                    hover:bg-[var(--bg-surface)] transition-colors
                    flex items-center gap-2
                    ${value === client.id ? "bg-[var(--bg-surface)]" : ""}
                  `}
                >
                  <span className="text-[var(--accent-pink)] font-mono text-xs">
                    {client.timesheetCode}
                  </span>
                  <span className="text-[var(--text-primary)] truncate">{client.name}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
