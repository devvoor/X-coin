# X Ads Integration

## Overview

The X (Twitter) Ads component is **the most complex and risky part** of this project.

**Key constraints:**
- X Ads API is private/gated (not publicly available)
- Manual execution is the safest default
- API integration is optional and requires credentials

## Execution Modes

### 1. Dry-Run (Default)

**Best for:** Testing, development, initial deployment

```typescript
ADS_ENGINE_MODE=dry-run
```

**Behavior:**
- Simulates ad campaign creation
- Writes campaign plan to report
- **Does NOT spend any money**
- **Does NOT interact with X APIs**

**Output example:**
```json
{
  "mode": "dry-run",
  "campaign": {
    "budget_usd": 500,
    "duration_hours": 24,
    "targeting": {...},
    "post_id": "1234567890"
  },
  "status": "simulated"
}
```

### 2. Manual (Recommended for Production)

**Best for:** Production use without API access

```typescript
ADS_ENGINE_MODE=manual
ADS_TARGET_POST_ID=<your_tweet_id>
```

**Behavior:**
- Calculates budget from epoch allocation
- Generates **ready-to-use campaign spec**
- Operator manually creates campaign in X Ads Manager
- Operator confirms execution in next epoch

**Workflow:**
1. Epoch runs, generates campaign spec in report
2. Operator receives notification
3. Operator copies campaign settings to [ads.twitter.com](https://ads.twitter.com)
4. Operator launches campaign manually
5. Operator logs campaign ID for records

**Pros:**
- No API credentials needed
- Full human oversight
- Compliant with X Terms of Service

**Cons:**
- Requires manual intervention per epoch
- Slight delay in execution

### 3. API (Advanced)

**Best for:** Fully automated execution (if you have API access)

```typescript
ADS_ENGINE_MODE=api
ADS_TARGET_POST_ID=<your_tweet_id>
X_ADS_API_KEY=<your_key>
X_ADS_API_SECRET=<your_secret>
X_ADS_ACCOUNT_ID=<your_account_id>
```

**Behavior:**
- Programmatically creates campaigns via X Ads API
- Automatically funds campaigns
- **Spends real money**

**Requirements:**
- Approved X Ads API developer account
- API credentials (key, secret, account ID)
- Pre-funded X Ads account
- Compliance with X Ads policies

**⚠️ CRITICAL WARNINGS:**
- X Ads API is NOT publicly available (gated access)
- Violating X's ToS can result in account suspension
- Always test on a separate ad account first
- Set `MAX_AD_SPEND_PER_EPOCH_USD` conservatively

## Configuration

### Target Post

The post/tweet to promote must be configured:

```env
ADS_TARGET_POST_ID=1234567890123456789
```

**How to find post ID:**
- URL format: `https://twitter.com/username/status/<POST_ID>`
- Example: `https://twitter.com/alice/status/1234567890123456789`
- Post ID: `1234567890123456789`

**Best practices:**
- Use a pinned, evergreen explainer post
- Post should explain the flywheel clearly
- Include disclaimers in the post itself
- Avoid hype language or price predictions

### Campaign Settings

```typescript
{
  objective: 'AWARENESS',        // or 'ENGAGEMENT'
  budget_usd: <calculated>,       // from epoch allocation
  duration_hours: 24,             // run for 24 hours
  targeting: {
    keywords: ['crypto', 'solana', 'defi'],
    interests: ['cryptocurrency'],
    geo: ['US', 'CA', 'GB', 'EU'],
    languages: ['en'],
  },
  placement: ['TIMELINE', 'PROFILE'],
}
```

## Safety Guardrails

### Budget Limits

```env
MAX_AD_SPEND_PER_EPOCH_USD=500
```

Even if allocation calculates $800 for ads, spend is capped at $500.

### Cooldown

```env
MIN_INTERVAL_SECONDS=3600
```

Prevents creating multiple campaigns too quickly.

### Kill Switch

```env
ADS_ENGINE_MODE=dry-run
```

Immediately stops all ad spending while allowing rest of system to run.

### Manual Approval

```env
REQUIRE_MANUAL_APPROVAL=true
```

Pauses before executing ads; operator must confirm via webhook or CLI.

## Compliance

### X Ads Policies

You must comply with:
- [X Ads Policies](https://business.twitter.com/en/help/ads-policies.html)
- Prohibited content rules
- Cryptocurrency advertising restrictions (varies by region)
- Truthful advertising standards

### Recommended Disclaimers in Ad Content

- "Community experiment, not financial advice"
- "Not affiliated with X Corp"
- "Cryptocurrency involves risk"

### Restricted Regions

Some regions restrict crypto ads. Exclude them:

```typescript
targeting: {
  geo_exclude: ['CN', 'IN'], // Example
}
```

## API Implementation Notes

The `XAdsEngine.ts` is a **stub/placeholder**:

```typescript
// TODO: Integrate with X Ads API
// This requires:
// 1. X Ads API developer approval
// 2. OAuth 1.0a authentication
// 3. Campaign creation endpoint
// 4. Funding endpoint
// 5. Error handling for rate limits
```

**Why stub?**
- X Ads API is not publicly documented
- Access requires partnership/approval
- Implementation varies by account type

If you gain API access:
1. Replace stub with real implementation
2. Use official X Ads SDK if available
3. Test extensively on sandbox/test account
4. Implement rate limit handling (X has strict limits)

## Monitoring

Track ads performance:
- Campaign ID logged in epoch report
- Monitor impressions, clicks, spend in X Ads Manager
- Compare spend vs. fees collected
- Adjust allocation if ads are ineffective

## Fallback Strategy

If ads integration fails or becomes unavailable:
- Revert to `dry-run` mode
- Reallocate ads budget to buybacks temporarily
- Continue flywheel with 100% buybacks until resolved

## FAQ

**Q: Can I use this without X Ads API?**
A: Yes! Use `manual` mode. It's safer and doesn't require API access.

**Q: What if my X account gets banned?**
A: Use a dedicated account for ads, separate from personal accounts. Follow all policies.

**Q: How do I measure ROI on ads?**
A: Track post engagement metrics (views, likes, retweets) and correlation with on-chain activity.

**Q: Can I change the target post mid-flight?**
A: Yes, update `ADS_TARGET_POST_ID` and restart the service.

## Legal Note

Promoting financial products (including crypto) via ads is regulated in many jurisdictions. Consult legal counsel before running ads campaigns at scale.
