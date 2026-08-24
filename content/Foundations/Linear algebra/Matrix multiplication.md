---
title: Matrix multiplication
types: foundation
tags:
  - linear-algebra
depends-on:
  - "[[Matrices]]"
  - "[[Dot product]]"
  - "[[Shape and dimension]]"
---

# Matrix multiplication

Matrix multiplication evaluates many dot products at once. If
$A\in\mathbb{R}^{m\times n}$ and $B\in\mathbb{R}^{n\times p}$, then
$C=AB\in\mathbb{R}^{m\times p}$ with

$$
C_{ij}=\sum_{k=1}^{n}A_{ik}B_{kj}.
$$

The $i$th row of $A$ meets the $j$th column of $B$. The shared dimension $n$ disappears into the
sum; the outer dimensions $m$ and $p$ remain.

This operation powers [[Linear layers]], creates Queries, keys, and values, computes every
pairwise attention score, and maps hidden states to output logits. Although model diagrams show many
named components, much of their computation reduces to matrix multiplications followed by simple
elementwise operations.

The order matters: usually $AB\ne BA$, and the reversed product may not even have valid dimensions.
Accelerators are designed to execute large blocks of these multiply-and-add operations in parallel,
which is one reason model code groups examples into batches.
