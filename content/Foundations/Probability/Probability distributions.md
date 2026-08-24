---
title: Probability distributions
aliases:
  - Probability distribution
types: foundation
tags:
  - probability
depends-on:
  - "[[Probability]]"
  - "[[Random variables]]"
  - "[[Summation notation]]"
---

# Probability distributions

A probability distribution assigns a probability to every possible value of a random variable. For
a discrete variable $X$, the probability mass function $p(x)$ obeys
$\sum_x p(x)=1$.

An example distribution over three tokens is

$$
p=[0.70,0.20,0.10].
$$

It expresses both a ranking and uncertainty. Selecting only the largest value loses the distinction
between a confident distribution such as $[0.98,0.01,0.01]$ and an uncertain one such as
$[0.36,0.34,0.30]$.

[[Softmax and logits|Softmax]] creates a categorical distribution over the vocabulary.
Cross-entropy compares that predicted distribution with the observed next token.
Entropy summarizes how spread out the distribution is, while Sampling draws one outcome
from it.

The model learns a different distribution for every context, which is why language modeling is a
conditional probability problem rather than a static word-frequency table.
