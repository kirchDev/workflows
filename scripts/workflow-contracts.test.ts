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
