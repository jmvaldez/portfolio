// The terminal's pure command interpreter. `run` never touches the DOM, storage or the
// network: it reads the `FsTree` it is given and returns data for the UI to render and act
// on. The UI performs every `Effect`; this file only decides what should happen.

import { HELP_TEXT } from '~/fs/bin';
import { listDir, resolvePath } from '~/fs/path';
import type { FsNode, FsTree } from '~/fs/types';

/** One line of terminal output. `tone` is the only styling channel. `parts`, when present,
 * lets `ls` mix tones within one row (directories `ink`, the rest `dim`); `text` is then
 * the plain-text join of `parts` and `tone` is the first part's. */
export interface Line {
  text: string;
  tone: 'ink' | 'dim';
  parts?: { text: string; tone: 'ink' | 'dim' }[];
}

/** Every side effect a command can ask for. There is deliberately no `navigate` variant:
 * the terminal never changes the document's URL, and `open` only opens a window. */
export type Effect =
  | { type: 'open'; path: string }
  | { type: 'fetchSrc'; node: FsNode }
  | { type: 'clear' }
  | { type: 'exit' }
  | { type: 'toast'; label: string; value?: string; splash?: boolean }
  | { type: 'arm' }
  | { type: 'disarm' }
  | { type: 'typeLines'; lines: Line[] }
  | { type: 'hexWall' }
  | { type: 'vim' };

export interface Result {
  lines: Line[];
  /** The new working directory; present only when `cd` changes it. */
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

/** The error result for any argument starting with `-`. The base commands check it before
 * any other validation; the easter-egg commands are exempt, since `rm -rf /` is triggered
 * by a flag. */
function flagsError(cmd: string): Result {
  return {
    lines: [
      mkLine(`${cmd}: flags aren't supported here.`),
      mkLine('this is a toy. a nice toy.', 'dim'),
    ],
  };
}

/** The "No such file or directory" / "Not a directory" error line for a path argument,
 * quoting `arg` as typed rather than as resolved. */
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

/** Packs `items` into columns for `ls`: column width from the longest entry, column count
 * from `width`, laid out column-major (down each column, then across). */
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
      // No fetch here: return a placeholder line and let the UI fetch the source. The UI
      // also appends the "open <name> to read it properly." hint once the source is in.
      return { lines: [mkLine('…', 'dim')], effects: [{ type: 'fetchSrc', node }] };
  }
}

function cmdOpen(args: string[], ctx: InterpretCtx): Result {
  if (hasFlag(args)) return flagsError('open');
  if (args.length > 1) return { lines: [mkLine('open: too many arguments')] };

  const arg = args[0];
  if (arg === undefined) {
    // Bare `open` opens the working directory's window; it prints nothing (that's `pwd`).
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

/** `sudo` with any arguments, including flags, is denied the same way. */
function cmdSudo(): Result {
  return {
    lines: [mkLine('guest is not in the sudoers file. This incident will be reported.')],
    effects: [{ type: 'toast', label: 'ACCESS DENIED' }],
  };
}

/** The lines typed out by `rm -rf /`. Fixed rather than derived from the tree, since it is
 * theatre, not a real listing. */
const REMOVAL_LINES: Line[] = [
  '/projects',
  '/projects/aetherforge',
  '/drones',
  '/drones/x500',
  '/about.txt',
  '/resume.txt',
].map((path) => mkLine(`removing ${path}`));

/** Runs the removal theatre only for the exact invocation `rm -rf /`; anything else gets
 * the plain read-only error. */
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

function cmdVim(): Result {
  return { lines: [], effects: [{ type: 'vim' }] };
}

/** `:wq`, `:q` and `:x` at the ordinary prompt: the visitor has the wrong program in mind,
 * and the terminal obliges. */
function cmdVimQuit(): Result {
  return {
    lines: [],
    effects: [
      { type: 'toast', label: 'EXITED VIM', value: '+1 skill', splash: true },
      { type: 'exit' },
    ],
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

/** The command a typed line invokes, for analytics: its first token when that is a node under
 * `/bin` (every command is one), else `unknown`. Never the arguments, and never an arbitrary
 * typed word. `null` for a blank line. */
export function commandName(line: string, tree: FsTree): string | null {
  const [cmd] = line.trim().split(/\s+/);
  if (!cmd) return null;
  return !cmd.includes('/') && tree[`/bin/${cmd}`] ? cmd : 'unknown';
}

/** Runs one typed line against `ctx` and returns the output lines and requested effects.
 * A blank line returns no lines. */
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
    case 'vi':
    case 'vim':
    case 'nvim':
      return cmdVim();
    case ':wq':
    case ':q':
    case ':x':
      return cmdVimQuit();
    default: {
      // Typing an app's name alone (`viewer.exe`) opens it, like `open`; with arguments it
      // is "command not found".
      if (args.length === 0) {
        const node = ctx.tree[`/bin/${cmd}`];
        if (node?.kind === 'app')
          return { lines: [], effects: [{ type: 'open', path: node.path }] };
      }
      return commandNotFound(cmd);
    }
  }
}
