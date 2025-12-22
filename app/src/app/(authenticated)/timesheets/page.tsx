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

  // Fetch active topics with subtopics for the dropdown
  const topics = await db.topic.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      name: true,
      displayOrder: true,
      status: true,
      subtopics: {
        where: { status: "ACTIVE" },
        select: {
          id: true,
          name: true,
          isPrefix: true,
          displayOrder: true,
          status: true,
        },
        orderBy: { displayOrder: "asc" },
      },
    },
    orderBy: { displayOrder: "asc" },
  });

  return <TimesheetsContent clients={clients} topics={topics} />;
}
