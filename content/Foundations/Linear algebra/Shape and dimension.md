---
title: Shape and dimension
aliases:
  - Tensor shape
types: foundation
tags:
  - linear-algebra
depends-on:
  - "[[Vectors]]"
---

# Shape and dimension

Shape records how an array is organized. A vector with $d$ entries has shape $[d]$. A matrix with
$m$ rows and $n$ columns has shape $[m,n]$. A batch of $b$ sequences, each with $t$ token vectors of
width $d$, may have shape $[b,t,d]$.

Shapes determine whether operations are meaningful. Matrices $A\in\mathbb{R}^{m\times n}$ and
$B\in\mathbb{R}^{n\times p}$ can be multiplied because the inner dimensions agree. Their product
has shape $[m,p]$.

Language-model equations often omit batch or sequence axes to stay readable. Code cannot. Following
the axes through [[Embedding lookup]], Multi-head attention, and Linear layers is one of the
most reliable ways to understand an implementation.

“Dimension” can mean either the number of axes or the size of a particular vector space. Context
usually resolves the ambiguity: “a rank-three tensor” has three axes, while “embedding dimension
$d$” means the size of its last axis.
