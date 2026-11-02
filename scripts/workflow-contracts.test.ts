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

function script(name: string, file = '_ci-rust.yml'): string {
  const step = readFileSync(`.github/workflows/${file}`, 'utf8')
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
            GITHUB_OUTPUT: output,
            TOOLCHAIN: ''
          },
          encoding: 'utf8'
        }
      );
      assert.equal(run.status, 0, run.stderr);
      assert.equal(
        readFileSync(output, 'utf8').trim(),
        location ? 'source=file\ntoolchain=1.90.0' : 'source=\ntoolchain='
      );
      if (location) rmSync(join(location, 'rust-toolchain.toml'));
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('toolchain input wins, legacy and path pins resolve, and names stay single output lines', () => {
  const root = mkdtempSync(join(tmpdir(), 'workflow-toolchain-input-'));
  const output = join(root, 'output');
  const cases: [string, string | undefined, string | undefined][] = [
    [
      'nightly-2026-10-07',
      '[toolchain]\nchannel = "1.90.0"\n',
      'source=input\ntoolchain=nightly-2026-10-07'
    ],
    ['', 'nightly-2026-10-07\n', 'source=file\ntoolchain=nightly-2026-10-07'],
    [
      '',
      '[toolchain]\nchannel = \'1.91.1\'\ncomponents = ["clippy"]\n',
      'source=file\ntoolchain=1.91.1'
    ],
    ['', '[toolchain]\npath = "/opt/rust"\n', 'source=file\ntoolchain='],
    ['stable\nEVIL=true', undefined, undefined]
  ];
  try {
    for (const [input, pin, expected] of cases) {
      writeFileSync(output, '');
      rmSync(join(root, 'rust-toolchain'), { force: true });
      if (pin) writeFileSync(join(root, 'rust-toolchain'), pin);
      const run = spawnSync(
        'bash',
        ['-c', script('Detect the repository toolchain')],
        {
          cwd: root,
          env: {
            ...process.env,
            GITHUB_WORKSPACE: root,
            GITHUB_OUTPUT: output,
            TOOLCHAIN: input
          },
          encoding: 'utf8'
        }
      );
      assert.equal(run.status, expected ? 0 : 1, run.stderr);
      assert.equal(readFileSync(output, 'utf8').trim(), expected ?? '');
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('toolchain install names the toolchain unless rustup 1.28+ reads the pin file', () => {
  const root = mkdtempSync(join(tmpdir(), 'workflow-rustup-'));
  const log = join(root, 'calls');
  writeFileSync(
    join(root, 'rustup'),
    [
      '#!/bin/sh',
      'if [ "$1" = --version ]; then echo "rustup $RUSTUP_VERSION (fake)"; exit 0; fi',
      'echo "$*" >> "$CALLS"',
      'if [ "$1 $2" = "toolchain list" ]; then echo "$INSTALLED"; fi',
      'if [ "$1 $2 $3" = "toolchain install --no-self-update" ] && [ "$RUSTUP_VERSION" = 1.26.0 ]; then exit 1; fi',
      ''
    ].join('\n'),
    { mode: 0o755 }
  );
  const install = (env: Record<string, string>) => {
    writeFileSync(log, '');
    const run = spawnSync(
      'bash',
      ['-c', script('Install the repository toolchain')],
      {
        env: {
          ...process.env,
          PATH: `${root}:${process.env.PATH}`,
          CALLS: log,
          COMPONENTS: 'rustfmt, clippy',
          INSTALLED: 'stable-x86_64-unknown-linux-gnu (default)',
          ...env
        },
        encoding: 'utf8'
      }
    );
    return {
      status: run.status,
      stderr: run.stderr,
      calls: readFileSync(log, 'utf8').trim().split('\n')
    };
  };
  try {
    const tc = 'nightly-2026-10-07';
    for (const version of ['1.26.0', '1.28.2']) {
      const run = install({
        RUSTUP_VERSION: version,
        SOURCE: 'input',
        TOOLCHAIN: tc,
        INSTALLED: ''
      });
      assert.equal(run.status, 0, run.stderr);
      assert.deepEqual(run.calls, [
        `toolchain install ${tc} --profile minimal --no-self-update`,
        `component add --toolchain ${tc} rustfmt clippy`,
        `override set ${tc}`,
        'toolchain list',
        `default ${tc}`
      ]);
    }
    const legacy = install({
      RUSTUP_VERSION: '1.26.0',
      SOURCE: 'file',
      TOOLCHAIN: tc
    });
    assert.equal(legacy.status, 0, legacy.stderr);
    assert.deepEqual(legacy.calls, [
      `toolchain install ${tc} --profile minimal --no-self-update`,
      `component add --toolchain ${tc} rustfmt clippy`,
      'toolchain list'
    ]);
    const modern = install({
      RUSTUP_VERSION: '1.28.2',
      SOURCE: 'file',
      TOOLCHAIN: ''
    });
    assert.equal(modern.status, 0, modern.stderr);
    assert.deepEqual(modern.calls, [
      'toolchain install --no-self-update',
      'component add rustfmt clippy',
      'toolchain list'
    ]);
    const unnamed = install({
      RUSTUP_VERSION: '1.26.0',
      SOURCE: 'file',
      TOOLCHAIN: ''
    });
    assert.equal(unnamed.status, 1);
    const missing = spawnSync(
      '/bin/bash',
      ['-c', script('Install the repository toolchain')],
      {
        env: {
          PATH: '/nonexistent',
          SOURCE: 'input',
          TOOLCHAIN: tc,
          COMPONENTS: ''
        },
        encoding: 'utf8'
      }
    );
    assert.equal(missing.status, 1);
    assert.match(missing.stdout, /::error::rustup is missing/u);
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

const AREA_FILTERS = [
  'tools:',
  '  - tools/**',
  "  - '*'",
  'core:',
  '  - services/core/**/*.json # comment',
  '  - "packages/**/Capacity.java"',
  'negated:',
  '  - tools/**',
  "  - '!tools/docs/**'",
  'braced:',
  "  - 'src/**/*.{ts,js}'",
  ''
].join('\n');

function git(cwd: string, ...args: string[]): string {
  const run = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  return run.stdout.trim();
}

function fingerprints(root: string, sha: string): Record<string, string> {
  const output = join(root, 'output');
  writeFileSync(output, '');
  const run = spawnSync(
    'bash',
    ['-c', script('Compute the area fingerprints', '_detect-changes.yml')],
    {
      env: {
        ...process.env,
        RUNNER_TEMP: root,
        GITHUB_OUTPUT: output,
        FILTERS: AREA_FILTERS,
        TOKEN: '',
        SERVER_URL: `file://${root}`,
        REPOSITORY: 'source',
        SHA: sha
      },
      encoding: 'utf8'
    }
  );
  assert.equal(run.status, 0, run.stderr);
  const lines = readFileSync(output, 'utf8').trim().split('\n');
  assert.equal(
    lines[0],
    'names=["tools","core","negated","braced"]',
    'every filter is named, fingerprinted or not'
  );
  const line = lines.find((entry) => entry.startsWith('fingerprints='));
  assert.ok(line, run.stdout);
  return JSON.parse(line.slice('fingerprints='.length));
}

test('area fingerprints follow the matched content and skip filters git cannot reproduce', () => {
  const root = mkdtempSync(join(tmpdir(), 'workflow-fingerprint-'));
  const source = join(root, 'source');
  const write = (path: string, content: string) => {
    mkdirSync(join(source, path, '..'), { recursive: true });
    writeFileSync(join(source, path), content);
  };
  try {
    mkdirSync(source);
    git(source, 'init', '-q');
    git(source, 'config', 'uploadpack.allowFilter', 'true');
    git(source, 'config', 'uploadpack.allowAnySHA1InWant', 'true');
    write('package.json', '{}');
    write('tools/cli/run.ts', 'one');
    write('services/core/app/config.json', '{}');
    write('services/core/app/Model.php', '<?php');
    write('packages/minecraft/a/Capacity.java', 'class A {}');
    const commit = (message: string) => {
      git(source, 'add', '-A');
      git(
        source,
        '-c',
        'user.name=t',
        '-c',
        'user.email=t@t',
        'commit',
        '-qm',
        message
      );
      return git(source, 'rev-parse', 'HEAD');
    };

    const first = fingerprints(root, commit('first'));
    assert.deepEqual(Object.keys(first), ['tools', 'core']);
    for (const value of Object.values(first))
      assert.match(value, /^[0-9a-f]{64}$/);

    write('services/core/app/Model.php', '<?php // outside every pattern');
    const outside = fingerprints(root, commit('outside'));
    assert.deepEqual(
      outside,
      first,
      'a file no pattern matches changes nothing'
    );

    write('packages/minecraft/a/Capacity.java', 'class B {}');
    const core = fingerprints(root, commit('core'));
    assert.equal(core.tools, first.tools);
    assert.notEqual(core.core, first.core, 'a /**/ match moves the area');

    write('README.md', 'root file');
    const rooted = fingerprints(root, commit('root'));
    assert.notEqual(rooted.tools, core.tools, "'*' matches a new root file");
    assert.equal(rooted.core, core.core);

    git(source, 'revert', '--no-edit', 'HEAD', 'HEAD~1');
    const reverted = fingerprints(root, git(source, 'rev-parse', 'HEAD'));
    assert.deepEqual(
      reverted,
      outside,
      'a revert lands on a fingerprint that already passed'
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('an unreachable tree fails open with no fingerprint at all', () => {
  const root = mkdtempSync(join(tmpdir(), 'workflow-fingerprint-open-'));
  try {
    assert.deepEqual(fingerprints(root, '0'.repeat(40)), {});
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('an area runs unless forced off its exact green fingerprint', () => {
  const root = mkdtempSync(join(tmpdir(), 'workflow-fingerprint-decide-'));
  const output = join(root, 'output');
  const fp = (char: string) => char.repeat(64);
  const decide = (env: Record<string, string>) => {
    writeFileSync(output, '');
    const run = spawnSync(
      'bash',
      ['-c', script('Decide which areas run', '_detect-changes.yml')],
      {
        env: {
          ...process.env,
          GITHUB_OUTPUT: output,
          GITHUB_STEP_SUMMARY: join(root, 'summary'),
          NAMES: '["tools","core","bots","raw"]',
          FINGERPRINTS: JSON.stringify({
            tools: fp('a'),
            core: fp('b'),
            bots: fp('c')
          }),
          GREEN: JSON.stringify([
            { context: 'ci-area/tools', description: fp('a') },
            { context: 'ci-area/core', description: fp('f') },
            { context: 'ci-area/elsewhere', description: fp('c') }
          ]),
          FORCE: 'false',
          ...env
        },
        encoding: 'utf8'
      }
    );
    assert.equal(run.status, 0, run.stderr);
    return readFileSync(output, 'utf8').trim();
  };
  try {
    assert.equal(
      decide({}),
      'changes=["core","bots","raw"]\nverified=["tools"]',
      'only the exact context and fingerprint count'
    );
    assert.equal(
      decide({ FORCE: 'true' }),
      'changes=["tools","core","bots","raw"]\nverified=[]'
    );
    assert.equal(
      decide({ GREEN: '', FINGERPRINTS: '' }),
      'changes=["tools","core","bots","raw"]\nverified=[]',
      'a failed lookup runs everything'
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('recording writes one status per named area and refuses malformed input', () => {
  const root = mkdtempSync(join(tmpdir(), 'workflow-fingerprint-record-'));
  const calls = join(root, 'calls');
  writeFileSync(
    join(root, 'curl'),
    ['#!/bin/sh', 'echo "$* $(cat)" >> "$CALLS"', ''].join('\n'),
    { mode: 0o755 }
  );
  const fp = 'd'.repeat(64);
  const record = (env: Record<string, string>) => {
    writeFileSync(calls, '');
    const run = spawnSync(
      'bash',
      [
        '-c',
        script(
          'Mark the green areas on this commit',
          '_record-area-fingerprints.yml'
        )
      ],
      {
        env: {
          ...process.env,
          PATH: `${root}:${process.env.PATH}`,
          CALLS: calls,
          TOKEN: 't',
          API_URL: 'https://api.example',
          REPOSITORY: 'o/r',
          HEAD_REPOSITORY: 'o/r',
          SHA: 'abc',
          RUN_URL: 'https://run',
          FINGERPRINTS: JSON.stringify({ tools: fp, core: fp }),
          AREAS: '*',
          ...env
        },
        encoding: 'utf8'
      }
    );
    return {
      status: run.status,
      calls: readFileSync(calls, 'utf8').trim().split('\n').filter(Boolean)
    };
  };
  try {
    const all = record({});
    assert.equal(all.status, 0);
    assert.equal(all.calls.length, 2);
    assert.match(all.calls[0], /\/repos\/o\/r\/statuses\/abc /);
    assert.match(all.calls[0], /"context":"ci-area\/tools"/);
    assert.match(all.calls[0], new RegExp(`"description":"${fp}"`));

    const named = record({ AREAS: '["core","unknown"]' });
    assert.equal(named.status, 0);
    assert.equal(named.calls.length, 1);
    assert.match(named.calls[0], /ci-area\/core/);

    assert.deepEqual(record({ HEAD_REPOSITORY: 'fork/r' }), {
      status: 0,
      calls: []
    });
    assert.deepEqual(record({ FINGERPRINTS: '' }), { status: 0, calls: [] });
    assert.equal(record({ AREAS: 'tools' }).status, 1);
    assert.equal(
      record({ FINGERPRINTS: JSON.stringify({ tools: 'nope' }) }).status,
      1
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
