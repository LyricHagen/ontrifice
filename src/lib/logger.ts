type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

const isDev = process.env.NODE_ENV !== "production";
const minLevel = LEVEL_PRIORITY[(process.env.LOG_LEVEL as LogLevel) ?? "debug"];

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  code?: string;
  context?: Record<string, unknown>;
}

function formatDev(entry: LogEntry): string {
  const parts = [
    `[${entry.timestamp}]`,
    entry.level.toUpperCase().padEnd(5),
    entry.message,
  ];
  if (entry.code) parts.push(`(${entry.code})`);
  if (entry.context && Object.keys(entry.context).length > 0) {
    parts.push(JSON.stringify(entry.context));
  }
  return parts.join(" ");
}

function emit(
  level: LogLevel,
  message: string,
  code?: string,
  context?: Record<string, unknown>,
): void {
  if (LEVEL_PRIORITY[level] < minLevel) return;

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    code,
    context,
  };

  const output = isDev ? formatDev(entry) : JSON.stringify(entry);

  if (level === "error" || level === "fatal") {
    console.error(output);
  } else if (level === "warn") {
    console.warn(output);
  } else {
    console.log(output);
  }
}

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) =>
    emit("debug", message, undefined, context),
  info: (message: string, context?: Record<string, unknown>) =>
    emit("info", message, undefined, context),
  warn: (message: string, code?: string, context?: Record<string, unknown>) =>
    emit("warn", message, code, context),
  error: (message: string, code?: string, context?: Record<string, unknown>) =>
    emit("error", message, code, context),
  fatal: (message: string, code?: string, context?: Record<string, unknown>) =>
    emit("fatal", message, code, context),
};
