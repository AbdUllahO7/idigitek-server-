// src/utils/sessionManager.ts - نسخة تشتغل على standalone و replica set
import mongoose from 'mongoose';
import logger from '../config/logger';

export class SessionManager {
  /**
   * Check if MongoDB is running as a replica set
   */
  private static async isReplicaSet(): Promise<boolean> {
    try {
      const adminDb = mongoose.connection.db?.admin();
      if (!adminDb) return false;
      
      const status = await adminDb.replSetGetStatus();
      return !!status;
    } catch (error: any) {
      // If we get an error checking replica set status, we're on standalone
      return false;
    }
  }

  /**
   * Execute a function with optional session (only if replica set)
   */
  static async withSession<T>(
    fn: (session: mongoose.ClientSession | null) => Promise<T>,
    options?: { useTransaction?: boolean }
  ): Promise<T> {
    const isReplica = await this.isReplicaSet();
    
    // If not a replica set, run without session
    if (!isReplica) {
      logger.debug('Running without session (standalone MongoDB)');
      return await fn(null);
    }
    
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
    } catch (error: any) {
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
   * Execute a transaction (only if replica set)
   */
  static async withTransaction<T>(
    fn: (session: mongoose.ClientSession | null) => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> {
    const isReplica = await this.isReplicaSet();
    
    // If not a replica set, run without transaction
    if (!isReplica) {
      logger.debug('Running without transaction (standalone MongoDB)');
      return await fn(null);
    }
    
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
        
        if (this.isRetryableError(error) && attempt < maxRetries) {
          logger.warn(`Transaction failed (attempt ${attempt}/${maxRetries}), retrying...`, {
            error: error.message,
            attempt
          });
          
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
  
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const withDatabaseTransaction = SessionManager.withTransaction;
export const withDatabaseSession = SessionManager.withSession;