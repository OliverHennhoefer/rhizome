---
title: Addition
types: foundation
tags:
  - arithmetic
depends-on:
  - "[[Scalars]]"
---

# Addition

Addition combines quantities. For scalars, $3+4=7$. For arrays with the same shape, it acts entry by
entry:

$$
[1,2]+[3,4]=[4,6].
$$

The operation looks elementary, but its role in language models is structural. A
[[Residual connections|residual connection]] adds a layer's input back to its output. A bias is added in an
affine transformation. Position information can be added to a token
representation, and a total loss can sum many per-token losses.

Addition is also implicit in Summation notation, dot products, and
matrix multiplication, where many products are accumulated. Because
addition is linear and easy to differentiate, it passes information and gradients without changing
their form as dramatically as nonlinear operations do.

The operands must be compatible. Adding arrays of unrelated shape is undefined unless a documented
broadcasting rule expands one of them. Shape errors are therefore conceptual errors, not merely
programming inconveniences.
