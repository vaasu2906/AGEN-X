import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, 'dist');
const staticDir = path.resolve(__dirname, '..', 'src', 'api', 'static');

if (fs.existsSync(distDir)) {
  fs.mkdirSync(staticDir, { recursive: true });
  fs.cpSync(distDir, staticDir, { recursive: true });
  console.log(`Successfully synced build artifacts to ${staticDir}`);
}
