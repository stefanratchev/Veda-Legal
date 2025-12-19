"use client";

import { useState, useCallback } from "react";
import { ClientStatus } from "@prisma/client";

interface Client {
  id: string;
  name: string;
  timesheetCode: string;
  invoicedName: string | null;
  invoiceAttn: string | null;
  email: string | null;
  hourlyRate: number | null;
  status: ClientStatus;
  createdAt: string;
}

interface ClientsContentProps {
  initialClients: Client[];
}

type ModalMode = "create" | "edit" | "delete" | null;

interface FormData {
  name: string;
  timesheetCode: string;
  invoicedName: string;
  invoiceAttn: string;
  email: string;
  hourlyRate: string;
  status: ClientStatus;
}

const initialFormData: FormData = {
  name: "",
  timesheetCode: "",
  invoicedName: "",
  invoiceAttn: "",
  email: "",
  hourlyRate: "",
  status: "ACTIVE",
};

export function ClientsContent({ initialClients }: ClientsContentProps) {
  const [clients, setClients] = useState<Client[]>(initialClients);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openCreateModal = useCallback(() => {
    setFormData(initialFormData);
    setSelectedClient(null);
    setError(null);
    setModalMode("create");
  }, []);

  const openEditModal = useCallback((client: Client) => {
    setFormData({
      name: client.name,
      timesheetCode: client.timesheetCode,
      invoicedName: client.invoicedName || "",
      invoiceAttn: client.invoiceAttn || "",
      email: client.email || "",
      hourlyRate: client.hourlyRate?.toString() || "",
      status: client.status,
    });
    setSelectedClient(client);
    setError(null);
    setModalMode("edit");
  }, []);

  const openDeleteModal = useCallback((client: Client) => {
    setSelectedClient(client);
    setError(null);
    setModalMode("delete");
  }, []);

  const closeModal = useCallback(() => {
    setModalMode(null);
    setSelectedClient(null);
    setError(null);
  }, []);

  const handleCreate = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to create client");
        return;
      }

      setClients((prev) => [data, ...prev]);
      closeModal();
    } catch {
      setError("Failed to create client");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedClient) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/clients", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedClient.id, ...formData }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to update client");
        return;
      }

      setClients((prev) =>
        prev.map((c) => (c.id === selectedClient.id ? data : c))
      );
      closeModal();
    } catch {
      setError("Failed to update client");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedClient) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/clients?id=${selectedClient.id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to delete client");
        return;
      }

      setClients((prev) => prev.filter((c) => c.id !== selectedClient.id));
      closeModal();
    } catch {
      setError("Failed to delete client");
    } finally {
      setIsLoading(false);
    }
  };

  const statusStyles: Record<ClientStatus, { dotColor: string; dotOpacity: string; textColor: string; label: string }> = {
    ACTIVE: { dotColor: "var(--accent-pink)", dotOpacity: "1", textColor: "var(--text-secondary)", label: "Active" },
    INACTIVE: { dotColor: "var(--text-muted)", dotOpacity: "0.5", textColor: "var(--text-muted)", label: "Inactive" },
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-[var(--text-primary)]">
            Clients
          </h1>
          <p className="text-[var(--text-muted)] text-[13px] mt-0.5">
            Manage your client records
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="
            flex items-center gap-1.5 px-4 py-2 rounded
            bg-[var(--accent-pink)] text-[var(--bg-deep)]
            font-medium text-[13px]
            hover:bg-[var(--accent-pink-dim)]
            transition-colors duration-200
          "
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          Add Client
        </button>
      </div>

      {/* Table */}
      <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded overflow-hidden">
        {clients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-12 h-12 rounded bg-[var(--bg-surface)] flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <p className="text-[var(--text-secondary)] text-[13px] mb-0.5">No clients yet</p>
            <p className="text-[12px] text-[var(--text-muted)]">Add your first client to get started</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border-subtle)]">
                <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                  Name
                </th>
                <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                  Email
                </th>
                <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                  Hourly Rate
                </th>
                <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                  Status
                </th>
                <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr
                  key={client.id}
                  className="border-b border-[var(--border-subtle)] last:border-b-0 hover:bg-[var(--bg-hover)] transition-colors"
                >
                  <td className="px-4 py-2.5">
                    <span className="font-medium text-[13px] text-[var(--text-primary)]">
                      {client.name}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-[13px] text-[var(--text-secondary)]">
                    {client.email || "—"}
                  </td>
                  <td className="px-4 py-2.5 text-[13px] text-[var(--text-secondary)]">
                    {client.hourlyRate ? `€${client.hourlyRate.toFixed(2)}` : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className="flex items-center gap-2 text-xs font-medium"
                      style={{ color: statusStyles[client.status].textColor }}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{
                          backgroundColor: statusStyles[client.status].dotColor,
                          opacity: statusStyles[client.status].dotOpacity,
                        }}
                      />
                      {statusStyles[client.status].label}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEditModal(client)}
                        className="p-1.5 rounded-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors"
                        title="Edit client"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => openDeleteModal(client)}
                        className="p-1.5 rounded-sm text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--danger-bg)] transition-colors"
                        title="Delete client"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {modalMode && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={closeModal}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          {/* Modal Content */}
          <div
            className="relative bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded w-full max-w-md mx-4 animate-fade-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-[var(--border-subtle)]">
              <h2 className="font-heading text-lg font-semibold text-[var(--text-primary)]">
                {modalMode === "create" && "Add New Client"}
                {modalMode === "edit" && "Edit Client"}
                {modalMode === "delete" && "Delete Client"}
              </h2>
            </div>

            {/* Body */}
            <div className="p-5">
              {modalMode === "delete" ? (
                <div>
                  <p className="text-[var(--text-secondary)] text-[13px]">
                    Are you sure you want to delete{" "}
                    <span className="font-medium text-[var(--text-primary)]">
                      {selectedClient?.name}
                    </span>
                    ? This action cannot be undone.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Name */}
                  <div>
                    <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">
                      Client Name <span className="text-[var(--danger)]">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, name: e.target.value }))
                      }
                      className="
                        w-full px-3 py-2 rounded text-[13px]
                        bg-[var(--bg-surface)] border border-[var(--border-subtle)]
                        text-[var(--text-primary)] placeholder-[var(--text-muted)]
                        focus:border-[var(--border-accent)] focus:ring-[2px] focus:ring-[var(--accent-pink-glow)]
                        focus:outline-none transition-all duration-200
                      "
                      placeholder="Enter client name"
                      autoFocus
                    />
                  </div>

                  {/* Timesheet Code */}
                  <div>
                    <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">
                      Timesheet Code <span className="text-[var(--danger)]">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.timesheetCode}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, timesheetCode: e.target.value }))
                      }
                      className="
                        w-full px-3 py-2 rounded text-[13px]
                        bg-[var(--bg-surface)] border border-[var(--border-subtle)]
                        text-[var(--text-primary)] placeholder-[var(--text-muted)]
                        focus:border-[var(--border-accent)] focus:ring-[2px] focus:ring-[var(--accent-pink-glow)]
                        focus:outline-none transition-all duration-200
                      "
                      placeholder="e.g., ACME-001"
                    />
                  </div>

                  {/* Invoiced Name */}
                  <div>
                    <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">
                      Invoiced Name
                    </label>
                    <input
                      type="text"
                      value={formData.invoicedName}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, invoicedName: e.target.value }))
                      }
                      className="
                        w-full px-3 py-2 rounded text-[13px]
                        bg-[var(--bg-surface)] border border-[var(--border-subtle)]
                        text-[var(--text-primary)] placeholder-[var(--text-muted)]
                        focus:border-[var(--border-accent)] focus:ring-[2px] focus:ring-[var(--accent-pink-glow)]
                        focus:outline-none transition-all duration-200
                      "
                      placeholder="Name for outgoing invoices"
                    />
                  </div>

                  {/* Invoice Attn */}
                  <div>
                    <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">
                      Invoice Attn
                    </label>
                    <input
                      type="text"
                      value={formData.invoiceAttn}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, invoiceAttn: e.target.value }))
                      }
                      className="
                        w-full px-3 py-2 rounded text-[13px]
                        bg-[var(--bg-surface)] border border-[var(--border-subtle)]
                        text-[var(--text-primary)] placeholder-[var(--text-muted)]
                        focus:border-[var(--border-accent)] focus:ring-[2px] focus:ring-[var(--accent-pink-glow)]
                        focus:outline-none transition-all duration-200
                      "
                      placeholder="Contact person for invoices"
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, email: e.target.value }))
                      }
                      className="
                        w-full px-3 py-2 rounded text-[13px]
                        bg-[var(--bg-surface)] border border-[var(--border-subtle)]
                        text-[var(--text-primary)] placeholder-[var(--text-muted)]
                        focus:border-[var(--border-accent)] focus:ring-[2px] focus:ring-[var(--accent-pink-glow)]
                        focus:outline-none transition-all duration-200
                      "
                      placeholder="client@example.com"
                    />
                  </div>

                  {/* Hourly Rate */}
                  <div>
                    <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">
                      Hourly Rate (EUR)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-[13px]">
                        €
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.hourlyRate}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            hourlyRate: e.target.value,
                          }))
                        }
                        className="
                          w-full pl-7 pr-3 py-2 rounded text-[13px]
                          bg-[var(--bg-surface)] border border-[var(--border-subtle)]
                          text-[var(--text-primary)] placeholder-[var(--text-muted)]
                          focus:border-[var(--border-accent)] focus:ring-[2px] focus:ring-[var(--accent-pink-glow)]
                          focus:outline-none transition-all duration-200
                        "
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  {/* Status */}
                  <div>
                    <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">
                      Status
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          status: e.target.value as ClientStatus,
                        }))
                      }
                      className="
                        w-full px-3 py-2 rounded text-[13px]
                        bg-[var(--bg-surface)] border border-[var(--border-subtle)]
                        text-[var(--text-primary)]
                        focus:border-[var(--border-accent)] focus:ring-[2px] focus:ring-[var(--accent-pink-glow)]
                        focus:outline-none transition-all duration-200
                        cursor-pointer
                      "
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="mt-3 px-3 py-2 rounded bg-[var(--danger-bg)] text-[var(--danger)] text-[13px]">
                  {error}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-[var(--border-subtle)] flex items-center justify-end gap-2">
              <button
                onClick={closeModal}
                disabled={isLoading}
                className="
                  px-3 py-1.5 rounded
                  bg-[var(--bg-surface)] border border-[var(--border-subtle)]
                  text-[var(--text-secondary)] text-[13px] font-medium
                  hover:border-[var(--border-accent)] hover:text-[var(--text-primary)]
                  transition-all duration-200
                  disabled:opacity-50
                "
              >
                Cancel
              </button>
              {modalMode === "delete" ? (
                <button
                  onClick={handleDelete}
                  disabled={isLoading}
                  className="
                    px-3 py-1.5 rounded
                    bg-[var(--danger)] text-white text-[13px] font-medium
                    hover:opacity-90
                    transition-all duration-200
                    disabled:opacity-50
                  "
                >
                  {isLoading ? "Deleting..." : "Delete"}
                </button>
              ) : (
                <button
                  onClick={modalMode === "create" ? handleCreate : handleUpdate}
                  disabled={isLoading || !formData.name.trim() || !formData.timesheetCode.trim()}
                  className="
                    px-3 py-1.5 rounded
                    bg-[var(--accent-pink)] text-[var(--bg-deep)] text-[13px] font-medium
                    hover:bg-[var(--accent-pink-dim)]
                    transition-all duration-200
                    disabled:opacity-50
                  "
                >
                  {isLoading
                    ? "Saving..."
                    : modalMode === "create"
                    ? "Create Client"
                    : "Save Changes"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
