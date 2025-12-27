import React, { ReactElement } from "react";
import { render, RenderOptions } from "@testing-library/react";
import { MobileNavProvider } from "@/contexts/MobileNavContext";

interface ProvidersProps {
  children: React.ReactNode;
}

function AllTheProviders({ children }: ProvidersProps) {
  return <MobileNavProvider>{children}</MobileNavProvider>;
}

export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">
) {
  return render(ui, { wrapper: AllTheProviders, ...options });
}

// Re-export everything from testing-library
export * from "@testing-library/react";
export { renderWithProviders as render };
