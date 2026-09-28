// Tab completion for the terminal. Pure, like `interpret.ts`: no DOM or storage access.
// The UI turns a `single` result into a new input value and a `multiple` result into a
// candidate list under the prompt.

import { listDir, resolvePath } from '~/fs/path';
import type { FsTree } from '~/fs/types';

export type CompletionResult =
  { type: 'single'; value: string } | { type: 'multiple'; candidates: string[] } | { type: 'none' };

export interface CompleteCtx {
  tree: FsTree;
  wd: string;
}

/** Returns the names of `/bin`'s children, which are the commands to complete against. The
 * easter-egg commands and the apps are real nodes there, so they complete too. */
function binCommandNames(tree: FsTree): string[] {
  const bin = tree['/bin'];
  if (!bin?.children) return [];
  return bin.children
    .map((path) => tree[path])
    .filter((node) => node !== undefined)
    .map((node) => node.name);
}

function resolveMatches(names: string[], toValue: (name: string) => string): CompletionResult {
  if (names.length === 0) return { type: 'none' };
  if (names.length === 1) return { type: 'single', value: toValue(names[0]!) };
  return { type: 'multiple', candidates: [...names].sort() };
}

function splice(line: string, start: number, end: number, replacement: string): string {
  return line.slice(0, start) + replacement + line.slice(end);
}

/**
 * Completes the word touching `cursor` in `line`: the first word against `/bin`'s command
 * names, later words against path segments relative to `ctx.wd`.
 *
 * Returns `single` with the whole new line for one match (a directory gets a trailing `/`),
 * `multiple` with the sorted candidates for several, or `none`.
 */
export function complete(line: string, cursor: number, ctx: CompleteCtx): CompletionResult {
  const wordMatch = /\S*$/.exec(line.slice(0, cursor));
  const word = wordMatch ? wordMatch[0] : '';
  const wordStart = cursor - word.length;
  const isCommandPosition = line.slice(0, wordStart).trim().length === 0;

  if (isCommandPosition) {
    const names = binCommandNames(ctx.tree).filter((name) => name.startsWith(word));
    return resolveMatches(names, (name) => splice(line, wordStart, cursor, name));
  }

  const slashIndex = word.lastIndexOf('/');
  const dirInput = slashIndex >= 0 ? word.slice(0, slashIndex + 1) : '';
  const segment = slashIndex >= 0 ? word.slice(slashIndex + 1) : word;

  const dirResult = resolvePath(ctx.tree, ctx.wd, dirInput === '' ? '.' : dirInput);
  if ('error' in dirResult || dirResult.node.kind !== 'dir') return { type: 'none' };

  const children = listDir(ctx.tree, dirResult.node.path).filter((node) =>
    node.name.startsWith(segment),
  );
  return resolveMatches(
    children.map((node) => node.name),
    (name) => {
      const node = children.find((n) => n.name === name)!;
      const completed = node.kind === 'dir' ? `${name}/` : name;
      return splice(line, wordStart, cursor, dirInput + completed);
    },
  );
}
