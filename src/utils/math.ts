/**
 * Convert basis points to decimal (e.g., 300 bps = 0.03)
 */
export function bpsToDecimal(bps: number): number {
  return bps / 10000;
}

/**
 * Convert decimal to basis points (e.g., 0.03 = 300 bps)
 */
export function decimalToBps(decimal: number): number {
  return Math.round(decimal * 10000);
}

/**
 * Calculate percentage of a value
 */
export function percentage(value: number, pct: number): number {
  return (value * pct) / 100;
}

/**
 * Clamp value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Format USD with 2 decimal places
 */
export function formatUSD(value: number): string {
  return `$${value.toFixed(2)}`;
}

/**
 * Format token amount with appropriate decimals
 */
export function formatTokenAmount(amount: number, decimals: number = 6): string {
  return (amount / Math.pow(10, decimals)).toFixed(decimals);
}

/**
 * Calculate price impact in basis points
 */
export function calculatePriceImpact(
  inputAmount: number,
  outputAmount: number,
  expectedRate: number
): number {
  const actualRate = outputAmount / inputAmount;
  const impactDecimal = Math.abs(1 - actualRate / expectedRate);
  return decimalToBps(impactDecimal);
}

/**
 * Safe division (returns 0 if denominator is 0)
 */
export function safeDivide(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}
