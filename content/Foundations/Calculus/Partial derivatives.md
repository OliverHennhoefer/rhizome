---
title: Partial derivatives
aliases:
  - Partial derivative
types: foundation
tags:
  - calculus
depends-on:
  - "[[Derivatives]]"
  - "[[Variables and functions]]"
---

# Partial derivatives

A function can depend on several variables. A partial derivative changes one variable while holding
the others fixed. For $f(x,y)=x^2+xy$,

$$
\frac{\partial f}{\partial x}=2x+y,
\qquad
\frac{\partial f}{\partial y}=x.
$$

The symbol $\partial$ signals that other inputs exist. Evaluated at $x=2,y=3$, the two partial
derivatives are $7$ and $2$: the output is locally more sensitive to $x$ than to $y$.

A language-model loss depends on every learned [[Parameters|parameter]]. Training needs a partial
derivative for each one. Those derivatives are collected into a gradient with the same
shape as the parameters.

“Holding the others fixed” is a local mathematical question. During an optimizer step, many
parameters are updated together after all of their partial derivatives have been computed.
