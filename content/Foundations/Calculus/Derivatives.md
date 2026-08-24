---
title: Derivatives
aliases:
  - Derivative
  - Slope
types: foundation
tags:
  - calculus
depends-on:
  - "[[Variables and functions]]"
---

# Derivatives

A derivative measures how sensitively a function's output responds to a small input change. For a
single-variable function $y=f(x)$, the derivative is written $f'(x)$ or $\frac{dy}{dx}$.

For $f(x)=x^2$, the derivative is $f'(x)=2x$. At $x=3$, a tiny increase of $0.01$ changes the output
by approximately $2\cdot3\cdot0.01=0.06$. The derivative is a local slope, not a description of the
entire function.

Learning uses this sensitivity in reverse. If changing a parameter upward would increase the
[[Loss functions|loss]], the derivative is positive and Gradient descent moves the parameter
downward. If it would decrease the loss, the derivative is negative and the update moves upward.

Language models have many inputs and parameters, requiring Partial derivatives and
Gradients. Their long compositions of functions require the Chain rule.
