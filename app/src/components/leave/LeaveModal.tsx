"use client";

import { useState, useRef } from "react";
import { LeavePeriod, LeaveType } from "@/types";
import { useClickOutside } from "@/hooks/useClickOutside";

interface LeaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { startDate: string; endDate: string; leaveType: LeaveType; reason: string }) => void;
  initialData?: LeavePeriod | null;
}

const leaveTypes: { value: LeaveType; label: string }[] = [
  { value: "VACATION", label: "Vacation" },
  { value: "SICK_LEAVE", label: "Sick Leave" },
  { value: "MATERNITY_PATERNITY", label: "Maternity/Paternity" },
];

export function LeaveModal({ isOpen, onClose, onSave, initialData }: LeaveModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  // State is initialized from initialData; parent should use key prop to reset when editing different items
  const [startDate, setStartDate] = useState(initialData?.startDate || "");
  const [endDate, setEndDate] = useState(initialData?.endDate || "");
  const [leaveType, setLeaveType] = useState<LeaveType>(initialData?.leaveType || "VACATION");
  const [reason, setReason] = useState(initialData?.reason || "");
  const [error, setError] = useState("");

  useClickOutside(modalRef, onClose, isOpen);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!startDate || !endDate) {
      setError("Please select both start and end dates");
      return;
    }

    if (startDate > endDate) {
      setError("Start date must be before or equal to end date");
      return;
    }

    onSave({ startDate, endDate, leaveType, reason });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div
        ref={modalRef}
        className="bg-[var(--bg-elevated)] rounded-lg border border-[var(--border-subtle)] p-6 w-full max-w-md animate-fade-up"
      >
        <h2 className="text-lg font-heading font-semibold text-[var(--text-primary)] mb-4">
          {initialData ? "Edit Leave Request" : "Request Leave"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="text-sm text-red-400 bg-red-400/10 p-2 rounded">{error}</p>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-pink)]"
              />
            </div>
            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-1">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-pink)]"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-1">
              Leave Type
            </label>
            <select
              value={leaveType}
              onChange={(e) => setLeaveType(e.target.value as LeaveType)}
              className="w-full px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-pink)]"
            >
              {leaveTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-1">
              Reason (optional)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-pink)] resize-none"
              placeholder="Optional note about your leave..."
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-[var(--bg-surface)] text-[var(--text-secondary)] rounded hover:text-[var(--text-primary)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-[var(--accent-pink)] text-[var(--bg-deep)] rounded font-medium hover:opacity-90 transition-opacity"
            >
              {initialData ? "Save Changes" : "Submit Request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
