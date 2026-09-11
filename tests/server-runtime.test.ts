import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

it('loads the serverless handler in native Node without a TypeScript transpiler', () => {
  // Vercel executes included .ts server modules using Node type stripping.
  // A Vite build alone does not catch unsupported runtime TypeScript syntax.
  const result = spawnSync(process.execPath, [
    '--input-type=module', '-e', "await import('./lib/hosted-runner-handler.ts');",
  ], { cwd: fileURLToPath(new URL('..', import.meta.url)), encoding: 'utf8', timeout: 10_000 });
  expect(result.status, result.stderr).toBe(0);
});
