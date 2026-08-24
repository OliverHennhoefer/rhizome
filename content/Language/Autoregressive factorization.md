---
title: Autoregressive factorization
aliases:
  - Chain rule of probability
types: foundation
tags:
  - language
  - probability
depends-on:
  - "[[Joint and conditional probability]]"
  - "[[Text corpora and sequences]]"
---

# Autoregressive factorization

Autoregressive factorization rewrites a sequence probability as a product of conditional
probabilities:

$$
p(x_1,\ldots,x_T)=\prod_{t=1}^{T}p(x_t\mid x_{<t}),
$$

where $x_{<t}$ means all tokens before position $t$. This is an identity from probability, not an
approximation introduced by Transformers.

The factorization establishes a direction: each position may depend on earlier positions but not on
future ones. [[Causal masking]] enforces that restriction inside self-attention during parallel
training.

Taking logarithms turns the product into a sum, so maximizing sequence likelihood becomes minimizing
the average Cross-entropy across next-token positions. During Inference, the same
factorization becomes a loop: predict one token, append it, and predict again.

Other factorizations are possible, but left-to-right autoregression aligns naturally with text
generation and the Decoder-only Transformer.
