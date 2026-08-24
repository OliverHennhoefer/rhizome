---
title: Activation functions
aliases:
  - Activation function
  - Nonlinearity
types: component
tags:
  - neural-network
depends-on:
  - "[[Variables and functions]]"
  - "[[Derivatives]]"
---

# Activation functions

An activation function applies a nonlinear rule to a layer's values, usually element by element. It
prevents a stack of affine transformations from collapsing into one equivalent affine map.

The rectified linear unit is $\operatorname{ReLU}(x)=\max(0,x)$. Modern Transformers often use
smoother functions such as GELU or SiLU. Their exact shapes differ, but each lets the network respond
differently depending on the input value.

Activations must support useful gradients. A function that is flat over most of its range can block
learning; one with extreme derivatives can destabilize it. The choice interacts with
[[Initialization]], normalization, and model width.

In a multilayer perceptron, activation sits between an expansion and a
projection. Gated MLPs and SwiGLU combine an activation with elementwise multiplication so one
learned path controls another.
