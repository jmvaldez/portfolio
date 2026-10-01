// Every seed URL a content page should exist at. Lives outside `pages.spec.ts` (which
// re-exports it for compatibility) because Playwright refuses to let one spec file import
// another; `zero-js.spec.ts` needs the same list. `filename` is the masthead's expected
// text: the routed node's own name, or its readme.md's name when the route is a
// directory with one (a directory never carries a body itself).
export const PAGE_URLS: { url: string; filename: string }[] = [
  { url: '/about/', filename: 'about.txt' },
  { url: '/contact/', filename: 'contact.txt' },
  { url: '/resume/', filename: 'resume.txt' },
  { url: '/projects/', filename: 'projects' },
  { url: '/projects/aetherforge/', filename: 'readme.md' },
  { url: '/projects/aetherforge/roadmap/', filename: 'roadmap.md' },
  { url: '/projects/member-profile-platform/', filename: 'readme.md' },
  { url: '/projects/member-payments/', filename: 'member-payments.md' },
  { url: '/projects/valdez-os/', filename: 'valdez-os.md' },
  { url: '/drones/', filename: 'drones' },
  { url: '/drones/x500/', filename: 'readme.md' },
];
