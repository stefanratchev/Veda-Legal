import { db } from "@/lib/db";
import { TimesheetsContent } from "@/components/timesheets/TimesheetsContent";

export default async function TimesheetsPage() {
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

  // Fetch active topics for the dropdown
  const topics = await db.topic.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      name: true,
      code: true,
    },
    orderBy: { displayOrder: "asc" },
  });

  return <TimesheetsContent clients={clients} topics={topics} />;
}
