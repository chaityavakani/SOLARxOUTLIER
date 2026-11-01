import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { asyncHandler } from '../../core/asyncHandler.js';
import { ok } from '../../core/response.js';
import { requireAuth } from '../../middlewares/requireAuth.js';

export const voiceRouter = Router();
voiceRouter.use(requireAuth);

let client;
try {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set in .env');
  client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
} catch (e) {
  console.warn('[voice] Anthropic SDK not configured:', e.message);
}

const SYSTEM_PROMPT = `You are a solar site-survey assistant. Extract structured data from a technician's spoken survey report. The technician may speak in ANY language — Hindi, Gujarati, English, Marathi, Tamil, Telugu, or a mix.

Return ONLY a valid JSON object with these exact keys (omit a key if not mentioned):
{
  "roofType": "RCC" | "METAL_SHEET" | "TILED" | "OTHER",
  "shadowFreeAreaSqft": <number>,
  "roofDirection": "S" | "SW" | "SE" | "W" | "E" | "N",
  "tiltDegrees": <number 0-90>,
  "cableDistanceMeters": <number>,
  "structureHeightFt": <number>,
  "recommendedCapacityKw": <number>,
  "recommendedSystemType": "ON_GRID" | "OFF_GRID",
  "notes": "<full observation in English>"
}

Rules:
- Convert all measurements to the correct unit (sq m → sq ft: multiply by 10.764; meters → feet if needed)
- "East-West" or "East West" direction → use "E"
- "North" direction is suboptimal — only set if clearly stated
- For "ડાયરેક્શન" or "direction" followed by a number — that is the tilt angle in degrees
- "ON_GRID" = grid-tied / net metering / ongrid; "OFF_GRID" = battery backup / offgrid
- notes field: translate the full speech to clear English observations
- Return ONLY the JSON object, no explanation, no markdown fences`;

voiceRouter.post(
  '/parse-survey',
  asyncHandler(async (req, res) => {
    if (!client) return ok(res, { _error: 'ANTHROPIC_API_KEY not configured in server .env' });
    const { transcript } = req.body;
    if (!transcript?.trim()) return ok(res, {});

    const message = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Technician said: "${transcript}"` }],
    });

    const raw = message.content[0]?.text?.trim() || '{}';
    // Strip markdown fences if model added them
    const json = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const fields = JSON.parse(json);
    ok(res, fields);
  })
);
