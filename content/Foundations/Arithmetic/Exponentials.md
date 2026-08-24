---
title: Exponentials
types: foundation
tags:
  - arithmetic
depends-on:
  - "[[Multiplication]]"
  - "[[Variables and functions]]"
---

# Exponentials

An exponential raises a fixed base to a variable power. The natural exponential is written $e^x$,
where $e\approx2.718$. It is always positive and grows quickly:

$$
e^0=1,\qquad e^1\approx2.718,\qquad e^{-1}\approx0.368.
$$

Exponentials turn addition into multiplication: $e^{a+b}=e^a e^b$. This makes them a natural bridge
between scores and probabilities. [[Softmax and logits|Softmax]] exponentiates logits so every
result is positive, then normalizes them to sum to one. Temperature changes how sharply those
exponentials favor the largest score.

The derivative of $e^x$ is also $e^x$, which makes the function convenient in optimization. Direct
calculation can overflow for large inputs, so stable implementations subtract the largest score
before exponentiating. That changes neither the softmax probabilities nor their interpretation.

The inverse operation is the logarithm, central to likelihood and cross-entropy.
