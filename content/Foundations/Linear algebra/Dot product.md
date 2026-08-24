---
title: Dot product
aliases:
  - Inner product
types: foundation
tags:
  - linear-algebra
depends-on:
  - "[[Vectors]]"
  - "[[Multiplication]]"
  - "[[Summation notation]]"
---

# Dot product

The dot product takes two equal-length vectors, multiplies matching entries, and adds the results:

$$
\mathbf{x}\cdot\mathbf{y}=\sum_{i=1}^{d}x_i y_i.
$$

For $\mathbf{x}=[1,2]$ and $\mathbf{y}=[3,4]$, the result is $1\cdot3+2\cdot4=11$. Unlike vector
addition, the output is one scalar.

A dot product measures alignment as well as magnitude. Similar directions tend to produce a large
positive value, opposing directions a negative value, and perpendicular directions zero. Dividing
by both vector lengths gives [[Norm and cosine similarity|cosine similarity]], which isolates
direction.

Attention scores are dot products between query and key vectors.
Matrix multiplication evaluates many such dot products together. This makes the simple
multiply-and-sum pattern one of the busiest operations in a Transformer.
