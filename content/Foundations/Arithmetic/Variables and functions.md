---
title: Variables and functions
aliases:
  - Function
  - Variables
types: foundation
tags:
  - arithmetic
depends-on:
  - "[[Scalars]]"
---

# Variables and functions

A variable is a name for a value. A function is a rule that maps inputs to outputs. Writing
$y=f(x)$ says that the value of $y$ is determined by applying $f$ to $x$.

For example, $f(x)=2x+1$ maps $3$ to $7$. A function may accept vectors or tensors rather than one
scalar, and it may contain billions of adjustable [[Parameters|parameters]]. A neural network is
still a function: it maps input token IDs and parameter values to output logits.

Composition connects functions. If $u=g(x)$ and $y=f(u)$, then $y=f(g(x))$. Deep models are long
compositions of Linear layers, Activation functions, attention, and normalization. The
Chain rule explains how a change at the end of this composition can be traced back through every
earlier function.

Symbols are local conventions. $x$ often means input, $y$ output, $\theta$ parameters, and $f_\theta$
a function controlled by those parameters, but a note or paper should always define them.
