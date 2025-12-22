import { db } from "@/lib/db";
import { TopicsContent } from "@/components/topics/TopicsContent";

export default async function TopicsPage() {
  const topics = await db.topic.findMany({
    select: {
      id: true,
      name: true,
      code: true,
      displayOrder: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { displayOrder: "asc" },
  });

  const serializedTopics = topics.map((t) => ({
    ...t,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }));

  return <TopicsContent initialTopics={serializedTopics} />;
}
