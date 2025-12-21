import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/user";
import { EmployeesContent } from "@/components/employees/EmployeesContent";

export default async function EmployeesPage() {
  // Get current user for role-based access
  const user = await getCurrentUser();

  // Fetch employees from database
  const employees = await db.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // Convert for client component (Date to string)
  const serializedEmployees = employees.map((employee) => ({
    ...employee,
    createdAt: employee.createdAt.toISOString(),
  }));

  return (
    <EmployeesContent
      initialEmployees={serializedEmployees}
      readOnly={user.role !== "ADMIN"}
    />
  );
}
