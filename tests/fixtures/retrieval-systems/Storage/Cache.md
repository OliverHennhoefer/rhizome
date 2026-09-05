---
title: Storage cache
aliases: [Cache]
tags: [storage, performance]
type: mechanism
---
# Storage cache

An LRU policy evicts the least recently accessed entry. A byte budget bounds retained memory.
Cache stampedes happen when concurrent requests all recompute an expired value.
