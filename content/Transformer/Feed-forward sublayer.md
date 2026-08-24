---
title: Feed-forward sublayer
aliases:
  - Transformer MLP
  - FFN
types: component
tags:
  - transformer
depends-on:
  - "[[Multilayer perceptrons]]"
  - "[[Learned representations]]"
---

# Feed-forward sublayer

The feed-forward sublayer applies the same MLP independently to every token position. It usually
expands model width to a larger intermediate dimension, applies a nonlinearity or gate, and projects
back.

$$
\operatorname{FFN}(\mathbf{x})=W_2\phi(W_1\mathbf{x}+\mathbf{b}_1)+\mathbf{b}_2.
$$

Self-attention determines which positions exchange information. The feed-forward sublayer then
processes the resulting features locally. This separation gives each [[Transformer block]] both
cross-position routing and substantial per-position computation.

In many models, feed-forward parameters exceed attention parameters. The intermediate width is
therefore a major contributor to total parameter count and computation.

Modern decoder models often use Gated MLPs and SwiGLU rather than the simple activation form.
Mixture of experts conditionally selects among several feed-forward networks instead of applying
one dense network to every token.
