"use client";

import { useState, useCallback, useMemo } from "react";
import { UserRole, UserStatus } from "@prisma/client";
import { DataTable } from "@/components/ui/DataTable";
import { ColumnDef } from "@/components/ui/table-types";
import { EmployeeModal } from "./EmployeeModal";

interface Employee {
  id: string;
  name: string | null;
  email: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  lastLogin: string | null;
}

interface EmployeesContentProps {
  initialEmployees: Employee[];
  readOnly?: boolean;
}

type ModalMode = "create" | "edit" | null;

interface FormData {
  email: string;
  name: string;
  role: UserRole;
}

const roleStyles: Record<
  "ADMIN" | "EMPLOYEE",
  { dotColor: string; textColor: string; label: string }
> = {
  ADMIN: {
    dotColor: "var(--accent-pink)",
    textColor: "var(--text-primary)",
    label: "Admin",
  },
  EMPLOYEE: {
    dotColor: "var(--text-muted)",
    textColor: "var(--text-muted)",
    label: "Employee",
  },
};

const statusStyles: Record<
  UserStatus,
  { bgColor: string; textColor: string; label: string }
> = {
  PENDING: {
    bgColor: "rgba(234, 179, 8, 0.15)",
    textColor: "#eab308",
    label: "Invited",
  },
  ACTIVE: {
    bgColor: "rgba(34, 197, 94, 0.15)",
    textColor: "#22c55e",
    label: "Active",
  },
  INACTIVE: {
    bgColor: "rgba(107, 114, 128, 0.15)",
    textColor: "#6b7280",
    label: "Deactivated",
  },
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? "" : "s"} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  if (diffDays < 30) return `${diffWeeks} week${diffWeeks === 1 ? "" : "s"} ago`;
  return `${diffMonths} month${diffMonths === 1 ? "" : "s"} ago`;
}

function formatAbsoluteTime(dateStr: string | null): string {
  if (!dateStr) return "Never logged in";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}


export function EmployeesContent({
  initialEmployees,
  readOnly = false,
}: EmployeesContentProps) {
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(
    null
  );
  const [formData, setFormData] = useState<FormData>({
    email: "",
    name: "",
    role: "EMPLOYEE",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"ALL" | UserRole>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL_ACTIVE" | "PENDING" | "INCLUDE_INACTIVE">("ALL_ACTIVE");

  // Filtered employees
  const filteredEmployees = useMemo(() => {
    return employees.filter((employee) => {
      // Status filter
      if (statusFilter === "ALL_ACTIVE" && employee.status === "INACTIVE") {
        return false;
      }
      if (statusFilter === "PENDING" && employee.status !== "PENDING") {
        return false;
      }
      // Role filter
      if (roleFilter !== "ALL" && employee.role !== roleFilter) {
        return false;
      }
      // Search
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = employee.name?.toLowerCase().includes(query) ?? false;
        const matchesEmail = employee.email.toLowerCase().includes(query);
        return matchesName || matchesEmail;
      }
      return true;
    });
  }, [employees, searchQuery, roleFilter, statusFilter]);

  // Modal handlers
  const openCreateModal = useCallback(() => {
    setFormData({
      email: "",
      name: "",
      role: "EMPLOYEE",
    });
    setSelectedEmployee(null);
    setError(null);
    setModalMode("create");
  }, []);

  const openEditModal = useCallback((employee: Employee) => {
    setFormData({
      email: employee.email,
      name: employee.name || "",
      role: employee.role,
    });
    setSelectedEmployee(employee);
    setError(null);
    setModalMode("edit");
  }, []);

  const closeModal = useCallback(() => {
    setModalMode(null);
    setSelectedEmployee(null);
    setError(null);
  }, []);

  const handleFormChange = useCallback((updates: Partial<FormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  }, []);

  // Update handler
  const handleUpdate = useCallback(async () => {
    if (!selectedEmployee) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/employees", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedEmployee.id, ...formData }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to update employee");
        return;
      }

      setEmployees((prev) =>
        prev.map((e) => (e.id === selectedEmployee.id ? data : e))
      );
      closeModal();
    } catch {
      setError("Failed to update employee");
    } finally {
      setIsLoading(false);
    }
  }, [selectedEmployee, formData, closeModal]);

  // Create handler
  const handleCreate = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email,
          name: formData.name || undefined,
          role: formData.role,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to create employee");
        return;
      }

      setEmployees((prev) => [data, ...prev]);
      closeModal();
    } catch {
      setError("Failed to create employee");
    } finally {
      setIsLoading(false);
    }
  }, [formData, closeModal]);

  // Column definitions
  const columns: ColumnDef<Employee>[] = useMemo(() => {
    const baseColumns: ColumnDef<Employee>[] = [
      {
        id: "name",
        header: "Name",
        accessor: (employee) => employee.name || "",
        cell: (employee) => (
          <span className="font-medium text-[13px] text-[var(--text-primary)]">
            {employee.name || "—"}
          </span>
        ),
      },
      {
        id: "email",
        header: "Email",
        accessor: (employee) => employee.email,
        cell: (employee) => (
          <span className="text-[13px] text-[var(--text-secondary)]">
            {employee.email}
          </span>
        ),
      },
      {
        id: "role",
        header: "Role",
        accessor: (employee) => employee.role,
        cell: (employee) => {
          const role = employee.role as "ADMIN" | "EMPLOYEE";
          const style = roleStyles[role];
          return (
            <span
              className="flex items-center gap-2 text-xs font-medium"
              style={{ color: style.textColor }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: style.dotColor }}
              />
              {style.label}
            </span>
          );
        },
      },
      {
        id: "status",
        header: "Status",
        accessor: (employee) => employee.status,
        cell: (employee) => {
          const style = statusStyles[employee.status];
          return (
            <span
              className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium"
              style={{ backgroundColor: style.bgColor, color: style.textColor }}
            >
              {style.label}
            </span>
          );
        },
      },
      {
        id: "createdAt",
        header: "Created",
        accessor: (employee) => employee.createdAt,
        cell: (employee) => (
          <span className="text-[13px] text-[var(--text-secondary)]">
            {formatDate(employee.createdAt)}
          </span>
        ),
      },
      {
        id: "lastLogin",
        header: "Last Login",
        accessor: (employee) => employee.lastLogin || "",
        cell: (employee) => (
          <span
            className="text-[13px] text-[var(--text-secondary)]"
            title={formatAbsoluteTime(employee.lastLogin)}
          >
            {formatRelativeTime(employee.lastLogin)}
          </span>
        ),
      },
    ];

    // Only add actions column if not readOnly
    if (!readOnly) {
      baseColumns.push({
        id: "actions",
        header: "Actions",
        accessor: () => null,
        sortable: false,
        align: "right",
        cell: (employee) => (
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={() => openEditModal(employee)}
              className="p-1.5 rounded-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors"
              title="Edit employee"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
            </button>
          </div>
        ),
      });
    }

    return baseColumns;
  }, [readOnly, openEditModal]);

  // Empty state icon
  const emptyIcon = (
    <svg
      className="w-6 h-6 text-[var(--text-muted)]"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
      />
    </svg>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-[var(--text-primary)]">
            Employees
          </h1>
          <p className="text-[var(--text-muted)] text-[13px] mt-0.5">
            {readOnly
              ? "View team members and their roles"
              : "Manage your team members and their permissions"}
          </p>
        </div>
        {!readOnly && (
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-3 py-1.5 rounded bg-[var(--accent-pink)] text-[var(--bg-deep)] text-[13px] font-medium hover:bg-[var(--accent-pink-dim)] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            Add Employee
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        {/* Search Input */}
        <div className="flex-1 max-w-md relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.5"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or email..."
            className="
              w-full pl-10 pr-3 py-2 rounded text-[13px]
              bg-[var(--bg-surface)] border border-[var(--border-subtle)]
              text-[var(--text-primary)] placeholder-[var(--text-muted)]
              focus:border-[var(--border-accent)] focus:ring-[2px] focus:ring-[var(--accent-pink-glow)]
              focus:outline-none transition-all duration-200
            "
          />
        </div>

        {/* Role Filter */}
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as "ALL" | UserRole)}
          className="
            px-3 py-2 rounded text-[13px]
            bg-[var(--bg-surface)] border border-[var(--border-subtle)]
            text-[var(--text-primary)]
            focus:border-[var(--border-accent)] focus:ring-[2px] focus:ring-[var(--accent-pink-glow)]
            focus:outline-none transition-all duration-200
            cursor-pointer
          "
        >
          <option value="ALL">All Roles</option>
          <option value="ADMIN">Admin</option>
          <option value="EMPLOYEE">Employee</option>
        </select>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="
            px-3 py-2 rounded text-[13px]
            bg-[var(--bg-surface)] border border-[var(--border-subtle)]
            text-[var(--text-primary)]
            focus:border-[var(--border-accent)] focus:ring-[2px] focus:ring-[var(--accent-pink-glow)]
            focus:outline-none transition-all duration-200
            cursor-pointer
          "
        >
          <option value="ALL_ACTIVE">All Active</option>
          <option value="PENDING">Pending Only</option>
          <option value="INCLUDE_INACTIVE">Include Deactivated</option>
        </select>

        {/* Result Count */}
        <div className="text-[13px] text-[var(--text-muted)]">
          {filteredEmployees.length} {filteredEmployees.length === 1 ? "result" : "results"}
        </div>
      </div>

      {/* Table */}
      <DataTable
        data={filteredEmployees}
        columns={columns}
        getRowKey={(employee) => employee.id}
        pageSize={25}
        emptyMessage={
          employees.length === 0 ? "No employees yet" : "No matching employees"
        }
        emptyIcon={emptyIcon}
      />

      {/* Modal - only shown when not in readOnly mode */}
      {!readOnly && modalMode && (
        <EmployeeModal
          mode={modalMode}
          formData={formData}
          selectedEmployeeName={selectedEmployee?.name || selectedEmployee?.email}
          isLoading={isLoading}
          error={error}
          onFormChange={handleFormChange}
          onSubmit={modalMode === "create" ? handleCreate : handleUpdate}
          onClose={closeModal}
        />
      )}
    </div>
  );
}
