---
title: Inference
aliases:
  - Generation
types: mechanism
tags:
  - transformer
  - inference
depends-on:
  - "[[Decoder-only Transformer]]"
  - "[[Probability distributions]]"
  - "[[Autoregressive factorization]]"
---

# Inference

Inference uses learned parameters to make predictions without updating them. For autoregressive text
generation, it repeatedly computes a next-token distribution, chooses a token, appends it to the
sequence, and continues.

The first pass over an existing prompt is [[Prefill and decoding|prefill]]. Later decode steps process
one new token while reusing a KV cache. The mathematical model is unchanged, but the computation
pattern differs greatly from parallel training.

Sampling determines how a probability distribution becomes a token. Greedy selection always
takes the largest probability; temperature and truncation can trade determinism for diversity.

Inference is deterministic only when both the token-selection rule and numerical execution are
deterministic. The model's probabilities remain conditional on the exact preceding tokens, so one
different choice can alter the whole continuation.
