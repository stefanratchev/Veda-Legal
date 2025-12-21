import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/user";

export default async function BillingPage() {
  const user = await getCurrentUser();

  if (user.role !== "ADMIN") {
    redirect("/timesheets");
  }

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-semibold text-[var(--text-primary)]">
        Billing
      </h1>
      <p className="text-[var(--text-secondary)]">
        Billing features coming soon.
      </p>
    </div>
  );
}
