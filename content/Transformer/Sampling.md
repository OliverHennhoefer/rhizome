---
title: Sampling
types: mechanism
tags:
  - language
  - inference
depends-on:
  - "[[Probability distributions]]"
  - "[[Random variables]]"
  - "[[Inference]]"
---

# Sampling

Sampling draws one token according to the model's next-token probability distribution. If three
tokens have probabilities $[0.7,0.2,0.1]$, repeated samples choose them in roughly those proportions,
not always in rank order.

Greedy decoding is the limiting deterministic alternative: always choose the highest-probability
token. It can work for constrained tasks but may produce repetitive or locally attractive sequences
in open-ended generation.

Sampling introduces randomness into which path through the autoregressive model is followed. Once a
token is chosen, it becomes part of the next context and changes every later distribution.

[[Temperature]] reshapes the distribution before drawing. Top-k and nucleus sampling remove low-
priority alternatives and renormalize the rest. These controls change selection, not the model's
learned parameters or underlying logits.
