// The "trapped in vim" easter egg's state machine. Pure: it decides the next state and the
// message on vim's command line; `Terminal.tsx` renders it and wires the keys and the timer.

/** The excuses for a failed exit, in order: realistic first, then worse. The last repeats. */
export const EXCUSES = [
  'E37: No write since last change (add ! to override)',
  'E32: No file name',
  'E1337: are you sure you want to leave?',
  'E404: exit not found',
  'E9000: vim has grown fond of you',
  'E9001: the exit is a state of mind',
];

/** Neovim's own reply to Ctrl-C. */
export const CTRL_C_MESSAGE = 'Type  :qa!  and press <Enter> to abandon all changes and exit Nvim';

/** The failed attempts after which the fake Stack Overflow card appears. */
export const CARD_AFTER = 5;

/** The fake Stack Overflow card: plain text, deliberately not their branding. */
export const CARD = {
  title: 'How do I exit Vim?',
  meta: 'asked 13 years ago · viewed 3.1M times',
  answer: 'top answer: press Esc, then type :qa! and hit Enter. no, really.',
};

/** What a visitor typed that counts as trying to leave, minus any leading colon. */
const EXIT_WORDS = new Set([
  'q',
  'q!',
  'qa',
  'wq',
  'wq!',
  'wqa',
  'x',
  'x!',
  'xa',
  'quit',
  'exit',
  'ZZ',
  'ZQ',
]);

export interface VimState {
  /** Failed exit attempts so far. */
  attempts: number;
  /** What vim's command line says; empty until the first submission. */
  message: string;
  showCard: boolean;
  /** Set by `:qa!`, the one way out. */
  escaped: boolean;
}

export type VimKey = 'esc' | 'ctrl-c';

export function startVim(): VimState {
  return { attempts: 0, message: '', showCard: false, escaped: false };
}

function fail(state: VimState, message?: string): VimState {
  const attempts = state.attempts + 1;
  return {
    ...state,
    attempts,
    message: message ?? EXCUSES[Math.min(attempts, EXCUSES.length) - 1]!,
    showCard: attempts >= CARD_AFTER,
  };
}

/** The state after a line is submitted on the command line. A blank line changes nothing. */
export function submit(state: VimState, line: string): VimState {
  const typed = line.trim();
  if (typed === '') return state;
  const word = typed.replace(/^:/, '');
  if (word === 'qa!' || word === 'qall!') return { ...state, escaped: true };
  if (EXIT_WORDS.has(word)) return fail(state);
  return { ...state, message: `E492: Not an editor command: ${word}` };
}

/** The state after a bare key. Both count as an attempt; Ctrl-C answers in Neovim's words. */
export function press(state: VimState, key: VimKey): VimState {
  return key === 'ctrl-c' ? fail(state, CTRL_C_MESSAGE) : fail(state);
}

/** `mm:ss` for a duration in milliseconds. */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}
