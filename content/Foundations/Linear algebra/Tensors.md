---
title: Tensors
aliases:
  - Tensor
types: foundation
tags:
  - linear-algebra
depends-on:
  - "[[Matrices]]"
  - "[[Shape and dimension]]"
---

# Tensors

In machine learning, a tensor is a multidimensional array. A scalar has no array axes, a vector has
one, a matrix has two, and a higher-rank tensor has three or more.

A batch of hidden states commonly has shape $[b,t,d]$: batch size $b$, sequence length $t$, and
model width $d$. Multi-head attention may temporarily reshape this into $[b,h,t,d_h]$, adding a head
axis $h$ where $d=h d_h$.

The word “tensor” has a deeper mathematical meaning, but the array interpretation is sufficient for
reading most language-model implementations. Operations such as reshape and transpose change how
the same values are indexed, while [[Matrix multiplication]] and elementwise functions change the
values.

Thinking in named axes prevents confusion. A vocabulary distribution
and an embedding vector may both be arrays, but their axes mean different things and
cannot be exchanged casually.
