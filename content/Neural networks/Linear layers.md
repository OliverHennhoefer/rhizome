---
title: Linear layers
aliases:
  - Linear layer
  - Dense layer
  - Fully connected layer
types: component
tags:
  - neural-network
depends-on:
  - "[[Affine transformations]]"
  - "[[Parameters]]"
  - "[[Matrix multiplication]]"
---

# Linear layers

A linear layer applies the same learned affine transformation to its inputs. For an input width
$d_\text{in}$ and output width $d_\text{out}$, its weight matrix has shape
$[d_\text{out},d_\text{in}]$ and its bias has shape $[d_\text{out}]$.

For a whole sequence, all token vectors are transformed in parallel through matrix multiplication.
The layer changes feature width but, by itself, does not mix information between token positions.

Transformers use linear layers to create [[Queries, keys, and values]], combine attention heads,
expand and contract the Feed-forward sublayer, and produce vocabulary logits.
The names describe different roles, while the core calculation remains $W\mathbf{x}+\mathbf{b}$.

Stacking only linear layers would still describe one affine transformation. Activation functions
and attention introduce input-dependent behavior between them.
