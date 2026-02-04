import { FeeSourceDetector, FeeDetectionResult } from './FeeSource.js';
import { logger } from '../../utils/logger.js';

export class MockFeeSource extends FeeSourceDetector {
  private mockFeesUsd: number;

  constructor(mockFeesUsd: number = 1000) {
    super();
    this.mockFeesUsd = mockFeesUsd;
  }

  async detectFees(sinceTimestamp?: number): Promise<FeeDetectionResult> {
    logger.info({ mockFeesUsd: this.mockFeesUsd }, 'Using mock fee source');

    // Simulate 50% SOL, 50% USDC
    const halfUsd = this.mockFeesUsd / 2;

    return {
      timestamp: Date.now(),
      sources: [
        {
          asset: 'SOL',
          amount: halfUsd / 100, // Assuming $100/SOL
          usdValue: halfUsd,
        },
        {
          asset: 'USDC',
          amount: halfUsd,
          usdValue: halfUsd,
        },
      ],
      totalUsd: this.mockFeesUsd,
    };
  }

  async getCurrentBalance(): Promise<{ [asset: string]: number }> {
    return {
      SOL: 10,
      USDC: 5000,
    };
  }

  setMockFeesUsd(amount: number): void {
    this.mockFeesUsd = amount;
  }
}
