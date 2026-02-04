import { strategy } from '../../config/strategy.js';
import { logger } from '../../utils/logger.js';
import { percentage } from '../../utils/math.js';

export interface AllocationResult {
  buybackUsd: number;
  adsUsd: number;
  burnUsd: number;
  lpAddUsd: number;
  totalAllocated: number;
}

export class AllocationEngine {
  allocate(totalFeesUsd: number): AllocationResult {
    logger.info({ totalFeesUsd, strategy }, 'Allocating fees');

    const buybackUsd = percentage(totalFeesUsd, strategy.buybackPct);
    const adsUsd = percentage(totalFeesUsd, strategy.adsPct);
    const burnUsd = percentage(totalFeesUsd, strategy.burnPct);
    const lpAddUsd = percentage(totalFeesUsd, strategy.lpAddPct);

    const totalAllocated = buybackUsd + adsUsd + burnUsd + lpAddUsd;

    // Sanity check
    if (Math.abs(totalAllocated - totalFeesUsd) > 0.01) {
      logger.warn(
        { totalFeesUsd, totalAllocated, diff: totalAllocated - totalFeesUsd },
        'Allocation mismatch detected (rounding)'
      );
    }

    const result: AllocationResult = {
      buybackUsd,
      adsUsd,
      burnUsd,
      lpAddUsd,
      totalAllocated,
    };

    logger.info(result, 'Allocation complete');
    return result;
  }
}
