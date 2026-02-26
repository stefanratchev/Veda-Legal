/**
 * Compute chart container height based on number of data items.
 * After maxBars grouping, effective bar count = min(dataLength, maxBars) + 1 if overflow exists.
 * Each bar gets 22px; minimum height is 120px to ensure axes and labels render properly.
 */
export function getChartHeight(dataLength: number, maxBars: number = 20): number {
  const effectiveBars = Math.min(dataLength, maxBars) + (dataLength > maxBars ? 1 : 0);
  return Math.max(120, effectiveBars * 22);
}
