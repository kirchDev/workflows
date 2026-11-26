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
    assert.ok(
      gate.includes(
        name === 'check'
          ? "if: ${{ !cancelled() && inputs.gate && needs.check.result != 'skipped' }}"
          : 'if: ${{ !cancelled() && inputs.gate }}'
      )
    );
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

test('the gate runs every task and fails once, naming each failure', () => {
  const root = mkdtempSync(join(tmpdir(), 'workflow-gate-'));
  try {
    // A stand-in `pnpm` that fails the tasks named in FAIL and logs every call.
    writeFileSync(
      join(root, 'pnpm'),
      '#!/usr/bin/env bash\necho "$1" >> "$CALLS"\ncase " $FAIL " in *" $1 "*) exit 1 ;; esac\n',
      { mode: 0o755 }
    );
    const command = script('Run the checks', '_ci-check.yml');
    for (const [fail, status] of [
      ['', 0],
      ['format', 1],
      ['format test', 1]
    ] as const) {
      const calls = join(root, 'calls');
      writeFileSync(calls, '');
      const run = spawnSync('bash', ['-c', command], {
        env: {
          ...process.env,
          PATH: `${root}:${process.env.PATH}`,
          TASKS: 'lint format typecheck test',
          FAIL: fail,
          CALLS: calls
        },
        encoding: 'utf8'
      });
      assert.equal(run.status, status, run.stderr);
      assert.equal(
        readFileSync(calls, 'utf8'),
        'lint\nformat\ntypecheck\ntest\n'
      );
      for (const task of fail.split(' ').filter(Boolean))
        assert.ok(run.stdout.includes(`::error::${task} failed.`), run.stdout);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('draft pull requests skip CodeQL and leave both gates skipped, not green', () => {
  const codeql = readFileSync('.github/workflows/_codeql.yml', 'utf8');
  const analyze = codeql.split('\n  analyze:\n')[1]!.split('\n  gate:\n')[0]!;
  assert.ok(
    analyze.includes(
      "if: github.event_name != 'pull_request' || github.event.pull_request.draft == false"
    )
  );
  assert.ok(
    codeql
      .split('\n  gate:\n')[1]!
      .includes("if: ${{ !cancelled() && needs.analyze.result != 'skipped' }}")
  );
  const stub = readFileSync('.github/workflows/codeql.yml', 'utf8');
  assert.match(stub, /types: \[[^\]]*ready_for_review[^\]]*\]/u);
});

// Evaluates the subset of the Actions expression language a job `if:` here
// uses — `||`, `&&`, `!`, parentheses, `==`/`!=`, string and boolean literals,
// context paths and `cancelled()` — with its documented loose equality: values
// of different types compare as numbers (null and false are 0, true is 1), and
// strings compare case-insensitively.
function evaluate(
  expression: string,
  context: Record<string, unknown>
): boolean {
  const source = expression.replace(/^\$\{\{\s*|\s*\}\}$/gu, '');
  const tokens =
    source.match(/\|\||&&|[!=]=|!|\(|\)|'(?:[^']|'')*'|[\w.-]+(?:\(\))?/gu) ??
    [];
  assert.equal(tokens.join(''), source.replace(/\s+/gu, ''), source);
  let at = 0;
  const truthy = (value: unknown) =>
    !(value === null || value === false || value === 0 || value === '') &&
    !Number.isNaN(value);
  const equal = (left: unknown, right: unknown) =>
    typeof left === 'string' && typeof right === 'string'
      ? left.toLowerCase() === right.toLowerCase()
      : typeof left === typeof right
        ? left === right
        : Number(left) === Number(right);
  const primary = (): unknown => {
    const token = tokens[at++]!;
    if (token === '(') {
      const value = or();
      assert.equal(tokens[at++], ')', source);
      return value;
    }
    if (token === '!') return !truthy(primary());
    if (token.startsWith("'")) return token.slice(1, -1).replaceAll("''", "'");
    if (token === 'true' || token === 'false') return token === 'true';
    if (token in context) return context[token];
    return token
      .split('.')
      .reduce<unknown>(
        (value, key) =>
          (value as Record<string, unknown> | null)?.[key] ?? null,
        context
      );
  };
  const equality = (): unknown => {
    let left = primary();
    while (tokens[at] === '==' || tokens[at] === '!=') {
      const negate = tokens[at++] === '!=';
      left = equal(left, primary()) !== negate;
    }
    return left;
  };
  const and = (): unknown => {
    let left = equality();
    while (tokens[at] === '&&') {
      at++;
      const right = equality();
      left = truthy(left) && truthy(right);
    }
    return left;
  };
  const or = (): unknown => {
    let left = and();
    while (tokens[at] === '||') {
      at++;
      const right = and();
      left = truthy(left) || truthy(right);
    }
    return left;
  };
  const result = or();
  assert.equal(at, tokens.length, source);
  return truthy(result);
}

test('a push runs the check and its gate; a draft pull request skips both', () => {
  const body = readFileSync('.github/workflows/_ci-check.yml', 'utf8');
  const condition = (job: string) => {
    const match = body
      .split(`\n  ${job}:\n`)[1]
      ?.match(/^    if: (.+)$/mu)?.[1];
    assert.ok(match, `Missing if: on ${job}`);
    return match;
  };
  const check = condition('check');
  const gate = condition('gate');
  // Pinned verbatim as well: under the documented coercion the bare
  // `draft == false` also holds on a push, so only the wording proves the
  // event is named rather than left to `null == false`.
  assert.equal(
    check,
    "github.event_name != 'pull_request' || github.event.pull_request.draft == false"
  );

  for (const [event, pullRequest, runs] of [
    ['push', undefined, true],
    ['workflow_dispatch', undefined, true],
    ['pull_request', { draft: false }, true],
    ['pull_request', { draft: true }, false]
  ] as const) {
    const github = {
      event_name: event,
      event: pullRequest ? { pull_request: pullRequest } : {}
    };
    assert.equal(
      evaluate(check, { github }),
      runs,
      `check on ${event} (${JSON.stringify(pullRequest)})`
    );
    // The gate judges whatever the check did: a failing check still reaches
    // it — and its script fails on `failure` — while a skipped one skips it.
    for (const checkResult of runs ? ['success', 'failure'] : ['skipped']) {
      assert.equal(
        evaluate(gate, {
          github,
          inputs: { gate: true },
          needs: { check: { result: checkResult } },
          'cancelled()': false
        }),
        runs,
        `gate on ${event} after ${checkResult}`
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
  const run = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 't',
      GIT_AUTHOR_EMAIL: 't@t',
      GIT_COMMITTER_NAME: 't',
      GIT_COMMITTER_EMAIL: 't@t',
      GIT_CONFIG_GLOBAL: '/dev/null'
    }
  });
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

// A stand-in for `gh` that answers from fixture files the way the real one
// does: `--paginate` reads every page (`<name>.json`, `<name>.2.json`), a page
// read without it stops at the first, `--jq` runs per page, and `<name>.fail`
// turns the call into an error with no JSON on stdout.
const FAKE_GH = [
  '#!/usr/bin/env bash',
  'set -euo pipefail',
  'echo "$*" >> "$FAKE/calls"',
  'jqexpr=',
  'paginate=false',
  'args=()',
  'while [ $# -gt 0 ]; do',
  '  case "$1" in',
  '  --jq) jqexpr=$2; shift 2 ;;',
  '  --paginate) paginate=true; shift ;;',
  '  *) args+=("$1"); shift ;;',
  '  esac',
  'done',
  'respond() {',
  '  if [ -e "$FAKE/$1.fail" ]; then echo "HTTP 502: Bad Gateway" >&2; exit 1; fi',
  '  pages=("$FAKE/$1.json")',
  '  if [ "$paginate" = true ] && [ -e "$FAKE/$1.2.json" ]; then pages+=("$FAKE/$1.2.json"); fi',
  '  for page in "${pages[@]}"; do',
  '    if [ -n "$jqexpr" ]; then jq -r "$jqexpr" "$page"; else cat "$page"; fi',
  '  done',
  '  exit "$(cat "$FAKE/$1.exit" 2>/dev/null || echo 0)"',
  '}',
  'case "${args[*]}" in',
  '"api repos/o/r/pulls?"*) respond pulls ;;',
  '"api repos/o/r/pulls/"*"/reviews") respond reviews ;;',
  '"api repos/o/r/rules/branches/"*) respond rules ;;',
  '"api repos/o/r/branches/"*) respond branch ;;',
  '"api repos/o/r/git/ref/heads/"*) respond tip ;;',
  '"api repos/o/r/collaborators/"*) respond permission ;;',
  '"pr view "*) respond view ;;',
  '"pr checks "*) respond checks ;;',
  '*) echo "unexpected gh call: $*" >&2; exit 2 ;;',
  'esac',
  ''
].join('\n');

function queueStep(
  file: string,
  name: string,
  fixtures: Record<string, unknown>,
  env: Record<string, string> = {}
) {
  const root = mkdtempSync(join(tmpdir(), 'workflow-queue-'));
  const output = join(root, 'output');
  writeFileSync(output, '');
  writeFileSync(join(root, 'calls'), '');
  writeFileSync(join(root, 'gh'), FAKE_GH, { mode: 0o755 });
  for (const [key, value] of Object.entries(fixtures)) {
    if (value === undefined) continue;
    if (key.endsWith('.fail')) writeFileSync(join(root, key), '');
    else if (key.endsWith('.exit'))
      writeFileSync(join(root, key), String(value));
    else writeFileSync(join(root, `${key}.json`), JSON.stringify(value));
  }
  try {
    const run = spawnSync('bash', ['-c', script(name, file)], {
      env: {
        ...process.env,
        PATH: `${root}:${process.env.PATH}`,
        FAKE: root,
        GH_REPO: 'o/r',
        QUEUE_BRANCH_PREFIX: 'ai/queue-',
        INTEGRATION_BRANCH: 'dev',
        GITHUB_OUTPUT: output,
        ...env
      },
      encoding: 'utf8'
    });
    return {
      status: run.status,
      log: run.stdout + run.stderr,
      output: readFileSync(output, 'utf8').trim(),
      calls: readFileSync(join(root, 'calls'), 'utf8')
    };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const pull = (number: number, ref: string, repo: string | null = 'o/r') => ({
  number,
  head: { ref, repo: repo === null ? null : { full_name: repo } }
});

test('the queue branch is found on any page, only in this repository, and two stop the cut', () => {
  const tip = 'abcdef0123456789abcdef0123456789abcdef01';
  const step = (fixtures: Record<string, unknown>) =>
    queueStep(
      '_queue-branch.yml',
      'Is a queue branch already open?',
      { tip: { object: { sha: tip } }, ...fixtures },
      { PR: '5' }
    );

  const none = step({ pulls: [pull(4, 'ai/queue/inf-1-worker')] });
  assert.equal(none.status, 0, none.log);
  assert.equal(none.output, `branch=ai/queue-abcdef0\nsha=${tip}\ncreate=true`);

  const one = step({ pulls: [pull(3, 'ai/queue-1111111')] });
  assert.equal(one.status, 0, one.log);
  assert.equal(one.output, 'branch=ai/queue-1111111\ncreate=false');

  const two = step({
    pulls: [pull(3, 'ai/queue-1111111'), pull(8, 'ai/queue-2222222')]
  });
  assert.equal(two.status, 1);
  assert.equal(two.output, '');
  assert.match(two.log, /::error::2 queue PRs are open into dev/);

  const fork = step({
    pulls: [
      pull(3, 'ai/queue-2222222', 'fork/r'),
      pull(6, 'ai/queue-3333333', null)
    ]
  });
  assert.equal(fork.status, 0, fork.log);
  assert.match(fork.output, /create=true$/);

  const pageTwo = step({
    pulls: [pull(1, 'feat/a')],
    'pulls.2': [pull(150, 'ai/queue-4444444')]
  });
  assert.equal(pageTwo.status, 0, pageTwo.log);
  assert.equal(pageTwo.output, 'branch=ai/queue-4444444\ncreate=false');

  const failed = step({ 'pulls.fail': true });
  assert.equal(failed.status, 1);
  assert.equal(failed.output, '');
  assert.match(failed.log, /::error::Could not list/);
});

test("the queue PR is opened unless this repository's branch already has one", () => {
  const step = (fixtures: Record<string, unknown>) =>
    queueStep(
      '_fast-forward-queue.yml',
      'Is a queue PR already open?',
      fixtures,
      { BRANCH: 'ai/queue-1111111' }
    );

  const own = step({ pulls: [pull(3, 'ai/queue-1111111')] });
  assert.equal(own.status, 0, own.log);
  assert.equal(own.output, 'create=false');
  assert.match(own.calls, /head=o:ai\/queue-1111111/);

  const fork = step({ pulls: [pull(3, 'ai/queue-1111111', 'fork/r')] });
  assert.equal(fork.status, 0, fork.log);
  assert.equal(fork.output, 'create=true');

  const failed = step({ 'pulls.fail': true });
  assert.equal(failed.status, 1);
  assert.equal(failed.output, '');
});

const HEAD = 'c'.repeat(40);
const row = (name: string, bucket: string, event = 'pull_request') => ({
  name,
  bucket,
  event,
  workflow: event ? name.split(' / ')[0] : ''
});
const required = (...contexts: string[]) => ({
  type: 'required_status_checks',
  parameters: {
    required_status_checks: contexts.map((context) => ({ context }))
  }
});
const landable = {
  pulls: [pull(7, 'ai/queue-abc1234')],
  view: {
    number: 7,
    state: 'OPEN',
    isDraft: false,
    baseRefName: 'dev',
    headRefName: 'ai/queue-abc1234',
    headRefOid: HEAD,
    isCrossRepository: false,
    statusCheckRollup: [{}]
  },
  rules: [{ type: 'deletion' }, required('CI / Gate')],
  branch: { protection: { required_status_checks: { contexts: [] } } },
  checks: [row('CI / Gate', 'pass')],
  reviews: [
    { user: { login: 'maintainer' }, state: 'APPROVED', commit_id: HEAD }
  ],
  permission: { permission: 'admin' }
};
const pick = (
  fixtures: Record<string, unknown> = {},
  env: Record<string, string> = {}
) =>
  queueStep(
    '_fast-forward-queue.yml',
    'Pick the queue PR',
    { ...landable, ...fixtures },
    { INPUT_PR: '', ...env }
  );

test('the landing considers exactly one queue PR of this repository, on any page', () => {
  const one = pick();
  assert.equal(one.status, 0, one.log);
  assert.equal(one.output, `pr=7\nsha=${HEAD}`);

  const none = pick({ pulls: [pull(4, 'ai/queue/inf-1-worker')] });
  assert.equal(none.status, 0, none.log);
  assert.equal(none.output, '');
  assert.match(none.log, /nothing to do/);

  const two = pick({
    pulls: [pull(7, 'ai/queue-abc1234'), pull(9, 'ai/queue-def5678')]
  });
  assert.equal(two.status, 1);
  assert.equal(two.output, '');
  assert.match(
    two.log,
    /::error::2 queue PRs are open into dev \(#7 ai\/queue-abc1234,#9 ai\/queue-def5678\)/
  );

  const fork = pick({
    pulls: [pull(5, 'ai/queue-abc1234', 'fork/r'), pull(7, 'ai/queue-abc1234')]
  });
  assert.equal(fork.output, `pr=7\nsha=${HEAD}`, fork.log);
  assert.equal(
    pick({ pulls: [pull(5, 'ai/queue-abc1234', 'fork/r')] }).output,
    ''
  );

  const pageTwo = pick({
    pulls: [pull(1, 'feat/a'), pull(2, 'ai/queue/inf-2-worker')],
    'pulls.2': [pull(150, 'ai/queue-abc1234')]
  });
  assert.equal(pageTwo.status, 0, pageTwo.log);
  assert.equal(pageTwo.output, `pr=150\nsha=${HEAD}`);

  const failed = pick({ 'pulls.fail': true });
  assert.equal(failed.status, 1);
  assert.equal(failed.output, '');
  assert.match(failed.log, /::error::Could not list/);

  // A dispatch names the PR, so two open queue PRs are no longer ambiguous —
  // and nothing is listed at all.
  const dispatched = pick(
    { pulls: [pull(7, 'ai/queue-abc1234'), pull(9, 'ai/queue-def5678')] },
    { INPUT_PR: '7' }
  );
  assert.equal(dispatched.output, `pr=7\nsha=${HEAD}`, dispatched.log);
  assert.doesNotMatch(dispatched.calls, /pulls\?/);

  const injected = pick({}, { INPUT_PR: '7\n::error::x' });
  assert.equal(injected.status, 1);
  assert.equal(injected.output, '');
});
