const fs = require('fs');
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
expectIncludes('target="_blank"', 'new-tab link behavior');
expectIncludes('rel="noopener noreferrer"', 'safe external-link behavior');
expectIncludes('renderStepVisual', 'step-specific visual renderer');
expectExcludes('data:image/png;base64,', 'embedded base64 image');

console.log('Visual integration test passed for F107-020 linked schematic.');
