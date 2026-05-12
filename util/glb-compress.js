const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);
const SIZE_LIMIT = 9 * 1024 * 1024;
const GLTF_TRANSFORM = path.join(__dirname, '..', 'node_modules', '.bin', 'gltf-transform');

async function compressIfNeeded(filePath) {
  const { size } = fs.statSync(filePath);
  if (size <= SIZE_LIMIT) return { path: filePath, compressed: false };

  const outPath = path.join(os.tmpdir(), `compressed-${Date.now()}.glb`);
  await execFileAsync(GLTF_TRANSFORM, [
    'optimize', filePath, outPath,
    '--compress', 'draco',
    '--texture-compress', 'webp',
  ]);

  return { path: outPath, compressed: true };
}

module.exports = { compressIfNeeded };
