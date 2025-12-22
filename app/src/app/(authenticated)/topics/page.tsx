import { db } from "@/lib/db";
import { TopicsContent } from "@/components/topics/TopicsContent";

export default async function TopicsPage() {
  const topics = await db.topic.findMany({
    select: {
      id: true,
      name: true,
      displayOrder: true,
      status: true,
      subtopics: {
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

  return <TopicsContent initialTopics={topics} />;
}
