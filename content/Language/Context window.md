---
title: Context window
aliases:
  - Context length
types: concept
tags:
  - language
  - transformer
depends-on:
  - "[[Text corpora and sequences]]"
  - "[[Tokens]]"
  - "[[Position information and encodings]]"
---

# Context window

The context window is the maximum token span a model can use for one prediction. If its length is
$T$, tokens outside the retained window cannot directly affect the next-token distribution.

Context is measured in tokens, not words or characters. Tokenizer behavior therefore
changes how much human-readable text fits. Special tokens and generated output also consume space.

Standard self-attention compares token positions pairwise, so its score matrix grows roughly with
$T^2$. Memory and computation have historically constrained context length, while more efficient
kernels, attention variants, and position schemes have extended it.

A long advertised window does not guarantee that every earlier detail influences the output equally.
Training data, position representation, architecture, and the
content itself determine effective use. During generation, a [[KV cache]] stores reusable context
states but does not remove the model's configured limit.
