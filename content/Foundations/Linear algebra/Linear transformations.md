---
title: Linear transformations
aliases:
  - Linear map
types: foundation
tags:
  - linear-algebra
depends-on:
  - "[[Matrix multiplication]]"
  - "[[Vector operations]]"
---

# Linear transformations

A linear transformation maps vectors while preserving addition and scaling. A matrix $W$ defines
one through

$$
f(\mathbf{x})=W\mathbf{x}.
$$

It satisfies $f(a\mathbf{x}+b\mathbf{y})=af(\mathbf{x})+bf(\mathbf{y})$. Geometrically, such a map
can rotate, stretch, shrink, reflect, or project a vector, but cannot bend the space with an
input-dependent rule.

A learned weight matrix chooses which combinations of input features become output features.
[[Queries, keys, and values]] are three different learned linear transformations of the same token
representation.

Strictly, a neural-network “linear layer” usually also adds a bias:
$W\mathbf{x}+\mathbf{b}$. That is an affine transformation rather than a purely linear one. Deep
networks alternate these maps with nonlinear functions; without the
nonlinear steps, many stacked matrices would collapse into a single matrix multiplication.
