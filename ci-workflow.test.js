const assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const workflowFiles = [
  '.github/workflows/pages.yml',
  '.github/workflows/visual-test.yml',
];

function workflowCommands(workflowFile) {
  return fs.readFileSync(path.join(__dirname, workflowFile), 'utf8')
    .split('\n')
    .map(line => line.match(/^\s+run:\s*(.+)\s*$/)?.[1])
    .filter(command => command?.startsWith('node build.js') || command?.startsWith('node --test'));
}

function writeTestFile(directory, filename, body = '') {
  fs.writeFileSync(path.join(directory, filename), [
    "const { test } = require('node:test');",
    "test('fixture', () => {",
    body,
    '});',
    '',
  ].join('\n'));
}

function simulateWorkflow(workflowFile) {
  const commands = workflowCommands(workflowFile);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'techdiag-ci-'));
  const { NODE_TEST_CONTEXT, ...workflowEnvironment } = process.env;

  try {
    fs.writeFileSync(path.join(directory, 'build.js'), "require('node:fs').writeFileSync('.built', 'ok');\n");

    const namedTests = new Set(commands.flatMap(command => command.match(/[\w.-]+\.test\.js/g) || []));
    for (const filename of namedTests) writeTestFile(directory, filename);

    writeTestFile(directory, 'visual.test.js', "if (!require('node:fs').existsSync('.built')) throw new Error('tests ran before build');");
    writeTestFile(directory, 'documentation.test.js', "require('node:fs').writeFileSync('.documentation-ran', 'ok');");
    writeTestFile(directory, 'future-regression.test.js', "require('node:fs').writeFileSync('.future-test-ran', 'ok');");

    for (const command of commands) {
      execFileSync('/bin/bash', ['-lc', command], {
        cwd: directory,
        env: workflowEnvironment,
        stdio: 'pipe',
      });
    }

    assert.ok(fs.existsSync(path.join(directory, '.documentation-ran')), `${workflowFile} skipped documentation.test.js`);
    assert.ok(fs.existsSync(path.join(directory, '.future-test-ran')), `${workflowFile} does not automatically discover new tests`);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

for (const workflowFile of workflowFiles) {
  test(`${workflowFile} builds before automatically running every test file`, () => {
    simulateWorkflow(workflowFile);
  });
}

test('visual integration does not recursively launch node:test', () => {
  const { NODE_TEST_CONTEXT, ...standaloneEnvironment } = process.env;
  execFileSync(process.execPath, ['build.js'], { cwd: __dirname, stdio: 'pipe' });
  const result = spawnSync(process.execPath, ['--test', 'visual.test.js'], {
    cwd: __dirname,
    encoding: 'utf8',
    env: standaloneEnvironment,
  });
  const output = `${result.stdout || ''}\n${result.stderr || ''}`;

  assert.equal(result.status, 0, output);
  assert.doesNotMatch(output, /node:test run\(\) is being called recursively/, output);
});
