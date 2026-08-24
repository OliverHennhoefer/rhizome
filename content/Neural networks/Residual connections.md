---
title: Residual connections
aliases:
  - Residual connection
  - Skip connection
types: mechanism
tags:
  - neural-network
  - transformer
depends-on:
  - "[[Vector operations]]"
  - "[[Shape and dimension]]"
---

# Residual connections

A residual connection adds a sublayer's input to its output:

$$
\mathbf{y}=\mathbf{x}+F(\mathbf{x}).
$$

The function $F$ learns a change to the current representation rather than constructing an entirely
new representation from scratch. Input and output must have the same shape.

The direct addition creates a short path for both activations and gradients. If the learned sublayer
initially contributes little, information can still pass through unchanged. This makes very deep
networks easier to optimize.

Each [[Transformer block]] has residual paths around self-attention and its feed-forward sublayer.
Combined with Pre-normalization, they form an evolving residual stream shared by the model's
layers.

Residual connections help preserve information, but additions can also change scale. Layer normalization
or RMS normalization controls that scale at predictable points.
