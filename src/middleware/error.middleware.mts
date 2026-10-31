import type { Request, Response, NextFunction } from 'express';
import CustomError from '../errors/CustomError.mts';

/** Keep API status codes intact; browser clients use redirectTo for navigation. */
export const globalErrorHandler = (err: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  const candidate = err instanceof CustomError ? err.statusCode :
    (err && typeof err === 'object' && 'status' in err ? err.status : 500);
  const statusCode = typeof candidate === 'number' && Number.isInteger(candidate) &&
    candidate >= 400 && candidate <= 599 ? candidate : 500;
  const message = statusCode >= 500 ? 'Something went wrong. Please try again later.' :
    err instanceof CustomError ? err.message : 'The request could not be processed.';
  const redirectTo = [401, 404, 500].includes(statusCode) ? `/${statusCode}` : undefined;

  res.setHeader('Cache-Control', 'no-store');
  res.status(statusCode).json({ error: {
    message,
    statusCode,
    code: err instanceof CustomError && err.code ? err.code : `ERR_${statusCode}`,
    ...(redirectTo ? { redirectTo, flash: { type: 'error', message } } : {}),
  } });
};
