# Runbook: Operations & Incident Response

## Overview

This runbook provides step-by-step procedures for operating and troubleshooting the x-coin-flywheel system.

## Routine Operations

### Starting the System

#### Development (Local)
```bash
# Copy example env
cp .env.example .env

# Edit with your values
nano .env

# Install dependencies
pnpm install

# Run in dev mode
pnpm dev
```

#### Production (Docker)
```bash
# Ensure .env is configured
# (Do NOT use .env.example in production)

# Start services
docker-compose up -d

# Check logs
docker-compose logs -f x-coin-flywheel

# Check status
docker-compose ps
```

### Stopping the System

```bash
# Graceful shutdown
docker-compose down

# Force stop (emergency)
docker-compose kill
```

### Viewing Logs

```bash
# Real-time logs
docker-compose logs -f

# Last 100 lines
docker-compose logs --tail=100

# Specific service
docker-compose logs x-coin-flywheel

# Export logs
docker-compose logs > flywheel-logs-$(date +%Y%m%d).txt
```

### Checking Health

#### Health Endpoint
```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "healthy",
  "uptime": 3600,
  "lastEpoch": "2026-02-04T12:00:00Z",
  "circuitBreaker": "closed"
}
```

#### Metrics
```bash
curl http://localhost:9090/metrics | grep flywheel
```

Key metrics:
- `flywheel_epochs_total`: Should increment each epoch
- `flywheel_errors_total`: Should be low
- `flywheel_circuit_breaker_state`: Should be 0 (closed)

### Manual Epoch Execution

```bash
# Run a single epoch (bypasses scheduler)
pnpm run epoch:once

# Or via webhook
curl -X POST http://localhost:3000/webhook/trigger \
  -H "Authorization: Bearer YOUR_WEBHOOK_SECRET"
```

### Simulating an Epoch (Dry-Run)

```bash
# Runs full logic without real transactions
pnpm run simulate
```

### Fetching Current Fees

```bash
# Check fee collector balance without executing epoch
pnpm run fetch-fees
```

### Taking a Snapshot

```bash
# Snapshot all relevant wallet balances
pnpm run snapshot
```

Output saved to `/reports/snapshot-<timestamp>.json`

## Configuration Changes

### Updating Strategy

Edit `.env`:
```bash
# Change allocation
BUYBACK_PERCENT=60
ADS_PERCENT=40

# Restart service
docker-compose restart x-coin-flywheel
```

**Note:** Changes apply to next epoch, not current.

### Changing Ads Mode

```bash
# Switch to dry-run (safe)
ADS_ENGINE_MODE=dry-run

# Switch to manual (recommended)
ADS_ENGINE_MODE=manual

# Switch to API (advanced)
ADS_ENGINE_MODE=api
```

### Adjusting Risk Parameters

```bash
# Increase max slippage (use caution)
MAX_SLIPPAGE_BPS=500  # 5%

# Decrease budget cap
MAX_BUDGET_PER_EPOCH_USD=500

# Restart required
docker-compose restart
```

## Incident Response

### Scenario 1: Executor Wallet Compromised

**Symptoms:**
- Unauthorized transactions from executor wallet
- Unexpected balance changes

**Immediate Actions:**
1. **Stop the bot**
   ```bash
   docker-compose down
   ```

2. **Generate new executor wallet**
   ```bash
   solana-keygen new -o /secure/new-executor.json
   ```

3. **Transfer remaining funds**
   ```bash
   # From compromised to new wallet
   solana transfer NEW_PUBKEY ALL --keypair /secure/old-executor.json
   ```

4. **Update configuration**
   ```bash
   # In .env
   EXECUTOR_KEYPAIR_PATH=/secure/new-executor.json
   ```

5. **Restart with new wallet**
   ```bash
   docker-compose up -d
   ```

6. **Monitor for 24 hours**

**Follow-up:**
- Review logs to identify how compromise occurred
- Audit file permissions
- Consider moving to hardware wallet

### Scenario 2: Circuit Breaker Triggered

**Symptoms:**
- Log message: "Circuit breaker OPEN"
- Epoch execution stops
- Metric: `flywheel_circuit_breaker_state` = 1

**Diagnosis:**
```bash
# Check recent logs
docker-compose logs --tail=50 | grep -i error

# Check last epoch report
cat reports/epoch-*.json | jq '.errors'
```

**Common Causes:**
- RPC node unavailable
- DEX liquidity too low
- Slippage exceeded
- Transaction failures

**Resolution:**
1. **Identify root cause** from logs

2. **Fix the issue** (examples):
   - Switch to different RPC endpoint
   - Wait for liquidity to improve
   - Adjust slippage limits

3. **Reset circuit breaker**
   ```bash
   # Restart service (auto-resets if timeout elapsed)
   docker-compose restart
   
   # Or manually via webhook (if implemented)
   curl -X POST http://localhost:3000/webhook/reset-circuit-breaker \
     -H "Authorization: Bearer YOUR_SECRET"
   ```

4. **Test with simulation**
   ```bash
   pnpm run simulate
   ```

5. **Resume normal operations**

### Scenario 3: Fees Not Detected

**Symptoms:**
- Epoch reports show $0 fees
- Fee collector wallet has balance
- No swaps executed

**Diagnosis:**
```bash
# Check fee collector balance directly
pnpm run fetch-fees

# Verify FEE_COLLECTOR_PUBKEY in .env
echo $FEE_COLLECTOR_PUBKEY

# Check RPC connection
curl $SOLANA_RPC_URL -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}'
```

**Common Causes:**
- Wrong fee collector address in config
- RPC node not synced
- Fee source polling logic bug

**Resolution:**
1. Verify configuration
2. Test RPC connectivity
3. Check code for bugs in `WalletWatcherFeeSource.ts`

### Scenario 4: Swap Failing (High Slippage)

**Symptoms:**
- Log: "Slippage exceeds maximum"
- Epoch completes but no buyback transaction

**Diagnosis:**
```bash
# Check recent quote
cat reports/epoch-*.json | jq '.execution.buyback.quote'
```

**Resolution:**
1. **Temporary:** Increase `MAX_SLIPPAGE_BPS` slightly
   ```bash
   MAX_SLIPPAGE_BPS=500  # 5% (was 3%)
   ```

2. **Better:** Split order across multiple epochs
   - Reduce `MAX_BUDGET_PER_EPOCH_USD`
   - Run more frequent epochs

3. **Best:** Wait for liquidity to improve
   - Set `ENABLE_SCHEDULER=false` temporarily
   - Resume when DEX liquidity is better

### Scenario 5: Ads Not Running (Manual Mode)

**Symptoms:**
- Epochs complete successfully
- Reports show ad plan generated
- No actual ads running on X

**Expected Behavior:**
In `manual` mode, operator must manually create campaigns.

**Procedure:**
1. **Review latest epoch report**
   ```bash
   cat reports/epoch-*.json | jq '.execution.ads'
   ```

2. **Extract campaign spec**
   ```json
   {
     "budget_usd": 500,
     "duration_hours": 24,
     "targeting": { ... },
     "post_id": "1234567890"
   }
   ```

3. **Go to X Ads Manager:** https://ads.twitter.com

4. **Create campaign** with matching parameters

5. **Note campaign ID** for records

6. **(Optional) Log in next epoch**

**Automation (Future):**
- Implement webhook to notify operator
- Email or Slack alert with campaign spec

### Scenario 6: RPC Rate Limited

**Symptoms:**
- Log: "429 Too Many Requests"
- Slow or failed epoch execution

**Resolution:**
1. **Switch to paid RPC provider**
   ```bash
   # In .env
   SOLANA_RPC_URL=https://api.mainnet-beta.solana.com  # Free (limited)
   # OR
   SOLANA_RPC_URL=https://rpc.ankr.com/solana  # Ankr
   # OR
   SOLANA_RPC_URL=https://solana-api.projectserum.com  # Serum
   ```

2. **Increase epoch interval**
   ```bash
   EPOCH_INTERVAL_SECONDS=7200  # 2 hours instead of 1
   ```

3. **Add retry logic** (already implemented in `retry.ts`)

### Scenario 7: Unexpected High Fees

**Symptoms:**
- Epoch reports show unusually high fees
- No corresponding trading activity

**Possible Causes:**
- Whale transfer (single large transfer with fee)
- Airdrop to fee collector (unintended)
- Bug in fee detection logic

**Diagnosis:**
```bash
# Check transactions to fee collector
solana transactions FEE_COLLECTOR_PUBKEY --limit 20
```

**Resolution:**
1. Verify transactions are legitimate fees
2. If anomaly, investigate source
3. If bug, fix `WalletWatcherFeeSource.ts`
4. Consider adding sanity checks (max fee per epoch)

## Monitoring & Alerts

### Prometheus Alerts (Example)

```yaml
# prometheus_alerts.yml
groups:
  - name: flywheel
    interval: 30s
    rules:
      - alert: FlywheelDown
        expr: up{job="x-coin-flywheel"} == 0
        for: 5m
        annotations:
          summary: "Flywheel service is down"
      
      - alert: CircuitBreakerOpen
        expr: flywheel_circuit_breaker_state == 1
        for: 1m
        annotations:
          summary: "Circuit breaker triggered"
      
      - alert: HighErrorRate
        expr: rate(flywheel_errors_total[5m]) > 1
        annotations:
          summary: "Error rate exceeding 1 per 5 minutes"
```

### Setting Up Alerts

1. **Prometheus Alertmanager**
   ```bash
   # docker-compose.yml (add)
   alertmanager:
     image: prom/alertmanager
     ports:
       - "9093:9093"
     volumes:
       - ./alertmanager.yml:/etc/alertmanager/alertmanager.yml
   ```

2. **Configure notifications** (email, Slack, PagerDuty)

## Key Rotation

### Executor Wallet Rotation

**Frequency:** Every 90 days or after suspected compromise

**Procedure:**
1. Generate new keypair
   ```bash
   solana-keygen new -o /secure/executor-new.json
   ```

2. Fund new wallet with gas fees
   ```bash
   solana transfer NEW_PUBKEY 0.1 --keypair /secure/executor-old.json
   ```

3. Stop service
   ```bash
   docker-compose down
   ```

4. Update config
   ```bash
   EXECUTOR_KEYPAIR_PATH=/secure/executor-new.json
   ```

5. Test
   ```bash
   pnpm run simulate
   ```

6. Deploy
   ```bash
   docker-compose up -d
   ```

7. Archive old keypair securely
   ```bash
   mv /secure/executor-old.json /archive/executor-$(date +%Y%m%d).json
   ```

### Webhook Secret Rotation

```bash
# Generate new secret
openssl rand -base64 32

# Update .env
WEBHOOK_SECRET=<new_secret>

# Restart
docker-compose restart

# Update clients (if any)
```

## Backup & Recovery

### Configuration Backup

```bash
# Backup .env (encrypted)
gpg -c .env
mv .env.gpg /secure/backups/env-$(date +%Y%m%d).gpg

# Backup keypairs
tar -czf keypairs-backup-$(date +%Y%m%d).tar.gz /secure/*.json
gpg -c keypairs-backup-$(date +%Y%m%d).tar.gz
```

### Reports Backup

```bash
# Sync reports to remote storage
rsync -av reports/ user@backup-server:/backups/x-coin-flywheel/reports/

# Or to S3
aws s3 sync reports/ s3://my-bucket/x-coin-reports/
```

### Disaster Recovery

If server fails completely:

1. **Provision new server**
2. **Restore configurations**
   ```bash
   gpg -d env-YYYYMMDD.gpg > .env
   ```
3. **Deploy**
   ```bash
   docker-compose up -d
   ```
4. **Verify**
   ```bash
   pnpm run simulate
   ```
5. **Resume**

## Performance Tuning

### Increasing Epoch Frequency

```bash
# Reduce interval (use with caution)
EPOCH_INTERVAL_SECONDS=1800  # 30 minutes

# Ensure RPC can handle load
# Ensure enough fees to justify gas costs
```

### Reducing Memory Usage

```bash
# Limit log retention
docker-compose logs --tail=1000 > /dev/null

# Prune old reports (keep last 30 days)
find reports/ -name "epoch-*.json" -mtime +30 -delete
```

## Upgrades

### Upgrading Code

```bash
# Pull latest code
git pull origin main

# Install new dependencies
pnpm install

# Run tests
pnpm test

# Rebuild
pnpm run build

# Restart
docker-compose down
docker-compose build
docker-compose up -d
```

### Upgrading Dependencies

```bash
# Check for updates
pnpm outdated

# Update (test in staging first!)
pnpm update

# Audit security
pnpm audit

# Test thoroughly
pnpm test
```

## Troubleshooting Commands

### Check Executor Balance
```bash
solana balance EXECUTOR_PUBKEY --url $SOLANA_RPC_URL
```

### Check Fee Collector Balance
```bash
solana balance FEE_COLLECTOR_PUBKEY --url $SOLANA_RPC_URL
```

### Verify Token Account
```bash
spl-token accounts TOKEN_MINT --owner EXECUTOR_PUBKEY
```

### Inspect Transaction
```bash
solana confirm SIGNATURE -v
```

### Test DEX Quote (Manual)
```bash
# Using Raydium SDK or Jupiter API
curl "https://quote-api.jup.ag/v6/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=TOKEN_MINT&amount=1000000"
```

## Support & Escalation

### Community Support
- GitHub Issues
- Discord (if available)
- Forum (if available)

### Critical Issues
- Email: security@example.com (for vulnerabilities)
- Emergency contact: <on-call phone>

## Changelog

Maintain a changelog of operational changes:

```markdown
## 2026-02-04
- Initial deployment to production
- Set epoch interval to 1 hour
- Ads mode: manual

## 2026-02-05
- Increased MAX_SLIPPAGE_BPS to 500 due to low liquidity
- Rotated executor wallet (scheduled rotation)
```

## Conclusion

This runbook should be treated as a living document. Update it as:
- New issues are discovered
- Procedures change
- System evolves

**Golden Rules:**
1. Always test changes in staging first
2. Keep backups current
3. Document everything
4. Monitor continuously
5. When in doubt, stop the system and investigate
