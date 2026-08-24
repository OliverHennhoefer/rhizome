---
title: Multilayer perceptrons
aliases:
  - MLP
  - Feed-forward network
types: component
tags:
  - neural-network
depends-on:
  - "[[Linear layers]]"
  - "[[Activation functions]]"
---

# Multilayer perceptrons

A multilayer perceptron composes linear layers with nonlinear activations. A common two-layer form is

$$
\operatorname{MLP}(\mathbf{x})=W_2\,\phi(W_1\mathbf{x}+\mathbf{b}_1)+\mathbf{b}_2,
$$

where $\phi$ is an activation function. The first layer often expands the vector width, creating
room for many intermediate features; the second projects back to the model width.

The same MLP is applied independently to every token position. It transforms what each token
representation contains, while [[Self-attention]] moves information between positions. These roles
complement one another inside a Transformer block.

Despite the historical name “perceptron,” a Transformer MLP is best understood as a learned
feature-processing subnetwork at each position. Modern models often replace the simple form with
a gated variant.
