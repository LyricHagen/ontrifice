import { NextResponse } from "next/server";

export class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly statusCode: number,
    public readonly userMessage: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(userMessage);
    this.name = "AppError";
  }
}

export function MarketFetchError(
  platform: string,
  reason: string,
  details?: Record<string, unknown>,
): AppError {
  return new AppError(
    "ERR_MARKET_FETCH_TIMEOUT",
    502,
    `Failed to fetch markets from ${platform}: ${reason}. This usually means the platform's API is temporarily unavailable. Try again in a few minutes, or check ${platform}'s status page.`,
    { platform, reason, ...details },
  );
}

export function DatabaseError(
  operation: string,
  table: string,
  details?: Record<string, unknown>,
): AppError {
  return new AppError(
    "ERR_DATABASE",
    500,
    `A database error occurred while performing "${operation}" on ${table}. This is likely a temporary issue. Try again shortly. If the problem persists, contact support.`,
    { operation, table, ...details },
  );
}

export function AuthError(
  reason:
    | "invalid_credentials"
    | "expired_session"
    | "missing_api_key"
    | "rate_limited"
    | "account_not_found",
): AppError {
  const messages: Record<string, { code: string; status: number; msg: string }> = {
    invalid_credentials: {
      code: "ERR_AUTH_INVALID_CREDENTIALS",
      status: 401,
      msg: "The email or password you entered is incorrect. If you forgot your password, you can reset it. If you don't have an account, sign up instead.",
    },
    expired_session: {
      code: "ERR_AUTH_SESSION_EXPIRED",
      status: 401,
      msg: "Your session has expired. This happens after a period of inactivity for security reasons. Please log in again to continue.",
    },
    missing_api_key: {
      code: "ERR_AUTH_MISSING_API_KEY",
      status: 401,
      msg: "No API key was provided with this request. Include your API key in the Authorization header as 'Bearer <your-key>'. You can generate one in Settings.",
    },
    rate_limited: {
      code: "ERR_AUTH_RATE_LIMITED",
      status: 429,
      msg: "You've made too many requests in a short period. Please wait a moment before trying again. If you need higher rate limits, contact support.",
    },
    account_not_found: {
      code: "ERR_AUTH_ACCOUNT_NOT_FOUND",
      status: 404,
      msg: "No account was found with that email address. Double-check for typos, or sign up to create a new account.",
    },
  };
  const m = messages[reason];
  return new AppError(m.code, m.status, m.msg, { reason });
}

export function ValidationError(field: string, reason: string): AppError {
  return new AppError(
    "ERR_VALIDATION",
    400,
    `Invalid value for "${field}": ${reason}. Check the field and try again.`,
    { field, reason },
  );
}

export function GraphComputationError(
  operation: string,
  details?: Record<string, unknown>,
): AppError {
  return new AppError(
    "ERR_GRAPH_COMPUTATION",
    500,
    `Graph computation failed during "${operation}". The dependency graph may have inconsistent data. Try again, or narrow the scope of your query.`,
    { operation, ...details },
  );
}

export function ExternalAPIError(
  service: string,
  statusCode: number,
  responseBody?: unknown,
): AppError {
  return new AppError(
    "ERR_EXTERNAL_API",
    502,
    `The external service "${service}" returned an error (HTTP ${statusCode}). This is outside our control. Try again shortly, or check if ${service} is experiencing issues.`,
    { service, statusCode, responseBody },
  );
}

export function handleApiError(error: unknown): NextResponse {
  if (error instanceof AppError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: `${error.userMessage} (${error.code})`,
          details: error.details,
        },
      },
      { status: error.statusCode },
    );
  }

  const message =
    error instanceof Error ? error.message : "An unknown error occurred";

  return NextResponse.json(
    {
      error: {
        code: "ERR_INTERNAL",
        message:
          "An unexpected error occurred. If this keeps happening, please contact support. (ERR_INTERNAL)",
        details:
          process.env.NODE_ENV === "development" ? { message } : undefined,
      },
    },
    { status: 500 },
  );
}
