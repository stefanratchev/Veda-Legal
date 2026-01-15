"use client";

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";

interface SidebarContextType {
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  toggleCollapsed: () => void;
}

const SidebarContext = createContext<SidebarContextType | null>(null);

export function SidebarProvider({ children }: { children: ReactNode }) {
  // Initialize to false for SSR, sync from localStorage on mount
  const [isCollapsed, setIsCollapsedState] = useState(false);

  // Initialize from localStorage on mount (client-side only)
  useEffect(() => {
    const stored = localStorage.getItem('sidebarCollapsed');
    if (stored === 'true') {
      setIsCollapsedState(true);
    }
  }, []);

  // Persist to localStorage when changed
  const setIsCollapsed = useCallback((collapsed: boolean) => {
    setIsCollapsedState(collapsed);
    localStorage.setItem('sidebarCollapsed', String(collapsed));
  }, []);

  const toggleCollapsed = useCallback(() => {
    setIsCollapsed(!isCollapsed);
  }, [isCollapsed, setIsCollapsed]);

  return (
    <SidebarContext.Provider value={{ isCollapsed, setIsCollapsed, toggleCollapsed }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within SidebarProvider");
  }
  return context;
}
