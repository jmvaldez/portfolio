import { describe, expect, it } from 'vitest';
import { HELP_TEXT } from '~/fs/bin';
import { tree } from './fixture';
import { run, type Effect, type InterpretCtx } from './interpret';

const ctx: InterpretCtx = { tree, wd: '/', width: 80 };
const at = (wd: string): InterpretCtx => ({ ...ctx, wd });

/** No command, under any input, may ever ask to navigate — the interpreter's `Effect`
 * union has no such variant, so this is really just a type/shape assertion: nothing here
 * conflates `open` (a window) with a real navigation. */
const NAVIGATION_EFFECT_TYPES = new Set([
  'open',
  'fetchSrc',
  'clear',
  'exit',
  'toast',
  'arm',
  'disarm',
  'typeLines',
  'hexWall',
]);
function assertNoNavigation(effects: Effect[] | undefined) {
  for (const effect of effects ?? []) {
    expect(NAVIGATION_EFFECT_TYPES.has(effect.type)).toBe(true);
  }
}

describe('help', () => {
  it('is byte-for-byte HELP_TEXT', () => {
    const result = run('help', ctx);
    expect(result.lines.map((l) => l.text).join('\n')).toBe(HELP_TEXT);
    assertNoNavigation(result.effects);
  });

  it('rejects a flag', () => {
    expect(run('help -v', ctx).lines).toEqual([
      { text: "help: flags aren't supported here.", tone: 'ink' },
      { text: 'this is a toy. a nice toy.', tone: 'dim' },
    ]);
  });
});

describe('ls', () => {
  it('lists the working directory when bare, dirs ink and everything else dim', () => {
    const result = run('ls', ctx);
    const parts = result.lines.flatMap((l) => l.parts ?? [l]);
    const byName = Object.fromEntries(parts.map((p) => [p.text.trim(), p.tone]));
    expect(byName['about.txt']).toBe('dim');
    expect(byName['resume.pdf@']).toBe('dim');
    expect(byName['projects/']).toBe('ink');
    expect(byName['drones/']).toBe('ink');
    expect(byName['bin/']).toBe('ink');
  });

  it('lists a given path, alphabetically', () => {
    const result = run('ls /projects', ctx);
    const names = result.lines.flatMap((l) => l.parts ?? [l]).map((p) => p.text.trim());
    expect(names).toEqual(['orbital-mesh/']);
  });

  it('includes the eggs and the apps in /bin', () => {
    const result = run('ls /bin', ctx);
    const names = result.lines.flatMap((l) => l.parts ?? [l]).map((p) => p.text.trim());
    for (const name of ['sudo', 'rm', 'arm', 'disarm', 'hack']) expect(names).toContain(name);
    expect(names).toContain('terminal.exe*');
    expect(names).toContain('viewer.exe*');
  });

  it('prints nothing for an empty directory', () => {
    expect(run('ls /drones', ctx).lines).toEqual([]);
  });

  it('packs entries into columns to fit width', () => {
    const result = run('ls /bin', { ...ctx, width: 20 });
    expect(result.lines.length).toBeGreaterThan(1);
  });

  it('rejects a flag', () => {
    expect(run('ls -la', ctx).lines).toEqual([
      { text: "ls: flags aren't supported here.", tone: 'ink' },
      { text: 'this is a toy. a nice toy.', tone: 'dim' },
    ]);
  });

  it('reports a missing path', () => {
    expect(run('ls /nope', ctx).lines).toEqual([
      { text: 'ls: /nope: No such file or directory', tone: 'ink' },
    ]);
  });
});

describe('cd', () => {
  it('bare cd goes to /', () => {
    expect(run('cd', at('/projects'))).toMatchObject({ wd: '/' });
  });

  it('moves the working directory and nothing else', () => {
    const result = run('cd projects', ctx);
    expect(result).toEqual({ lines: [], wd: '/projects' });
  });

  it('resolves ~/drones', () => {
    expect(run('cd ~/drones', at('/projects'))).toMatchObject({ wd: '/drones' });
  });

  it('reports a missing target', () => {
    expect(run('cd nope', ctx).lines).toEqual([
      { text: 'cd: nope: No such file or directory', tone: 'ink' },
    ]);
  });

  it('reports a non-directory target', () => {
    expect(run('cd about.txt', ctx).lines).toEqual([
      { text: 'cd: about.txt: Not a directory', tone: 'ink' },
    ]);
  });

  it('reports too many arguments', () => {
    expect(run('cd a b', ctx).lines).toEqual([{ text: 'cd: too many arguments', tone: 'ink' }]);
  });

  it('rejects a flag', () => {
    expect(run('cd -x', ctx).lines).toEqual([
      { text: "cd: flags aren't supported here.", tone: 'ink' },
      { text: 'this is a toy. a nice toy.', tone: 'dim' },
    ]);
  });
});

describe('pwd', () => {
  it('prints the working directory', () => {
    expect(run('pwd', at('/projects')).lines).toEqual([{ text: '/projects', tone: 'ink' }]);
  });
});

describe('cat', () => {
  it('prints a text node whole', () => {
    expect(run('cat /bin/sudo', ctx).lines).toEqual([{ text: 'you first.', tone: 'ink' }]);
  });

  it('emits fetchSrc for a file node, with a dim placeholder', () => {
    const result = run('cat about.txt', ctx);
    expect(result.lines).toEqual([{ text: '…', tone: 'dim' }]);
    expect(result.effects).toEqual([{ type: 'fetchSrc', node: tree['/about.txt'] }]);
  });

  it('reports Is a directory for a dir target', () => {
    expect(run('cat projects', ctx).lines).toEqual([
      { text: 'cat: projects: Is a directory', tone: 'ink' },
    ]);
  });

  it('reports binary file for a link target, with the open hint', () => {
    expect(run('cat resume.pdf', ctx).lines).toEqual([
      { text: 'cat: resume.pdf: binary file', tone: 'ink' },
      { text: "try 'open resume.pdf'.", tone: 'dim' },
    ]);
  });

  it('reports binary file for an app target, with the run hint', () => {
    expect(run('cat /bin/viewer.exe', ctx).lines).toEqual([
      { text: 'cat: /bin/viewer.exe: binary file', tone: 'ink' },
      { text: 'try running it.', tone: 'dim' },
    ]);
  });

  it('reports a missing target', () => {
    expect(run('cat nope', ctx).lines).toEqual([
      { text: 'cat: nope: No such file or directory', tone: 'ink' },
    ]);
  });

  it('rejects a flag', () => {
    expect(run('cat -n about.txt', ctx).lines).toEqual([
      { text: "cat: flags aren't supported here.", tone: 'ink' },
      { text: 'this is a toy. a nice toy.', tone: 'dim' },
    ]);
  });
});

describe('open', () => {
  it('bare open opens the working directory, not pwd', () => {
    const result = run('open', at('/projects'));
    expect(result.lines).toEqual([]);
    expect(result.effects).toEqual([{ type: 'open', path: '/projects' }]);
  });

  it('opens a resolved path', () => {
    expect(run('open projects', ctx).effects).toEqual([{ type: 'open', path: '/projects' }]);
  });

  it('reports a missing target', () => {
    expect(run('open nope', ctx).lines).toEqual([
      { text: 'open: nope: No such file or directory', tone: 'ink' },
    ]);
  });

  it('rejects a flag', () => {
    expect(run('open -x', ctx).lines).toEqual([
      { text: "open: flags aren't supported here.", tone: 'ink' },
      { text: 'this is a toy. a nice toy.', tone: 'dim' },
    ]);
  });
});

describe('whoami', () => {
  it('prints guest, then the cat about.txt line', () => {
    expect(run('whoami', ctx).lines).toEqual([
      { text: 'guest', tone: 'ink' },
      { text: "you're looking for 'cat about.txt'.", tone: 'dim' },
    ]);
  });
});

describe('clear', () => {
  it('emits a clear effect', () => {
    const result = run('clear', ctx);
    expect(result.lines).toEqual([]);
    expect(result.effects).toEqual([{ type: 'clear' }]);
  });
});

describe('exit', () => {
  it('emits an exit effect', () => {
    const result = run('exit', ctx);
    expect(result.lines).toEqual([]);
    expect(result.effects).toEqual([{ type: 'exit' }]);
  });
});

describe('an app name typed bare', () => {
  it('launches it, same as open', () => {
    expect(run('viewer.exe', ctx).effects).toEqual([{ type: 'open', path: '/bin/viewer.exe' }]);
  });
});

describe('unknown command', () => {
  it('reports command not found with the dry hint', () => {
    expect(run('foo', ctx).lines).toEqual([
      { text: 'foo: command not found', tone: 'ink' },
      { text: "try 'help'. or don't; it's your terminal.", tone: 'dim' },
    ]);
  });
});

describe('easter eggs', () => {
  it('sudo prints the sudoers line and toasts', () => {
    const result = run('sudo rm -rf /', ctx);
    expect(result.lines).toEqual([
      { text: 'guest is not in the sudoers file. This incident will be reported.', tone: 'ink' },
    ]);
    expect(result.effects?.some((e) => e.type === 'toast')).toBe(true);
    assertNoNavigation(result.effects);
  });

  it('rm -rf / runs the removal theatre then the read-only error', () => {
    const result = run('rm -rf /', ctx);
    expect(result.lines).toEqual([
      { text: "rm: cannot remove '/': read-only file system", tone: 'ink' },
      { text: 'nice try.', tone: 'dim' },
    ]);
    const typeLines = result.effects?.find((e) => e.type === 'typeLines');
    expect(typeLines?.type).toBe('typeLines');
    if (typeLines?.type === 'typeLines') expect(typeLines.lines.length).toBe(6);
  });

  it('any other rm just reports the read-only error', () => {
    expect(run('rm foo', ctx).lines).toEqual([{ text: 'rm: read-only file system', tone: 'ink' }]);
    expect(run('rm', ctx).lines).toEqual([{ text: 'rm: read-only file system', tone: 'ink' }]);
    expect(run('rm -rf /projects', ctx).lines).toEqual([
      { text: 'rm: read-only file system', tone: 'ink' },
    ]);
  });

  it('arm emits an arm effect', () => {
    expect(run('arm', ctx).effects).toEqual([{ type: 'arm' }]);
  });

  it('disarm emits a disarm effect', () => {
    expect(run('disarm', ctx).effects).toEqual([{ type: 'disarm' }]);
  });

  it('hack shows the hex wall then the lockout lines', () => {
    const result = run('hack', ctx);
    expect(result.lines).toEqual([
      { text: 'TERMINAL LOCKED', tone: 'ink' },
      { text: 'please contact an administrator.', tone: 'dim' },
    ]);
    expect(result.effects).toEqual([{ type: 'hexWall' }]);
  });
});

describe('effects never navigate', () => {
  it('has no navigate variant across every command this phase implements', () => {
    const lines = [
      'help',
      'ls',
      'ls /bin',
      'cd projects',
      'pwd',
      'cat about.txt',
      'cat /bin/sudo',
      'open',
      'open projects',
      'whoami',
      'clear',
      'exit',
      'sudo x',
      'rm -rf /',
      'rm x',
      'arm',
      'disarm',
      'hack',
      'viewer.exe',
      'foo',
    ];
    for (const input of lines) assertNoNavigation(run(input, ctx).effects);
  });
});
