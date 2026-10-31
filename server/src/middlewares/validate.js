import { ZodError } from 'zod';
import { AppError } from '../core/AppError.js';

/** Validates body, params and query with zod schemas. */
export function validate(schemas) {
  return (req, _res, next) => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body ?? {});
      if (schemas.params) req.params = schemas.params.parse(req.params ?? {});
      if (schemas.query) {
        const parsed = schemas.query.parse(req.query ?? {});
        Object.keys(req.query).forEach((k) => delete req.query[k]);
        Object.assign(req.query, parsed);
      }
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        return next(
          new AppError(422, 'VALIDATION_ERROR', 'Please check the highlighted fields.', {
            fields: err.flatten().fieldErrors,
            form: err.flatten().formErrors,
          })
        );
      }
      next(err);
    }
  };
}
