import { config } from './env.js';

export interface AllocationStrategy {
  buybackPct: number;
  adsPct: number;
  burnPct: number;
  lpAddPct: number;
}

export interface RiskLimits {
  maxBudgetPerEpochUSD: number;
  maxSlippageBps: number;
  maxPriceImpactBps: number;
  minIntervalSeconds: number;
  maxAdSpendPerEpochUSD: number;
  requireManualApproval: boolean;
}

export const strategy: AllocationStrategy = {
  buybackPct: config.BUYBACK_PERCENT,
  adsPct: config.ADS_PERCENT,
  burnPct: config.BURN_PERCENT,
  lpAddPct: config.LP_ADD_PERCENT,
};

export const riskLimits: RiskLimits = {
  maxBudgetPerEpochUSD: config.MAX_BUDGET_PER_EPOCH_USD,
  maxSlippageBps: config.MAX_SLIPPAGE_BPS,
  maxPriceImpactBps: config.MAX_PRICE_IMPACT_BPS,
  minIntervalSeconds: config.MIN_INTERVAL_SECONDS,
  maxAdSpendPerEpochUSD: config.MAX_AD_SPEND_PER_EPOCH_USD,
  requireManualApproval: config.REQUIRE_MANUAL_APPROVAL,
};

// Validate strategy totals 100%
const total = strategy.buybackPct + strategy.adsPct + strategy.burnPct + strategy.lpAddPct;
if (Math.abs(total - 100) > 0.01) {
  throw new Error(`Strategy allocation must total 100%, got ${total}%`);
}
