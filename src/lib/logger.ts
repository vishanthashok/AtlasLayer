type Level = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: Level;
  service: string;
  message: string;
  data?: Record<string, unknown>;
  duration_ms?: number;
  timestamp: string;
}

function emit(entry: LogEntry): void {
  const line = JSON.stringify(entry);
  switch (entry.level) {
    case 'error': console.error(line); break;
    case 'warn':  console.warn(line);  break;
    case 'debug':
      if (process.env.NODE_ENV !== 'production') console.debug(line);
      break;
    default: console.log(line);
  }
}

export function createLogger(service: string) {
  return {
    debug: (message: string, data?: Record<string, unknown>) =>
      emit({ level: 'debug', service, message, data, timestamp: new Date().toISOString() }),

    info: (message: string, data?: Record<string, unknown>) =>
      emit({ level: 'info', service, message, data, timestamp: new Date().toISOString() }),

    warn: (message: string, data?: Record<string, unknown>) =>
      emit({ level: 'warn', service, message, data, timestamp: new Date().toISOString() }),

    error: (message: string, data?: Record<string, unknown>) =>
      emit({ level: 'error', service, message, data, timestamp: new Date().toISOString() }),

    timed: async <T>(label: string, fn: () => Promise<T>): Promise<T> => {
      const t0 = Date.now();
      try {
        const result = await fn();
        emit({ level: 'info', service, message: label, duration_ms: Date.now() - t0, timestamp: new Date().toISOString() });
        return result;
      } catch (e) {
        emit({ level: 'error', service, message: `${label} failed`, data: { error: String(e) }, duration_ms: Date.now() - t0, timestamp: new Date().toISOString() });
        throw e;
      }
    },
  };
}
