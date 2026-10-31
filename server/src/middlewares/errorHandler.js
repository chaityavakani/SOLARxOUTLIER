import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { AppError } from '../core/AppError.js';
import { logger } from '../core/logger.js';
import { isProd } from '../config/env.js';

export function errorHandler(err, req, res, _next) {
  let status = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'Something went wrong on our side. Please try again.';
  let details;

  if (err instanceof AppError) {
    status = err.status;
    code = err.code;
    message = err.message;
    details = err.details;
  } else if (err instanceof ZodError) {
    status = 422;
    code = 'VALIDATION_ERROR';
    message = 'Please check the highlighted fields.';
    details = err.flatten().fieldErrors;
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      status = 409;
      code = 'DUPLICATE';
      message = `That ${(err.meta?.target || 'value').toString().replace(/_/g, ' ')} is already in use.`;
    } else if (err.code === 'P2025') {
      status = 404;
      code = 'NOT_FOUND';
      message = 'The record could not be found.';
    }
  } else if (err.type === 'entity.too.large') {
    status = 413;
    code = 'PAYLOAD_TOO_LARGE';
    message = 'The uploaded content is too large.';
  }

  if (status >= 500) {
    logger.error({ err, path: req.originalUrl, method: req.method }, 'Unhandled request error');
  }

  res.status(status).json({
    success: false,
    error: {
      code,
      message,
      ...(details ? { details } : {}),
      ...(!isProd && status >= 500 ? { stack: err.stack } : {}),
    },
  });
}
