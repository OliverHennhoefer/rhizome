---
title: Transpose
types: foundation
tags:
  - linear-algebra
depends-on:
  - "[[Matrices]]"
---

# Transpose

The transpose of a matrix swaps rows and columns. If $A$ has shape $[m,n]$, then $A^\mathsf{T}$ has
shape $[n,m]$, and

$$
(A^\mathsf{T})_{ij}=A_{ji}.
$$

For vectors, transposition distinguishes a column from a row in written linear algebra. The dot
product is often written $\mathbf{x}^\mathsf{T}\mathbf{y}$, a matrix product whose result is one
scalar.

In [[Scaled dot-product attention]], the query matrix multiplies the transpose of the key matrix:
$QK^\mathsf{T}$. This places every query in a row and every key in a column, producing a table of
pairwise scores between token positions.

A transpose rearranges axes; it does not learn values or change them. In tensor libraries, similar
operations may be called `transpose`, `permute`, or an axis swap. Tracking the resulting
shape is more important than the specific API name.
