---
title: Logarithms
aliases:
  - Logarithm
  - Natural logarithm
types: foundation
tags:
  - arithmetic
depends-on:
  - "[[Exponentials]]"
---

# Logarithms

A logarithm answers: “what exponent produces this positive number?” For the natural logarithm,
$\log(e^x)=x$. It reverses the exponential and turns products into sums:

$$
\log(ab)=\log a+\log b.
$$

That identity matters because a sequence probability is a product of many small conditional
probabilities. Multiplying them can underflow toward zero; adding their logarithms is numerically
stable. [[Likelihood and log-likelihood|Log-likelihood]] therefore scores a model using sums rather
than a huge product.

If the model assigns probability $p$ to the correct token, its negative log-loss is $-\log p$.
Confident correct predictions approach zero loss, while confident mistakes receive a large penalty.
This is the bridge from a probability distribution to
Cross-entropy, the standard next-token training objective.

Only positive inputs have real logarithms. In practice, softmax produces positive probabilities and
implementations combine log and softmax into a stable `log-softmax` calculation.
