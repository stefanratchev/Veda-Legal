import { getCurrentUser } from "@/lib/user";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNavProvider } from "@/contexts/MobileNavContext";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  return (
    <MobileNavProvider>
      <div className="flex min-h-screen">
        <Sidebar
          user={{
            name: user.name,
            position: user.position,
            initials: user.initials,
            image: user.image,
          }}
          className="animate-slide-in"
        />
        <main className="flex-1 lg:ml-[240px]">
          <div className="px-3 py-4 md:px-4 lg:px-6 lg:py-5">{children}</div>
        </main>
      </div>
    </MobileNavProvider>
  );
}
