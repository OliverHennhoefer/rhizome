---
title: Gradients
aliases:
  - Gradient
types: foundation
tags:
  - calculus
depends-on:
  - "[[Partial derivatives]]"
  - "[[Vectors]]"
---

# Gradients

The gradient collects all partial derivatives of a scalar-valued function into a vector. For
$f(x,y)$,

$$
\nabla f=
\begin{bmatrix}
\partial f/\partial x\\
\partial f/\partial y
\end{bmatrix}.
$$

It points in the direction of steepest local increase. Its negative points toward the steepest local
decrease, which motivates the update in [[Gradient descent]].

For a matrix or tensor of parameters, the gradient has the same shape. Each entry says
how a tiny change to the corresponding parameter would affect the loss, assuming
the others remain fixed.

A gradient is local information. It does not guarantee the best long-term route through a complex
loss landscape. Learning rate, momentum, adaptive optimizers, noisy mini-batches,
and parameter scale all influence how that direction becomes an actual update.
