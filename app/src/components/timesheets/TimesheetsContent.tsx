"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { formatDateISO, toDecimalHours } from "@/lib/date-utils";
import { WeekStrip } from "./WeekStrip";
import { EntryForm } from "./EntryForm";
import { EntriesList } from "./EntriesList";
import type { Client, Topic, TimeEntry, FormData } from "@/types";
import { initialFormData } from "@/types";

interface TimesheetsContentProps {
  clients: Client[];
  topics: Topic[];
}

export function TimesheetsContent({ clients, topics }: TimesheetsContentProps) {
  const today = useMemo(() => new Date(), []);
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [datesWithEntries, setDatesWithEntries] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingEntries, setIsLoadingEntries] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  // Navigation handlers
  const goToPrevWeek = useCallback(() => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 7);
    setSelectedDate(newDate);
  }, [selectedDate]);

  const goToNextWeek = useCallback(() => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 7);
    if (formatDateISO(newDate) <= formatDateISO(today)) {
      setSelectedDate(newDate);
    } else {
      // If selectedDate + 7 would be in the future, navigate to today instead
      setSelectedDate(today);
    }
  }, [selectedDate, today]);

  const goToToday = useCallback(() => {
    setSelectedDate(today);
  }, [today]);

  // Form handlers
  const handleFormChange = useCallback((updates: Partial<FormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!formData.clientId || !formData.subtopicId) return;
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
          subtopicId: formData.subtopicId,
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
      // Keep client and subtopic selected, only reset duration and description
      setFormData((prev) => ({
        ...initialFormData,
        clientId: prev.clientId,
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
        onSelectDate={setSelectedDate}
        onPrevWeek={goToPrevWeek}
        onNextWeek={goToNextWeek}
        onGoToToday={goToToday}
      />

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
      />
    </div>
  );
}
