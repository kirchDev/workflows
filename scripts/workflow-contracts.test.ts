import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const workflow = readFileSync('.github/workflows/_ci-rust.yml', 'utf8');
function script(name: string): string {
  const step = workflow
    .split(`      - name: ${name}\n`)[1]
    ?.split('\n      - ')[0];
  const body = step?.split('        run: |\n')[1];
  assert.ok(body, `Missing script: ${name}`);
  return body
    .split('\n')
    .filter((line) => line.startsWith('          '))
    .map((line) => line.slice(10))
    .join('\n');
}

test('repository toolchain is found in the crate or an ancestor without escaping the checkout', () => {
  const root = mkdtempSync(join(tmpdir(), 'workflow-toolchain-'));
  const repo = join(root, 'repo');
  const crate = join(repo, 'tools', 'crate');
  mkdirSync(crate, { recursive: true });
  writeFileSync(
    join(root, 'rust-toolchain.toml'),
    '[toolchain]\nchannel="nightly"\n'
  );
  try {
    for (const location of [undefined, repo, crate]) {
      const output = join(root, 'output');
      writeFileSync(output, '');
      if (location)
        writeFileSync(
          join(location, 'rust-toolchain.toml'),
          '[toolchain]\nchannel="1.90.0"\n'
        );
      const run = spawnSync(
        'bash',
        ['-c', script('Detect the repository toolchain')],
        {
          cwd: crate,
          env: {
            ...process.env,
            GITHUB_WORKSPACE: repo,
            GITHUB_OUTPUT: output
          },
          encoding: 'utf8'
        }
      );
      assert.equal(run.status, 0, run.stderr);
      assert.equal(
        readFileSync(output, 'utf8').trim(),
        `pinned=${location !== undefined}`
      );
      if (location) rmSync(join(location, 'rust-toolchain.toml'));
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('Cargo options preserve existing defaults and pass feature text as one argument', () => {
  const root = mkdtempSync(join(tmpdir(), 'workflow-cargo-'));
  const output = join(root, 'arguments');
  writeFileSync(
    join(root, 'cargo'),
    '#!/bin/sh\nprintf "%s\\n" "$@" > "$ARGS_FILE"\n',
    { mode: 0o755 }
  );
  try {
    for (const name of ['Clippy', 'Tests']) {
      for (const locked of [false, true]) {
        const features = locked ? 'feature-a,feature-b;echo injected' : '';
        const run = spawnSync('bash', ['-c', script(name)], {
          env: {
            ...process.env,
            PATH: `${root}:${process.env.PATH}`,
            ARGS_FILE: output,
            LOCKED: String(locked),
            ALL_FEATURES: String(!locked),
            FEATURES: features
          },
          encoding: 'utf8'
        });
        assert.equal(run.status, 0, run.stderr);
        const expected = [name === 'Clippy' ? 'clippy' : 'test'];
        if (name === 'Clippy') expected.push('--all-targets');
        expected.push(locked ? '--locked' : '--all-features');
        if (features) expected.push('--features', features);
        if (name === 'Clippy') expected.push('--', '-D', 'warnings');
        assert.deepEqual(
          readFileSync(output, 'utf8').trim().split('\n'),
          expected
        );
      }
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('Gradle task arguments remain data and an empty task list fails', () => {
  const root = mkdtempSync(join(tmpdir(), 'workflow-gradle-'));
  const output = join(root, 'arguments');
  const body = readFileSync('.github/workflows/_ci-gradle.yml', 'utf8')
    .split('      - name: Run Gradle\n')[1]!
    .split('      - name: Preserve')[0]!;
  const command = body
    .split('        run: |\n')[1]!
    .split('\n')
    .filter((line) => line.startsWith('          '))
    .map((line) => line.slice(10))
    .join('\n');
  writeFileSync(
    join(root, 'gradlew'),
    '#!/bin/sh\nprintf "%s\\n" "$@" > "$ARGS_FILE"\n',
    { mode: 0o755 }
  );
  try {
    for (const tasks of ['check --build-cache', 'check;echo injected', '']) {
      const run = spawnSync('bash', ['-c', command], {
        cwd: root,
        env: { ...process.env, TASKS: tasks, ARGS_FILE: output },
        encoding: 'utf8'
      });
      assert.equal(run.status, tasks ? 0 : 1, run.stderr);
      if (tasks)
        assert.deepEqual(
          readFileSync(output, 'utf8').trim().split('\n'),
          tasks.split(' ')
        );
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('CI debug overrides reject injected environment lines and configure both Cargo profiles', () => {
  const root = mkdtempSync(join(tmpdir(), 'workflow-debug-'));
  const output = join(root, 'environment');
  try {
    for (const value of [
      'line-tables-only',
      '0',
      'full',
      'invalid',
      '0\nEVIL=true'
    ]) {
      writeFileSync(output, '');
      const run = spawnSync(
        'bash',
        ['-c', script('Configure CI debug information')],
        {
          env: { ...process.env, PROFILE_DEBUG: value, GITHUB_ENV: output },
          encoding: 'utf8'
        }
      );
      const valid = ['line-tables-only', '0', 'full'].includes(value);
      assert.equal(run.status, valid ? 0 : 1, run.stderr);
      assert.equal(
        readFileSync(output, 'utf8'),
        valid
          ? `CARGO_PROFILE_DEV_DEBUG=${value === 'full' ? '2' : value}\nCARGO_PROFILE_TEST_DEBUG=${value === 'full' ? '2' : value}\n`
          : ''
      );
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('optional aggregate gates remain on by default and reject failed or cancelled dependencies', () => {
  for (const name of ['check', 'rust', 'gradle']) {
    const source = readFileSync(`.github/workflows/_ci-${name}.yml`, 'utf8');
    assert.match(
      source,
      /      gate:\n[\s\S]*?        type: boolean\n        default: true/u
    );
    const gate = source.split('\n  gate:\n')[1]!;
    assert.ok(gate.includes('if: ${{ !cancelled() && inputs.gate }}'));
    const command = gate
      .split('        run: |\n')[1]!
      .split('\n')
      .filter((line) => line.startsWith('          '))
      .map((line) => line.slice(10))
      .join('\n');
    for (const result of ['success', 'skipped', 'failure', 'cancelled']) {
      const run = spawnSync('bash', ['-c', command], {
        env: { ...process.env, RESULT: result, RESULTS: `success ${result}` },
        encoding: 'utf8'
      });
      assert.equal(
        run.status,
        ['success', 'skipped'].includes(result) ? 0 : 1,
        run.stderr
      );
    }
  }
});
