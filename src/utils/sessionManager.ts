// src/utils/sessionManager.ts - نسخة مبسطة
import mongoose from 'mongoose';
import logger from '../config/logger';

export class SessionManager {
  /**
   * Execute a function with session and automatic cleanup
   */
  static async withSession<T>(
    fn: (session: mongoose.ClientSession) => Promise<T>,
    options?: { useTransaction?: boolean }
  ): Promise<T> {
    const session = await mongoose.startSession();
    
    try {
      if (options?.useTransaction) {
        session.startTransaction();
      }
      
      const result = await fn(session);
      
      if (options?.useTransaction && session.inTransaction()) {
        await session.commitTransaction();
      }
      
      return result;
    } catch (error) {
      if (options?.useTransaction && session.inTransaction()) {
        await session.abortTransaction();
      }
      
      logger.error('Session operation failed:', {
        error: error.message,
        sessionId: session.id
      });
      
      throw error;
    } finally {
      await session.endSession();
    }
  }
  
  /**
   * Execute a transaction with automatic retry
   */
  static async withTransaction<T>(
    fn: (session: mongoose.ClientSession) => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const session = await mongoose.startSession();
      
      try {
        session.startTransaction();
        
        const result = await fn(session);
        
        await session.commitTransaction();
        return result;
        
      } catch (error: any) {
        if (session.inTransaction()) {
          await session.abortTransaction();
        }
        
        lastError = error;
        
        // Check if it's a retryable error
        if (this.isRetryableError(error) && attempt < maxRetries) {
          logger.warn(`Transaction failed (attempt ${attempt}/${maxRetries}), retrying...`, {
            error: error.message,
            attempt
          });
          
          // Wait before retry
          await this.delay(Math.pow(2, attempt) * 100);
          await session.endSession();
          continue;
        }
        
        logger.error('Transaction failed permanently:', {
          error: error.message,
          attempts: attempt
        });
        
        await session.endSession();
        throw error;
      }
    }
    
    throw lastError;
  }
  
  /**
   * Check if error is retryable
   */
  private static isRetryableError(error: any): boolean {
    const retryableErrors = [
      'WriteConflict',
      'TemporarilyUnavailable',
      'TransientTransactionError',
      'UnknownTransactionCommitResult'
    ];
    
    return retryableErrors.some(code => 
      error.message?.includes(code) || 
      error.codeName === code ||
      error.hasErrorLabel?.(code)
    );
  }
  
  /**
   * Delay utility for retries
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export utility functions
export const withDatabaseTransaction = SessionManager.withTransaction;
export const withDatabaseSession = SessionManager.withSession;