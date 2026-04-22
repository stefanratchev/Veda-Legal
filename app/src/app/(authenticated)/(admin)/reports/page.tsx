import { getCurrentUser } from "@/lib/user";
import { ReportsContent } from "@/components/reports/ReportsContent";
import { getMonthRange, formatDateISO } from "@/lib/date-utils";
import { getReportData } from "@/lib/report-utils";

export default async function ReportsPage() {
  const user = await getCurrentUser();
  const isAdmin = ["ADMIN", "PARTNER"].includes(user.position);

  const today = new Date();
  const { start: startDate, end: endDate } = getMonthRange(today);

  const initialData = await getReportData({
    startDate: formatDateISO(startDate),
    endDate: formatDateISO(endDate),
    userId: user.id,
    isAdmin,
  });

  return <ReportsContent initialData={initialData} isAdmin={isAdmin} />;
}
