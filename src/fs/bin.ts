// `/bin` (ticket 08 § Commands, § `/bin`, § Easter eggs). Every command the terminal
// understands is also a node here, so the commands are discoverable by walking the
// filesystem — `ls /bin` lists them, `cat /bin/<command>` describes them.
//
// `HELP_TEXT` is exported for Phase 11's terminal to print for bare `help`, byte for byte
// what ticket 08 specifies.

import type { FsNode } from './types';

export const HELP_TEXT = `commands:
  ls [path]      list a directory
  cd [path]      change directory
  pwd            print working directory
  cat <file>     print a file
  open [path]    open a window
  whoami         identify yourself
  clear          clear the screen
  help           this
  exit           close the terminal
there's more in /bin, if you're the curious type.`;

/** One line of `help`'s command table, keyed by command name, plus the `usage:` line
 * `cat /bin/<command>` appends to it. */
const COMMANDS: Record<string, { help: string; usage: string }> = {
  ls: { help: 'ls [path]      list a directory', usage: 'usage: ls [path]' },
  cd: { help: 'cd [path]      change directory', usage: 'usage: cd [path]' },
  pwd: { help: 'pwd            print working directory', usage: 'usage: pwd' },
  cat: { help: 'cat <file>     print a file', usage: 'usage: cat <file>' },
  open: { help: 'open [path]    open a window', usage: 'usage: open [path]' },
  whoami: { help: 'whoami         identify yourself', usage: 'usage: whoami' },
  clear: { help: 'clear          clear the screen', usage: 'usage: clear' },
  help: { help: 'help           this', usage: 'usage: help' },
  exit: { help: 'exit           close the terminal', usage: 'usage: exit' },
};

/** Absent from `help`, present here — found by exploring (ticket 08 § Easter eggs). Each
 * line is dry and doesn't spoil the command's effect; `hack`'s is ticket 08's own text. */
const EGGS: Record<string, string> = {
  sudo: 'you first.',
  rm: "don't.",
  arm: "you'll know when it's armed.",
  disarm: "you'll know when it's not.",
  hack: 'do not.',
};

function commandNode(name: string): FsNode {
  const { help, usage } = COMMANDS[name]!;
  return { path: `/bin/${name}`, name, kind: 'text', title: name, text: `${help}\n${usage}` };
}

function eggNode(name: string): FsNode {
  return { path: `/bin/${name}`, name, kind: 'text', title: name, text: EGGS[name]! };
}

function appNode(
  name: string,
  app: 'terminal' | 'viewer',
  flags: { launcher?: boolean; icon?: boolean },
): FsNode {
  const node: FsNode = { path: `/bin/${name}`, name, kind: 'app', title: name, app };
  if (flags.launcher !== undefined) node.launcher = flags.launcher;
  if (flags.icon !== undefined) node.icon = flags.icon;
  return node;
}

export const binNodes: FsNode[] = [
  ...Object.keys(COMMANDS).map(commandNode),
  ...Object.keys(EGGS).map(eggNode),
  appNode('terminal.exe', 'terminal', { launcher: true, icon: true }),
  appNode('viewer.exe', 'viewer', { icon: true }),
];
