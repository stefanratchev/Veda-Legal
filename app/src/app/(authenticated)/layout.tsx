import { getCurrentUser } from "@/lib/user";
import { Sidebar } from "@/components/layout/Sidebar";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-screen">
      <Sidebar
        user={{
          name: user.name,
          role: user.role,
          initials: user.initials,
        }}
        className="animate-slide-in"
      />
      <main className="flex-1 ml-[240px]">
        <div className="px-6 py-5">{children}</div>
      </main>
    </div>
  );
}
