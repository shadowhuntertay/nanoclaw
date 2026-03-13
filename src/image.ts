/**
 * Image download helpers for channel integrations.
 * Downloads photos to the group's workspace and provides base64 loading
 * for multimodal container input.
 */
import fs from 'fs';
import https from 'https';
import http from 'http';
import path from 'path';

import { GROUPS_DIR } from './config.js';
import { logger } from './logger.js';

export interface ImageAttachment {
  data: string; // base64-encoded image data
  mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
}

/**
 * Marker format embedded in message content to signal a saved image.
 * Regex captures the relative path, e.g. "images/photo_2026-03-13T19-30-00.jpg"
 */
const PHOTO_MARKER_RE = /\[Photo:([^\]]+)\]/g;

/** Download a URL to a Buffer. Follows one level of HTTP redirect. */
function fetchBuffer(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    lib
      .get(url, (res) => {
        if (
          res.statusCode &&
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          fetchBuffer(res.headers.location).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode} downloading image`));
          return;
        }
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
      })
      .on('error', reject);
  });
}

/**
 * Download an image from a URL and save it to the group's images/ folder.
 * Returns the relative path (e.g. "images/photo_2026-03-13T19-30-00.jpg")
 * formatted as a [Photo:...] marker for embedding in message content.
 */
export async function saveImageToGroup(
  url: string,
  groupFolder: string,
  extension = 'jpg',
): Promise<string> {
  const imagesDir = path.join(GROUPS_DIR, groupFolder, 'images');
  fs.mkdirSync(imagesDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `photo_${timestamp}.${extension}`;
  const filePath = path.join(imagesDir, filename);

  const buf = await fetchBuffer(url);
  fs.writeFileSync(filePath, buf);
  logger.info(
    { groupFolder, filename, bytes: buf.length },
    'Saved Telegram photo to group workspace',
  );

  return `images/${filename}`;
}

/**
 * Scan message contents for [Photo:path] markers and load each as base64.
 * Returns up to maxImages attachments (most recent first).
 */
export function extractImageAttachments(
  messages: { content: string }[],
  groupFolder: string,
  maxImages = 5,
): ImageAttachment[] {
  const attachments: ImageAttachment[] = [];
  const groupDir = path.join(GROUPS_DIR, groupFolder);

  for (const msg of messages) {
    let match: RegExpExecArray | null;
    PHOTO_MARKER_RE.lastIndex = 0;
    while ((match = PHOTO_MARKER_RE.exec(msg.content)) !== null) {
      const relPath = match[1];
      const fullPath = path.join(groupDir, relPath);
      try {
        const buf = fs.readFileSync(fullPath);
        const ext = path.extname(relPath).toLowerCase().slice(1);
        const mediaType =
          ext === 'png'
            ? 'image/png'
            : ext === 'gif'
              ? 'image/gif'
              : ext === 'webp'
                ? 'image/webp'
                : 'image/jpeg';
        attachments.push({ data: buf.toString('base64'), mediaType });
        if (attachments.length >= maxImages) return attachments;
      } catch (err) {
        logger.warn({ relPath, err }, 'Failed to load image for multimodal');
      }
    }
  }

  return attachments;
}
