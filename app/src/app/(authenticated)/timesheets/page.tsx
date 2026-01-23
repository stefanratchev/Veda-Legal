import { eq, asc } from "drizzle-orm";
import { db, clients, topics, subtopics } from "@/lib/db";
import { TimesheetsContent } from "@/components/timesheets/TimesheetsContent";
import { getCurrentUser } from "@/lib/user";
import { hasAdminAccess } from "@/lib/auth-utils";

export default async function TimesheetsPage() {
  const user = await getCurrentUser();
  const isAdmin = hasAdminAccess(user.position);

  // Fetch active clients for the dropdown (including clientType for filtering topics)
  const clientsList = await db.query.clients.findMany({
    where: eq(clients.status, "ACTIVE"),
    columns: {
      id: true,
      name: true,
      clientType: true,
    },
    orderBy: [asc(clients.name)],
  });

  // Filter out MANAGEMENT clients for non-admin users
  const filteredClients = isAdmin
    ? clientsList
    : clientsList.filter((c) => c.clientType !== "MANAGEMENT");

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

  return <TimesheetsContent clients={filteredClients} topics={topicsList} />;
}
