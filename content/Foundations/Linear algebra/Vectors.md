---
title: Vectors
aliases:
  - Vector
types: foundation
tags:
  - linear-algebra
depends-on:
  - "[[Scalars]]"
---

# Vectors

A vector is an ordered list of scalars. A three-dimensional vector might be written
$\mathbf{x}=[2,-1,4]$. Its **dimension** is the number of entries, here $3$.

The ordering gives each position a role. In a physical vector the entries might be spatial
coordinates; in a language model they are learned features without simple fixed names. An
[[Embeddings|embedding]] represents a token as a vector so later operations can compare and
transform it.

Vectors support addition and scaling, dot products, and
matrix transformations. A batch of token vectors forms a matrix, and batches of those
matrices form tensors.

Bold lowercase symbols such as $\mathbf{x}$ commonly denote vectors. Code often stores the same
object as a one-dimensional array with shape `[d]`, where $d$ is the vector dimension. The values,
their order, and their shape all matter.
