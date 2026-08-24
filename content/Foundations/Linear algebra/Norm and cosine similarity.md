---
title: Norm and cosine similarity
aliases:
  - Vector norm
  - Cosine similarity
types: foundation
tags:
  - linear-algebra
depends-on:
  - "[[Dot product]]"
  - "[[Multiplication]]"
  - "[[Summation notation]]"
---

# Norm and cosine similarity

The Euclidean norm measures a vector's length:

$$
\lVert\mathbf{x}\rVert_2=\sqrt{\sum_i x_i^2}.
$$

For $[3,4]$, the norm is $5$. A norm compresses many components into one non-negative magnitude.
Normalization methods use related measurements to keep activations at manageable scales.

Cosine similarity compares direction rather than raw length:

$$
\cos(\mathbf{x},\mathbf{y})=
\frac{\mathbf{x}\cdot\mathbf{y}}{\lVert\mathbf{x}\rVert_2\lVert\mathbf{y}\rVert_2}.
$$

Its value ranges from $-1$ to $1$ when both vectors are nonzero. Similar learned
[[Embeddings|embeddings]] often point in related directions, although geometric closeness alone does
not guarantee identical meaning.

Attention uses an unnormalized dot product rather than cosine similarity because
learned vector magnitudes can carry useful information. RMS normalization controls scale at a
different point in the network.
