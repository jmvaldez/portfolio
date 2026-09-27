# Terminal command surface

Type: grilling
Status: resolved
Blocked by: —

## Question

Specify the toy shell exactly. It is an alternate navigation path and a charm delivery
mechanism, never the only way through the site.

Settle: the command list and each one's exact output (`ls`, `cd`, `cat`, `pwd`, `whoami`,
`help`, `clear`, `open`?); what an unknown command prints, and what a valid command with
bad arguments prints; whether tab-completion and history exist; how the terminal and the
window UI stay in sync — does `open projects` raise the projects window; what the prompt
string is; the easter eggs and how discoverable they are; and how the terminal is
reachable (always-open window, taskbar item, keyboard shortcut).

Depends on the filesystem shape settled in `05`.

## Hard constraint from ticket 09

**The terminal never navigates.** Everything it does happens inside the desktop shell. A
typed command that can tear down the document is an unbounded set of ways to lose desktop
state, and the terminal was already ruled out as primary navigation. So `open projects`
raises the projects *window*; it never loads the projects *page*. If the visitor wants the
page, they maximise the window the terminal opened — promotion is the maximise box's job,
not a verb. This is not a decision this ticket revisits; the `open`? in the question above
is settled as window-only.

## Answer

Vocabulary is in `CONTEXT.md` at the repo root: **Terminal**, **Command**, **Working
directory**, **Easter egg**. The ticket 09 constraint holds throughout — nothing here
navigates.

### Reachability

The terminal is an `app` node, `/bin/terminal.exe`, so its taskbar launcher and desktop
icon come from the mount table like everything else. On first arrival at the shell it is
**open but not focused**, snapped small to the bottom-left corner, so it never swallows
keystrokes from someone who only wants to click. **One instance**: a second launch raises
the existing window. It does not exist on the linear layout (mobile, no-JS), which loses
nothing because the terminal is always an alternate path.

### Keys

- **Backtick** is Quake-style: opens or focuses the terminal; when it is already focused,
  minimises it. No command needs a backtick.
- `Esc` blurs back to the desktop. `Ctrl+L` clears. `Ctrl+C` abandons the line, echoing `^C`.
- **Tab** completes a command or path on a single match and lists candidates on several.
- **Up/down** walks history: last 100 commands, kept in `sessionStorage` alongside the
  window layout, so it survives a round trip through a page. Scrollback is not kept.

### Voice and prompt

Unix-shaped, with a dry in-world tail: the first line of any error is what coreutils would
print, the optional second line carries the voice. Prompt is `guest@valdez:<wd>$` — e.g.
`guest@valdez:/projects$`.

On a session's first open the terminal prints one motd line, `valdez-os 1.0 · type 'help'`,
then the prompt. A terminal restored from `sessionStorage` shows only a fresh prompt.

### Commands

Nine: `help ls cd pwd cat open clear whoami exit`. No `echo`, `grep`, `man` or `tree` —
each invites expectations of a real shell the toy can't meet. **No flags anywhere.**

`help` prints exactly:

```
commands:
  ls [path]      list a directory
  cd [path]      change directory
  pwd            print working directory
  cat <file>     print a file
  open [path]    open a window
  whoami         identify yourself
  clear          clear the screen
  help           this
  exit           close the terminal
there's more in /bin, if you're the curious type.
```

- **`ls`** uses `ls -F` markers: `dir/`, `app*`, `link@`; `file` and `text` bare.
  Alphabetical, columns fitted to the window width. Directories full phosphor brightness,
  everything else dimmer — single hue, never amber (amber is chrome). Empty dir prints nothing.
- **`cd`** moves the working directory and nothing else. Bare `cd` goes to `/`.
- **Paths**: absolute, relative, `.`, `..`, and `~` meaning `/`.
- **`cat`** prints the raw Markdown (ticket 05), whole, no pager. A dim `…` holds the line
  while the fetch is in flight; a failed fetch replaces it with an error line. After a long
  print, scroll so the **first** line of output is at the top of the view. A `file` node's
  output ends with a dim hint: `open <name> to read it properly.`
- **`open <path>`** raises the node's window if open, otherwise opens it, by kind: `dir` →
  folder window; `file` / `text` → content window; `app` → launches it; `link` → triggers
  the download or `mailto:` (neither unloads the document). Bare `open` opens the working
  directory. **Sync is one-way**: clicking a window never moves the working directory.
- **`whoami`** prints `guest`, then `you're looking for 'cat about.txt'.`
- **`exit`** closes the terminal window.
- **Apps** are `.exe`, commands are extensionless — the distinction is visible in any
  listing. Typing an app's name (`viewer.exe`) launches it, same as `open`.

### Errors

```
foo              foo: command not found
                 try 'help'. or don't; it's your terminal.
cd nope          cd: nope: No such file or directory      (same shape for cat, open)
cd about.txt     cd: about.txt: Not a directory
cat projects     cat: projects: Is a directory
cat resume.pdf   cat: resume.pdf: binary file
                 try 'open resume.pdf'.
cat viewer.exe   cat: viewer.exe: binary file
                 try running it.
ls -la           ls: flags aren't supported here.
                 this is a toy. a nice toy.
cd a b           cd: too many arguments
```

### `/bin`

Holds the nine commands, the easter egg commands (`sudo rm arm disarm hack`) and the apps
(`terminal.exe`, `viewer.exe`). `cat /bin/<command>` prints its `help` line plus a usage
line; `cat` on an egg prints a dry one-liner that doesn't spoil it (`cat /bin/hack` →
`do not.`). `cat` on an app is the binary-file error.

### Easter eggs

Absent from `help`, present in `/bin` — found by exploring, never tripped over by the
mouse-only visitor.

- **`sudo <anything>`**: `guest is not in the sudoers file. This incident will be
  reported.` plus a kill-feed toast.
- **`rm -rf /`**: ~6 lines of `removing /projects/…` at typing speed, then
  `rm: cannot remove '/': read-only file system` / `nice try.` Any other `rm`:
  `rm: read-only file system`.
- **`arm` / `disarm`**: opens or raises `viewer.exe`, spins the props up, `ARMED` toast;
  `disarm` reverses it. One egg, two commands.
- **`hack`**: a Fallout-style hex-dump wall, then `TERMINAL LOCKED` /
  `please contact an administrator.` A wink, **not** a playable minigame — a real
  word-guess game would be new scope.
- **Konami code**, typed anywhere in the shell: flips the vector grid from Commodore blue
  to amber for the session, with a toast. Not a command, so not in `/bin`.

### Left elsewhere

- Keyboard reachability and the screen-reader story for the terminal (is output announced
  as it prints?) stay in the map's accessibility fog.
- Whether the motd follows the boot's last line belongs to **Boot sequence**; noted there.
