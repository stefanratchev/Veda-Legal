import { asc } from "drizzle-orm";
import { db, topics, subtopics } from "@/lib/db";
import { TopicsContent } from "@/components/topics/TopicsContent";

export default async function TopicsPage() {
  const topicsList = await db.query.topics.findMany({
    columns: {
      id: true,
      name: true,
      displayOrder: true,
      status: true,
      topicType: true,
    },
    with: {
      subtopics: {
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

  return <TopicsContent initialTopics={topicsList} />;
}
