---
title: Gated MLPs and SwiGLU
aliases:
  - SwiGLU
  - Gated MLP
types: component
tags:
  - neural-network
  - transformer
  - modern-refinement
depends-on:
  - "[[Multilayer perceptrons]]"
  - "[[Activation functions]]"
  - "[[Multiplication]]"
supported-by:
  - "[GLU Variants Improve Transformer](https://arxiv.org/abs/2002.05202)"
---

# Gated MLPs and SwiGLU

A gated MLP creates two learned projections and multiplies them elementwise so one path controls the
other. SwiGLU uses the SiLU activation in the gate:

$$
\operatorname{SwiGLU}(\mathbf{x})=
(\operatorname{SiLU}(\mathbf{x}W_g)\odot \mathbf{x}W_v)W_o.
$$

$W_g$ forms gate values, $W_v$ forms candidate features, and $W_o$ projects the gated result back to
model width. The symbol $\odot$ means entrywise multiplication.

The gate makes feature transmission input-dependent: some channels can be suppressed while others
pass strongly. This is more expressive than applying one activation to a single projection.

Many modern decoder Transformers use SwiGLU or a related gated linear unit in their
[[Feed-forward sublayer]]. It refines the MLP component without changing the surrounding attention,
residual, or normalization structure.
