"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { formatDateISO, toDecimalHours } from "@/lib/date-utils";
import { WeekStrip } from "./WeekStrip";
import { EntryForm } from "./EntryForm";
import { EntriesList } from "./EntriesList";
import { TeamTimesheets } from "./TeamTimesheets";
import { M365ActivityPanel } from "./M365ActivityPanel";
import { SubmitButton } from "./SubmitButton";
import { SubmitPromptModal } from "./SubmitPromptModal";
import type { ClientWithType, Topic, TimeEntry, FormData, TeamSummary, M365ActivityResponse } from "@/types";
import { initialFormData } from "@/types";

interface TimesheetsContentProps {
  clients: ClientWithType[];
  topics: Topic[];
  userName?: string;
}

export function TimesheetsContent({ clients, topics, userName }: TimesheetsContentProps) {
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
  const [revocationWarning, setRevocationWarning] = useState<string | null>(null);

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

  // Fetch submitted dates for the visible month
  const fetchSubmittedDates = useCallback(async (centerDate: Date) => {
    try {
      const year = centerDate.getFullYear();
      const month = centerDate.getMonth() + 1;
      const response = await fetch(`/api/timesheets/submissions?year=${year}&month=${month}`);
      if (response.ok) {
        const dates: string[] = await response.json();
        setSubmittedDates(new Set(dates));
      }
    } catch (err) {
      console.error("Failed to fetch submitted dates:", err);
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
        if (Array.isArray(data.overdue)) {
          if (data.overdue.length === 0) {
            setOverdueDates(new Set());
          } else if (typeof data.overdue[0] === "string") {
            // Regular user format: string[]
            setOverdueDates(new Set(data.overdue as string[]));
          } else if (userName && typeof data.overdue[0] === "object" && "dates" in data.overdue[0]) {
            // Admin format: { userId, name, dates }[] - extract current user's dates
            const userOverdue = data.overdue.find((u: { name: string }) => u.name === userName);
            setOverdueDates(new Set(userOverdue?.dates || []));
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch overdue status:", err);
    }
  }, [userName]);

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

  // Fetch submitted dates when month changes
  useEffect(() => {
    fetchSubmittedDates(selectedDate);
  }, [selectedDate, fetchSubmittedDates]);

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

    const totalHoursForEntry = toDecimalHours(formData.hours, formData.minutes);

    try {
      const response = await fetch("/api/timesheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: formatDateISO(selectedDate),
          clientId: formData.clientId,
          subtopicId: formData.subtopicId || null,
          topicId: formData.topicId || null,
          hours: totalHoursForEntry,
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

      // Update total hours and check if we should prompt for submission
      const newTotalHours = totalHours + totalHoursForEntry;
      setTotalHours(newTotalHours);
      if (newTotalHours >= 8 && !isSubmitted) {
        setShowSubmitPrompt(true);
      }
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
        const data = await response.json();
        setEntries((prev) => prev.filter((e) => e.id !== entryId));
        fetchDatesWithEntries(selectedDate);

        // Check if submission was revoked due to hours dropping below 8
        if (data.submissionRevoked) {
          setIsSubmitted(false);
          setSubmittedDates((prev) => {
            const next = new Set(prev);
            next.delete(formatDateISO(selectedDate));
            return next;
          });
          const formattedDate = selectedDate.toLocaleDateString("en-GB", {
            weekday: "long",
            day: "numeric",
            month: "long",
          });
          setRevocationWarning(
            `Your timesheet submission for ${formattedDate} has been revoked. You now have ${data.remainingHours.toFixed(1)} hours logged (8 required).`
          );
          // Auto-dismiss after 5 seconds
          setTimeout(() => setRevocationWarning(null), 5000);
        }

        // Update total hours if provided
        if (typeof data.remainingHours === "number") {
          setTotalHours(data.remainingHours);
        }
      }
    } catch {
      setError("Failed to delete entry");
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate, fetchDatesWithEntries]);

  const updateEntry = useCallback((updatedEntry: TimeEntry, revocationData?: { submissionRevoked: boolean; remainingHours: number }) => {
    setEntries((prev) =>
      prev.map((e) => (e.id === updatedEntry.id ? updatedEntry : e))
    );

    // Check if submission was revoked due to hours dropping below 8
    if (revocationData?.submissionRevoked) {
      setIsSubmitted(false);
      setSubmittedDates((prev) => {
        const next = new Set(prev);
        next.delete(formatDateISO(selectedDate));
        return next;
      });
      const formattedDate = selectedDate.toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
      });
      setRevocationWarning(
        `Your timesheet submission for ${formattedDate} has been revoked. You now have ${revocationData.remainingHours.toFixed(1)} hours logged (8 required).`
      );
      // Auto-dismiss after 5 seconds
      setTimeout(() => setRevocationWarning(null), 5000);
    }

    // Update total hours if provided
    if (typeof revocationData?.remainingHours === "number") {
      setTotalHours(revocationData.remainingHours);
    }
  }, [selectedDate]);

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

      {/* Submit Button */}
      <SubmitButton
        totalHours={totalHours}
        isSubmitted={isSubmitted}
        isLoading={isLoading}
        onSubmit={handleTimesheetSubmit}
      />

      {/* Team Timesheets (only shown for ADMIN/PARTNER) */}
      <TeamTimesheets
        summaries={teamSummaries}
        selectedDate={selectedDate}
      />

      {/* Submit Prompt Modal */}
      {showSubmitPrompt && (
        <SubmitPromptModal
          date={formatDateISO(selectedDate)}
          totalHours={totalHours}
          onSubmit={handleTimesheetSubmit}
          onDismiss={() => setShowSubmitPrompt(false)}
        />
      )}

      {/* Revocation Warning Toast */}
      {revocationWarning && (
        <div className="fixed bottom-4 right-4 bg-[var(--warning-bg)] border border-[var(--warning)] text-[var(--warning)] px-4 py-3 rounded-lg shadow-lg animate-fade-up max-w-md z-50">
          <p className="text-sm font-medium">{revocationWarning}</p>
        </div>
      )}
    </div>
  );
}
