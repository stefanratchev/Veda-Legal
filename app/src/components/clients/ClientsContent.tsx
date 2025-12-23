"use client";

import { useState, useCallback, useMemo } from "react";
import { ClientStatus } from "@prisma/client";
import { DataTable } from "@/components/ui/DataTable";
import { TableFilters } from "@/components/ui/TableFilters";
import { ColumnDef } from "@/components/ui/table-types";
import { ClientModal } from "./ClientModal";

interface Client {
  id: string;
  name: string;
  timesheetCode: string;
  invoicedName: string | null;
  invoiceAttn: string | null;
  email: string | null;
  secondaryEmails: string | null;
  hourlyRate: number | null;
  phone: string | null;
  address: string | null;
  practiceArea: string | null;
  status: ClientStatus;
  notes: string | null;
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
  secondaryEmails: string;
  hourlyRate: string;
  status: ClientStatus;
  notes: string;
}

const initialFormData: FormData = {
  name: "",
  timesheetCode: "",
  invoicedName: "",
  invoiceAttn: "",
  email: "",
  secondaryEmails: "",
  hourlyRate: "",
  status: "ACTIVE",
  notes: "",
};

const statusStyles: Record<ClientStatus, { dotColor: string; dotOpacity: string; textColor: string; label: string }> = {
  ACTIVE: { dotColor: "var(--accent-pink)", dotOpacity: "1", textColor: "var(--text-secondary)", label: "Active" },
  INACTIVE: { dotColor: "var(--text-muted)", dotOpacity: "0.5", textColor: "var(--text-muted)", label: "Inactive" },
};

export function ClientsContent({ initialClients }: ClientsContentProps) {
  const [clients, setClients] = useState<Client[]>(initialClients);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | ClientStatus>("ALL");

  // Filtered clients
  const filteredClients = useMemo(() => {
    return clients.filter((client) => {
      if (statusFilter !== "ALL" && client.status !== statusFilter) {
        return false;
      }
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = client.name.toLowerCase().includes(query);
        const matchesEmail = client.email?.toLowerCase().includes(query) ?? false;
        return matchesName || matchesEmail;
      }
      return true;
    });
  }, [clients, searchQuery, statusFilter]);

  // Modal handlers
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
      secondaryEmails: client.secondaryEmails || "",
      hourlyRate: client.hourlyRate?.toString() || "",
      status: client.status,
      notes: client.notes || "",
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

  const handleFormChange = useCallback((updates: Partial<FormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  }, []);

  // CRUD handlers
  const handleCreate = useCallback(async () => {
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
  }, [formData, closeModal]);

  const handleUpdate = useCallback(async () => {
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

      setClients((prev) => prev.map((c) => (c.id === selectedClient.id ? data : c)));
      closeModal();
    } catch {
      setError("Failed to update client");
    } finally {
      setIsLoading(false);
    }
  }, [selectedClient, formData, closeModal]);

  const handleDelete = useCallback(async () => {
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
  }, [selectedClient, closeModal]);

  const handleSubmit = useCallback(() => {
    if (modalMode === "create") {
      handleCreate();
    } else if (modalMode === "edit") {
      handleUpdate();
    } else if (modalMode === "delete") {
      handleDelete();
    }
  }, [modalMode, handleCreate, handleUpdate, handleDelete]);

  // Column definitions
  const columns: ColumnDef<Client>[] = useMemo(
    () => [
      {
        id: "name",
        header: "Name",
        accessor: (client) => client.name,
        cell: (client) => (
          <span className="font-medium text-[13px] text-[var(--text-primary)]">
            {client.name}
          </span>
        ),
      },
      {
        id: "email",
        header: "Email",
        accessor: (client) => client.email || "",
        cell: (client) => (
          <span className="text-[13px] text-[var(--text-secondary)]">
            {client.email || "—"}
          </span>
        ),
      },
      {
        id: "hourlyRate",
        header: "Hourly Rate",
        accessor: (client) => client.hourlyRate ?? 0,
        cell: (client) => (
          <span className="text-[13px] text-[var(--text-secondary)]">
            {client.hourlyRate ? `€${client.hourlyRate.toFixed(2)}` : "—"}
          </span>
        ),
      },
      {
        id: "createdAt",
        header: "Created",
        accessor: (client) => client.createdAt,
        cell: (client) => (
          <span className="text-[13px] text-[var(--text-secondary)]">
            {new Date(client.createdAt).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
        ),
      },
      {
        id: "status",
        header: "Status",
        accessor: (client) => client.status,
        cell: (client) => {
          const style = statusStyles[client.status];
          return (
            <span
              className="flex items-center gap-2 text-xs font-medium"
              style={{ color: style.textColor }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{
                  backgroundColor: style.dotColor,
                  opacity: style.dotOpacity,
                }}
              />
              {style.label}
            </span>
          );
        },
      },
      {
        id: "actions",
        header: "Actions",
        accessor: () => null,
        sortable: false,
        align: "right",
        cell: (client) => (
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
        ),
      },
    ],
    [openEditModal, openDeleteModal]
  );

  // Empty state icon
  const emptyIcon = (
    <svg className="w-6 h-6 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );

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

      {/* Filters */}
      <TableFilters
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search by name or email..."
        filterOptions={[
          { value: "ALL", label: "All Status" },
          { value: "ACTIVE", label: "Active" },
          { value: "INACTIVE", label: "Inactive" },
        ]}
        filterValue={statusFilter}
        onFilterChange={(value) => setStatusFilter(value as "ALL" | ClientStatus)}
        resultCount={filteredClients.length}
      />

      {/* Table */}
      <DataTable
        data={filteredClients}
        columns={columns}
        getRowKey={(client) => client.id}
        pageSize={25}
        emptyMessage={clients.length === 0 ? "No clients yet" : "No matching clients"}
        emptyIcon={emptyIcon}
      />

      {/* Modal */}
      {modalMode && (
        <ClientModal
          mode={modalMode}
          formData={formData}
          selectedClientName={selectedClient?.name}
          isLoading={isLoading}
          error={error}
          onFormChange={handleFormChange}
          onSubmit={handleSubmit}
          onClose={closeModal}
        />
      )}
    </div>
  );
}
