// Every seed URL a content page should exist at (ticket 12 § URLs). Lives outside
// `pages.spec.ts` (which re-exports it for compatibility) because Playwright refuses
// to let one spec file import another; `zero-js.spec.ts` needs the same list. `filename`
// is the masthead's expected text (ticket 12 § Anatomy): the routed node's own name, or
// its readme.md's name when the route is a directory with one (a directory never
// carries a body itself — glossary "Readme").
export const PAGE_URLS: { url: string; filename: string }[] = [
  { url: '/about/', filename: 'about.txt' },
  { url: '/contact/', filename: 'contact.txt' },
  { url: '/resume/', filename: 'resume.txt' },
  { url: '/projects/', filename: 'projects' },
  { url: '/projects/orbital-mesh/', filename: 'readme.md' },
  { url: '/projects/orbital-mesh/notes/', filename: 'notes.md' },
  { url: '/projects/ledger-lite/', filename: 'ledger-lite.md' },
  { url: '/projects/signal-relay/', filename: 'readme.md' },
  { url: '/drones/', filename: 'drones' },
  { url: '/drones/nazgul/', filename: 'readme.md' },
  { url: '/drones/nazgul/tuning/', filename: 'tuning.md' },
  { url: '/drones/pico-whoop/', filename: 'pico-whoop.md' },
];
