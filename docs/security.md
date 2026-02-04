# Security

## Threat Model

### Assets at Risk
1. **Executor wallet private keys** (highest risk)
2. **Fee collector funds** (medium risk, watch-only)
3. **X Ads API credentials** (if used)
4. **Configuration secrets**

### Attack Vectors

#### 1. Private Key Compromise
- Stolen executor wallet → attacker can drain funds, execute unauthorized swaps
- **Mitigation:**
  - Store keys encrypted at rest
  - Use hardware wallets for high-value operations (future)
  - Limit executor wallet balance
  - Rotate keys periodically

#### 2. Configuration Manipulation
- Attacker modifies `.env` → changes allocation, disables safety checks
- **Mitigation:**
  - File permissions (600)
  - Immutable infrastructure (Docker)
  - Config validation (Zod)
  - Audit logs

#### 3. DEX Manipulation
- Sandwich attacks during buyback swaps
- Fake liquidity pools
- **Mitigation:**
  - Slippage limits
  - Price impact checks
  - Use reputable DEXes only
  - Simulate transactions before execution

#### 4. Webhook Abuse
- Attacker triggers epochs repeatedly → drains budget
- **Mitigation:**
  - Webhook authentication (secret token)
  - Rate limiting
  - Circuit breaker
  - IP allowlist (optional)

#### 5. Dependency Vulnerabilities
- Malicious npm packages
- Outdated dependencies
- **Mitigation:**
  - `pnpm audit` in CI
  - Lock file (`pnpm-lock.yaml`)
  - Dependabot alerts
  - Review updates before merging

#### 6. X Ads Account Compromise
- Attacker gains access to ads account → spends budget maliciously
- **Mitigation:**
  - 2FA on X account
  - Separate ad account from personal
  - Budget caps per campaign
  - Monitor spend anomalies

## Security Best Practices

### 1. Key Management

#### Environment Variable (Development)
```bash
# .env
EXECUTOR_SECRET_KEY=<base58_secret>
```
**Pros:** Simple
**Cons:** Exposed in process memory, logs, etc.
**Recommendation:** Dev/test only

#### Keypair File (Production)
```bash
# .env
EXECUTOR_KEYPAIR_PATH=/secure/path/executor.json
```
**File permissions:**
```bash
chmod 600 /secure/path/executor.json
chown executor:executor /secure/path/executor.json
```
**Pros:** More secure
**Cons:** Still filesystem-based

#### Future: Hardware Wallet / HSM
- Ledger integration
- Cloud KMS (AWS KMS, GCP KMS)
- Threshold signatures

### 2. Separation of Concerns

| Wallet            | Purpose                | Key Type        | Balance          |
|-------------------|------------------------|-----------------|------------------|
| Executor          | Signs transactions     | Hot (private)   | Minimal (gas)    |
| Fee Collector     | Receives fees          | Watch-only      | Accumulates fees |
| Vault (future)    | Stores $x              | Multisig (cold) | High value       |

**Rationale:**
- Compromised executor cannot steal accumulated fees
- Vault requires multiple signatures (Squads, Realms)

### 3. Least Privilege

Executor wallet should only have permissions to:
- Swap on DEX
- Transfer to vault (if configured)

Executor wallet should NOT:
- Control fee collector
- Modify token metadata
- Access vault funds

### 4. Input Validation

All user inputs validated via Zod schemas:
```typescript
const ConfigSchema = z.object({
  MAX_BUDGET_PER_EPOCH_USD: z.number().positive().max(10000),
  MAX_SLIPPAGE_BPS: z.number().min(0).max(1000),
  // ...
});
```

### 5. Rate Limiting

```typescript
// Prevent spam epochs
if (timeSinceLastEpoch < MIN_INTERVAL_SECONDS) {
  throw new Error('Rate limit: too soon');
}
```

### 6. Circuit Breaker

```typescript
// Stop after 3 consecutive failures
if (consecutiveFailures >= 3) {
  circuitBreaker.open();
  // Requires manual reset
}
```

### 7. Transaction Simulation

Before sending real transactions:
```typescript
const simulation = await connection.simulateTransaction(tx);
if (simulation.value.err) {
  throw new Error('Simulation failed');
}
```

### 8. Audit Logging

All critical actions logged:
- Epoch start/end
- Fee detection
- Swap execution (tx signature)
- Ads execution
- Configuration changes
- Errors

Logs are:
- Timestamped
- Structured (JSON)
- Immutable (append-only)

## Operations Security

### Deployment

1. **Use immutable infrastructure**
   - Docker images with pinned versions
   - No mutable config on running containers

2. **Secrets management**
   - Never commit secrets to git
   - Use Docker secrets or env files (not in repo)
   - Rotate secrets regularly

3. **Network isolation**
   - Firewall rules (only required ports)
   - VPC/subnet isolation
   - No public SSH if possible

### Monitoring

1. **Alert on anomalies**
   - Sudden spike in fees
   - Failed epochs
   - Circuit breaker triggered
   - Unusual DEX slippage

2. **Metrics to watch**
   - `flywheel_errors_total` (should be low)
   - `flywheel_circuit_breaker_state` (should be 0)
   - Executor wallet balance (should not drain)
   - Fee collector balance (should accumulate)

### Incident Response

See [runbook.md](./runbook.md) for detailed procedures.

**Quick actions:**
1. **Stop the bot:** `docker-compose down`
2. **Kill switch:** Set `ADS_ENGINE_MODE=dry-run` and `ENABLE_SCHEDULER=false`
3. **Rotate keys:** Generate new executor wallet, update config
4. **Review logs:** Check `/logs` and `/reports` for unauthorized activity

## Compliance & Legal

### Regulatory Considerations

- **US:** Consult securities law (tokens may be securities)
- **EU:** MiCA regulations for crypto assets
- **Ads:** Crypto advertising restricted in some regions

### Data Privacy

- No PII collected from users
- On-chain data is public by nature
- Logs should not contain sensitive data

### Terms of Service

If operating as a service:
- Publish clear ToS
- Disclaimer of liability
- Age restrictions (18+)
- Geographic restrictions

## Security Checklist

Before deploying to production:

- [ ] Keys stored securely (not in code)
- [ ] `.env` in `.gitignore`
- [ ] File permissions set correctly (600 for keys)
- [ ] Webhook secret configured
- [ ] Rate limits enabled
- [ ] Circuit breaker tested
- [ ] Slippage/impact limits set conservatively
- [ ] Budget caps configured
- [ ] Ads mode set to `manual` or `dry-run` initially
- [ ] Monitoring and alerts configured
- [ ] Logs reviewed for sensitive data
- [ ] Dependencies audited (`pnpm audit`)
- [ ] CI/CD pipeline includes security checks
- [ ] Incident response plan documented
- [ ] Team trained on runbook procedures
- [ ] Backup executor wallet prepared
- [ ] Testnet deployment successful
- [ ] Legal review completed (if applicable)

## Vulnerability Disclosure

If you discover a security vulnerability:

1. **Do NOT open a public issue**
2. Email: [security@example.com] (replace with actual contact)
3. Include:
   - Description of vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

We will:
- Acknowledge within 24 hours
- Investigate and respond within 7 days
- Credit reporter (if desired) after fix

## Responsible Disclosure Timeline

- **Day 0:** Vulnerability reported
- **Day 1:** Acknowledgment sent
- **Day 7:** Assessment complete, fix planned
- **Day 30:** Fix deployed (target)
- **Day 60:** Public disclosure (if safe)

## Security Updates

Monitor:
- GitHub Security Advisories
- npm security alerts
- Solana ecosystem announcements
- X API changes

Update dependencies regularly:
```bash
pnpm update
pnpm audit
```

## Penetration Testing

Recommended annual penetration test scope:
- Key storage mechanisms
- Webhook authentication
- DEX interaction logic
- Configuration validation
- Error handling (information leakage)

## Insurance (Future)

Consider:
- Smart contract insurance (Nexus Mutual, etc.)
- Custody insurance for hot wallets
- Cyber liability insurance

## Conclusion

Security is a continuous process. This document should be reviewed and updated as:
- New threats emerge
- The system evolves
- Lessons are learned from incidents

**Remember:** The goal is not perfect security (impossible), but **risk-appropriate security**.
