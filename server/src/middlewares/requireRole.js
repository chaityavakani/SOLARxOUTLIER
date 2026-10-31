import { forbidden } from '../core/AppError.js';

/** Restricts a route to the given roles. Must run after requireAuth. */
export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(forbidden());
    if (!roles.includes(req.user.role)) {
      return next(forbidden('Your role does not have access to this area.'));
    }
    next();
  };
}
