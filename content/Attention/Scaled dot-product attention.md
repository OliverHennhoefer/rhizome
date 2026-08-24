---
title: Scaled dot-product attention
aliases:
  - Dot-product attention
types: mechanism
tags:
  - attention
  - transformer
depends-on:
  - "[[Attention]]"
  - "[[Queries, keys, and values]]"
  - "[[Attention scores and weights]]"
  - "[[Matrix multiplication]]"
  - "[[Transpose]]"
supported-by:
  - "[Attention Is All You Need](https://arxiv.org/abs/1706.03762)"
---

# Scaled dot-product attention

Scaled dot-product attention computes all query-key scores at once, normalizes them, and combines the
values:

$$
\operatorname{Attention}(Q,K,V)=
\operatorname{softmax}\!\left(\frac{QK^\mathsf{T}}{\sqrt{d_k}}+M\right)V.
$$

$d_k$ is key dimension and $M$ is an optional mask. $QK^\mathsf{T}$ creates a score for every query-key
pair. The final multiplication by $V$ evaluates the weighted sums.

Why divide by $\sqrt{d_k}$? If query and key components have comparable variance, their unscaled dot
product tends to grow with dimension. Very large score gaps make softmax nearly saturated and its
gradients small. Scaling keeps scores in a more workable range.

The formula is compact because Matrix multiplication batches many individual operations. In
practice, optimized attention kernels avoid materializing every intermediate, but preserve the same
mathematical result. [[Multi-head attention]] runs this mechanism in several learned subspaces.
