const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const { execFileSync } = require('child_process');

execFileSync(process.execPath, ['build.js'], { stdio: 'inherit' });

const html = fs.readFileSync('dist/index.html', 'utf8');

function expectIncludes(value, label) {
  if (!html.includes(value)) {
    throw new Error(`Visual integration missing: ${label}`);
  }
}

function expectExcludes(value, label) {
  if (html.includes(value)) {
    throw new Error(`Visual integration should not include: ${label}`);
  }
}

expectIncludes('F107-020', 'step mapping F107-020');
expectIncludes('assets/f2m/107/cablage-cn12.png', 'linked schematic path');
expectIncludes('Voir le schéma de câblage DPM / CN12', 'schematic link label');
expectIncludes("link.target = '_blank'", 'new-tab link behavior');
expectIncludes("link.rel = 'noopener noreferrer'", 'safe external-link behavior');
expectIncludes('renderStepVisual', 'step-specific visual renderer');
expectExcludes('data:image/png;base64,', 'embedded base64 image');

const assetPath = path.join('dist', 'assets', 'f2m', '107', 'cablage-cn12.png');
if (!fs.existsSync(assetPath)) throw new Error('Hosted F107-020 schematic asset is missing');
const png = fs.readFileSync(assetPath);
if (png.length !== 45054) throw new Error(`Hosted F107-020 PNG size mismatch: ${png.length}`);
const sha = crypto.createHash('sha256').update(png).digest('hex');
if (sha !== 'cce3b85094f25bf465b31471cce89984c376b12acfc3e6d9ff648cf96b963fe9') {
  throw new Error(`Hosted F107-020 PNG checksum mismatch: ${sha}`);
}

console.log('Visual integration test passed for F107-020 hosted schematic link.');
