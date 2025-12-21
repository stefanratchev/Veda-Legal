"use client";

import { useState, useCallback, useMemo } from "react";
import { UserRole } from "@prisma/client";
import { DataTable } from "@/components/ui/DataTable";
import { TableFilters } from "@/components/ui/TableFilters";
import { ColumnDef } from "@/components/ui/table-types";
import { EmployeeModal } from "./EmployeeModal";

interface Employee {
  id: string;
  name: string | null;
  email: string;
  role: UserRole;
  createdAt: string;
  lastLogin: string | null;
}

interface EmployeesContentProps {
  initialEmployees: Employee[];
  readOnly?: boolean;
}

type ModalMode = "edit" | null;

interface FormData {
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

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return "Never";
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
    name: "",
    role: "EMPLOYEE",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"ALL" | UserRole>("ALL");

  // Filtered employees
  const filteredEmployees = useMemo(() => {
    return employees.filter((employee) => {
      if (roleFilter !== "ALL" && employee.role !== roleFilter) {
        return false;
      }
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName =
          employee.name?.toLowerCase().includes(query) ?? false;
        const matchesEmail = employee.email.toLowerCase().includes(query);
        return matchesName || matchesEmail;
      }
      return true;
    });
  }, [employees, searchQuery, roleFilter]);

  // Modal handlers
  const openEditModal = useCallback((employee: Employee) => {
    setFormData({
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
          <span className="text-[13px] text-[var(--text-secondary)]">
            {formatDateTime(employee.lastLogin)}
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
      </div>

      {/* Filters */}
      <TableFilters
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search by name or email..."
        filterOptions={[
          { value: "ALL", label: "All Roles" },
          { value: "ADMIN", label: "Admin" },
          { value: "EMPLOYEE", label: "Employee" },
        ]}
        filterValue={roleFilter}
        onFilterChange={(value) => setRoleFilter(value as "ALL" | UserRole)}
        resultCount={filteredEmployees.length}
      />

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
      {!readOnly && modalMode === "edit" && selectedEmployee && (
        <EmployeeModal
          formData={formData}
          selectedEmployeeName={selectedEmployee.name || selectedEmployee.email}
          isLoading={isLoading}
          error={error}
          onFormChange={handleFormChange}
          onSubmit={handleUpdate}
          onClose={closeModal}
        />
      )}
    </div>
  );
}
