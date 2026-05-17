import fs from 'fs';
import path from 'path';

const srcDir = 'node_modules/@mediapipe/tasks-vision/wasm';
const destDir = 'public/wasm';

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

if (!fs.existsSync(srcDir)) {
  console.warn(`Source directory does not exist: ${srcDir}. Run pnpm install first.`);
  process.exit(0);
}

for (const file of fs.readdirSync(srcDir)) {
  fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file));
}

console.log('Copied MediaPipe vision WASM files to public/wasm');
