---
title: Language modeling
aliases:
  - Language model
types: model
tags:
  - language
depends-on:
  - "[[Probability distributions]]"
  - "[[Text corpora and sequences]]"
  - "[[Tokens]]"
---

# Language modeling

Language modeling assigns probabilities to token sequences. A useful model must capture both local
patterns—such as spelling and syntax—and longer-range dependencies that change which continuations
are plausible.

An autoregressive model represents the probability of a complete sequence through conditional
next-token probabilities. This avoids listing a separate probability for every possible text, an
astronomically large space.

The model is trained from observed sequences rather than hand-written grammar rules. Its probability
estimates emerge from shared [[Parameters|parameters]] and representations
that recur across many contexts.

Autoregressive factorization supplies the probability equation, Next-token prediction supplies
the learning task, and a Decoder-only Transformer supplies the function used to compute each
conditional distribution. Together they form the core of a modern LLM.
