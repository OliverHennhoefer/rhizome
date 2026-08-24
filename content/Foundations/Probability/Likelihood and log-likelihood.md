---
title: Likelihood and log-likelihood
aliases:
  - Likelihood
  - Log-likelihood
types: foundation
tags:
  - probability
depends-on:
  - "[[Joint and conditional probability]]"
  - "[[Logarithms]]"
  - "[[Parameters]]"
---

# Likelihood and log-likelihood

Likelihood asks how well particular parameter values explain observed data. For observations
$x_1,\ldots,x_n$ and parameters $\theta$, it treats

$$
L(\theta)=p_\theta(x_1,\ldots,x_n)
$$

as a function of $\theta$. The data are fixed; the candidate model parameters vary.

Products of many probabilities become tiny, so optimization uses the log-likelihood. Logarithms turn
products into sums:

$$
\log L(\theta)=\sum_i \log p_\theta(x_i\mid x_{<i}).
$$

Maximizing log-likelihood is equivalent to maximizing likelihood because the logarithm is strictly
increasing. Training code usually minimizes the negative log-likelihood instead, which is the same
objective with its sign reversed.

For categorical next-token prediction, negative log-likelihood and [[Cross-entropy]] are two views
of the same calculation. Pretraining applies it across large text corpora.
