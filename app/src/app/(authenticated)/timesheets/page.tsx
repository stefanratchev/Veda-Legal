import { eq, asc } from "drizzle-orm";
import { db, clients, topics, subtopics } from "@/lib/db";
import { TimesheetsContent } from "@/components/timesheets/TimesheetsContent";

export default async function TimesheetsPage() {
  // Fetch active clients for the dropdown
  const clientsList = await db.query.clients.findMany({
    where: eq(clients.status, "ACTIVE"),
    columns: {
      id: true,
      name: true,
    },
    orderBy: [asc(clients.name)],
  });

  // Fetch active topics with subtopics for the dropdown
  const topicsList = await db.query.topics.findMany({
    where: eq(topics.status, "ACTIVE"),
    columns: {
      id: true,
      name: true,
      displayOrder: true,
      status: true,
      topicType: true,
    },
    with: {
      subtopics: {
        where: eq(subtopics.status, "ACTIVE"),
        columns: {
          id: true,
          name: true,
          isPrefix: true,
          displayOrder: true,
          status: true,
        },
        orderBy: [asc(subtopics.displayOrder)],
      },
    },
    orderBy: [asc(topics.displayOrder)],
  });

  return <TimesheetsContent clients={clientsList} topics={topicsList} />;
}
