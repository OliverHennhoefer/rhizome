---
title: Vector operations
aliases:
  - Vector addition
  - Scalar multiplication
types: foundation
tags:
  - linear-algebra
depends-on:
  - "[[Vectors]]"
  - "[[Addition]]"
  - "[[Multiplication]]"
---

# Vector operations

Vectors of the same dimension can be added entry by entry:

$$
[1,2]+[3,-1]=[4,1].
$$

A scalar can multiply every entry: $2[1,2]=[2,4]$. Together, these operations let us form weighted
combinations such as $0.25\mathbf{a}+0.75\mathbf{b}$. [[Attention]] produces this kind of weighted
sum when it blends value vectors from several token positions.

These operations preserve dimension. If $\mathbf{x}\in\mathbb{R}^d$, then
$a\mathbf{x}+\mathbf{y}$ is also in $\mathbb{R}^d$ when $a$ is a scalar and $\mathbf{y}$ has the
same dimension. This compatibility is what lets Residual connections add a layer's input and
output.

Vector addition does not mix entries with one another. Mixing happens through a Dot product or
a linear transformation. Recognizing that difference helps distinguish
simple aggregation from learned feature interaction.
