// The terminal's pure command interpreter (ticket 08 § Commands, § Errors, § Easter
// eggs). `run` never touches the DOM, storage or the network — it only ever reads the
// already-built `FsTree` it's handed and returns data for Task 11.2's UI to render and
// act on. That UI owns every side effect an `Effect` names (opening a window, fetching a
// source file, clearing the log, closing the window, toasting, arming/disarming the
// viewer, typing the `rm -rf /` lines, painting the hex wall) — this file only decides
// *what* should happen, never performs it.

import { HELP_TEXT } from '~/fs/bin';
import { listDir, resolvePath } from '~/fs/path';
import type { FsNode, FsTree } from '~/fs/types';

/** One line of terminal output. `tone` is the only styling channel (ticket 14 §
 * Terminal: tones map to `--ink` / `--ink-dim`, never amber). `parts`, when present, is
 * `ls`'s packed-column case: a single row can mix directories (`ink`, ticket 08's "full
 * phosphor brightness") with everything else (`dim`), which a single line-level `tone`
 * can't express. `text`/`tone` still carry a flattened fallback — the plain-text join of
 * `parts`, tone-less callers (tests, copy/paste) can just read `text`. */
export interface Line {
  text: string;
  tone: 'ink' | 'dim';
  parts?: { text: string; tone: 'ink' | 'dim' }[];
}

/** Every side effect a command can ask for. Deliberately closed — there is no `navigate`
 * variant, and there must never be one (ticket 09: the terminal never navigates). `open`
 * only ever raises/opens a *window*, via the shell's own `launch()` (Task 11.2), never
 * the document's URL. */
export type Effect =
  | { type: 'open'; path: string }
  | { type: 'fetchSrc'; node: FsNode }
  | { type: 'clear' }
  | { type: 'exit' }
  | { type: 'toast'; label: string; value?: string }
  | { type: 'arm' }
  | { type: 'disarm' }
  | { type: 'typeLines'; lines: Line[] }
  | { type: 'hexWall' };

export interface Result {
  lines: Line[];
  /** Present only when the working directory changes (`cd`). Absent, not unchanged-echoed,
   * on every other command. */
  wd?: string;
  effects?: Effect[];
}

export interface InterpretCtx {
  tree: FsTree;
  /** The current working directory, an absolute path always present in `tree`. */
  wd: string;
  /** The terminal window's current character width, `ls`'s column-packing budget. */
  width: number;
}

function mkLine(text: string, tone: Line['tone'] = 'ink'): Line {
  return { text, tone };
}

function hasFlag(args: string[]): boolean {
  return args.some((arg) => arg.startsWith('-'));
}

/** Ticket 08's one universal error row: "any argument starting with `-`, on any
 * command". Checked before every other validation in each of the nine base commands —
 * the eggs (`sudo`, `rm`, `arm`, `disarm`, `hack`) are exempt, since `rm -rf /`'s own
 * flag *is* its trigger. */
function flagsError(cmd: string): Result {
  return {
    lines: [
      mkLine(`${cmd}: flags aren't supported here.`),
      mkLine('this is a toy. a nice toy.', 'dim'),
    ],
  };
}

/** The shared `ENOENT`/`ENOTDIR` shape ticket 08's error table names for `cd`, and says
 * is "the same shape for `cat`, `open`" (ENOENT); ENOTDIR (a non-directory mid-path)
 * isn't in the table but is the same coreutils phrasing by construction. Uses the raw
 * typed argument, matching every example row (`cd nope` → `...nope...`, not a resolved
 * path). */
function pathError(cmd: string, arg: string, error: 'ENOENT' | 'ENOTDIR'): Line {
  const message = error === 'ENOENT' ? 'No such file or directory' : 'Not a directory';
  return mkLine(`${cmd}: ${arg}: ${message}`);
}

function displaySuffix(node: FsNode): string {
  switch (node.kind) {
    case 'dir':
      return `${node.name}/`;
    case 'app':
      return `${node.name}*`;
    case 'link':
      return `${node.name}@`;
    default:
      return node.name;
  }
}

/** `ls`'s simple multi-column packing: column width from the longest entry, column
 * count from `width`, laid out column-major (traditional `ls` order — down each column,
 * then across), directories `ink`, everything else `dim` (ticket 08 § `ls`). */
function packColumns(items: { display: string; tone: Line['tone'] }[], width: number): Line[] {
  const colWidth = Math.max(...items.map((item) => item.display.length)) + 2;
  const cols = Math.max(1, Math.min(items.length, Math.floor(width / colWidth)));
  const rows = Math.ceil(items.length / cols);

  const lines: Line[] = [];
  for (let r = 0; r < rows; r++) {
    const parts: { text: string; tone: Line['tone'] }[] = [];
    for (let c = 0; c < cols; c++) {
      const idx = c * rows + r;
      if (idx >= items.length) continue;
      const item = items[idx]!;
      const isLastInRow = c === cols - 1 || idx + rows >= items.length;
      parts.push({
        text: isLastInRow ? item.display : item.display.padEnd(colWidth),
        tone: item.tone,
      });
    }
    lines.push({ text: parts.map((p) => p.text).join(''), tone: parts[0]!.tone, parts });
  }
  return lines;
}

function cmdHelp(args: string[]): Result {
  if (hasFlag(args)) return flagsError('help');
  return { lines: HELP_TEXT.split('\n').map((text) => mkLine(text)) };
}

function cmdLs(args: string[], ctx: InterpretCtx): Result {
  if (hasFlag(args)) return flagsError('ls');

  let node: FsNode;
  if (args.length > 0) {
    const target = args[0]!;
    const result = resolvePath(ctx.tree, ctx.wd, target);
    if ('error' in result) return { lines: [pathError('ls', target, result.error)] };
    node = result.node;
  } else {
    node = ctx.tree[ctx.wd]!;
  }

  const entries = node.kind === 'dir' ? listDir(ctx.tree, node.path) : [node];
  if (entries.length === 0) return { lines: [] };

  const items: { display: string; tone: Line['tone'] }[] = entries.map((n) => ({
    display: displaySuffix(n),
    tone: n.kind === 'dir' ? 'ink' : 'dim',
  }));
  return { lines: packColumns(items, ctx.width) };
}

function cmdCd(args: string[], ctx: InterpretCtx): Result {
  if (hasFlag(args)) return flagsError('cd');
  if (args.length > 1) return { lines: [mkLine('cd: too many arguments')] };

  const target = args[0] ?? '~';
  const result = resolvePath(ctx.tree, ctx.wd, target);
  if ('error' in result) return { lines: [pathError('cd', target, result.error)] };
  if (result.node.kind !== 'dir') return { lines: [mkLine(`cd: ${target}: Not a directory`)] };
  return { lines: [], wd: result.node.path };
}

function cmdPwd(args: string[], ctx: InterpretCtx): Result {
  if (hasFlag(args)) return flagsError('pwd');
  return { lines: [mkLine(ctx.wd)] };
}

function cmdCat(args: string[], ctx: InterpretCtx): Result {
  if (hasFlag(args)) return flagsError('cat');
  if (args.length === 0) return { lines: [mkLine('cat: missing operand')] };
  if (args.length > 1) return { lines: [mkLine('cat: too many arguments')] };

  const arg = args[0]!;
  const result = resolvePath(ctx.tree, ctx.wd, arg);
  if ('error' in result) return { lines: [pathError('cat', arg, result.error)] };

  const node = result.node;
  switch (node.kind) {
    case 'dir':
      return { lines: [mkLine(`cat: ${arg}: Is a directory`)] };
    case 'link':
      return {
        lines: [mkLine(`cat: ${arg}: binary file`), mkLine(`try 'open ${node.name}'.`, 'dim')],
      };
    case 'app':
      return {
        lines: [mkLine(`cat: ${arg}: binary file`), mkLine('try running it.', 'dim')],
      };
    case 'text':
      return { lines: (node.text ?? '').split('\n').map((text) => mkLine(text)) };
    case 'file':
      // Pure function, no fetch: a placeholder line plus the effect Task 11.2 resolves
      // against `node.srcUrl`. Ticket 08 also wants a trailing dim hint — "open <name>
      // to read it properly." — appended once the real source has printed; that's the
      // UI's job (it owns the fetch and therefore knows when the source is in), so it
      // isn't produced here.
      return { lines: [mkLine('…', 'dim')], effects: [{ type: 'fetchSrc', node }] };
  }
}

function cmdOpen(args: string[], ctx: InterpretCtx): Result {
  if (hasFlag(args)) return flagsError('open');
  if (args.length > 1) return { lines: [mkLine('open: too many arguments')] };

  const arg = args[0];
  if (arg === undefined) {
    // Ticket 08 § `open`: "Bare `open` opens the working directory" — an action, not a
    // print (that's `pwd`'s job); it raises/opens the wd's own window.
    return { lines: [], effects: [{ type: 'open', path: ctx.wd }] };
  }

  const result = resolvePath(ctx.tree, ctx.wd, arg);
  if ('error' in result) return { lines: [pathError('open', arg, result.error)] };
  return { lines: [], effects: [{ type: 'open', path: result.node.path }] };
}

function cmdWhoami(args: string[]): Result {
  if (hasFlag(args)) return flagsError('whoami');
  return {
    lines: [mkLine('guest'), mkLine("you're looking for 'cat about.txt'.", 'dim')],
  };
}

function cmdClear(args: string[]): Result {
  if (hasFlag(args)) return flagsError('clear');
  return { lines: [], effects: [{ type: 'clear' }] };
}

function cmdExit(args: string[]): Result {
  if (hasFlag(args)) return flagsError('exit');
  return { lines: [], effects: [{ type: 'exit' }] };
}

/** `sudo <anything>`: the whole rest of the line is the "anything" — no flag handling,
 * ticket 08 doesn't carve out an exception for `sudo -x`. */
function cmdSudo(): Result {
  return {
    lines: [mkLine('guest is not in the sudoers file. This incident will be reported.')],
    effects: [{ type: 'toast', label: 'ACCESS DENIED' }],
  };
}

/** Flavour text for `rm -rf /`'s six typed lines (ticket 08: "~6 lines of `removing
 * /projects/…`"). Fixed rather than derived from `ctx.tree` — it's a dry theatrical
 * beat, not a real listing, so it stays identical regardless of the content seeded into
 * any given tree. */
const REMOVAL_LINES: Line[] = [
  '/projects',
  '/projects/orbital-mesh',
  '/drones',
  '/drones/nazgul',
  '/about.txt',
  '/resume.txt',
].map((path) => mkLine(`removing ${path}`));

/** Only the exact invocation `rm -rf /` runs the removal theatre; anything else
 * (`rm foo`, bare `rm`, `rm -rf /projects`) gets the flat read-only line. */
function cmdRm(args: string[]): Result {
  if (args.length === 2 && args[0] === '-rf' && args[1] === '/') {
    return {
      lines: [mkLine("rm: cannot remove '/': read-only file system"), mkLine('nice try.', 'dim')],
      effects: [{ type: 'typeLines', lines: REMOVAL_LINES }],
    };
  }
  return { lines: [mkLine('rm: read-only file system')] };
}

function cmdArm(): Result {
  return { lines: [], effects: [{ type: 'arm' }] };
}

function cmdDisarm(): Result {
  return { lines: [], effects: [{ type: 'disarm' }] };
}

function cmdHack(): Result {
  return {
    lines: [mkLine('TERMINAL LOCKED'), mkLine('please contact an administrator.', 'dim')],
    effects: [{ type: 'hexWall' }],
  };
}

function commandNotFound(cmd: string): Result {
  return {
    lines: [
      mkLine(`${cmd}: command not found`),
      mkLine("try 'help'. or don't; it's your terminal.", 'dim'),
    ],
  };
}

/** Runs one typed line against `ctx` and returns what happened. Pure: same inputs,
 * same output, no DOM/storage/network access anywhere in this module. */
export function run(line: string, ctx: InterpretCtx): Result {
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { lines: [] };

  const [cmd, ...args] = tokens as [string, ...string[]];
  switch (cmd) {
    case 'help':
      return cmdHelp(args);
    case 'ls':
      return cmdLs(args, ctx);
    case 'cd':
      return cmdCd(args, ctx);
    case 'pwd':
      return cmdPwd(args, ctx);
    case 'cat':
      return cmdCat(args, ctx);
    case 'open':
      return cmdOpen(args, ctx);
    case 'whoami':
      return cmdWhoami(args);
    case 'clear':
      return cmdClear(args);
    case 'exit':
      return cmdExit(args);
    case 'sudo':
      return cmdSudo();
    case 'rm':
      return cmdRm(args);
    case 'arm':
      return cmdArm();
    case 'disarm':
      return cmdDisarm();
    case 'hack':
      return cmdHack();
    default: {
      // Ticket 08 § `open`: "Typing an app's name (`viewer.exe`) launches it, same as
      // `open`." Only when it's the whole command (no arguments) — `viewer.exe foo`
      // isn't a documented shape, so it falls through to "command not found" below.
      if (args.length === 0) {
        const node = ctx.tree[`/bin/${cmd}`];
        if (node?.kind === 'app')
          return { lines: [], effects: [{ type: 'open', path: node.path }] };
      }
      return commandNotFound(cmd);
    }
  }
}
