// The terminal window. It performs the effects that `interpret.ts` requests: `open` via
// `launch()`, `fetchSrc` via a fetch of `node.srcUrl` (the raw source, not the rendered
// body from `bodies.ts`), `clear`, `exit`, `toast`, `arm`/`disarm`, `typeLines`, `hexWall`.
//
// Output is a polite `role="log"` in which each `LogEntry` (the prompt line plus its output)
// is one DOM child, appended once the command has fully resolved, never line by line. The
// typing animation of `typeLines`/`hexWall` renders in a transient `aria-hidden` slot
// outside the log, and only the finished result becomes a log child.
import { useEffect, useRef, useState } from 'react';
import { track } from '~/analytics';
import type { FsNode } from '~/fs/types';
import {
  appendHistory,
  hasShownTerminalMotd,
  readHistory,
  setTerminalMotdShown,
} from '~/lib/storage';
import type { AppProps } from '../apps/registry';
import { launch } from '../launch';
import { sceneGateOpen } from '../scene/gate';
import { useShellStore } from '../store';
import { appRegistry } from '../apps/registry';
import { complete } from './complete';
import { commandName, run, type Line } from './interpret';

/** Delay between typed lines; skipped under reduced motion. */
const TYPE_INTERVAL_MS = 40;

/** The hex-dump wall that `hack` types out; decorative. */
const HEX_WALL_LINES: Line[] = [
  '0x4C1F  76 61 6C 64 65 7A 2D 6F  73 00 00 00 00 00 00 00',
  '0x4C2F  DE AD BE EF 00 13 37 42  FF FF FF FF 00 00 00 00',
  '0x4C3F  ACCESS.................. DENIED',
  '0x4C4F  00 00 00 00 00 00 00 00  00 00 00 00 00 00 00 00',
  '0x4C5F  4C 4F 43 4B 45 44 00 00  00 00 00 00 00 00 00 00',
].map((text) => ({ text, tone: 'dim' as const }));

/** The column budget for `ls` until the log has been measured. */
const DEFAULT_COLS = 80;

interface LogEntry {
  id: number;
  /** The echoed `guest@valdez:<wd>$ <line>` row, or `''` for the session-opening motd,
   * which renders no prompt row. */
  promptText: string;
  lines: Line[];
}

function renderLine(line: Line, key: number) {
  if (line.parts) {
    return (
      <div className="term-line" key={key}>
        {line.parts.map((part, i) => (
          <span key={i} className={`term-${part.tone}`}>
            {part.text}
          </span>
        ))}
      </div>
    );
  }
  return (
    <div className={`term-line term-${line.tone}`} key={key}>
      {line.text === '' ? ' ' : line.text}
    </div>
  );
}

export default function Terminal({ windowId }: AppProps) {
  const tree = useShellStore((state) => state.tree);

  const [wd, setWd] = useState('/');
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [input, setInput] = useState('');
  const [typingLines, setTypingLines] = useState<Line[] | null>(null);
  const [cols, setCols] = useState(DEFAULT_COLS);

  const logRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const entryRefs = useRef(new Map<number, HTMLDivElement>());
  const nextEntryId = useRef(0);

  const historyRef = useRef<string[]>([]);
  const historyIdxRef = useRef<number | null>(null);
  const draftRef = useRef('');

  function commit(promptText: string, lines: Line[]): number {
    const id = nextEntryId.current++;
    setEntries((prev) => [...prev, { id, promptText, lines }]);
    scrollToEntrySoon(id);
    return id;
  }

  function updateEntry(id: number, lines: Line[]): void {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, lines } : e)));
    scrollToEntrySoon(id);
  }

  // Output taller than the log scrolls to its first line rather than its tail, so a long
  // `cat` starts at the top. Shorter output scrolls to the bottom.
  function scrollToEntrySoon(id: number): void {
    requestAnimationFrame(() => {
      const container = logRef.current;
      const el = entryRefs.current.get(id);
      if (!container || !el) return;
      if (el.offsetHeight > container.clientHeight) {
        container.scrollTop = el.offsetTop;
      } else {
        container.scrollTop = container.scrollHeight;
      }
    });
  }

  function reveal(lines: Line[]): Promise<Line[]> {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return Promise.resolve(lines);
    return new Promise<Line[]>((resolve) => {
      let i = 0;
      const tick = () => {
        i++;
        setTypingLines(lines.slice(0, i));
        if (i >= lines.length) {
          resolve(lines);
        } else {
          setTimeout(tick, TYPE_INTERVAL_MS);
        }
      };
      tick();
    }).finally(() => setTypingLines(null));
  }

  async function loadSrc(id: number, node: FsNode): Promise<void> {
    try {
      if (!node.srcUrl) throw new Error('no srcUrl');
      const res = await fetch(node.srcUrl);
      if (!res.ok) throw new Error(String(res.status));
      const text = await res.text();
      const srcLines = text.split('\n').map((t) => ({ text: t, tone: 'ink' as const }));
      updateEntry(id, [
        ...srcLines,
        { text: `open ${node.name} to read it properly.`, tone: 'dim' },
      ]);
    } catch {
      updateEntry(id, [{ text: `cat: ${node.name}: could not read file`, tone: 'dim' }]);
    }
  }

  function doArm(armed: boolean): void {
    const node = tree?.['/bin/viewer.exe'];
    // Opens or raises `viewer.exe`, unless the scene gate is closed (reduced motion or no
    // WebGL): then there is nothing to spin and arming only toasts.
    if (
      sceneGateOpen() &&
      node &&
      node.kind === 'app' &&
      node.app !== undefined &&
      node.app in appRegistry
    ) {
      launch(node);
    }
    useShellStore.getState().setEffects({ armed });
    useShellStore.getState().toast(armed ? 'ARMED' : 'DISARMED');
  }

  function doExit(): void {
    useShellStore.getState().close(windowId);
    // `Desktop.tsx` resolves focus for other windows' closes via refs this component can't
    // reach, so focus the first desktop icon instead.
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>('.desktop-icon')?.focus();
    });
  }

  async function runLine(raw: string): Promise<void> {
    if (!tree) return;
    const cwdAtRun = wd;
    const promptText = `guest@valdez:${cwdAtRun}$ ${raw}`;

    if (raw.trim().length > 0) {
      appendHistory(raw);
      historyRef.current = [...historyRef.current, raw].slice(-100);
    }
    historyIdxRef.current = null;

    const command = commandName(raw, tree);
    if (command !== null) track('terminal_command_run', { command });

    const result = run(raw, { tree, wd: cwdAtRun, width: cols });
    if (result.wd !== undefined) setWd(result.wd);

    const effects = result.effects ?? [];

    if (effects.some((e) => e.type === 'clear')) {
      setEntries([]);
      return;
    }
    if (effects.some((e) => e.type === 'exit')) {
      doExit();
      return;
    }

    const typeLinesEffect = effects.find((e) => e.type === 'typeLines');
    const hexWallEffect = effects.find((e) => e.type === 'hexWall');

    if (typeLinesEffect && typeLinesEffect.type === 'typeLines') {
      const revealed = await reveal(typeLinesEffect.lines);
      commit(promptText, [...revealed, ...result.lines]);
      return;
    }
    if (hexWallEffect) {
      const revealed = await reveal(HEX_WALL_LINES);
      commit(promptText, [...revealed, ...result.lines]);
      return;
    }

    const id = commit(promptText, result.lines);
    for (const effect of effects) {
      switch (effect.type) {
        case 'open': {
          const node = tree[effect.path];
          if (node) launch(node);
          break;
        }
        case 'fetchSrc':
          void loadSrc(id, effect.node);
          break;
        case 'toast':
          useShellStore.getState().toast(effect.label, effect.value);
          break;
        case 'arm':
          doArm(true);
          break;
        case 'disarm':
          doArm(false);
          break;
        default:
          break;
      }
    }
  }

  function navigateHistory(direction: 1 | -1): void {
    const hist = historyRef.current;
    if (hist.length === 0) return;
    const idx = historyIdxRef.current;
    if (idx === null) {
      if (direction !== -1) return;
      draftRef.current = input;
      historyIdxRef.current = hist.length - 1;
      setInput(hist[hist.length - 1]!);
      return;
    }
    const next = idx + direction;
    if (next < 0) return;
    if (next >= hist.length) {
      historyIdxRef.current = null;
      setInput(draftRef.current);
      return;
    }
    historyIdxRef.current = next;
    setInput(hist[next]!);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Tab') {
      e.preventDefault();
      if (!tree) return;
      const cursor = e.currentTarget.selectionStart ?? input.length;
      const result = complete(input, cursor, { tree, wd });
      if (result.type === 'single') {
        setInput(result.value);
      } else if (result.type === 'multiple') {
        commit(`guest@valdez:${wd}$ ${input}`, [
          { text: result.candidates.join('  '), tone: 'dim' },
        ]);
      }
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      navigateHistory(-1);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      navigateHistory(1);
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      e.currentTarget.blur();
      return;
    }
    if (e.ctrlKey && (e.key === 'l' || e.key === 'L')) {
      e.preventDefault();
      setEntries([]);
      return;
    }
    if (e.ctrlKey && (e.key === 'c' || e.key === 'C')) {
      e.preventDefault();
      commit(`guest@valdez:${wd}$ ${input}^C`, []);
      setInput('');
      historyIdxRef.current = null;
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const raw = input;
      setInput('');
      void runLine(raw);
    }
  }

  // Prints the motd once per session, so a terminal restored by a reload (a fresh mount in
  // the same session) doesn't repeat it. Placed after `commit` because the lint rule
  // against using a binding before its declaration wants the caller textually below it.
  useEffect(() => {
    historyRef.current = readHistory();
    if (!hasShownTerminalMotd()) {
      commit('', [{ text: "valdez-os 1.0 · type 'help'", tone: 'ink' }]);
      setTerminalMotdShown();
    }
    // Mount-only: this is the one-time session check, not a reactive dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Measures `ls`'s column budget in characters, using a hidden monospace probe span so it
  // tracks the real font, and re-measures whenever the log resizes.
  useEffect(() => {
    const container = logRef.current;
    const probe = measureRef.current;
    if (!container || !probe) return;
    function update() {
      const charWidth = probe!.getBoundingClientRect().width / 10 || 8;
      setCols(Math.max(20, Math.floor(container!.clientWidth / charWidth)));
    }
    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // A click anywhere in the terminal focuses the prompt, unless it ended a text selection,
  // which is left alone so it can be copied.
  function focusInputOnClick(): void {
    if (window.getSelection()?.isCollapsed === false) return;
    inputRef.current?.focus();
  }

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- pointer convenience only; the input is keyboard-reachable on its own
    <div className="terminal" onClick={focusInputOnClick}>
      <span
        ref={measureRef}
        aria-hidden="true"
        style={{ position: 'absolute', visibility: 'hidden', whiteSpace: 'pre', left: -9999 }}
      >
        MMMMMMMMMM
      </span>
      <div
        className="terminal-log"
        role="log"
        aria-live="polite"
        aria-label="Terminal output"
        ref={logRef}
      >
        {entries.map((entry) => (
          <div
            className="term-entry"
            key={entry.id}
            ref={(el) => {
              if (el) entryRefs.current.set(entry.id, el);
              else entryRefs.current.delete(entry.id);
            }}
          >
            {entry.promptText !== '' && (
              <div className="term-line term-prompt">{entry.promptText}</div>
            )}
            {entry.lines.map((line, i) => renderLine(line, i))}
          </div>
        ))}
        {typingLines && (
          <div className="term-entry" aria-hidden="true">
            {typingLines.map((line, i) => renderLine(line, i))}
          </div>
        )}
      </div>
      <div className="terminal-input-row">
        <span className="terminal-prompt" aria-hidden="true">{`guest@valdez:${wd}$ `}</span>
        <input
          ref={inputRef}
          className="terminal-input"
          aria-label="Terminal command"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
      </div>
    </div>
  );
}
