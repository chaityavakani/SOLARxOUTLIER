import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import { env } from '../config/env.js';
import { prisma } from './prisma.js';
import { badRequest } from './AppError.js';

const uploadRoot = path.resolve(env.UPLOAD_DIR);
fs.mkdirSync(uploadRoot, { recursive: true });

const ALLOWED = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
};
const MAX_BYTES = 5 * 1024 * 1024;

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadRoot),
  filename: (_req, file, cb) => {
    const ext = ALLOWED[file.mimetype] || '.bin';
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED[file.mimetype]) {
      return cb(badRequest('Only JPG, PNG, WEBP or PDF files are allowed.', 'INVALID_FILE_TYPE'));
    }
    cb(null, true);
  },
});

/** Persists an Attachment row for an uploaded file. */
export async function saveAttachment({ entityType, entityId, file, kind = 'PHOTO', uploadedById }) {
  return prisma.attachment.create({
    data: {
      entityType,
      entityId,
      fileUrl: `/uploads/${file.filename}`,
      fileName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      kind,
      uploadedById: uploadedById || null,
    },
  });
}

/** Saves a base64 data URL (signature pad) as a PNG on disk. */
export async function saveDataUrl(dataUrl, prefix = 'signature') {
  const match = /^data:(image\/(png|jpeg|webp));base64,(.+)$/.exec(dataUrl || '');
  if (!match) throw badRequest('Signature must be a PNG image.', 'INVALID_SIGNATURE');
  const ext = match[2] === 'jpeg' ? '.jpg' : `.${match[2]}`;
  const filename = `${prefix}-${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
  fs.writeFileSync(path.join(uploadRoot, filename), Buffer.from(match[3], 'base64'));
  return `/uploads/${filename}`;
}
