"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { DataTable } from "@/components/ui/DataTable";
import { TableFilters } from "@/components/ui/TableFilters";
import { ColumnDef } from "@/components/ui/table-types";
import { CreateServiceDescriptionModal } from "./CreateServiceDescriptionModal";
import { ServiceDescriptionStatus } from "@/types";

interface ServiceDescriptionListItem {
  id: string;
  clientId: string;
  clientName: string;
  periodStart: string;
  periodEnd: string;
  status: ServiceDescriptionStatus;
  totalAmount: number;
  updatedAt: string;
}

interface Client {
  id: string;
  name: string;
  timesheetCode: string;
}

interface BillingContentProps {
  initialServiceDescriptions: ServiceDescriptionListItem[];
  clients: Client[];
}

const statusStyles: Record<ServiceDescriptionStatus, { dotColor: string; dotOpacity: string; textColor: string; label: string }> = {
  DRAFT: { dotColor: "var(--warning)", dotOpacity: "1", textColor: "var(--text-secondary)", label: "Draft" },
  FINALIZED: { dotColor: "var(--success)", dotOpacity: "1", textColor: "var(--text-secondary)", label: "Finalized" },
};

function formatPeriod(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const startMonth = startDate.toLocaleString("en-GB", { month: "short", year: "numeric" });
  const endMonth = endDate.toLocaleString("en-GB", { month: "short", year: "numeric" });
  if (startMonth === endMonth) return startMonth;
  return `${startMonth} - ${endMonth}`;
}

export function BillingContent({ initialServiceDescriptions, clients }: BillingContentProps) {
  const router = useRouter();
  const [serviceDescriptions, setServiceDescriptions] = useState(initialServiceDescriptions);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | ServiceDescriptionStatus>("ALL");

  // Filtered list
  const filteredDescriptions = useMemo(() => {
    return serviceDescriptions.filter((sd) => {
      if (statusFilter !== "ALL" && sd.status !== statusFilter) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return sd.clientName.toLowerCase().includes(query);
      }
      return true;
    });
  }, [serviceDescriptions, searchQuery, statusFilter]);

  const openCreateModal = useCallback(() => {
    setCreateError(null);
    setShowCreateModal(true);
  }, []);

  const closeCreateModal = useCallback(() => {
    setShowCreateModal(false);
    setCreateError(null);
  }, []);

  const handleCreate = useCallback(async (clientId: string, periodStart: string, periodEnd: string) => {
    setIsCreating(true);
    setCreateError(null);

    try {
      const response = await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, periodStart, periodEnd }),
      });

      const data = await response.json();

      if (!response.ok) {
        setCreateError(data.error || "Failed to create service description");
        return;
      }

      // Navigate to the new service description
      router.push(`/billing/${data.id}`);
    } catch {
      setCreateError("Failed to create service description");
    } finally {
      setIsCreating(false);
    }
  }, [router]);

  const handleRowClick = useCallback((sd: ServiceDescriptionListItem) => {
    router.push(`/billing/${sd.id}`);
  }, [router]);

  const handleDelete = useCallback(async (sd: ServiceDescriptionListItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete service description for ${sd.clientName}?`)) return;

    try {
      const response = await fetch(`/api/billing/${sd.id}`, { method: "DELETE" });
      if (response.ok) {
        setServiceDescriptions((prev) => prev.filter((item) => item.id !== sd.id));
      }
    } catch {
      alert("Failed to delete service description");
    }
  }, []);

  const columns: ColumnDef<ServiceDescriptionListItem>[] = useMemo(
    () => [
      {
        id: "clientName",
        header: "Client",
        accessor: (sd) => sd.clientName,
        cell: (sd) => (
          <span className="font-medium text-[13px] text-[var(--text-primary)]">
            {sd.clientName}
          </span>
        ),
      },
      {
        id: "period",
        header: "Period",
        accessor: (sd) => sd.periodStart,
        cell: (sd) => (
          <span className="text-[13px] text-[var(--text-secondary)]">
            {formatPeriod(sd.periodStart, sd.periodEnd)}
          </span>
        ),
      },
      {
        id: "status",
        header: "Status",
        accessor: (sd) => sd.status,
        cell: (sd) => {
          const style = statusStyles[sd.status];
          return (
            <span className="flex items-center gap-2 text-xs font-medium" style={{ color: style.textColor }}>
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: style.dotColor, opacity: style.dotOpacity }} />
              {style.label}
            </span>
          );
        },
      },
      {
        id: "totalAmount",
        header: "Total",
        accessor: (sd) => sd.totalAmount,
        align: "right",
        cell: (sd) => (
          <span className="text-[13px] text-[var(--text-secondary)]">
            {sd.totalAmount > 0 ? `${sd.totalAmount.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BGN` : "-"}
          </span>
        ),
      },
      {
        id: "updatedAt",
        header: "Last Updated",
        accessor: (sd) => sd.updatedAt,
        cell: (sd) => (
          <span className="text-[13px] text-[var(--text-secondary)]">
            {new Date(sd.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
          </span>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        accessor: () => null,
        sortable: false,
        align: "right",
        cell: (sd) => (
          <div className="flex items-center justify-end gap-1">
            {sd.status === "DRAFT" && (
              <button
                onClick={(e) => handleDelete(sd, e)}
                className="p-1.5 rounded-sm text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--danger-bg)] transition-colors"
                title="Delete draft"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        ),
      },
    ],
    [handleDelete]
  );

  const emptyIcon = (
    <svg className="w-6 h-6 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-[var(--text-primary)]">Billing</h1>
          <p className="text-[var(--text-muted)] text-[13px] mt-0.5">Manage service descriptions and billing</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-1.5 px-4 py-2 rounded bg-[var(--accent-pink)] text-[var(--bg-deep)] font-medium text-[13px] hover:bg-[var(--accent-pink-dim)] transition-colors duration-200"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          New Service Description
        </button>
      </div>

      <TableFilters
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search by client name..."
        filterOptions={[
          { value: "ALL", label: "All Status" },
          { value: "DRAFT", label: "Draft" },
          { value: "FINALIZED", label: "Finalized" },
        ]}
        filterValue={statusFilter}
        onFilterChange={(value) => setStatusFilter(value as "ALL" | ServiceDescriptionStatus)}
        resultCount={filteredDescriptions.length}
      />

      <DataTable
        data={filteredDescriptions}
        columns={columns}
        getRowKey={(sd) => sd.id}
        pageSize={25}
        emptyMessage={serviceDescriptions.length === 0 ? "No service descriptions yet" : "No matching service descriptions"}
        emptyIcon={emptyIcon}
        onRowClick={handleRowClick}
      />

      {showCreateModal && (
        <CreateServiceDescriptionModal
          clients={clients}
          isLoading={isCreating}
          error={createError}
          onSubmit={handleCreate}
          onClose={closeCreateModal}
        />
      )}
    </div>
  );
}
