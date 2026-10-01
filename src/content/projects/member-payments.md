---
type: project
title: Member Payments & Wallet
summary: Primary engineer on LegalShield's member payment forms, wallet and missed-payment recovery flows.
role: Primary engineer
tech:
  - React
  - TypeScript
  - TanStack Query
  - .NET
  - Snowflake
  - Streamlit
period:
  start: '2022'
  end: '2025'
status: shipped
featured: true
---

## The problem

When a member's payment fails, they can lose their coverage, so these forms have to work. They
run in the US and Canada, across most states, and they're layered: an older Java FreeMarker form
sits in an iframe inside a newer payments app that adds features on top, and that app is iframed
into apps across the company. A problem at any layer shows up as a broken form for the member.

## What I built

- The payment-method forms and wallet, with one messaging protocol so the layers can talk to
  each other across the iframes
- Error handling that gives members a message they can act on when a card is declined, can't be
  verified, or the processor is down
- The flow that lets members catch up on a missed payment and keep their coverage
- Canadian bank-draft support
- Masking for sensitive fields in checkout
- A Snowflake and Streamlit app tracking payment health and authorization failures. One thing it
  showed: members make most payment-method changes themselves.

## Production fixes

Members were hitting errors from a high-volume API, and I traced it to `If-Match` checks that
failed and never recovered. A downstream processor would update the record partway through a
request, which changed its version, and our side kept sending the stale one.

I shipped a quick fix on the frontend first, with optimistic updates and retries through TanStack
Query, then followed up with a proper fix in the processor that was bumping the version.
