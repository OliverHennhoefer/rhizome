---
title: Top-k and nucleus sampling
aliases:
  - Top-k sampling
  - Top-p sampling
  - Nucleus sampling
types: mechanism
tags:
  - probability
  - inference
depends-on:
  - "[[Sampling]]"
  - "[[Probability distributions]]"
---

# Top-k and nucleus sampling

Top-k sampling keeps only the $k$ highest-probability tokens, sets the rest to zero, and renormalizes.
Its candidate count stays fixed even when the original distribution is unusually certain or
uncertain.

Nucleus, or top-p, sampling instead keeps the smallest high-probability set whose cumulative
probability reaches a threshold $p$. A confident distribution may retain only a few tokens; a flatter
one retains more.

Both methods remove the low-probability tail before drawing a token. This can avoid unlikely
continuations while preserving more variety than greedy decoding. Aggressive truncation can also
discard a rare but appropriate token.

These rules operate after [[Temperature]] and softmax in a typical pipeline. They are decoding
policies, not parts of the Decoder-only Transformer or its training objective.
