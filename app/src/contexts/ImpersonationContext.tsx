"use client";

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { useRouter } from "next/navigation";

interface ImpersonatedUser {
  id: string;
  name: string | null;
  position: string;
  image: string | null;
}

interface ImpersonationContextType {
  isImpersonating: boolean;
  impersonatedUser: ImpersonatedUser | null;
  isLoading: boolean;
  startImpersonation: (userId: string) => Promise<void>;
  stopImpersonation: () => Promise<void>;
  refresh: () => Promise<void>;
}

const ImpersonationContext = createContext<ImpersonationContextType | null>(null);

export function ImpersonationProvider({ children }: { children: ReactNode }) {
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [impersonatedUser, setImpersonatedUser] = useState<ImpersonatedUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/impersonate");
      if (response.ok) {
        const data = await response.json();
        setIsImpersonating(data.impersonating ?? false);
        setImpersonatedUser(data.user ?? null);
      } else {
        setIsImpersonating(false);
        setImpersonatedUser(null);
      }
    } catch {
      setIsImpersonating(false);
      setImpersonatedUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const startImpersonation = useCallback(async (userId: string) => {
    const response = await fetch("/api/admin/impersonate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Failed to start impersonation");
    }

    const data = await response.json();
    setIsImpersonating(true);
    setImpersonatedUser({
      id: data.user.id,
      name: data.user.name,
      position: data.user.position,
      image: data.user.image ?? null,
    });

    router.push("/timesheets");
    router.refresh();
  }, [router]);

  const stopImpersonation = useCallback(async () => {
    const response = await fetch("/api/admin/impersonate", {
      method: "DELETE",
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Failed to stop impersonation");
    }

    setIsImpersonating(false);
    setImpersonatedUser(null);
    router.refresh();
  }, [router]);

  return (
    <ImpersonationContext.Provider
      value={{
        isImpersonating,
        impersonatedUser,
        isLoading,
        startImpersonation,
        stopImpersonation,
        refresh,
      }}
    >
      {children}
    </ImpersonationContext.Provider>
  );
}

export function useImpersonation() {
  const context = useContext(ImpersonationContext);
  if (!context) {
    throw new Error("useImpersonation must be used within ImpersonationProvider");
  }
  return context;
}
