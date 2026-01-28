"use client";

import { useState } from "react";
import { LeavePeriod, LeaveType, LeaveStatus } from "@/types";
import { LeaveModal } from "./LeaveModal";

interface LeaveContentProps {
  initialLeave: LeavePeriod[];
  currentUserId: string;
  isAdmin: boolean;
}

const statusColors: Record<LeaveStatus, string> = {
  PENDING: "bg-yellow-500/20 text-yellow-500",
  APPROVED: "bg-green-500/20 text-green-500",
  REJECTED: "bg-red-500/20 text-red-500",
};

const leaveTypeLabels: Record<LeaveType, string> = {
  VACATION: "Vacation",
  SICK_LEAVE: "Sick Leave",
  MATERNITY_PATERNITY: "Maternity/Paternity",
};

export function LeaveContent({ initialLeave, currentUserId, isAdmin }: LeaveContentProps) {
  const [leavePeriods, setLeavePeriods] = useState<LeavePeriod[]>(initialLeave);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLeave, setEditingLeave] = useState<LeavePeriod | null>(null);

  const pendingApprovals = leavePeriods.filter(
    (lp) => lp.status === "PENDING" && lp.userId !== currentUserId
  );

  const myLeave = leavePeriods.filter((lp) => lp.userId === currentUserId);
  const allLeave = isAdmin ? leavePeriods : myLeave;

  const handleApprove = async (id: string) => {
    const res = await fetch(`/api/leave/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "APPROVED" }),
    });
    if (res.ok) {
      const updated = await res.json();
      setLeavePeriods((prev) =>
        prev.map((lp) => (lp.id === id ? { ...lp, ...updated } : lp))
      );
    }
  };

  const handleReject = async (id: string, reason?: string) => {
    const res = await fetch(`/api/leave/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "REJECTED", rejectionReason: reason }),
    });
    if (res.ok) {
      const updated = await res.json();
      setLeavePeriods((prev) =>
        prev.map((lp) => (lp.id === id ? { ...lp, ...updated } : lp))
      );
    }
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/leave/${id}`, { method: "DELETE" });
    if (res.ok) {
      setLeavePeriods((prev) => prev.filter((lp) => lp.id !== id));
    }
  };

  const handleSave = async (data: { startDate: string; endDate: string; leaveType: LeaveType; reason: string }) => {
    if (editingLeave) {
      const res = await fetch(`/api/leave/${editingLeave.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const updated = await res.json();
        setLeavePeriods((prev) =>
          prev.map((lp) => (lp.id === editingLeave.id ? { ...lp, ...updated } : lp))
        );
      }
    } else {
      const res = await fetch("/api/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const created = await res.json();
        setLeavePeriods((prev) => [{ ...created, userName: null, reviewedByName: null }, ...prev]);
      }
    }
    setIsModalOpen(false);
    setEditingLeave(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-heading font-semibold text-[var(--text-primary)]">
          Leave
        </h1>
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 bg-[var(--accent-pink)] text-[var(--bg-deep)] rounded font-medium hover:opacity-90 transition-opacity"
        >
          Request Leave
        </button>
      </div>

      {/* Pending Approvals (Admin only) */}
      {isAdmin && pendingApprovals.length > 0 && (
        <div className="bg-[var(--bg-elevated)] rounded-lg border border-[var(--border-subtle)] p-4">
          <h2 className="text-lg font-heading font-medium text-[var(--text-primary)] mb-4">
            Pending Approvals
          </h2>
          <div className="space-y-3">
            {pendingApprovals.map((lp) => (
              <div
                key={lp.id}
                className="flex items-center justify-between p-3 bg-[var(--bg-surface)] rounded"
              >
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">
                    {lp.userName}
                  </p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    {leaveTypeLabels[lp.leaveType]} · {lp.startDate} to {lp.endDate}
                  </p>
                  {lp.reason && (
                    <p className="text-xs text-[var(--text-muted)] mt-1">{lp.reason}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleApprove(lp.id)}
                    className="px-3 py-1 text-sm bg-green-500/20 text-green-500 rounded hover:bg-green-500/30"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleReject(lp.id)}
                    className="px-3 py-1 text-sm bg-red-500/20 text-red-500 rounded hover:bg-red-500/30"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Leave List */}
      <div className="bg-[var(--bg-elevated)] rounded-lg border border-[var(--border-subtle)]">
        <div className="p-4 border-b border-[var(--border-subtle)]">
          <h2 className="text-lg font-heading font-medium text-[var(--text-primary)]">
            {isAdmin ? "All Leave Requests" : "My Leave Requests"}
          </h2>
        </div>
        <div className="divide-y divide-[var(--border-subtle)]">
          {allLeave.length === 0 ? (
            <p className="p-4 text-sm text-[var(--text-muted)]">No leave requests yet.</p>
          ) : (
            allLeave.map((lp) => (
              <div key={lp.id} className="p-4 flex items-center justify-between">
                <div>
                  {isAdmin && lp.userId !== currentUserId && (
                    <p className="text-sm font-medium text-[var(--text-primary)]">
                      {lp.userName}
                    </p>
                  )}
                  <p className="text-sm text-[var(--text-secondary)]">
                    {leaveTypeLabels[lp.leaveType]} · {lp.startDate} to {lp.endDate}
                  </p>
                  {lp.reason && (
                    <p className="text-xs text-[var(--text-muted)] mt-1">{lp.reason}</p>
                  )}
                  {lp.rejectionReason && (
                    <p className="text-xs text-red-400 mt-1">
                      Rejected: {lp.rejectionReason}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-1 text-xs font-medium rounded ${statusColors[lp.status]}`}>
                    {lp.status}
                  </span>
                  {(lp.userId === currentUserId && lp.status === "PENDING") && (
                    <>
                      <button
                        onClick={() => {
                          setEditingLeave(lp);
                          setIsModalOpen(true);
                        }}
                        className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(lp.id)}
                        className="text-xs text-red-400 hover:text-red-300"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                  {isAdmin && lp.userId !== currentUserId && (
                    <button
                      onClick={() => handleDelete(lp.id)}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <LeaveModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingLeave(null);
          }}
          onSave={handleSave}
          initialData={editingLeave}
        />
      )}
    </div>
  );
}
