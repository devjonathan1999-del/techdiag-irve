const fs = require('fs');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

execFileSync(process.execPath, ['build.js'], { stdio: 'inherit' });

const html = fs.readFileSync('dist/index.html', 'utf8');

function expectIncludes(value, label) {
  if (!html.includes(value)) {
    throw new Error(`Visual integration missing: ${label}`);
  }
}

expectIncludes('F107-020', 'step mapping F107-020');
expectIncludes('data:image/png;base64,', 'embedded user-provided PNG');
expectIncludes('Schéma de câblage Modbus DPM ↔ CN12', 'visual title');
expectIncludes('Choisir le schéma correspondant au DPM installé', 'visual guidance');
expectIncludes('renderStepVisual', 'step-specific visual renderer');

const match = html.match(/data:image\/png;base64,([A-Za-z0-9+/=]+)/);
if (!match) throw new Error('Visual image data URI not found');
const png = Buffer.from(match[1], 'base64');
const pngSignature = Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);
if (!png.subarray(0, 8).equals(pngSignature)) throw new Error('F107-020 visual is not a valid PNG');
if (png.length !== 45054) throw new Error(`F107-020 PNG is truncated: ${png.length} bytes instead of 45054`);
const sha = crypto.createHash('sha256').update(png).digest('hex');
if (sha !== 'cce3b85094f25bf465b31471cce89984c376b12acfc3e6d9ff648cf96b963fe9') {
  throw new Error(`F107-020 PNG checksum mismatch: ${sha}`);
}

console.log('Visual integration test passed for F107-020 with intact PNG.');
