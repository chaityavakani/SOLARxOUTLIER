import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import { env, isProd } from './config/env.js';
import { logger } from './core/logger.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { notFound } from './middlewares/notFound.js';
import { apiRouter } from './routes.js';

export function createApp() {
  const app = express();

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(
    cors({
      origin: (origin, cb) => {
        // In development allow any localhost port so Vite port-bumps never block the app.
        const allowed = env.CLIENT_URL.split(',').map((s) => s.trim());
        const isLocalhost = !origin || /^https?:\/\/localhost(:\d+)?$/.test(origin);
        const isDev = env.NODE_ENV !== 'production';
        if (isDev && isLocalhost) return cb(null, true);
        if (allowed.includes(origin)) return cb(null, true);
        cb(new Error(`CORS: origin ${origin} not allowed`));
      },
      credentials: true,
    })
  );
  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());
  app.use(pinoHttp({ logger, autoLogging: isProd }));

  app.use('/uploads', express.static(path.resolve(env.UPLOAD_DIR), { dotfiles: 'deny', index: false }));

  app.get('/api/v1/health', (_req, res) =>
    res.json({ success: true, data: { status: 'ok', service: 'SunPower SIMS API', time: new Date() } })
  );

  app.use('/api/v1', apiRouter);
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
