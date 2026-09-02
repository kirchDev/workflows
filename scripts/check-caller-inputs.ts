// Every `with:` key a caller passes must exist as an input on the body it calls.
//
// THIS IS NOT A STYLE CHECK. GitHub rejects an unknown input at workflow STARTUP:
// the run ends as `startup_failure` before a single job begins, and the message
// says only "this run likely failed because of a workflow file issue" — it never
// names the input. actionlint does not catch it either, because it resolves a
// `uses:` pointing at another repository no further than the string.
//
// So the class of error is: invisible to every linter, fatal at runtime, and
// silent about its own cause. That is exactly the kind this repo turns into a
// gate task. Found in production by `kirchDev/app`, which passed a
// `report-artifact` input `_ci-lighthouse.yml` has never defined.
//
// Scope is deliberately this repository's own stubs. A caller in another repo
// pins a body by SHA and may legitimately be a version behind, so checking it
// from here would report a difference rather than a defect.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIR = '.github/workflows';

/** The `inputs:` keys of a `workflow_call` body, read without a YAML parser. */
function bodyInputs(text: string): Set<string> {
  const inputs = new Set<string>();
  const lines = text.split('\n');
  let inCall = false;
  let inInputs = false;

  for (const line of lines) {
    if (/^\s{2}workflow_call:\s*$/.test(line)) {
      inCall = true;
      continue;
    }
    if (inCall && /^\s{4}inputs:\s*$/.test(line)) {
      inInputs = true;
      continue;
    }
    // Any key back at four spaces (`secrets:`, `outputs:`) ends the block.
    if (inInputs && /^\s{4}\S/.test(line)) inInputs = false;
    // A key back at two spaces leaves `workflow_call` entirely.
    if (inCall && /^\s{2}\S/.test(line) && !/^\s{2}workflow_call:/.test(line)) {
      inCall = false;
      inInputs = false;
    }
    if (inInputs) {
      const match = /^\s{6}([A-Za-z0-9_-]+):\s*$/.exec(line);
      if (match) inputs.add(match[1]);
    }
  }
  return inputs;
}

/** Every (job, body, with-key) a caller states, for local `uses: ./…` calls. */
function callerUses(
  text: string
): { job: string; body: string; keys: string[] }[] {
  const calls: { job: string; body: string; keys: string[] }[] = [];
  const lines = text.split('\n');
  let job = '';
  let body = '';
  let inWith = false;
  let keys: string[] = [];

  const flush = () => {
    if (body) calls.push({ job, body, keys });
    body = '';
    keys = [];
    inWith = false;
  };

  for (const line of lines) {
    const jobMatch = /^\s{2}([A-Za-z0-9_-]+):\s*$/.exec(line);
    if (jobMatch) {
      flush();
      job = jobMatch[1];
      continue;
    }
    const usesMatch =
      /^\s{4}uses:\s*\.\/\.github\/workflows\/(\S+\.yml)\s*$/.exec(line);
    if (usesMatch) {
      body = usesMatch[1];
      continue;
    }
    if (/^\s{4}with:\s*$/.test(line)) {
      inWith = true;
      continue;
    }
    if (inWith && /^\s{4}\S/.test(line)) inWith = false;
    if (inWith) {
      const keyMatch = /^\s{6}([A-Za-z0-9_-]+):/.exec(line);
      if (keyMatch) keys.push(keyMatch[1]);
    }
  }
  flush();
  return calls;
}

const files = readdirSync(DIR).filter((f) => f.endsWith('.yml'));
const bodies = new Map<string, Set<string>>();
for (const file of files) {
  const text = readFileSync(join(DIR, file), 'utf8');
  if (/^\s{2}workflow_call:\s*$/m.test(text))
    bodies.set(file, bodyInputs(text));
}

let failures = 0;
let checked = 0;

for (const file of files) {
  if (file.startsWith('_')) continue;
  const text = readFileSync(join(DIR, file), 'utf8');
  for (const call of callerUses(text)) {
    const allowed = bodies.get(call.body);
    if (!allowed) {
      console.error(
        `${file}: job "${call.job}" calls ${call.body}, which is not a workflow_call body here.`
      );
      failures++;
      continue;
    }
    checked++;
    for (const key of call.keys) {
      if (!allowed.has(key)) {
        console.error(
          `${file}: job "${call.job}" passes "${key}" to ${call.body}, which defines no such input.\n` +
            `  ${call.body} accepts: ${[...allowed].sort().join(', ') || '(none)'}`
        );
        failures++;
      }
    }
  }
}

console.log(
  `Checked ${checked} local body call${checked === 1 ? '' : 's'} across ${files.length} workflow files.`
);
if (failures > 0) {
  console.error(
    `\n${failures} caller input${failures === 1 ? '' : 's'} would fail the run at startup.`
  );
  process.exit(1);
}
console.log('Every input a caller passes exists on the body it calls.');
