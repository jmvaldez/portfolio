// `/bin`: every terminal command is also a node here, so `ls /bin` lists them and
// `cat /bin/<command>` describes them.

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

/** Each command's `help` table line, plus the `usage:` line `cat /bin/<command>` adds. */
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

/** Hidden commands, absent from `help` and found by exploring; each reply is dry. */
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
