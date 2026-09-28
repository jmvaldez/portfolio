// Site-wide constants with no `astro:content`/`astro:config` dependency, so they stay
// importable from pure lib code (`src/lib/meta.ts`) and from tests. Content is lorem
// ipsum throughout (map "Standing preferences"), and the site-wide description is no
// exception.

export const SITE_NAME = 'Joe Valdez';

export const SITE_DESCRIPTION =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit — a software-engineering ' +
  'portfolio presented as a retro personal computer.';
