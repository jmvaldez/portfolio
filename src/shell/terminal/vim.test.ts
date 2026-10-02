import { describe, expect, it } from 'vitest';
import { CARD_AFTER, CTRL_C_MESSAGE, EXCUSES, formatElapsed, press, startVim, submit } from './vim';

describe('submit', () => {
  it('starts with an empty command line', () => {
    expect(startVim()).toEqual({ attempts: 0, message: '', showCard: false, escaped: false });
  });

  it('answers each failed exit with the next excuse, then repeats the last', () => {
    let state = startVim();
    for (const excuse of EXCUSES) {
      state = submit(state, ':q');
      expect(state.message).toBe(excuse);
    }
    state = submit(state, ':q');
    expect(state.message).toBe(EXCUSES.at(-1));
    expect(state.attempts).toBe(EXCUSES.length + 1);
  });

  it.each([':q', ':q!', ':wq', ':x', 'ZZ', 'exit', 'quit', ':quit', '  :wq  '])(
    'counts %j as an exit attempt',
    (line) => {
      expect(submit(startVim(), line).attempts).toBe(1);
    },
  );

  it('rejects anything else as not an editor command, without counting it', () => {
    const state = submit(startVim(), ':hello world');
    expect(state.message).toBe('E492: Not an editor command: hello world');
    expect(state.attempts).toBe(0);
    expect(submit(startVim(), 'ls').message).toBe('E492: Not an editor command: ls');
  });

  it('ignores a blank line', () => {
    const state = submit(startVim(), ':q');
    expect(submit(state, '   ')).toBe(state);
  });

  it('shows the card from the fifth failed attempt', () => {
    let state = startVim();
    for (let i = 1; i <= CARD_AFTER; i++) {
      state = submit(state, ':q');
      expect(state.showCard).toBe(i >= CARD_AFTER);
    }
  });

  it('keeps the card once shown', () => {
    let state = startVim();
    for (let i = 0; i < CARD_AFTER; i++) state = submit(state, ':q');
    expect(submit(state, ':nope').showCard).toBe(true);
  });

  it('escapes on :qa! at any point, counting nothing', () => {
    expect(submit(startVim(), ':qa!')).toMatchObject({ escaped: true, attempts: 0 });
    expect(submit(submit(startVim(), ':q'), ':qa!').escaped).toBe(true);
  });

  it('does not escape on :qa', () => {
    const state = submit(startVim(), ':qa');
    expect(state.escaped).toBe(false);
    expect(state.attempts).toBe(1);
  });
});

describe('press', () => {
  it('counts Esc as an attempt with the next excuse', () => {
    const state = press(startVim(), 'esc');
    expect(state.attempts).toBe(1);
    expect(state.message).toBe(EXCUSES[0]);
  });

  it("answers Ctrl-C in Neovim's words and still counts it", () => {
    const state = press(startVim(), 'ctrl-c');
    expect(state.attempts).toBe(1);
    expect(state.message).toBe(CTRL_C_MESSAGE);
  });

  it('the next excuse follows the attempt count whatever the key', () => {
    const state = submit(press(startVim(), 'ctrl-c'), ':q');
    expect(state.message).toBe(EXCUSES[1]);
  });
});

describe('formatElapsed', () => {
  it('formats milliseconds as mm:ss', () => {
    expect(formatElapsed(0)).toBe('00:00');
    expect(formatElapsed(42_900)).toBe('00:42');
    expect(formatElapsed(61_000)).toBe('01:01');
    expect(formatElapsed(3_600_000)).toBe('60:00');
    expect(formatElapsed(-5)).toBe('00:00');
  });
});
