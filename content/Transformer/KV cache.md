---
title: KV cache
aliases:
  - Key-value cache
  - Attention cache
types: mechanism
tags:
  - transformer
  - inference
depends-on:
  - "[[Queries, keys, and values]]"
  - "[[Causal masking]]"
  - "[[Prefill and decoding]]"
  - "[[Tensors]]"
---

# KV cache

The key-value cache stores attention keys and values computed for earlier tokens at every layer.
During decoding, those earlier states do not change under causal attention, so recomputing them would
repeat work.

For each new token, the model computes one new query, key, and value. The query attends to the cached
keys and the new key, then combines the corresponding values. The new key and value are appended for
the next step.

Cache memory grows with sequence length, layer count, key-value head count, head dimension, and batch
size. Long contexts can therefore make the cache a major memory and bandwidth cost even though it
contains no learned parameters.

[[Grouped-query attention]] reduces this cost by sharing key-value heads. The cache accelerates
Inference but does not expand the Context window or change the model's distribution.
