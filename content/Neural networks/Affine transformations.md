---
title: Affine transformations
aliases:
  - Affine transformation
types: foundation
tags:
  - neural-network
depends-on:
  - "[[Linear transformations]]"
  - "[[Vector operations]]"
---

# Affine transformations

An affine transformation applies a linear map and then adds a bias:

$$
\mathbf{y}=W\mathbf{x}+\mathbf{b}.
$$

The matrix $W$ mixes and scales input features; the vector $\mathbf{b}$ shifts the result. Unlike a
strictly linear transformation, an affine map need not send the zero vector to zero.

Most operations called “linear” in neural-network libraries are affine. The bias lets a feature
activate even when its inputs are zero and gives the learned transformation a movable origin.

A single affine map can only reshape a linear geometry. Neural networks gain expressive power by
alternating [[Linear layers|affine layers]] with nonlinear activations.
Attention projections and output projections may omit biases in some architectures, but they remain
the same general family of matrix-based feature transformations.
