import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/user";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!["ADMIN", "PARTNER"].includes(user.position)) {
    redirect("/timesheets");
  }

  return children;
}
