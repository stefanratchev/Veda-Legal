"use client";

import { useSidebar } from "@/contexts/SidebarContext";

interface MainContentProps {
  children: React.ReactNode;
}

export function MainContent({ children }: MainContentProps) {
  const { isCollapsed } = useSidebar();

  return (
    <main
      className={`
        flex-1 overflow-x-hidden min-w-0
        transition-[margin] duration-200
        ${isCollapsed ? 'lg:ml-[56px]' : 'lg:ml-[220px]'}
      `}
    >
      {children}
    </main>
  );
}
