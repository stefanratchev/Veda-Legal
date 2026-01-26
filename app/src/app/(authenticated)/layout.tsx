import { getCurrentUser } from "@/lib/user";
import { Sidebar } from "@/components/layout/Sidebar";
import { MainContent } from "@/components/layout/MainContent";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { OverdueBanner } from "@/components/layout/OverdueBanner";
import { MobileNavProvider } from "@/contexts/MobileNavContext";
import { SidebarProvider } from "@/contexts/SidebarContext";
import { ImpersonationProvider } from "@/contexts/ImpersonationContext";
import { hasAdminAccess } from "@/lib/api-utils";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  const isAdmin = hasAdminAccess(user.position);

  return (
    <ImpersonationProvider>
      <MobileNavProvider>
        <SidebarProvider>
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
            <MainContent>
              <OverdueBanner isAdmin={isAdmin} userName={user.name} />
              <MobileHeader />
              <div className="px-3 py-4 md:px-4 lg:px-6 lg:py-5">{children}</div>
            </MainContent>
          </div>
        </SidebarProvider>
      </MobileNavProvider>
    </ImpersonationProvider>
  );
}
