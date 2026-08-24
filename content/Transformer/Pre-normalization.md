---
title: Pre-normalization
aliases:
  - Pre-norm
types: mechanism
tags:
  - transformer
  - optimization
depends-on:
  - "[[Layer normalization]]"
  - "[[Residual connections]]"
---

# Pre-normalization

Pre-normalization applies normalization before each Transformer sublayer:

$$
\mathbf{y}=\mathbf{x}+F(\operatorname{Norm}(\mathbf{x})).
$$

The residual stream itself retains a direct identity path, while the attention or feed-forward
function receives a controlled input scale. This generally makes deep Transformers easier to
optimize than the original post-normalized arrangement, where normalization follows the residual
addition.

Pre-norm is an architectural placement, not a particular normalization formula. The `Norm` may be
Layer normalization or [[RMS normalization]]. Some models add a final normalization after the
complete block stack before producing logits.

The choice affects gradient flow and activation scale, but does not change the language-model
objective. It is one of several details that distinguish concrete implementations of the same
decoder-only architecture during stable training.
