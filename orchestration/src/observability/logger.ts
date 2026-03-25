/**
 * Structured logger for the orchestration layer.
 *
 * Produces JSON log lines in production and readable output in development.
 * Every log entry includes a correlation `requestId` when one is active.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  /** ISO-8601 timestamp. */
  timestamp: string;
  /** Severity level. */
  level: LogLevel;
  /** Log message. */
  message: string;
  /** Originating module (e.g. "llm.dual-provider", "supervisor"). */
  module: string;
  /** Correlation ID for request tracing. */
  requestId?: string;
  /** Arbitrary structured context. */
  context?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Level filtering
// ---------------------------------------------------------------------------

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------

export class Logger {
  private readonly module: string;
  private readonly minLevel: LogLevel;
  private readonly isProduction: boolean;
  private requestId?: string;

  constructor(module: string, minLevel: LogLevel = 'info') {
    this.module = module;
    this.minLevel = minLevel;
    this.isProduction = process.env.NODE_ENV === 'production';
  }

  /** Create a child logger bound to a specific request. */
  withRequestId(requestId: string): Logger {
    const child = new Logger(this.module, this.minLevel);
    child.requestId = requestId;
    return child;
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log('warn', message, context);
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.log('error', message, context);
  }

  // -----------------------------------------------------------------------
  // Internal
  // -----------------------------------------------------------------------

  private log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[this.minLevel]) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      module: this.module,
      ...(this.requestId ? { requestId: this.requestId } : {}),
      ...(context && Object.keys(context).length > 0 ? { context } : {}),
    };

    if (this.isProduction) {
      // JSON lines for log aggregation (ELK, CloudWatch, etc.)
      const stream = level === 'error' ? process.stderr : process.stdout;
      stream.write(JSON.stringify(entry) + '\n');
    } else {
      // Readable format for development
      const prefix = `[${entry.timestamp}] ${level.toUpperCase().padEnd(5)} [${this.module}]`;
      const reqPart = this.requestId ? ` req=${this.requestId}` : '';
      const ctxPart = context ? ` ${JSON.stringify(context)}` : '';
      const stream = level === 'error' ? console.error : console.log;
      stream(`${prefix}${reqPart} ${message}${ctxPart}`);
    }
  }
}

/**
 * Factory function — creates a logger scoped to a module name.
 * Pass the orchestration log level from config for consistent filtering.
 */
export function createLogger(module: string, level?: LogLevel): Logger {
  const envLevel = (process.env.ORCHESTRATION_LOG_LEVEL as LogLevel) ?? level ?? 'info';
  return new Logger(module, envLevel);
}
