import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/user";

export default async function ReportsPage() {
  const user = await getCurrentUser();

  if (user.role !== "ADMIN") {
    redirect("/timesheets");
  }

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-semibold text-[var(--text-primary)]">
        Reports
      </h1>
      <p className="text-[var(--text-secondary)]">
        Reporting features coming soon.
      </p>
    </div>
  );
}
