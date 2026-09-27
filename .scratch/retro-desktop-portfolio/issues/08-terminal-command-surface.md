# Terminal command surface

Type: grilling
Status: open
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
