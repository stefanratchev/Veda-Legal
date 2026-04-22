/**
 * Currency formatters shared across reports chart components.
 * Lifted from RevenueChart.tsx so PricingHealthChart and any future
 * chart can reuse the same formatting semantics.
 */

export function formatEur(value: number): string {
  if (value >= 1000) {
    return `€${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}K`;
  }
  return `€${Math.round(value)}`;
}

export function formatEurPerHour(value: number): string {
  return `€${Math.round(value)}/hr`;
}
