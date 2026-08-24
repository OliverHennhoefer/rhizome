---
title: Layer normalization
aliases:
  - LayerNorm
types: mechanism
tags:
  - neural-network
  - transformer
depends-on:
  - "[[Expectation]]"
  - "[[Norm and cosine similarity]]"
  - "[[Learned representations]]"
---

# Layer normalization

Layer normalization standardizes the features of one token representation. For vector $\mathbf{x}$,
it computes a feature mean $\mu$ and variance $\sigma^2$, then applies learned scale and shift:

$$
\operatorname{LayerNorm}(\mathbf{x})=
\boldsymbol{\gamma}\odot\frac{\mathbf{x}-\mu}{\sqrt{\sigma^2+\epsilon}}+
\boldsymbol{\beta}.
$$

The small $\epsilon$ prevents division by zero. Unlike batch normalization, the statistics do not
depend on other examples in the mini-batch, which suits variable sequences and autoregressive
inference.

Normalization keeps activation scales predictable as residual updates accumulate through many
layers. Its learned parameters still allow the network to choose useful feature scales.

Many decoder-only Transformers use normalization before each sublayer, called
[[Pre-normalization|pre-norm]]. Some modern architectures replace LayerNorm with the simpler
RMS normalization.
