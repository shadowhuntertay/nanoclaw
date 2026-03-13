/**
 * Image download helpers for channel integrations.
 * Downloads photos to the group's workspace so container agents can read them.
 */
import fs from 'fs';
import https from 'https';
import http from 'http';
import path from 'path';

import { GROUPS_DIR } from './config.js';
import { logger } from './logger.js';

/** Download a URL to a Buffer. Follows one level of HTTP redirect. */
function fetchBuffer(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    lib
      .get(url, (res) => {
        // Follow redirect
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
 *
 * Returns the relative path from the group folder root (e.g. "images/photo_2026-03-13T19-30-00.jpg")
 * so the agent can read it with: Read("images/photo_2026-03-13T19-30-00.jpg")
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
