const fs = require('fs');
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

console.log('Visual integration test passed for F107-020.');
