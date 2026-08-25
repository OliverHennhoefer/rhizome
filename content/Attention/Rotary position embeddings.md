---
title: Rotary position embeddings
aliases:
  - RoPE
  - Rotary embeddings
types: mechanism
tags:
  - attention
  - modern-refinement
depends-on:
  - "[[Position information and encodings]]"
  - "[[Queries, keys, and values]]"
  - "[[Dot product]]"
supported-by:
  - "[[Sources/RoFormer - Enhanced Transformer with Rotary Position Embedding]]"
---

# Rotary position embeddings

Rotary position embeddings encode position by rotating pairs of query and key coordinates through
position-dependent angles. A simplified two-dimensional rotation is

$$
R_\theta=
\begin{bmatrix}
\cos\theta&-\sin\theta\\
\sin\theta&\cos\theta
\end{bmatrix}.
$$

Different feature pairs rotate at different frequencies. When a rotated query meets a rotated key,
their dot product depends on the relative position difference, not only the two absolute positions.

RoPE changes queries and keys rather than adding a position vector to hidden states. It therefore
fits directly inside the attention calculation and adds no learned table for each absolute position.

Many modern decoder-only models use RoPE, often with frequency adjustments for longer contexts. Such
extensions can improve range but do not guarantee uniform performance throughout an enlarged
[[Context window]]. RoPE is a common refinement, not part of the minimal definition of attention.
