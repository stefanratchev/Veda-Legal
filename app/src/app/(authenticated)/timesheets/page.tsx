import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/user";
import { TimesheetsContent } from "@/components/timesheets/TimesheetsContent";

export default async function TimesheetsPage() {
  // Get user from cached function (shared with layout, no duplicate queries)
  const user = await getCurrentUser();

  // Fetch active clients for the dropdown
  const clients = await db.client.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      name: true,
      timesheetCode: true,
    },
    orderBy: { name: "asc" },
  });

  return <TimesheetsContent userId={user.id} clients={clients} />;
}
