import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const envSchema = z.object({
  // Network
  SOLANA_RPC_URL: z.string().url(),
  SOLANA_NETWORK: z.enum(['devnet', 'mainnet-beta', 'testnet']).default('devnet'),

  // Wallets
  EXECUTOR_SECRET_KEY: z.string().optional(),
  EXECUTOR_KEYPAIR_PATH: z.string().optional(),
  FEE_COLLECTOR_PUBKEY: z.string().min(32),
  TOKEN_MINT: z.string().min(32),

  // Strategy
  BUYBACK_PERCENT: z.coerce.number().min(0).max(100).default(50),
  ADS_PERCENT: z.coerce.number().min(0).max(100).default(50),
  BURN_PERCENT: z.coerce.number().min(0).max(100).default(0),
  LP_ADD_PERCENT: z.coerce.number().min(0).max(100).default(0),

  // Risk Parameters
  MAX_BUDGET_PER_EPOCH_USD: z.coerce.number().positive().default(1000),
  MAX_SLIPPAGE_BPS: z.coerce.number().min(0).max(10000).default(300),
  MAX_PRICE_IMPACT_BPS: z.coerce.number().min(0).max(10000).default(500),
  MIN_INTERVAL_SECONDS: z.coerce.number().positive().default(3600),
  MAX_AD_SPEND_PER_EPOCH_USD: z.coerce.number().positive().default(500),
  REQUIRE_MANUAL_APPROVAL: z.coerce.boolean().default(true),

  // Ads Engine
  ADS_ENGINE_MODE: z.enum(['dry-run', 'manual', 'api']).default('dry-run'),
  ADS_TARGET_POST_ID: z.string().optional(),
  X_ADS_API_KEY: z.string().optional(),
  X_ADS_API_SECRET: z.string().optional(),
  X_ADS_ACCOUNT_ID: z.string().optional(),

  // Execution
  EPOCH_INTERVAL_SECONDS: z.coerce.number().positive().default(3600),
  ENABLE_SCHEDULER: z.coerce.boolean().default(false),

  // Server
  ENABLE_WEBHOOK: z.coerce.boolean().default(false),
  WEBHOOK_PORT: z.coerce.number().default(3000),
  WEBHOOK_SECRET: z.string().optional(),

  // Monitoring
  ENABLE_METRICS: z.coerce.boolean().default(true),
  METRICS_PORT: z.coerce.number().default(9090),

  // Logging
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  LOG_PRETTY: z.coerce.boolean().default(true),

  // Circuit Breaker
  CIRCUIT_BREAKER_FAILURE_THRESHOLD: z.coerce.number().positive().default(3),
  CIRCUIT_BREAKER_RESET_TIMEOUT_MS: z.coerce.number().positive().default(300000),
});

// Validate and parse environment variables
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment configuration:');
  console.error(parsed.error.format());
  process.exit(1);
}

export const config = parsed.data;

// Additional validation: strategy percentages must sum to 100
const strategyTotal =
  config.BUYBACK_PERCENT + config.ADS_PERCENT + config.BURN_PERCENT + config.LP_ADD_PERCENT;

if (Math.abs(strategyTotal - 100) > 0.01) {
  console.error(
    `❌ Strategy percentages must sum to 100%, got ${strategyTotal}%`
  );
  process.exit(1);
}

// Validate wallet configuration
if (!config.EXECUTOR_SECRET_KEY && !config.EXECUTOR_KEYPAIR_PATH) {
  console.error('❌ Must provide either EXECUTOR_SECRET_KEY or EXECUTOR_KEYPAIR_PATH');
  process.exit(1);
}

// Validate ads configuration
if (config.ADS_ENGINE_MODE === 'api') {
  if (!config.X_ADS_API_KEY || !config.X_ADS_API_SECRET || !config.X_ADS_ACCOUNT_ID) {
    console.error('❌ API mode requires X_ADS_API_KEY, X_ADS_API_SECRET, and X_ADS_ACCOUNT_ID');
    process.exit(1);
  }
}

if (config.ADS_ENGINE_MODE !== 'dry-run' && !config.ADS_TARGET_POST_ID) {
  console.error('❌ ADS_TARGET_POST_ID is required for manual and api modes');
  process.exit(1);
}

// Validate webhook configuration
if (config.ENABLE_WEBHOOK && !config.WEBHOOK_SECRET) {
  console.error('❌ WEBHOOK_SECRET is required when ENABLE_WEBHOOK is true');
  process.exit(1);
}

console.log('✅ Configuration validated successfully');
