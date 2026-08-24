---
title: Expectation
aliases:
  - Expected value
types: foundation
tags:
  - probability
depends-on:
  - "[[Probability distributions]]"
  - "[[Multiplication]]"
  - "[[Summation notation]]"
---

# Expectation

Expectation is the probability-weighted average of a random variable. For discrete outcomes,

$$
\mathbb{E}[X]=\sum_x p(x)x.
$$

If $X$ is $0$ with probability $0.75$ and $4$ with probability $0.25$, then
$\mathbb{E}[X]=0.75\cdot0+0.25\cdot4=1$. The expected value need not itself be a possible outcome.

More generally, $\mathbb{E}[f(X)]$ averages a quantity $f(X)$ over the distribution of $X$. Training
objectives are often described as expected loss over the unknown data distribution. A finite
[[Mini-batches and stochastic gradient descent|mini-batch]] estimates that expectation with an
ordinary average.

Attention also computes a weighted sum that resembles an expectation: attention weights act
like a distribution over positions and value vectors are the quantities being averaged. The analogy
is useful, although attention weights are learned deterministic outputs for the current input.
