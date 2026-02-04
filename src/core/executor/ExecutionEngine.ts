import { FeeSourceDetector } from '../feeSource/FeeSource.js';
import { AllocationEngine } from '../strategy/AllocationEngine.js';
import { RiskManager } from '../risk/RiskManager.js';
import { CircuitBreaker } from '../risk/CircuitBreaker.js';
import { DexSwapper } from '../../dex/interfaces.js';
import { AdsEngine } from '../ads/AdsEngine.js';
import { ReportWriter } from '../reporting/ReportWriter.js';
import { TweetSummary } from '../reporting/TweetSummary.js';
import { logger } from '../../utils/logger.js';
import { riskLimits } from '../../config/strategy.js';

export interface EpochResult {
  epochId: number;
  success: boolean;
  feesUsd: number;
  buybackTx?: string;
  adsCampaignId?: string;
  reportPath?: string;
  error?: string;
}

export class ExecutionEngine {
  private feeSource: FeeSourceDetector;
  private allocationEngine: AllocationEngine;
  private riskManager: RiskManager;
  private circuitBreaker: CircuitBreaker;
  private dexSwapper: DexSwapper;
  private adsEngine: AdsEngine;
  private reportWriter: ReportWriter;
  private tweetSummary: TweetSummary;
  private epochCounter = 0;
  private lastEpochTime = 0;

  constructor(
    feeSource: FeeSourceDetector,
    dexSwapper: DexSwapper,
    adsEngine: AdsEngine
  ) {
    this.feeSource = feeSource;
    this.allocationEngine = new AllocationEngine();
    this.riskManager = new RiskManager();
    this.circuitBreaker = new CircuitBreaker();
    this.dexSwapper = dexSwapper;
    this.adsEngine = adsEngine;
    this.reportWriter = new ReportWriter();
    this.tweetSummary = new TweetSummary();
  }

  async executeEpoch(): Promise<EpochResult> {
    this.epochCounter++;
    const epochId = this.epochCounter;

    logger.info({ epochId }, '🔄 Starting epoch execution');

    try {
      // Check circuit breaker
      if (!this.circuitBreaker.canProceed()) {
        const error = 'Circuit breaker is OPEN, skipping epoch';
        logger.error({ epochId }, error);
        return { epochId, success: false, feesUsd: 0, error };
      }

      // Check minimum interval
      const now = Date.now();
      const timeSinceLast = (now - this.lastEpochTime) / 1000;
      if (this.lastEpochTime > 0 && timeSinceLast < riskLimits.minIntervalSeconds) {
        const error = `Minimum interval not met: ${timeSinceLast}s < ${riskLimits.minIntervalSeconds}s`;
        logger.warn({ epochId }, error);
        return { epochId, success: false, feesUsd: 0, error };
      }

      // Step 1: Detect fees
      logger.info({ epochId }, 'Step 1: Detecting fees');
      const feeResult = await this.feeSource.detectFees(this.lastEpochTime);

      if (feeResult.totalUsd === 0) {
        logger.info({ epochId }, 'No fees detected, skipping epoch');
        this.lastEpochTime = now;
        return { epochId, success: true, feesUsd: 0 };
      }

      logger.info({ epochId, feesUsd: feeResult.totalUsd }, 'Fees detected');

      // Step 2: Allocate budget
      logger.info({ epochId }, 'Step 2: Allocating budget');
      const allocation = this.allocationEngine.allocate(feeResult.totalUsd);

      // Step 3: Risk check
      logger.info({ epochId }, 'Step 3: Checking risk limits');
      const riskCheck = this.riskManager.checkRisk({
        budgetUsd: allocation.totalAllocated,
        timeSinceLastEpoch: timeSinceLast,
      });

      if (!riskCheck.allowed) {
        const error = `Risk check failed: ${riskCheck.reason}`;
        logger.error({ epochId, riskCheck }, error);
        this.circuitBreaker.recordFailure();
        return { epochId, success: false, feesUsd: feeResult.totalUsd, error };
      }

      // Step 4: Execute buyback
      let buybackTx: string | undefined;
      if (allocation.buybackUsd > 0) {
        logger.info({ epochId, buybackUsd: allocation.buybackUsd }, 'Step 4: Executing buyback');
        try {
          const swapResult = await this.dexSwapper.swap({
            inputAsset: 'USDC', // Or SOL based on available fees
            outputAsset: 'TOKEN',
            amountUsd: allocation.buybackUsd,
          });
          buybackTx = swapResult.signature;
          logger.info({ epochId, tx: buybackTx }, 'Buyback successful');
        } catch (error) {
          logger.error({ epochId, error }, 'Buyback failed');
          this.circuitBreaker.recordFailure();
          throw error;
        }
      }

      // Step 5: Execute ads
      let adsCampaignId: string | undefined;
      if (allocation.adsUsd > 0) {
        logger.info({ epochId, adsUsd: allocation.adsUsd }, 'Step 5: Executing ads');
        try {
          const adsResult = await this.adsEngine.execute({
            budgetUsd: allocation.adsUsd,
          });
          adsCampaignId = adsResult.campaignId;
          logger.info({ epochId, campaignId: adsCampaignId }, 'Ads execution complete');
        } catch (error) {
          logger.error({ epochId, error }, 'Ads execution failed');
          // Don't fail entire epoch if ads fail
        }
      }

      // Step 6: Generate report
      logger.info({ epochId }, 'Step 6: Generating report');
      const reportPath = await this.reportWriter.write({
        epochId,
        timestamp: now,
        fees: feeResult,
        allocation,
        buybackTx,
        adsCampaignId,
      });

      // Step 7: Generate tweet summary
      const tweetText = this.tweetSummary.generate({
        epochId,
        feesUsd: feeResult.totalUsd,
        buybackUsd: allocation.buybackUsd,
        adsUsd: allocation.adsUsd,
        buybackTx,
        reportPath,
      });

      logger.info({ epochId, tweetText }, 'Tweet summary generated');

      // Success
      this.circuitBreaker.recordSuccess();
      this.lastEpochTime = now;

      logger.info({ epochId }, '✅ Epoch completed successfully');

      return {
        epochId,
        success: true,
        feesUsd: feeResult.totalUsd,
        buybackTx,
        adsCampaignId,
        reportPath,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ epochId, error: errorMessage }, '❌ Epoch failed');
      this.circuitBreaker.recordFailure();

      return {
        epochId,
        success: false,
        feesUsd: 0,
        error: errorMessage,
      };
    }
  }

  getEpochCounter(): number {
    return this.epochCounter;
  }

  getLastEpochTime(): number {
    return this.lastEpochTime;
  }

  getCircuitBreakerState(): string {
    return this.circuitBreaker.getState();
  }
}
