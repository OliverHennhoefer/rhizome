---
title: RMS normalization
aliases:
  - RMSNorm
types: mechanism
tags:
  - neural-network
  - transformer
  - modern-refinement
depends-on:
  - "[[Norm and cosine similarity]]"
  - "[[Learned representations]]"
  - "[[Parameters]]"
supported-by:
  - "[Root Mean Square Layer Normalization](https://arxiv.org/abs/1910.07467)"
---

# RMS normalization

RMS normalization controls a vector's scale using its root mean square without subtracting its mean:

$$
\operatorname{RMSNorm}(\mathbf{x})=
\boldsymbol{\gamma}\odot
\frac{\mathbf{x}}{\sqrt{\frac{1}{d}\sum_{i=1}^{d}x_i^2+\epsilon}}.
$$

Here $d$ is feature dimension, $\boldsymbol{\gamma}$ a learned scale, and $\epsilon$ a small stability
constant. The result keeps the overall feature magnitude controlled while preserving the vector's
mean.

Compared with [[Layer normalization]], RMSNorm removes mean-centering and usually the learned bias.
That makes it slightly simpler and cheaper. It is a common modern refinement, but both methods serve
the same architectural need: stable activation scale through deep residual stacks.

RMSNorm does not normalize across tokens or batches. It acts independently on the features of each
token representation, so it works identically during training and autoregressive inference.
