const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
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

expectIncludes('querySheet("Visuels_Terrain")', 'Visuels_Terrain data source');
expectIncludes('visuals=', 'visual catalogue loaded from Google Sheets');
expectIncludes('visual.URL', 'visual URL read from data');
expectIncludes("visual['Légende']", 'visual link label read from data');
expectIncludes("link.target = '_blank'", 'new-tab link behavior');
expectIncludes("link.rel = 'noopener noreferrer'", 'safe link behavior');
expectIncludes('renderStepVisual', 'step-specific visual renderer');
expectExcludes('const STEP_VISUALS', 'hardcoded visual mapping');
expectExcludes('data:image/png;base64,', 'embedded base64 image');
expectExcludes("'F107-020':", 'hardcoded F107-020 visual entry');

const sourceAsset = path.join('assets', 'f2m', '107', 'cablage-cn12.png');
if (!fs.existsSync(sourceAsset)) throw new Error('Source F107-020 PNG asset is missing from repository assets');

const sourceDir = path.dirname(sourceAsset);
const legacyBase64Parts = fs.readdirSync(sourceDir).filter(name => name.endsWith('.b64'));
if (legacyBase64Parts.length) {
  throw new Error(`Legacy base64 schematic parts must be removed: ${legacyBase64Parts.join(', ')}`);
}

const distAsset = path.join('dist', 'assets', 'f2m', '107', 'cablage-cn12.png');
if (!fs.existsSync(distAsset)) throw new Error('Hosted F107-020 schematic asset is missing from dist');

const sourcePng = fs.readFileSync(sourceAsset);
const distPng = fs.readFileSync(distAsset);
const signature = Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);
const iend = Buffer.from([0x00,0x00,0x00,0x00,0x49,0x45,0x4e,0x44,0xae,0x42,0x60,0x82]);
if (!sourcePng.subarray(0, 8).equals(signature)) throw new Error('Source F107-020 asset is not a PNG');
if (!sourcePng.subarray(-12).equals(iend)) throw new Error('Source F107-020 PNG is truncated');

const width = sourcePng.readUInt32BE(16);
const height = sourcePng.readUInt32BE(20);
if (width !== 716 || height !== 910) throw new Error(`Unexpected original schematic dimensions: ${width}x${height}`);

const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const expectedHash = 'ae77c3709771f986b98c2b631de12c73f452d26cd5b6a0452b85bd609ad22bcf';
if (hash(sourcePng) !== expectedHash) throw new Error('Repository schematic does not match the original manufacturer image');
if (hash(sourcePng) !== hash(distPng)) throw new Error('Build must copy the hosted schematic without altering it');

console.log('Visual integration test passed for F107-020 data-driven hosted schematic link.');
