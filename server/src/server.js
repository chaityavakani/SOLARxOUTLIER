import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './core/logger.js';
import { registerListeners } from './core/registerListeners.js';
import { startJobs } from './jobs/index.js';

const app = createApp();

registerListeners();

app.listen(env.PORT, () => {
  logger.info(`SunPower SIMS API listening on http://localhost:${env.PORT}/api/v1`);
  startJobs();
});
