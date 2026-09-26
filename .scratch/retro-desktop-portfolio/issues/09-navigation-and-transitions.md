# Navigation and transition model

Type: grilling
Status: open
Blocked by: 04, 05

## Question

The shape is hybrid: short sections open in-window, long ones hard-navigate to a real
page. Draw the line precisely and specify the seam.

Settle: which of `about`, `projects`, `drones`, `resume`, `contact` open in-window and
which navigate; what the transition looks like when a window becomes a page (does it
maximise and fill, or is it a cut); what the URL does in each case, and whether an
in-window section is linkable; how a content page gets back to the desktop, and whether
the desktop's state (open windows, positions) survives the round trip; and what a
deep-linked visitor sees when they arrive on a content page without ever seeing the
desktop.

The risk to name explicitly: the shell and the pages must not feel like two different
websites.
