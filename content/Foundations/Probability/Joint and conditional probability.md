---
title: Joint and conditional probability
aliases:
  - Conditional probability
  - Joint probability
types: foundation
tags:
  - probability
depends-on:
  - "[[Probability]]"
  - "[[Multiplication]]"
---

# Joint and conditional probability

A joint probability describes several events together. A conditional probability describes one
event given that another is known. They are connected by

$$
p(A,B)=p(A)\,p(B\mid A).
$$

The vertical bar means “given.” If $A$ is the prefix “the cat” and $B$ is the next token “sat,” then
$p(B\mid A)$ is the model's probability for “sat” after seeing that prefix.

The product rule extends to a sequence:

$$
p(x_1,\ldots,x_T)=\prod_{t=1}^{T}p(x_t\mid x_1,\ldots,x_{t-1}).
$$

This equation is the probabilistic basis of [[Autoregressive factorization]]. It turns one difficult
joint distribution over complete texts into a series of next-token
distributions. Because the product may become extremely small, training works with
log-probabilities.
