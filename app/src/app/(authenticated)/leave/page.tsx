import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { leavePeriods } from "@/lib/schema";
import { getCurrentUser } from "@/lib/user";
import { LeaveContent } from "@/components/leave/LeaveContent";

export default async function LeavePage() {
  const user = await getCurrentUser();
  const isAdmin = ["ADMIN", "PARTNER"].includes(user.position);

  // Fetch leave periods based on role
  const leaveData = await db.query.leavePeriods.findMany({
    where: isAdmin ? undefined : eq(leavePeriods.userId, user.id),
    with: {
      user: { columns: { name: true } },
      reviewedBy: { columns: { name: true } },
    },
    orderBy: [desc(leavePeriods.createdAt)],
  });

  const serializedLeave = leaveData.map((lp) => ({
    id: lp.id,
    userId: lp.userId,
    userName: lp.user?.name || null,
    startDate: lp.startDate,
    endDate: lp.endDate,
    leaveType: lp.leaveType,
    status: lp.status,
    reason: lp.reason,
    reviewedById: lp.reviewedById,
    reviewedByName: lp.reviewedBy?.name || null,
    reviewedAt: lp.reviewedAt,
    rejectionReason: lp.rejectionReason,
    createdAt: lp.createdAt,
  }));

  return (
    <LeaveContent
      initialLeave={serializedLeave}
      currentUserId={user.id}
      isAdmin={isAdmin}
    />
  );
}
