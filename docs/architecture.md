# Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         X-COIN FLYWHEEL                         │
│                     (Off-Chain Execution Bot)                    │
└─────────────────────────────────────────────────────────────────┘
                                 │
                 ┌───────────────┼───────────────┐
                 │               │               │
         ┌───────▼───────┐ ┌────▼─────┐ ┌──────▼──────┐
         │  Fee Source   │ │    DEX   │ │  X Ads API  │
         │   (Solana)    │ │ (Swaps)  │ │  (Manual)   │
         └───────────────┘ └──────────┘ └─────────────┘
```

## Component Architecture

### High-Level Layers

```
┌──────────────────────────────────────────────────┐
│                  SERVER LAYER                    │
│  - Webhook API (Fastify)                         │
│  - Metrics endpoint (Prometheus)                 │
│  - Health checks                                 │
└────────────┬─────────────────────────────────────┘
             │
┌────────────▼─────────────────────────────────────┐
│              EXECUTION LAYER                     │
│  - EpochScheduler (cron-like)                    │
│  - ExecutionEngine (orchestrator)                │
│  - AllocationEngine (splits fees)                │
└────────────┬─────────────────────────────────────┘
             │
    ┌────────┼────────┐
    │        │        │
┌───▼───┐ ┌──▼──┐ ┌──▼──────┐
│ FEES  │ │ DEX │ │   ADS   │
│SOURCE │ │SWAP │ │ ENGINE  │
└───┬───┘ └──┬──┘ └──┬──────┘
    │        │        │
┌───▼────────▼────────▼─────────────────────────┐
│           SOLANA BLOCKCHAIN                   │
│  - RPC client                                 │
│  - SPL token operations                       │
│  - Transaction signing                        │
└───────────────────────────────────────────────┘
```

## Core Components

### 1. Fee Source

**Purpose:** Detect and quantify protocol fees

```
┌─────────────────┐
│   FeeSource     │ (interface)
├─────────────────┤
│ + detectFees()  │
│ + getBalance()  │
└────────▲────────┘
         │
   ┌─────┴────────────┬──────────────┐
   │                  │              │
┌──▼──────────────┐ ┌─▼────────┐ ┌──▼─────┐
│WalletWatcher    │ │ Indexer  │ │  Mock  │
│FeeSource        │ │FeeSource │ │Source  │
└─────────────────┘ └──────────┘ └────────┘
```

- **WalletWatcherFeeSource:** Polls Solana wallet for inflows
- **IndexerFeeSource:** (Stub) Query blockchain indexer
- **MockFeeSource:** Simulates fees for testing

### 2. Execution Engine

**Purpose:** Orchestrate epoch execution

```
EpochScheduler
    │
    ├─> Trigger every N seconds
    │
    ▼
ExecutionEngine
    │
    ├─> 1. Fetch fees (FeeSource)
    │
    ├─> 2. Allocate budget (AllocationEngine)
    │
    ├─> 3. Check risk (RiskManager)
    │
    ├─> 4. Execute buyback (DEX)
    │
    ├─> 5. Execute ads (AdsEngine)
    │
    ├─> 6. Generate report (ReportWriter)
    │
    └─> 7. Log metrics (Prometheus)
```

### 3. Allocation Engine

**Purpose:** Split fees according to strategy

```typescript
Input: {
  fees: { sol: 10, usdc: 500 },
  strategy: { buybackPct: 50, adsPct: 50 }
}

Output: {
  buyback_usd: 255,
  ads_usd: 255,
  remaining_usd: 0
}
```

**Validation:**
- Total allocations ≤ 100%
- Minimum thresholds met
- Risk limits respected

### 4. DEX Connector

**Purpose:** Execute token swaps on Solana DEXes

```
┌─────────────┐
│ DexSwapper  │ (interface)
├─────────────┤
│ + getQuote()│
│ + swap()    │
└──────▲──────┘
       │
  ┌────┴─────┬────────┬──────┐
  │          │        │      │
┌─▼──────┐ ┌─▼──┐ ┌──▼───┐ ┌▼─────┐
│Raydium │ │Orca│ │Meteora│ │ Mock │
└────────┘ └────┘ └───────┘ └──────┘
```

**Flow:**
1. Request quote (input asset → $x)
2. Validate slippage/price impact
3. Build transaction
4. Sign with executor wallet
5. Send and confirm
6. Return transaction signature

### 5. Ads Engine

**Purpose:** Manage X ads campaigns

```
┌──────────────┐
│  AdsEngine   │ (interface)
├──────────────┤
│ + planCampaign() │
│ + execute()      │
└───────▲──────────┘
        │
   ┌────┴────────┬─────────────┬───────────┐
   │             │             │           │
┌──▼────┐ ┌─────▼──────┐ ┌────▼─────┐ ┌──▼──────┐
│XAds   │ │ DryRun     │ │ Manual   │ │ (Future)│
│Engine │ │ AdsEngine  │ │AdsEngine │ │         │
└───────┘ └────────────┘ └──────────┘ └─────────┘
```

**Modes:**
- **XAdsEngine:** API integration (stub)
- **DryRunAdsEngine:** Simulation only
- **ManualAdsEngine:** Generate spec for operator

### 6. Risk Manager

**Purpose:** Enforce safety limits

```typescript
RiskManager.check({
  budget_usd: 1000,
  slippage_bps: 250,
  price_impact_bps: 400,
  last_epoch_time: <timestamp>
})

Returns: {
  allowed: true,
  warnings: [],
  blocked_reason: null
}
```

**Checks:**
- Budget within limits
- Slippage acceptable
- Price impact reasonable
- Minimum interval elapsed
- Circuit breaker state

### 7. Circuit Breaker

**Purpose:** Stop execution on repeated failures

```
State Machine:
         ┌──────┐
         │CLOSED│ (normal)
         └───┬──┘
             │ failure
             ▼
         ┌──────┐
         │ OPEN │ (blocked)
         └───┬──┘
             │ timeout
             ▼
      ┌──────────┐
      │HALF-OPEN │ (testing)
      └─────┬────┘
            │
        success → CLOSED
        failure → OPEN
```

**Configuration:**
- `failureThreshold`: Failures before opening (default: 3)
- `resetTimeout`: Time before testing (default: 5 minutes)

### 8. Reporting

**Purpose:** Transparent epoch records

```typescript
EpochReport {
  epoch_id: number,
  timestamp: ISO8601,
  fees: {
    sources: [...],
    total_usd: number
  },
  allocation: {
    buyback_usd: number,
    ads_usd: number
  },
  execution: {
    buyback: {
      quote: {...},
      tx_signature: string,
      tokens_acquired: number
    },
    ads: {
      mode: string,
      campaign_id?: string,
      spend_usd: number
    }
  },
  balances: {
    before: {...},
    after: {...}
  },
  signatures: {
    executor: string,
    timestamp: number
  }
}
```

Saved to: `/reports/epoch-<id>-<timestamp>.json`

## Data Flow

### Epoch Execution Sequence

```
1. SCHEDULE
   EpochScheduler → triggerEpoch()

2. DETECT FEES
   ExecutionEngine → FeeSource.detectFees()
   └─> Query Solana RPC
   └─> Calculate USD value
   └─> Return: { sol: X, usdc: Y }

3. ALLOCATE
   ExecutionEngine → AllocationEngine.allocate()
   └─> Split according to strategy
   └─> Return: { buyback_usd, ads_usd }

4. RISK CHECK
   ExecutionEngine → RiskManager.check()
   └─> Validate limits
   └─> Return: { allowed: true/false }

5. EXECUTE BUYBACK
   ExecutionEngine → DexSwapper.swap()
   └─> Get quote
   └─> Validate slippage
   └─> Build + sign transaction
   └─> Send to Solana
   └─> Confirm
   └─> Return: { tx_signature, tokens }

6. EXECUTE ADS
   ExecutionEngine → AdsEngine.execute()
   └─> Plan campaign
   └─> [If API mode] Create campaign
   └─> [If manual mode] Output spec
   └─> Return: { campaign_id?, status }

7. REPORT
   ExecutionEngine → ReportWriter.write()
   └─> Compile all data
   └─> Sign report
   └─> Save to /reports
   └─> Return: { report_path }

8. NOTIFY
   ExecutionEngine → TweetSummary.generate()
   └─> Format human-readable summary
   └─> Log to console / webhook
```

## Wallet Architecture

```
┌────────────────────┐
│  EXECUTOR WALLET   │ (Hot wallet, holds signing keys)
│                    │
│  Purpose:          │
│  - Sign DEX swaps  │
│  - Pay gas fees    │
│                    │
│  Security:         │
│  - Env var secret  │
│  - OR keypair file │
│  - Limited funds   │
└────────────────────┘

┌────────────────────┐
│ FEE COLLECTOR      │ (Watch-only)
│                    │
│  Purpose:          │
│  - Receive fees    │
│  - Source of truth │
│                    │
│  Security:         │
│  - Public key only │
│  - No private key  │
└────────────────────┘

┌────────────────────┐
│  VAULT WALLET(S)   │ (Optional, future)
│                    │
│  Purpose:          │
│  - Hold $x tokens  │
│  - Multisig access │
│                    │
│  Security:         │
│  - Squads multisig │
│  - Governance      │
└────────────────────┘
```

## Network Topology (Production)

```
                  Internet
                     │
            ┌────────▼────────┐
            │  Load Balancer  │
            └────────┬────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
   ┌────▼────┐  ┌───▼─────┐  ┌──▼──────┐
   │ Bot #1  │  │ Bot #2  │  │ Bot #3  │
   │(Primary)│  │(Backup) │  │(Monitor)│
   └────┬────┘  └───┬─────┘  └──┬──────┘
        │           │            │
        └───────────┼────────────┘
                    │
              ┌─────▼─────┐
              │   Solana  │
              │    RPC    │
              └───────────┘
```

**Redundancy:**
- Primary bot executes epochs
- Backup bot takes over if primary fails
- Monitor bot watches for anomalies

## Security Boundaries

```
┌──────────────────────────────────────┐
│         TRUST BOUNDARY               │
│                                      │
│  ┌────────────────────────────────┐ │
│  │  Executor Wallet (Hot)         │ │
│  │  - Can sign transactions       │ │
│  │  - Limited blast radius        │ │
│  └────────────────────────────────┘ │
│                                      │
│  ┌────────────────────────────────┐ │
│  │  Configuration (Sensitive)     │ │
│  │  - API keys                    │ │
│  │  - Risk limits                 │ │
│  └────────────────────────────────┘ │
└──────────────────────────────────────┘

External Attack Surface:
- Webhook endpoint (authenticated)
- Metrics endpoint (read-only)
- RPC endpoint (rate-limited)
```

## Observability

```
Application
    │
    ├─> Logger (Pino)
    │   └─> Console / File / Syslog
    │
    ├─> Metrics (Prometheus)
    │   └─> Counters, Gauges, Histograms
    │       - epochs_total
    │       - fees_collected_usd
    │       - buyback_tokens_acquired
    │       - ads_spend_usd
    │       - errors_total
    │
    └─> Reports (JSON files)
        └─> Archived per epoch
```

**Metrics exported:**
- `flywheel_epochs_total`: Total epochs executed
- `flywheel_fees_collected_usd`: Cumulative fees
- `flywheel_buyback_usd`: Cumulative buyback spend
- `flywheel_ads_usd`: Cumulative ads spend
- `flywheel_errors_total`: Error count by type
- `flywheel_circuit_breaker_state`: 0=closed, 1=open, 2=half-open

## Deployment Models

### 1. Single VPS
- Docker Compose
- Simplest setup
- No redundancy

### 2. Kubernetes
- Helm chart (future)
- Auto-scaling
- High availability

### 3. Serverless (Future)
- AWS Lambda / GCP Cloud Run
- Event-driven epochs
- Cost-efficient at low volume

## Technology Stack Summary

| Layer               | Technology           |
|---------------------|----------------------|
| Language            | TypeScript (Node 20) |
| Runtime             | Node.js              |
| Package Manager     | pnpm                 |
| Web Server          | Fastify              |
| Blockchain Client   | @solana/web3.js      |
| Logging             | Pino                 |
| Metrics             | Prometheus           |
| Validation          | Zod                  |
| Testing             | Vitest               |
| Linting             | ESLint + Prettier    |
| Containerization    | Docker               |
| Orchestration       | Docker Compose       |
| CI/CD               | GitHub Actions       |
