# Mechanics: Fees → Buyback + Ads

## Fee Collection

### Source
- **Creator fees** from $x token transfers on Solana
- Configured at token creation (e.g., 1-5% per transfer)
- Accumulated in a designated **Fee Collector Wallet**

### Monitoring
The `WalletWatcherFeeSource` polls the fee collector wallet every epoch to detect:
- SOL inflows
- USDC inflows
- SPL token inflows (converted to USD equivalent)

## Epoch Cycle

An **epoch** is a fixed time interval (default: 1 hour).

Each epoch:
1. **Detect fees** collected since last epoch
2. **Allocate budget** according to strategy
3. **Execute swaps** on DEX for buybacks
4. **Plan/execute ads** on X platform
5. **Generate report** with full transparency

## Allocation Strategy

Configured via `strategy.ts` and environment variables:

| Parameter        | Default | Description                          |
|------------------|---------|--------------------------------------|
| `buybackPct`     | 50%     | Percentage of fees used for buybacks |
| `adsPct`         | 50%     | Percentage of fees used for X ads    |
| `burnPct`        | 0%      | (Optional) Burn tokens               |
| `lpAddPct`       | 0%      | (Optional) Add liquidity to pools    |

**Total must equal 100%.**

### Example

Epoch detects **$1,000 USD** in fees:
- **$500** → Buy $x tokens from DEX (price support)
- **$500** → Promote target post on X (visibility)

## Buyback Execution

1. **Calculate USD budget** from allocation
2. **Get optimal route** from DEX aggregator (Raydium/Orca/Meteora)
3. **Check slippage/price impact** against risk limits:
   - `maxSlippageBps` (default: 300 = 3%)
   - `maxPriceImpactBps` (default: 500 = 5%)
4. **Execute swap** via executor wallet
5. **Transfer $x tokens** to vault or burn address

### Safety Checks
- Slippage too high? → Skip epoch
- Liquidity too low? → Skip epoch
- Circuit breaker triggered? → Stop execution

## Ads Execution

Three modes:

### 1. Dry-Run (Default)
- Generates campaign plan
- Writes to report
- **Does not spend money**
- Safe for testing

### 2. Manual
- Outputs campaign spec JSON
- Operator copies to X Ads Manager
- Reports planned spend

### 3. API (Optional)
- Requires X Ads API credentials
- Programmatically creates/funds campaign
- Real budget is spent
- **Use with caution**

### Ad Campaign Structure

```json
{
  "objective": "AWARENESS",
  "budget_usd": 500,
  "duration_hours": 24,
  "targeting": {
    "keywords": ["crypto", "solana", "defi"],
    "interests": ["cryptocurrency", "blockchain"],
    "geo": ["US", "EU"]
  },
  "creative": {
    "post_id": "<target_tweet_id>",
    "call_to_action": "Learn more about the flywheel"
  }
}
```

## Reporting

Each epoch generates:
- **`epoch-<timestamp>.json`** in `/reports`
- Contains:
  - Fees detected (amount, source, USD value)
  - Allocation breakdown
  - Swap details (route, quote, execution tx)
  - Ad plan/result (campaign ID, spend, status)
  - Balances snapshot (before/after)
  - Timestamp, executor address, signatures

- **Tweet summary** (plain text):
  ```
  🔄 Epoch #42 Complete
  
  💰 Fees: $1,000 USD
  📈 Bought: 12,500 $x (~$500)
  📢 Ads: $500 campaign active
  
  TX: <solscan link>
  Report: <github link>
  ```

## Risk Controls

- **maxBudgetPerEpochUSD**: Hard cap per epoch (default: $1,000)
- **minIntervalSeconds**: Minimum time between epochs (prevents spam)
- **requireManualApproval**: If true, epoch pauses for operator confirmation
- **Circuit breaker**: Stops after N consecutive failures

## Fee Sustainability

For the flywheel to be sustainable:
- Fees collected per epoch must exceed operating costs (gas fees, etc.)
- If fees drop below threshold, system enters "hibernation" mode
- Alerts operator to review viability

## Future Enhancements

- **Governance vault**: Community votes on allocation percentages
- **Dynamic allocation**: Adjust based on market conditions
- **Multi-DEX routing**: Split orders across multiple venues for better execution
- **LP rewards**: Incentivize liquidity providers from fee pool
