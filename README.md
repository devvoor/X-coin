# $x Flywheel

> **⚠️ IMPORTANT DISCLAIMER:**  
> This is an **UNOFFICIAL, COMMUNITY-DRIVEN EXPERIMENT**.  
> **NOT affiliated with X Corp, Elon Musk, xAI, SpaceX, or any related entities.**  
> **NOT financial advice. Cryptocurrency involves significant risk. DYOR.**

[![CI](https://github.com/devvoor/X-coin/actions/workflows/ci.yml/badge.svg)](https://github.com/devvoor/X-coin/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## What is $x?

**$x** is a community experiment that creates a self-reinforcing flywheel:

```
Creator Fees → 50% Buybacks + 50% X Ads → More Visibility → More Activity → More Fees → ...
```

The token uses its own creator fees to:
1. **Buy itself back** from DEXes (price support)
2. **Promote itself** via X (Twitter) ads

All operations are **transparent**, **on-chain**, and **automated**.

**Read more:** [Concept](./docs/concept.md) • [Mechanics](./docs/mechanics.md) • [DISCLAIMER](./docs/DISCLAIMER.md)

## Features

✅ **Fee-Driven Flywheel:** Protocol fees fund buybacks + ads  
✅ **Transparent:** Every epoch produces public report with tx signatures  
✅ **Safe Defaults:** Ads disabled until explicitly enabled  
✅ **Modular:** Swap DEX, ads mode, strategy via config  
✅ **Risk Controls:** Slippage limits, circuit breaker, budget caps  
✅ **Production-Ready:** Docker, CI/CD, metrics, tests

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 8+
- Solana CLI (optional)
- Docker & Docker Compose (for production)

### Installation

```bash
# Clone repository
git clone https://github.com/devvoor/X-coin.git
cd X-coin

# Install dependencies
pnpm install

# Copy environment template
cp .env.example .env

# Edit .env with your configuration
nano .env
```

### Configuration

Edit `.env`:

```bash
# NETWORK (use devnet for testing)
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_NETWORK=devnet

# EXECUTOR WALLET (signs swaps)
EXECUTOR_SECRET_KEY=<your_base58_secret>
# OR
EXECUTOR_KEYPAIR_PATH=/path/to/keypair.json

# FEE COLLECTOR (watch-only, receives creator fees)
FEE_COLLECTOR_PUBKEY=<fee_collector_public_key>

# TOKEN
TOKEN_MINT=<your_token_mint_address>

# STRATEGY (must total 100%)
BUYBACK_PERCENT=50
ADS_PERCENT=50

# RISK LIMITS
MAX_BUDGET_PER_EPOCH_USD=1000
MAX_SLIPPAGE_BPS=300
MAX_PRICE_IMPACT_BPS=500

# ADS (start with dry-run!)
ADS_ENGINE_MODE=dry-run
ADS_TARGET_POST_ID=
```

**See full config:** [Environment Variables](#environment-variables)

### Development

```bash
# Run in development mode (auto-reload)
pnpm dev

# Run tests
pnpm test

# Lint code
pnpm lint

# Simulate an epoch (safe, no real transactions)
pnpm run simulate
```

### Production

```bash
# Build
docker-compose build

# Start services (app + Prometheus)
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

## How It Works

### Epoch Cycle (Default: Every 1 hour)

```
1. DETECT FEES
   └─> Poll fee collector wallet
   └─> Calculate USD value

2. ALLOCATE
   └─> 50% → Buyback budget
   └─> 50% → Ads budget

3. CHECK RISKS
   └─> Slippage within limits?
   └─> Budget within cap?
   └─> Circuit breaker closed?

4. EXECUTE BUYBACK
   └─> Get best DEX route (Raydium/Orca/etc.)
   └─> Execute swap: SOL/USDC → $x
   └─> Send tokens to vault

5. EXECUTE ADS
   └─> [dry-run] Simulate campaign
   └─> [manual] Output campaign spec for operator
   └─> [api] Create campaign via X Ads API

6. GENERATE REPORT
   └─> JSON report → /reports/epoch-<timestamp>.json
   └─> Tweet-ready summary
   └─> TX signatures, balances, etc.
```

**Read more:** [Architecture](./docs/architecture.md)

## Ads Integration

Three modes:

### 1. Dry-Run (Default, Safest)
```bash
ADS_ENGINE_MODE=dry-run
```
- Simulates ad campaigns
- **Does NOT spend money**
- Writes plan to report
- Best for testing

### 2. Manual (Recommended for Production)
```bash
ADS_ENGINE_MODE=manual
ADS_TARGET_POST_ID=1234567890
```
- Generates campaign spec
- Operator manually creates campaign in X Ads Manager
- No API credentials needed
- Full human oversight

### 3. API (Advanced)
```bash
ADS_ENGINE_MODE=api
ADS_TARGET_POST_ID=1234567890
X_ADS_API_KEY=<key>
X_ADS_API_SECRET=<secret>
X_ADS_ACCOUNT_ID=<id>
```
- Fully automated
- Requires X Ads API access (gated/private)
- **Spends real money**
- Use with extreme caution

**Read more:** [Ads Integration](./docs/ads.md)

## Environment Variables

### Network
| Variable | Description | Default |
|----------|-------------|---------|
| `SOLANA_RPC_URL` | Solana RPC endpoint | (required) |
| `SOLANA_NETWORK` | Network name (devnet/mainnet-beta) | devnet |

### Wallets
| Variable | Description |
|----------|-------------|
| `EXECUTOR_SECRET_KEY` | Base58 private key (OR use keypair file) |
| `EXECUTOR_KEYPAIR_PATH` | Path to keypair JSON (OR use secret key) |
| `FEE_COLLECTOR_PUBKEY` | Public key of fee collector (watch-only) |
| `TOKEN_MINT` | $x token mint address |

### Strategy
| Variable | Default | Description |
|----------|---------|-------------|
| `BUYBACK_PERCENT` | 50 | % of fees for buybacks |
| `ADS_PERCENT` | 50 | % of fees for ads |
| `BURN_PERCENT` | 0 | % to burn (optional) |
| `LP_ADD_PERCENT` | 0 | % to add liquidity (optional) |

**Total must equal 100%.**

### Risk Parameters
| Variable | Default | Description |
|----------|---------|-------------|
| `MAX_BUDGET_PER_EPOCH_USD` | 1000 | Max USD to spend per epoch |
| `MAX_SLIPPAGE_BPS` | 300 | Max slippage (3%) |
| `MAX_PRICE_IMPACT_BPS` | 500 | Max price impact (5%) |
| `MIN_INTERVAL_SECONDS` | 3600 | Min time between epochs |
| `MAX_AD_SPEND_PER_EPOCH_USD` | 500 | Max ads spend per epoch |
| `REQUIRE_MANUAL_APPROVAL` | true | Pause for approval before execution |

### Ads
| Variable | Default | Description |
|----------|---------|-------------|
| `ADS_ENGINE_MODE` | dry-run | Mode: dry-run \| manual \| api |
| `ADS_TARGET_POST_ID` | - | Tweet/post ID to promote |
| `X_ADS_API_KEY` | - | (API mode only) |
| `X_ADS_API_SECRET` | - | (API mode only) |
| `X_ADS_ACCOUNT_ID` | - | (API mode only) |

### Execution
| Variable | Default | Description |
|----------|---------|-------------|
| `EPOCH_INTERVAL_SECONDS` | 3600 | Time between epochs |
| `ENABLE_SCHEDULER` | false | Auto-run epochs on interval |
| `ENABLE_WEBHOOK` | false | Enable webhook API |
| `WEBHOOK_PORT` | 3000 | Webhook port |
| `WEBHOOK_SECRET` | - | Webhook auth secret |

### Monitoring
| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_METRICS` | true | Prometheus metrics |
| `METRICS_PORT` | 9090 | Metrics endpoint port |
| `LOG_LEVEL` | info | Log level (debug/info/warn/error) |
| `LOG_PRETTY` | true | Pretty-print logs |

### Circuit Breaker
| Variable | Default | Description |
|----------|---------|-------------|
| `CIRCUIT_BREAKER_FAILURE_THRESHOLD` | 3 | Failures before opening |
| `CIRCUIT_BREAKER_RESET_TIMEOUT_MS` | 300000 | Reset timeout (5 min) |

## CLI Commands

```bash
# Development
pnpm dev                 # Run with auto-reload
pnpm start               # Run production build

# Building
pnpm build               # Compile TypeScript

# Testing
pnpm test                # Run all tests
pnpm test:watch          # Run tests in watch mode
pnpm test:coverage       # Run with coverage report

# Linting
pnpm lint                # Check code style
pnpm lint:fix            # Fix code style issues
pnpm format              # Format code
pnpm format:check        # Check formatting

# Utilities
pnpm run simulate        # Simulate epoch (no real tx)
pnpm run epoch:once      # Run single epoch
pnpm run fetch-fees      # Check fee collector balance
pnpm run snapshot        # Snapshot wallet balances
pnpm run webhook         # Start webhook server
```

## Transparency & Reporting

Every epoch generates:

### JSON Report (`/reports/epoch-<id>-<timestamp>.json`)
```json
{
  "epoch_id": 42,
  "timestamp": "2026-02-04T12:00:00Z",
  "fees": {
    "total_usd": 1000,
    "sources": [...]
  },
  "allocation": {
    "buyback_usd": 500,
    "ads_usd": 500
  },
  "execution": {
    "buyback": {
      "quote": {...},
      "tx_signature": "3Xk7...",
      "tokens_acquired": 12500
    },
    "ads": {
      "mode": "manual",
      "budget_usd": 500,
      "campaign_spec": {...}
    }
  },
  "balances": {
    "before": {...},
    "after": {...}
  }
}
```

### Tweet Summary
```
🔄 Epoch #42 Complete

💰 Fees: $1,000 USD
📈 Bought: 12,500 $x (~$500)
📢 Ads: $500 campaign ready

TX: https://solscan.io/tx/3Xk7...
Report: https://github.com/.../epoch-42.json
```

All reports are **signed**, **timestamped**, and **publicly archived**.

## Repository Structure

```
x-coin-flywheel/
├── docs/                       # Documentation
│   ├── DISCLAIMER.md          # Legal disclaimer
│   ├── concept.md             # Flywheel concept
│   ├── mechanics.md           # How it works
│   ├── ads.md                 # Ads integration guide
│   ├── architecture.md        # System architecture
│   ├── security.md            # Security considerations
│   └── runbook.md             # Operations guide
├── src/
│   ├── index.ts               # Entry point
│   ├── config/
│   │   ├── env.ts             # Environment config (Zod)
│   │   └── strategy.ts        # Allocation strategy
│   ├── core/
│   │   ├── feeSource/         # Fee detection
│   │   ├── executor/          # Epoch execution
│   │   ├── strategy/          # Budget allocation
│   │   ├── ads/               # Ads engines
│   │   ├── risk/              # Risk management
│   │   └── reporting/         # Reports & summaries
│   ├── solana/                # Solana client & SPL
│   ├── dex/                   # DEX connectors
│   ├── server/                # Webhook API
│   └── utils/                 # Logger, retry, math
├── scripts/                   # CLI utilities
├── tests/                     # Unit & integration tests
├── reports/                   # Epoch reports (gitignored)
├── Dockerfile
├── docker-compose.yml
├── package.json
├── tsconfig.json
└── README.md
```

## Security

### Key Principles
- Executor wallet holds minimal funds (gas only)
- Fee collector is watch-only
- All transactions simulated before execution
- Circuit breaker stops on repeated failures
- Rate limits prevent spam
- Secrets never in code

### Checklist Before Production
- [ ] Keys stored securely (not in code)
- [ ] File permissions set (600 for keys)
- [ ] Webhook secret configured
- [ ] Risk limits set conservatively
- [ ] Ads mode set to `manual` or `dry-run`
- [ ] Tests passing
- [ ] Monitoring configured

**Read more:** [Security](./docs/security.md) • [Runbook](./docs/runbook.md)

## Roadmap

### Phase 1: Core Flywheel (Current)
- ✅ Fee detection (wallet watcher)
- ✅ Buyback execution (DEX swaps)
- ✅ Dry-run ads engine
- ✅ Reporting & transparency
- ✅ Risk controls & circuit breaker

### Phase 2: Manual Ads Flow
- ✅ Manual ads engine (campaign spec output)
- 🚧 Webhook for operator notifications
- 🚧 Campaign tracking & analytics

### Phase 3: API Integration (Optional)
- 🔮 X Ads API integration (if access granted)
- 🔮 Automated campaign creation
- 🔮 Performance optimization

### Phase 4: Governance (Future)
- 🔮 Multisig vaults (Squads/Realms)
- 🔮 Community voting on allocation %
- 🔮 DAO treasury management
- 🔮 Governance token integration

Legend: ✅ Complete • 🚧 In Progress • 🔮 Planned

## Contributing

We welcome contributions! Please:

1. Read [DISCLAIMER.md](./docs/DISCLAIMER.md)
2. Fork the repo
3. Create a feature branch
4. Make your changes
5. Add tests
6. Submit PR

**Code standards:**
- TypeScript strict mode
- ESLint + Prettier
- 80%+ test coverage
- Clear commit messages

## Testing

```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test:coverage

# Run specific test
pnpm test src/core/strategy/AllocationEngine.test.ts
```

Tests cover:
- ✅ Allocation logic
- ✅ Risk checks
- ✅ Circuit breaker states
- ✅ Tweet summary formatting
- ✅ Fee source detection
- ✅ Mock integrations

## Monitoring

### Prometheus Metrics

Available at `http://localhost:9090/metrics`:

- `flywheel_epochs_total`: Total epochs executed
- `flywheel_fees_collected_usd`: Cumulative fees
- `flywheel_buyback_usd`: Cumulative buyback spend
- `flywheel_ads_usd`: Cumulative ads spend
- `flywheel_errors_total`: Error count by type
- `flywheel_circuit_breaker_state`: 0=closed, 1=open

### Grafana Dashboard (Optional)

Connect Grafana to Prometheus for visualizations:
- Fee collection over time
- Buyback vs ads allocation
- Error rates
- Circuit breaker events

## FAQ

### Q: Is this the official X coin?
**A: NO.** This is an unofficial community experiment. Not affiliated with X Corp or Elon Musk.

### Q: Is this financial advice?
**A: NO.** This is experimental software. DYOR. Only participate with funds you can afford to lose.

### Q: How do I get X Ads API access?
**A:** X Ads API is private/gated. Apply at [ads.twitter.com](https://ads.twitter.com). Not required—use `manual` mode instead.

### Q: What if the flywheel stops?
**A:** If fees drop below operating costs, the system hibernates. No perpetual promises made.

### Q: Can I change the allocation percentages?
**A:** Yes, via `.env`. Future governance may allow community voting.

### Q: What DEXes are supported?
**A:** Raydium (partial implementation), Orca (stub), Meteora (stub). Extensible via `DexSwapper` interface.

### Q: Is the code audited?
**A:** Not yet. Use at your own risk. Consider professional audit before large-scale deployment.

## Support

- **Issues:** [GitHub Issues](https://github.com/devvoor/X-coin/issues)
- **Discussions:** [GitHub Discussions](https://github.com/devvoor/X-coin/discussions)
- **Security:** See [Security Policy](./docs/security.md#vulnerability-disclosure)

## License

MIT License - see [LICENSE](./LICENSE)

## Disclaimer (Again)

**This software is provided "AS IS" without warranty of any kind.**

- Not financial advice
- Not affiliated with X Corp, Elon Musk, or related entities
- Cryptocurrency involves risk
- Only participate with funds you can afford to lose
- Consult legal/tax professionals before use

**Read full disclaimer:** [docs/DISCLAIMER.md](./docs/DISCLAIMER.md)

---

**Built with ❤️ by the community**

**Remember:** This is an experiment. The flywheel might succeed, might fail, might teach us something new. That's the point.

🌐 [Website](#) • 📢 [Twitter](#) • 💬 [Discord](#)
