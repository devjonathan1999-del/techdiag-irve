const fs = require('fs');
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
const signature = Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);
const iend = Buffer.from([0x00,0x00,0x00,0x00,0x49,0x45,0x4e,0x44,0xae,0x42,0x60,0x82]);
if (!png.subarray(0, 8).equals(signature)) throw new Error('Hosted F107-020 asset is not a PNG');
if (!png.subarray(-12).equals(iend)) throw new Error('Hosted F107-020 PNG is truncated');
if (png.readUInt32BE(16) !== 716 || png.readUInt32BE(20) !== 910) {
  throw new Error(`Hosted F107-020 PNG dimensions are invalid: ${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`);
}

console.log('Visual integration test passed for F107-020 hosted schematic link.');
