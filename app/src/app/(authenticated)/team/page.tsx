import { desc } from "drizzle-orm";
import { db, users } from "@/lib/db";
import { getCurrentUser } from "@/lib/user";
import { EmployeesContent } from "@/components/employees/EmployeesContent";

export default async function EmployeesPage() {
  // Get current user for role-based access
  const user = await getCurrentUser();

  // Fetch employees from database
  const employees = await db.query.users.findMany({
    columns: {
      id: true,
      name: true,
      email: true,
      position: true,
      status: true,
      createdAt: true,
      lastLogin: true,
    },
    orderBy: [desc(users.createdAt)],
  });

  // Convert for client component (timestamps already strings from Drizzle)
  const serializedEmployees = employees.map((employee) => ({
    ...employee,
    createdAt: employee.createdAt,
    lastLogin: employee.lastLogin ?? null,
  }));

  return (
    <EmployeesContent
      initialEmployees={serializedEmployees}
      currentUserId={user.id}
      currentUserPosition={user.position}
      readOnly={!["ADMIN", "PARTNER"].includes(user.position)}
    />
  );
}
