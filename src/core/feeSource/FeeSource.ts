export interface FeeDetectionResult {
  timestamp: number;
  sources: FeeSource[];
  totalUsd: number;
}

export interface FeeSource {
  asset: string;
  amount: number;
  usdValue: number;
}

export abstract class FeeSourceDetector {
  abstract detectFees(sinceTimestamp?: number): Promise<FeeDetectionResult>;
  abstract getCurrentBalance(): Promise<{ [asset: string]: number }>;
}
