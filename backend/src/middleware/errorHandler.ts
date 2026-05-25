import { Request, Response, NextFunction } from 'express';

export interface ApiError extends Error {
  statusCode?: number;
}

/**
 * Centralised error handler middleware.
 * Returns a consistent JSON error shape for all routes.
 */
export function errorHandler(
  err: ApiError,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const statusCode = err.statusCode ?? 500;
  const isDev      = process.env.NODE_ENV !== 'production';

  console.error(`[ErrorHandler] ${statusCode} — ${err.message}`);
  if (isDev && err.stack) console.error(err.stack);

  res.status(statusCode).json({
    error:   err.message ?? 'Internal server error',
    ...(isDev ? { stack: err.stack } : {}),
  });
}
