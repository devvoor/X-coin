import { Connection, PublicKey } from '@solana/web3.js';
import { getAccount } from '@solana/spl-token';
import { FeeSourceDetector, FeeDetectionResult, FeeSource } from './FeeSource.js';
import { logger } from '../../utils/logger.js';
import { config } from '../../config/env.js';

export class WalletWatcherFeeSource extends FeeSourceDetector {
  private connection: Connection;
  private feeCollectorPubkey: PublicKey;
  private lastCheckedBalance: { [asset: string]: number } = {};

  constructor(connection: Connection, feeCollectorPubkey: string) {
    super();
    this.connection = connection;
    this.feeCollectorPubkey = new PublicKey(feeCollectorPubkey);
  }

  async detectFees(sinceTimestamp?: number): Promise<FeeDetectionResult> {
    logger.info({ feeCollector: this.feeCollectorPubkey.toBase58() }, 'Detecting fees');

    const sources: FeeSource[] = [];
    let totalUsd = 0;

    try {
      // Check SOL balance
      const solBalance = await this.connection.getBalance(this.feeCollectorPubkey);
      const solAmount = solBalance / 1e9; // lamports to SOL

      const lastSolBalance = this.lastCheckedBalance['SOL'] || 0;
      const solDelta = solAmount - lastSolBalance;

      if (solDelta > 0) {
        // TODO: Get actual SOL price from oracle/API
        const solPriceUsd = 100; // Placeholder
        const solUsdValue = solDelta * solPriceUsd;

        sources.push({
          asset: 'SOL',
          amount: solDelta,
          usdValue: solUsdValue,
        });

        totalUsd += solUsdValue;
        logger.info({ sol: solDelta, usd: solUsdValue }, 'Detected SOL fees');
      }

      this.lastCheckedBalance['SOL'] = solAmount;

      // Check USDC balance (if token account exists)
      try {
        // TODO: Get USDC mint from config
        const usdcMint = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'); // Mainnet USDC
        const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
          this.feeCollectorPubkey,
          { mint: usdcMint }
        );

        if (tokenAccounts.value.length > 0) {
          const usdcAccount = tokenAccounts.value[0];
          const usdcBalance =
            usdcAccount.account.data.parsed.info.tokenAmount.uiAmount || 0;

          const lastUsdcBalance = this.lastCheckedBalance['USDC'] || 0;
          const usdcDelta = usdcBalance - lastUsdcBalance;

          if (usdcDelta > 0) {
            sources.push({
              asset: 'USDC',
              amount: usdcDelta,
              usdValue: usdcDelta, // USDC is 1:1 with USD
            });

            totalUsd += usdcDelta;
            logger.info({ usdc: usdcDelta }, 'Detected USDC fees');
          }

          this.lastCheckedBalance['USDC'] = usdcBalance;
        }
      } catch (error) {
        logger.debug({ error }, 'No USDC account found or error fetching');
      }

      return {
        timestamp: Date.now(),
        sources,
        totalUsd,
      };
    } catch (error) {
      logger.error({ error }, 'Error detecting fees');
      throw error;
    }
  }

  async getCurrentBalance(): Promise<{ [asset: string]: number }> {
    const balances: { [asset: string]: number } = {};

    try {
      // SOL balance
      const solBalance = await this.connection.getBalance(this.feeCollectorPubkey);
      balances['SOL'] = solBalance / 1e9;

      // Token balances
      const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
        this.feeCollectorPubkey,
        { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
      );

      for (const account of tokenAccounts.value) {
        const mint = account.account.data.parsed.info.mint;
        const amount = account.account.data.parsed.info.tokenAmount.uiAmount || 0;
        balances[mint] = amount;
      }

      return balances;
    } catch (error) {
      logger.error({ error }, 'Error getting current balance');
      throw error;
    }
  }
}
