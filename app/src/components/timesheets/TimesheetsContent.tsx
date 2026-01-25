"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { formatDateISO, toDecimalHours } from "@/lib/date-utils";
import { WeekStrip } from "./WeekStrip";
import { EntryForm } from "./EntryForm";
import { EntriesList } from "./EntriesList";
import { TeamTimesheets } from "./TeamTimesheets";
import { M365ActivityPanel } from "./M365ActivityPanel";
import type { ClientWithType, Topic, TimeEntry, FormData, TeamSummary, M365ActivityResponse } from "@/types";
import { initialFormData } from "@/types";

interface TimesheetsContentProps {
  clients: ClientWithType[];
  topics: Topic[];
}

export function TimesheetsContent({ clients, topics }: TimesheetsContentProps) {
  const today = useMemo(() => new Date(), []);
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [teamSummaries, setTeamSummaries] = useState<TeamSummary[]>([]);
  const [datesWithEntries, setDatesWithEntries] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingEntries, setIsLoadingEntries] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Submission flow state
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submittedDates, setSubmittedDates] = useState<Set<string>>(new Set());
  const [overdueDates, setOverdueDates] = useState<Set<string>>(new Set());
  const [totalHours, setTotalHours] = useState(0);
  const [showSubmitPrompt, setShowSubmitPrompt] = useState(false);

  // M365 Activity state
  const [isM365PanelOpen, setIsM365PanelOpen] = useState(false);
  const [isM365Loading, setIsM365Loading] = useState(false);
  const [m365Data, setM365Data] = useState<M365ActivityResponse | null>(null);
  const [m365Error, setM365Error] = useState<string | null>(null);

  // Fetch entries for selected date
  const fetchEntries = useCallback(async (date: Date) => {
    setIsLoadingEntries(true);
    try {
      const response = await fetch(`/api/timesheets?date=${formatDateISO(date)}`);
      if (response.ok) {
        const data = await response.json();
        // Handle both response shapes:
        // - Array for regular users (backward compatible)
        // - Object with entries + teamSummaries for ADMIN/PARTNER
        if (Array.isArray(data)) {
          setEntries(data);
          setTeamSummaries([]);
          setTotalHours(0);
          setIsSubmitted(false);
        } else {
          setEntries(data.entries || []);
          setTeamSummaries(data.teamSummaries || []);
          setTotalHours(data.totalHours ?? 0);
          setIsSubmitted(data.isSubmitted ?? false);
          // Track submitted dates
          if (data.isSubmitted) {
            setSubmittedDates((prev) => new Set([...prev, formatDateISO(date)]));
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch entries:", err);
    } finally {
      setIsLoadingEntries(false);
    }
  }, []);

  // Fetch dates with entries for visible week range
  const fetchDatesWithEntries = useCallback(async (centerDate: Date) => {
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

  // Fetch M365 activity for selected date
  const fetchM365Activity = useCallback(async () => {
    setIsM365Loading(true);
    setM365Error(null);
    setIsM365PanelOpen(true);

    try {
      const response = await fetch(`/api/m365/activity?date=${formatDateISO(selectedDate)}`);
      const data = await response.json();

      if (!response.ok) {
        setM365Error(data.error || "Failed to fetch M365 activity");
        setM365Data(null);
        return;
      }

      setM365Data(data);
    } catch {
      setM365Error("Connection failed. Check your internet.");
      setM365Data(null);
    } finally {
      setIsM365Loading(false);
    }
  }, [selectedDate]);

  // Close M365 panel
  const closeM365Panel = useCallback(() => {
    setIsM365PanelOpen(false);
    setM365Data(null);
    setM365Error(null);
  }, []);

  // Fetch overdue status for the user
  const fetchOverdueStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/timesheets/overdue");
      if (response.ok) {
        const data = await response.json();
        // For regular users, data.overdue is string[]
        if (Array.isArray(data.overdue)) {
          if (data.overdue.length === 0 || typeof data.overdue[0] === "string") {
            setOverdueDates(new Set(data.overdue as string[]));
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch overdue status:", err);
    }
  }, []);

  // Handle timesheet submission for the selected date
  const handleTimesheetSubmit = useCallback(async () => {
    try {
      const response = await fetch("/api/timesheets/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: formatDateISO(selectedDate) }),
      });

      if (response.ok) {
        setIsSubmitted(true);
        setSubmittedDates((prev) => new Set([...prev, formatDateISO(selectedDate)]));
        setOverdueDates((prev) => {
          const next = new Set(prev);
          next.delete(formatDateISO(selectedDate));
          return next;
        });
        setShowSubmitPrompt(false);
      }
    } catch (err) {
      console.error("Failed to submit timesheet:", err);
    }
  }, [selectedDate]);

  // Fetch on date change
  useEffect(() => {
    fetchEntries(selectedDate);
    // Close M365 panel when date changes
    setIsM365PanelOpen(false);
    setM365Data(null);
    setM365Error(null);
  }, [selectedDate, fetchEntries]);

  // Fetch dots when month changes
  useEffect(() => {
    fetchDatesWithEntries(selectedDate);
  }, [selectedDate, fetchDatesWithEntries]);

  // Fetch overdue status on mount
  useEffect(() => {
    fetchOverdueStatus();
  }, [fetchOverdueStatus]);

  // Navigation handlers
  const goToPrevWeek = useCallback(() => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 7);
    setSelectedDate(newDate);
  }, [selectedDate]);

  const goToNextWeek = useCallback(() => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 7);
    setSelectedDate(newDate);
  }, [selectedDate]);

  const goToToday = useCallback(() => {
    setSelectedDate(today);
  }, [today]);

  // Form handlers
  const handleFormChange = useCallback((updates: Partial<FormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!formData.clientId || (!formData.subtopicId && !formData.topicId)) return;
    if (formData.hours === 0 && formData.minutes === 0) return;

    setIsLoading(true);
    setError(null);

    const totalHours = toDecimalHours(formData.hours, formData.minutes);

    try {
      const response = await fetch("/api/timesheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: formatDateISO(selectedDate),
          clientId: formData.clientId,
          subtopicId: formData.subtopicId || null,
          topicId: formData.topicId || null,
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
      // Keep client and topic/subtopic selected, only reset duration and description
      setFormData((prev) => ({
        ...initialFormData,
        clientId: prev.clientId,
        topicId: prev.topicId,
        subtopicId: prev.subtopicId,
      }));
    } catch {
      setError("Failed to create entry");
    } finally {
      setIsLoading(false);
    }
  }, [formData, selectedDate]);

  const deleteEntry = useCallback(async (entryId: string) => {
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
  }, [selectedDate, fetchDatesWithEntries]);

  const updateEntry = useCallback((updatedEntry: TimeEntry) => {
    setEntries((prev) =>
      prev.map((e) => (e.id === updatedEntry.id ? updatedEntry : e))
    );
  }, []);

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
      <WeekStrip
        selectedDate={selectedDate}
        today={today}
        datesWithEntries={datesWithEntries}
        submittedDates={submittedDates}
        overdueDates={overdueDates}
        onSelectDate={setSelectedDate}
        onPrevWeek={goToPrevWeek}
        onNextWeek={goToNextWeek}
        onGoToToday={goToToday}
        onFetchM365Activity={fetchM365Activity}
        isM365Loading={isM365Loading}
        isM365PanelOpen={isM365PanelOpen}
      />

      {/* M365 Activity Panel */}
      {isM365PanelOpen && (
        <M365ActivityPanel
          data={m365Data}
          isLoading={isM365Loading}
          error={m365Error}
          onClose={closeM365Panel}
          date={formatDateISO(selectedDate)}
        />
      )}

      {/* Entry Form */}
      <EntryForm
        clients={clients}
        topics={topics}
        formData={formData}
        isLoading={isLoading}
        error={error}
        onFormChange={handleFormChange}
        onSubmit={handleSubmit}
      />

      {/* Entries List */}
      <EntriesList
        entries={entries}
        isLoadingEntries={isLoadingEntries}
        onDeleteEntry={deleteEntry}
        onUpdateEntry={updateEntry}
        clients={clients}
        topics={topics}
      />

      {/* Team Timesheets (only shown for ADMIN/PARTNER) */}
      <TeamTimesheets
        summaries={teamSummaries}
        selectedDate={selectedDate}
      />
    </div>
  );
}
