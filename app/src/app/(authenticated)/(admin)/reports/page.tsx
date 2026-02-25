import { getCurrentUser } from "@/lib/user";
import { ReportsContent } from "@/components/reports/ReportsContent";
import { getMonthRange, formatDateISO, getPreviousPeriod } from "@/lib/date-utils";
import { getReportData } from "@/lib/report-utils";

export default async function ReportsPage() {
  const user = await getCurrentUser();
  const isAdmin = ["ADMIN", "PARTNER"].includes(user.position);

  // Get current month range
  const today = new Date();
  const { start: startDate, end: endDate } = getMonthRange(today);

  // Get comparison period (previous month)
  const comparisonPeriod = getPreviousPeriod(startDate, endDate);

  // Fetch both periods in parallel
  const [initialData, initialComparisonData] = await Promise.all([
    getReportData({
      startDate: formatDateISO(startDate),
      endDate: formatDateISO(endDate),
      userId: user.id,
      isAdmin,
    }),
    getReportData({
      startDate: formatDateISO(comparisonPeriod.start),
      endDate: formatDateISO(comparisonPeriod.end),
      userId: user.id,
      isAdmin,
    }),
  ]);

  return (
    <ReportsContent
      initialData={initialData}
      initialComparisonData={initialComparisonData}
      isAdmin={isAdmin}
      currentUserId={user.id}
    />
  );
}
