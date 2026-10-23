export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number = 400,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}

export function toErrorResponse(err: unknown): {
  error: { code: string; message: string; details?: Record<string, unknown> };
  status: number;
} {
  if (isAppError(err)) {
    return {
      error: { code: err.code, message: err.message, details: err.details },
      status: err.status,
    };
  }
  console.error("[unhandled]", err instanceof Error ? err.message : "unknown");
  return {
    error: { code: "INTERNAL", message: "Something went wrong" },
    status: 500,
  };
}
