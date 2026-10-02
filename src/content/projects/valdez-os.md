---
type: project
title: valdez-os
summary: This site. A portfolio disguised as a retro desktop, with a terminal, draggable windows and a 3D scene.
role: Solo builder
tech:
  - Astro
  - React
  - TypeScript
  - Three.js
  - Tailwind CSS
  - Playwright
  - Cloudflare Pages
period:
  start: '2026'
  end: present
status: wip
repo: https://github.com/jmvaldez/portfolio
---

## Overview

You're looking at it. On a big screen it boots into a desktop with draggable windows, a
working terminal (try `help`), and a 3D drone scene. On a phone, or for a search engine,
it's a plain readable page with the same content.

## Under the hood

- Every window is backed by a real static page, so nothing is hidden behind JavaScript
- The terminal walks a filesystem built from the site's own content at build time
- Strict budgets fail the build if the site gets too heavy
- Lighthouse and end-to-end tests run on every change in CI
- The resume PDF is generated from the resume page, never edited by hand
