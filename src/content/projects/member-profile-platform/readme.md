---
type: project
title: Member Profile Platform
summary: Technical lead on the member profile LegalShield's customer service reps use, from the React UI to the pipeline that ships it.
role: Technical lead
tech:
  - TypeScript
  - React
  - Next.js
  - Node.js
  - GitHub Actions
  - New Relic
  - Playwright
  - Storybook
period:
  start: '2025'
  end: present
status: wip
featured: true
---

## The problem

Customer service reps were jumping between several tools to understand one member. We set out to
build one profile with identity, contact, plan, billing, alerts and cases in it, so a rep can get
oriented and act within 60 seconds. A whole team would be building on it, so the groundwork had to
hold up.

## What I built

- A backend-for-frontend that pulls dozens of services from across the company, including an
  IBM i mainframe, into one member record, so the UI never has to call those services itself.
- The Next.js app itself. Page loads sit in Google's "good" Core Web Vitals range, and every panel
  loads on its own, so one slow or failing data source doesn't take the page down with it.
- A component library documented in Storybook. It replaced a legacy library and the hand-rolled
  components that had been copied and duplicated across the codebase.
- Role-based access checked on both sides: routes are gated in React, and the server enforces the
  same rules, including redacting sensitive member data for anyone without access to it.
- A trunk-based pipeline on GitHub Actions. End-to-end tests gate every release, rollbacks are
  tagged for audit, and release notes are generated automatically. I also moved a production
  service off its old CI provider.
- Shared New Relic packages for server and browser monitoring, plus a service health dashboard
  covering every downstream dependency, so we could see the metrics before picking alert
  thresholds.
- A Claude Code skill, backed by an internal API, that creates complicated test members on demand
  for developers and QA.
