import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(10),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  PORT: z.coerce.number().default(5000),
  UPLOAD_DIR: z.string().default('uploads'),
  NODE_ENV: z.string().default('development'),
});

export const env = schema.parse(process.env);
export const isProd = env.NODE_ENV === 'production';
