---
title: Event model
types: concept
tags:
  - architecture
  - runtime
---

# Event model

Events identify the resource that changed and preserve enough context to update its dependants.

## Change propagation

An update disconnects stale outgoing relationships, reparses the resource, then reconnects it. ^propagation
