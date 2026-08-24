---
title: Cache invalidation
aliases:
  - Caching
types:
  - concept
tags:
  - architecture
depends-on:
  - "[[Event model]]"
supported-by:
  - https://martinfowler.com/bliki/TwoHardThings.html
---

# Cache invalidation

Cached state is safe only when changes have explicit, traceable invalidation paths.

> [!question] Impact
> What must be recomputed when an upstream event changes?

See [[Incremental compilation]] and the [[Event model#Change propagation]].
