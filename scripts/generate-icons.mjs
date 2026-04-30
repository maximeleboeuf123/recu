import sharp from 'sharp';
import { readFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

mkdirSync(resolve(root, 'public/icons'), { recursive: true });

const svg = readFileSync(resolve(root, 'public/icon.svg'));

await sharp(svg)
  .resize(192, 192)
  .png()
  .toFile(resolve(root, 'public/icons/icon-192.png'));

await sharp(svg)
  .resize(512, 512)
  .png()
  .toFile(resolve(root, 'public/icons/icon-512.png'));

console.log('Icons generated: icon-192.png and icon-512.png');
