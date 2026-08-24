---
title: Scalars
aliases:
  - Scalar
types: foundation
tags:
  - arithmetic
---

# Scalars

A scalar is one number. It may represent a token score, a probability, a loss, a learning rate, or
one entry in a much larger array. For example, $3$, $-0.2$, and $10^{-4}$ are all scalars.

Scalars can be combined with [[Addition]] and Multiplication. A function can transform one
scalar into another, as in $y=x^2$, while a derivative describes how sensitive the output is to a
small change in the input.

Neural networks store millions or billions of scalars as parameters, but process them
in structured collections such as Vectors, Matrices, and Tensors. Those structures do not
replace scalar arithmetic: they organize many scalar operations so hardware can perform them
efficiently.

When an equation uses a lowercase italic symbol such as $x$ or $\alpha$, it often denotes a scalar.
The meaning comes from context, not the letter itself. Keeping track of whether a symbol is one
number or an array is the first step toward reading model equations reliably.
