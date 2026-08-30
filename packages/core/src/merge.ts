import type { MergeConflict, MergeResult } from '@aes/contracts';
import { canonicalJson } from './canonical.ts';

const MISSING = Symbol('missing');
const RESTRICTED_KEYS = /(^|_)(code|scripts?|instructions?|prompts?|credentials?|secrets?|passwords?|private.?keys?|balances?|wallet|funds?)($|_)/i;

function equal(left: unknown, right: unknown): boolean {
  return canonicalJson(left) === canonicalJson(right);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function joinPath(path: string, key: string): string {
  return path ? `${path}.${key}` : key;
}

export function threeWayMerge(base: unknown, left: unknown, right: unknown): MergeResult {
  const conflicts: MergeConflict[] = [];

  const mergeValue = (path: string, baseValue: unknown, leftValue: unknown, rightValue: unknown): unknown => {
    if (baseValue !== MISSING && leftValue !== MISSING && rightValue !== MISSING && equal(baseValue, leftValue) && equal(baseValue, rightValue)) return baseValue;

    if (isRecord(baseValue) && isRecord(leftValue) && isRecord(rightValue)) {
      const output: Record<string, unknown> = {};
      for (const key of new Set([...Object.keys(baseValue), ...Object.keys(leftValue), ...Object.keys(rightValue)])) {
        const childPath = joinPath(path, key);
        const baseChild = key in baseValue ? baseValue[key] : MISSING;
        const leftChild = key in leftValue ? leftValue[key] : MISSING;
        const rightChild = key in rightValue ? rightValue[key] : MISSING;

        const changedLeft = !equal(baseChild === MISSING ? undefined : baseChild, leftChild === MISSING ? undefined : leftChild);
        const changedRight = !equal(baseChild === MISSING ? undefined : baseChild, rightChild === MISSING ? undefined : rightChild);
        if (RESTRICTED_KEYS.test(key) && (changedLeft || changedRight)) {
          conflicts.push({ path: childPath, reason: 'restricted-field', base: baseChild === MISSING ? undefined : baseChild, left: leftChild === MISSING ? undefined : leftChild, right: rightChild === MISSING ? undefined : rightChild });
          continue;
        }

        const merged = mergeValue(childPath, baseChild, leftChild, rightChild);
        if (merged !== MISSING) output[key] = merged;
      }
      return output;
    }

    if (leftValue !== MISSING && rightValue !== MISSING && equal(leftValue, rightValue)) return leftValue;
    if (baseValue !== MISSING && leftValue !== MISSING && equal(baseValue, leftValue)) return rightValue;
    if (baseValue !== MISSING && rightValue !== MISSING && equal(baseValue, rightValue)) return leftValue;

    if (leftValue === MISSING || rightValue === MISSING) {
      const changedSide = leftValue === MISSING ? rightValue : leftValue;
      if (baseValue === MISSING) return changedSide;
      conflicts.push({ path: path || '$', reason: 'delete-vs-change', base: baseValue, left: leftValue === MISSING ? undefined : leftValue, right: rightValue === MISSING ? undefined : rightValue });
      return MISSING;
    }

    conflicts.push({ path: path || '$', reason: 'changed-both', base: baseValue === MISSING ? undefined : baseValue, left: leftValue, right: rightValue });
    return MISSING;
  };

  const value = mergeValue('', base, left, right);
  return conflicts.length ? { status: 'conflict', value: value === MISSING ? undefined : value, conflicts } : { status: 'merged', value: value === MISSING ? undefined : value, conflicts: [] };
}

export type ResolutionChoice = 'base' | 'left' | 'right' | 'custom';

export function applyConflictResolution(
  candidate: unknown,
  conflicts: MergeConflict[],
  resolutions: Record<string, { choice: ResolutionChoice; custom?: unknown }>,
): unknown {
  if (conflicts.some((conflict) => !resolutions[conflict.path])) throw new Error('Every conflict must be resolved before a canonical head can be created.');
  let output: unknown = structuredClone(candidate ?? {});
  for (const conflict of conflicts) {
    const resolution = resolutions[conflict.path];
    const value = resolution.choice === 'custom' ? resolution.custom : conflict[resolution.choice];
    output = setPath(output, conflict.path, value);
  }
  return output;
}

function setPath(root: unknown, path: string, value: unknown): unknown {
  if (path === '$') return value;
  const keys = path.split('.');
  const output = isRecord(root) ? structuredClone(root) : {};
  let cursor = output;
  keys.forEach((key, index) => {
    if (index === keys.length - 1) {
      if (value === undefined) delete cursor[key];
      else cursor[key] = value;
      return;
    }
    if (!isRecord(cursor[key])) cursor[key] = {};
    cursor = cursor[key] as Record<string, unknown>;
  });
  return output;
}
