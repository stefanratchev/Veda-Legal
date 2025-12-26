"use client";

import type { M365ActivityResponse } from "@/types";

interface M365ActivityPanelProps {
  data: M365ActivityResponse | null;
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
  date: string;
}

/**
 * M365ActivityPanel - Stub component for TDD
 * TODO: Implement in Task 7
 */
export function M365ActivityPanel({
  data,
  isLoading,
  error,
  onClose,
  date,
}: M365ActivityPanelProps) {
  // Stub - to be implemented
  return null;
}
