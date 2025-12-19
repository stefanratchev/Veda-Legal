"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { ClientSelect } from "@/components/ui/ClientSelect";
import { DurationPicker, DurationPickerRef } from "@/components/ui/DurationPicker";

interface Client {
  id: string;
  name: string;
  timesheetCode: string;
}

interface TimeEntry {
  id: string;
  date: string;
  hours: number;
  description: string;
  clientId: string;
  client: {
    id: string;
    name: string;
    timesheetCode: string;
  };
}

interface TimesheetsContentProps {
  userId: string;
  clients: Client[];
}

interface FormData {
  clientId: string;
  hours: number;
  minutes: number;
  description: string;
}

const initialFormData: FormData = {
  clientId: "",
  hours: 1,
  minutes: 0,
  description: "",
};

// Format date for display
function formatDateLong(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// Format date as YYYY-MM-DD
function formatDateISO(date: Date): string {
  return date.toISOString().split("T")[0];
}

// Format hours for display
function formatHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `${h}h`;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

// Get week days centered around a date
function getWeekDays(centerDate: Date): Date[] {
  const days: Date[] = [];
  const dayOfWeek = (centerDate.getDay() + 6) % 7; // Monday = 0
  const monday = new Date(centerDate);
  monday.setDate(centerDate.getDate() - dayOfWeek);

  for (let i = 0; i < 7; i++) {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    days.push(day);
  }
  return days;
}

// Get short day name
function getDayName(date: Date): string {
  return date.toLocaleDateString("en-GB", { weekday: "short" });
}

// Get month name
function getMonthName(date: Date): string {
  return date.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

export function TimesheetsContent({ userId, clients }: TimesheetsContentProps) {
  const today = useMemo(() => new Date(), []);
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [datesWithEntries, setDatesWithEntries] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingEntries, setIsLoadingEntries] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<FormData>(initialFormData);
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const monthPickerRef = useRef<HTMLDivElement>(null);
  const durationPickerRef = useRef<DurationPickerRef>(null);

  // Week days for the strip
  const weekDays = useMemo(() => getWeekDays(selectedDate), [selectedDate]);

  // Fetch entries for selected date
  const fetchEntries = useCallback(async (date: Date) => {
    setIsLoadingEntries(true);
    try {
      const response = await fetch(`/api/timesheets?date=${formatDateISO(date)}`);
      if (response.ok) {
        const data = await response.json();
        setEntries(data);
      }
    } catch (err) {
      console.error("Failed to fetch entries:", err);
    } finally {
      setIsLoadingEntries(false);
    }
  }, []);

  // Fetch dates with entries for visible week range
  const fetchDatesWithEntries = useCallback(async (centerDate: Date) => {
    // Fetch a broader range to cover navigation
    const startDate = new Date(centerDate);
    startDate.setDate(startDate.getDate() - 30);
    const endDate = new Date(centerDate);
    endDate.setDate(endDate.getDate() + 30);

    try {
      const year = centerDate.getFullYear();
      const month = centerDate.getMonth() + 1;
      const response = await fetch(`/api/timesheets/dates?year=${year}&month=${month}`);
      if (response.ok) {
        const dates: string[] = await response.json();
        setDatesWithEntries(new Set(dates));
      }
    } catch (err) {
      console.error("Failed to fetch dates:", err);
    }
  }, []);

  // Fetch on date change
  useEffect(() => {
    fetchEntries(selectedDate);
  }, [selectedDate, fetchEntries]);

  // Fetch dots when month changes
  useEffect(() => {
    fetchDatesWithEntries(selectedDate);
  }, [selectedDate, fetchDatesWithEntries]);

  // Close month picker on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (monthPickerRef.current && !monthPickerRef.current.contains(event.target as Node)) {
        setIsMonthPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Calculate daily total
  const dailyTotal = useMemo(() => {
    return entries.reduce((sum, entry) => sum + entry.hours, 0);
  }, [entries]);

  // Date helpers
  const isToday = (date: Date): boolean => {
    return formatDateISO(date) === formatDateISO(today);
  };

  const isSelected = (date: Date): boolean => {
    return formatDateISO(date) === formatDateISO(selectedDate);
  };

  const isFuture = (date: Date): boolean => {
    const todayStr = formatDateISO(today);
    const dateStr = formatDateISO(date);
    return dateStr > todayStr;
  };

  const hasEntries = (date: Date): boolean => {
    return datesWithEntries.has(formatDateISO(date));
  };

  // Navigation
  const goToPrevWeek = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 7);
    setSelectedDate(newDate);
  };

  const goToNextWeek = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 7);
    // Don't go into future
    if (formatDateISO(newDate) <= formatDateISO(today)) {
      setSelectedDate(newDate);
    }
  };

  const goToToday = () => {
    setSelectedDate(today);
  };

  // Quick month jump
  const jumpToMonth = (monthsAgo: number) => {
    const newDate = new Date(today);
    newDate.setMonth(newDate.getMonth() - monthsAgo);
    newDate.setDate(1);
    setSelectedDate(newDate);
    setIsMonthPickerOpen(false);
  };

  // Form submission
  const handleSubmit = async () => {
    if (!formData.clientId || formData.description.trim().length < 10) return;
    if (formData.hours === 0 && formData.minutes === 0) return;

    setIsLoading(true);
    setError(null);

    const totalHours = formData.hours + formData.minutes / 60;

    try {
      const response = await fetch("/api/timesheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: formatDateISO(selectedDate),
          clientId: formData.clientId,
          hours: totalHours,
          description: formData.description.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to create entry");
        return;
      }

      setEntries((prev) => [data, ...prev]);
      setDatesWithEntries((prev) => new Set([...prev, formatDateISO(selectedDate)]));
      // Keep client selected, only reset duration and description
      setFormData((prev) => ({
        ...initialFormData,
        clientId: prev.clientId,
      }));
    } catch {
      setError("Failed to create entry");
    } finally {
      setIsLoading(false);
    }
  };

  // Start editing
  const startEdit = (entry: TimeEntry) => {
    const h = Math.floor(entry.hours);
    const m = Math.round((entry.hours - h) * 60);
    const roundedMinutes = Math.round(m / 15) * 15;
    setEditFormData({
      clientId: entry.clientId,
      hours: h,
      minutes: roundedMinutes >= 60 ? 0 : roundedMinutes,
      description: entry.description,
    });
    setEditingId(entry.id);
  };

  // Cancel editing
  const cancelEdit = () => {
    setEditingId(null);
    setEditFormData(initialFormData);
  };

  // Save edit
  const saveEdit = async (entryId: string) => {
    if (editFormData.description.trim().length < 10) return;
    if (editFormData.hours === 0 && editFormData.minutes === 0) return;

    setIsLoading(true);
    setError(null);

    const totalHours = editFormData.hours + editFormData.minutes / 60;

    try {
      const response = await fetch("/api/timesheets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: entryId,
          clientId: editFormData.clientId,
          hours: totalHours,
          description: editFormData.description.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to update entry");
        return;
      }

      setEntries((prev) => prev.map((e) => (e.id === entryId ? data : e)));
      setEditingId(null);
    } catch {
      setError("Failed to update entry");
    } finally {
      setIsLoading(false);
    }
  };

  // Delete entry
  const deleteEntry = async (entryId: string) => {
    if (!confirm("Delete this entry?")) return;

    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/timesheets?id=${entryId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setEntries((prev) => prev.filter((e) => e.id !== entryId));
        fetchDatesWithEntries(selectedDate);
      }
    } catch {
      setError("Failed to delete entry");
    } finally {
      setIsLoading(false);
    }
  };

  // Edit stepper handlers
  const editIncrementHours = () => {
    setEditFormData((prev) => ({ ...prev, hours: Math.min(12, prev.hours + 1) }));
  };

  const editDecrementHours = () => {
    setEditFormData((prev) => ({ ...prev, hours: Math.max(0, prev.hours - 1) }));
  };

  const editIncrementMinutes = () => {
    setEditFormData((prev) => {
      const newMinutes = prev.minutes === 45 ? 0 : prev.minutes + 15;
      return { ...prev, minutes: newMinutes };
    });
  };

  const editDecrementMinutes = () => {
    setEditFormData((prev) => {
      const newMinutes = prev.minutes === 0 ? 45 : prev.minutes - 15;
      return { ...prev, minutes: newMinutes };
    });
  };

  const canSubmit =
    formData.clientId &&
    formData.description.trim().length >= 10 &&
    (formData.hours > 0 || formData.minutes > 0);

  // Generate recent months for picker
  const recentMonths = useMemo(() => {
    const months = [];
    for (let i = 0; i < 6; i++) {
      const date = new Date(today);
      date.setMonth(date.getMonth() - i);
      months.push({
        label: date.toLocaleDateString("en-GB", { month: "long", year: "numeric" }),
        monthsAgo: i,
      });
    }
    return months;
  }, [today]);

  return (
    <div className="space-y-4">
      {/* Page Title */}
      <div>
        <h1 className="font-heading text-2xl font-semibold text-[var(--text-primary)]">
          Timesheets
        </h1>
        <p className="text-[var(--text-muted)] text-[13px] mt-0.5">Track your billable hours</p>
      </div>

      {/* Week Strip */}
      <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded p-3">
        <div className="flex items-center gap-3">
          {/* Prev Week */}
          <button
            onClick={goToPrevWeek}
            className="p-1.5 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-all duration-200"
            title="Previous week"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Days */}
          <div className="flex-1 flex items-center gap-2">
            {weekDays.map((day) => {
              const disabled = isFuture(day);
              const selected = isSelected(day);
              const todayDay = isToday(day);
              const hasEntry = hasEntries(day);

              return (
                <button
                  key={formatDateISO(day)}
                  disabled={disabled}
                  onClick={() => !disabled && setSelectedDate(day)}
                  className={`
                    relative flex flex-col items-center gap-0.5 px-3 py-2 rounded
                    transition-all duration-200 flex-1
                    ${disabled ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}
                    ${selected
                      ? "bg-[var(--accent-pink)] text-[var(--bg-deep)] shadow-lg shadow-[var(--accent-pink-glow)]"
                      : "hover:bg-[var(--bg-surface)]"
                    }
                    ${todayDay && !selected ? "ring-1 ring-[var(--accent-pink)] ring-offset-1 ring-offset-[var(--bg-elevated)]" : ""}
                  `}
                >
                  <span className={`text-[10px] font-medium uppercase tracking-wider ${selected ? "text-[var(--bg-deep)]/70" : "text-[var(--text-muted)]"}`}>
                    {getDayName(day)}
                  </span>
                  <span className={`text-base font-heading font-semibold ${selected ? "text-[var(--bg-deep)]" : "text-[var(--text-primary)]"}`}>
                    {day.getDate()}
                  </span>
                  {/* Entry indicator dot */}
                  {hasEntry && (
                    <span className={`absolute bottom-0.5 w-1 h-1 rounded-full ${selected ? "bg-[var(--bg-deep)]" : "bg-[var(--accent-pink)]"}`} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Next Week */}
          <button
            onClick={goToNextWeek}
            disabled={formatDateISO(weekDays[6]) >= formatDateISO(today)}
            className="p-1.5 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Next week"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Divider */}
          <div className="w-px h-8 bg-[var(--border-subtle)]" />

          {/* Month Picker & Today */}
          <div className="flex items-center gap-2">
            <div className="relative" ref={monthPickerRef}>
              <button
                onClick={() => setIsMonthPickerOpen(!isMonthPickerOpen)}
                className="px-2.5 py-1.5 rounded text-[13px] font-medium text-[var(--text-secondary)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-accent)] hover:text-[var(--text-primary)] transition-all duration-200 flex items-center gap-1.5"
              >
                <span>{getMonthName(selectedDate)}</span>
                <svg className={`w-3.5 h-3.5 transition-transform duration-200 ${isMonthPickerOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isMonthPickerOpen && (
                <div className="absolute right-0 top-full mt-1 z-50 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded shadow-xl overflow-hidden animate-fade-up min-w-[160px]">
                  {recentMonths.map((month) => (
                    <button
                      key={month.monthsAgo}
                      onClick={() => jumpToMonth(month.monthsAgo)}
                      className="w-full px-3 py-2 text-left text-[13px] text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] transition-colors"
                    >
                      {month.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={goToToday}
              className="px-2.5 py-1.5 rounded text-[13px] font-medium text-[var(--accent-pink)] bg-[var(--accent-pink-glow)] border border-[var(--border-accent)] hover:bg-[var(--accent-pink)] hover:text-[var(--bg-deep)] transition-all duration-200"
            >
              Today
            </button>
          </div>
        </div>
      </div>

      {/* Entry Form - Single Row */}
      <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded p-4">
        <div className="flex items-center gap-3">
          {/* Client Selector */}
          <ClientSelect
            clients={clients}
            value={formData.clientId}
            onChange={(clientId) => {
              setFormData((prev) => ({ ...prev, clientId }));
              // Auto-open duration picker after client selection
              setTimeout(() => durationPickerRef.current?.open(), 0);
            }}
            placeholder="Select client..."
            className="w-[220px] flex-shrink-0"
          />

          {/* Duration Picker */}
          <DurationPicker
            ref={durationPickerRef}
            hours={formData.hours}
            minutes={formData.minutes}
            onChange={(hours, minutes) => setFormData((prev) => ({ ...prev, hours, minutes }))}
            className="w-[120px] flex-shrink-0"
          />

          {/* Description */}
          <input
            type="text"
            value={formData.description}
            onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="What did you work on? (min 10 chars)"
            className="
              flex-1 min-w-[200px] px-3 py-2 rounded text-sm
              bg-[var(--bg-surface)] border border-[var(--border-subtle)]
              text-[var(--text-primary)] placeholder-[var(--text-muted)]
              focus:border-[var(--border-accent)] focus:ring-[2px] focus:ring-[var(--accent-pink-glow)]
              focus:outline-none transition-all duration-200
            "
          />

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || isLoading}
            className="
              px-4 py-2 rounded flex-shrink-0
              bg-[var(--accent-pink)] text-[var(--bg-deep)]
              font-semibold text-sm
              hover:bg-[var(--accent-pink-dim)]
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-all duration-200
              shadow-lg shadow-[var(--accent-pink-glow)]
            "
          >
            {isLoading ? "..." : "Log"}
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mt-2 px-3 py-2 rounded bg-[var(--danger-bg)] text-[var(--danger)] text-[13px]">
            {error}
          </div>
        )}
      </div>

      {/* Entries List */}
      <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border-subtle)]">
          <h3 className="font-medium text-sm text-[var(--text-primary)]">
            {isToday(selectedDate) ? "Today's Entries" : "Entries"}
          </h3>
        </div>

        {isLoadingEntries ? (
          <div className="flex items-center justify-center py-8">
            <svg className="w-6 h-6 animate-spin text-[var(--accent-pink)]" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-10 h-10 rounded bg-[var(--bg-surface)] flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-[var(--text-secondary)] text-sm">No entries for this date</p>
            <p className="text-[13px] text-[var(--text-muted)] mt-0.5">Use the form above to log your time</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-subtle)]">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="p-4 hover:bg-[var(--bg-hover)] transition-colors"
              >
                {editingId === entry.id ? (
                  /* Edit Mode */
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1">
                        Client
                      </label>
                      <select
                        value={editFormData.clientId}
                        onChange={(e) => setEditFormData((prev) => ({ ...prev, clientId: e.target.value }))}
                        className="
                          w-full px-4 py-2.5 rounded
                          bg-[var(--bg-surface)] border border-[var(--border-subtle)]
                          text-[var(--text-primary)]
                          focus:border-[var(--border-accent)] focus:ring-[3px] focus:ring-[var(--accent-pink-glow)]
                          focus:outline-none transition-all duration-200
                        "
                      >
                        {clients.map((client) => (
                          <option key={client.id} value={client.id}>
                            {client.timesheetCode} - {client.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1">
                        Duration
                      </label>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={editDecrementHours}
                            disabled={editFormData.hours === 0}
                            className="w-8 h-8 rounded-sm bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-accent)] disabled:opacity-40 transition-all flex items-center justify-center"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4" />
                            </svg>
                          </button>
                          <span className="w-12 text-center text-lg font-heading font-semibold text-[var(--text-primary)]">
                            {editFormData.hours}h
                          </span>
                          <button
                            type="button"
                            onClick={editIncrementHours}
                            disabled={editFormData.hours === 12}
                            className="w-8 h-8 rounded-sm bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-accent)] disabled:opacity-40 transition-all flex items-center justify-center"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                            </svg>
                          </button>
                        </div>
                        <span className="text-[var(--text-muted)]">:</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={editDecrementMinutes}
                            className="w-8 h-8 rounded-sm bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-accent)] transition-all flex items-center justify-center"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4" />
                            </svg>
                          </button>
                          <span className="w-12 text-center text-lg font-heading font-semibold text-[var(--text-primary)]">
                            {editFormData.minutes.toString().padStart(2, "0")}m
                          </span>
                          <button
                            type="button"
                            onClick={editIncrementMinutes}
                            className="w-8 h-8 rounded-sm bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-accent)] transition-all flex items-center justify-center"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1">
                        Description
                      </label>
                      <textarea
                        value={editFormData.description}
                        onChange={(e) => setEditFormData((prev) => ({ ...prev, description: e.target.value }))}
                        rows={2}
                        className="
                          w-full px-4 py-2.5 rounded
                          bg-[var(--bg-surface)] border border-[var(--border-subtle)]
                          text-[var(--text-primary)]
                          focus:border-[var(--border-accent)] focus:ring-[3px] focus:ring-[var(--accent-pink-glow)]
                          focus:outline-none transition-all duration-200
                          resize-none
                        "
                      />
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => saveEdit(entry.id)}
                        disabled={editFormData.description.trim().length < 10 || (editFormData.hours === 0 && editFormData.minutes === 0) || isLoading}
                        className="px-4 py-2 rounded bg-[var(--accent-pink)] text-[var(--bg-deep)] text-sm font-medium hover:bg-[var(--accent-pink-dim)] disabled:opacity-50 transition-colors"
                      >
                        Save
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="px-4 py-2 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)] text-sm font-medium hover:border-[var(--border-accent)] hover:text-[var(--text-primary)] transition-all"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  /* View Mode */
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[var(--accent-pink)] font-mono text-[11px] bg-[var(--accent-pink-glow)] px-1.5 py-0.5 rounded">
                          {entry.client.timesheetCode}
                        </span>
                        <span className="font-medium text-sm text-[var(--text-primary)]">
                          {entry.client.name}
                        </span>
                        <span className="text-[13px] text-[var(--text-muted)]">
                          {formatHours(entry.hours)}
                        </span>
                      </div>
                      <p className="text-[var(--text-secondary)] text-[13px]">
                        {entry.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => startEdit(entry)}
                        className="p-1.5 rounded-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors"
                        title="Edit entry"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => deleteEntry(entry.id)}
                        className="p-1.5 rounded-sm text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--danger-bg)] transition-colors"
                        title="Delete entry"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Daily Total Footer */}
            {entries.length > 0 && (
              <div className="px-4 py-3 bg-[var(--bg-surface)]">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-medium text-[var(--text-secondary)]">Daily Total</span>
                  <span className="text-base font-heading font-semibold text-[var(--accent-pink)]">
                    {formatHours(dailyTotal)}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
