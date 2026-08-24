---
title: Prefill and decoding
aliases:
  - Prefill
  - Decode
types: mechanism
tags:
  - transformer
  - inference
depends-on:
  - "[[Inference]]"
  - "[[Self-attention]]"
  - "[[Context window]]"
---

# Prefill and decoding

Autoregressive inference has two computational phases. **Prefill** processes all prompt tokens, often
in parallel, and creates their hidden states and key-value cache entries. **Decoding** then produces
new tokens one at a time.

During each decode step, the new query attends to cached keys and values from the entire retained
context. Only the new token's layer activations must be computed, but every step still reads growing
context state.

Prefill is dominated by parallel matrix computation and attention across the prompt. Decoding is more
sequential and often limited by memory bandwidth, especially when loading model parameters and cache
data for one token at a time.

This distinction explains why prompt processing speed and generated-token speed are reported
separately. [[Grouped-query attention]] and the KV cache primarily improve the decoding side
without changing next-token probabilities.
