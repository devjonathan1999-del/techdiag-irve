const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

execFileSync(process.execPath, ['build.js'], { stdio: 'inherit' });
execFileSync(process.execPath, ['--test', 'documentation.test.js', 'ui.test.js', 'summary.test.js'], { stdio: 'inherit' });

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

// Google Sheets reads must bypass stale gviz responses after a base update.
expectIncludes("'&cacheBust='+Date.now()", 'Google Sheets cache-busting query parameter');

// Global readability must be present in the built application without changing diagnostic semantics.
expectIncludes('techdiag-readability', 'global readability enhancement');
expectIncludes('questionReadabilityClass', 'adaptive question typography');
expectIncludes('.question.compact', 'compact long-question style');
expectIncludes('.question.dense', 'dense very-long-question style');
expectIncludes('.setting-value', 'highlighted settings values');

// Public manufacturer documentation must stay data-driven from Sources_Public.
expectIncludes('querySheet("Sources_Public")', 'Sources_Public documentation source');
expectIncludes('renderManufacturerDocs', 'manufacturer documentation renderer');
expectIncludes('📘 Documentation fabricant', 'manufacturer documentation action');
expectIncludes("docLink.target = '_blank'", 'manufacturer documentation opens in a new tab');
expectIncludes("docLink.rel = 'noopener noreferrer'", 'safe manufacturer documentation link');
expectExcludes('PKM.000013_08-ePro-Installation-Manual-F2M-Charge.pdf', 'hardcoded Free2move manual URL in application code');

// Diagnostic summary regression checks.
// Internal snake_case keys must never leak into the copied report as crude labels.
expectIncludes('const TD_SUMMARY_ACCENTS', 'French summary label normalization');
expectIncludes("/^conclusion(?:_|$)/i.test(key)", 'conclusion fields excluded from collected data');
expectIncludes("replace(/\\s+\\d+$/,'')", 'technical numeric suffix removed from collected-data labels');
expectIncludes("lines.push('', 'CONCLUSION', title);", 'copied conclusion contains only the actionable conclusion');
expectExcludes("title + (conclusion ? ' — '+conclusion : '')", 'internal interpretation appended to copied conclusion');

const sourceAsset = path.join('assets', 'f2m', '107', 'cablage-cn12.png');
if (!fs.existsSync(sourceAsset)) throw new Error('Source F107-020 PNG asset is missing from repository assets');

const sourceDir = path.dirname(sourceAsset);
const legacyBase64Parts = fs.readdirSync(sourceDir).filter(name => name.endsWith('.b64'));
if (legacyBase64Parts.length) {
  throw new Error(`Legacy base64 schematic parts must be removed: ${legacyBase64Parts.join(', ')}`);
}

// F107-040 must use the user-provided PowerUp capture under a stable filename.
const powerUpAsset = path.join(sourceDir, 'powerup-dpm-type.png');
if (!fs.existsSync(powerUpAsset)) throw new Error('Source F107-040 PowerUp PNG asset is missing from repository assets');
const pngNames = fs.readdirSync(sourceDir).filter(name => name.toLowerCase().endsWith('.png')).sort();
const expectedPngNames = ['cablage-cn12.png', 'powerup-dpm-type.png'];
if (JSON.stringify(pngNames) !== JSON.stringify(expectedPngNames)) {
  throw new Error(`Unused F107 PNG assets must be removed. Found: ${pngNames.join(', ')}`);
}
const gitBlobSha = bytes => crypto.createHash('sha1')
  .update(Buffer.from(`blob ${bytes.length}\0`))
  .update(bytes)
  .digest('hex');
const expectedPowerUpBlobSha = 'cdbee6f258d43723b406209802420f8b8bc259cd';
if (gitBlobSha(fs.readFileSync(powerUpAsset)) !== expectedPowerUpBlobSha) {
  throw new Error('F107-040 powerup-dpm-type.png must match the user-provided 2026-08-28 221308 capture');
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

console.log('Visual integration test passed for F107 visuals, public manufacturer documentation, global readability, and diagnostic summary formatting.');
