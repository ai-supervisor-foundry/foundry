import { LoggerPort } from '../../../domain/ports/logger';
import { log, logVerbose, logPerformance, logStateTransition, logError } from './logger';

export class LoggerAdapter implements LoggerPort {
  log(module: string, message: string, ...args: unknown[]): void {
    log(module, message, ...args);
  }
  
  logVerbose(component: string, message: string, data?: Record<string, unknown>): void {
    logVerbose(component, message, data);
  }
  
  logPerformance(operation: string, duration: number, metadata?: Record<string, unknown>): void {
    logPerformance(operation, duration, metadata);
  }
  
  logStateTransition(from: string, to: string, context?: Record<string, unknown>): void {
    logStateTransition(from, to, context);
  }
  
  logError(module: string, message: string, error?: unknown): void {
    logError(module, message, error);
  }
}
