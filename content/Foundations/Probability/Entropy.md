---
title: Entropy
types: foundation
tags:
  - probability
  - information
depends-on:
  - "[[Probability distributions]]"
  - "[[Logarithms]]"
  - "[[Expectation]]"
---

# Entropy

Entropy measures the average uncertainty of a probability distribution. For a discrete distribution
$p$,

$$
H(p)=-\sum_x p(x)\log p(x).
$$

A distribution concentrated on one outcome has low entropy: little remains uncertain. A uniform
distribution over many outcomes has high entropy. The logarithm makes information from independent
events additive.

Entropy describes the distribution itself; it does not say whether its probabilities match reality.
[[Cross-entropy]] compares a target distribution with a predicted one. During generation,
Temperature changes the entropy of the model's next-token distribution: lower temperatures
usually concentrate probability, while higher temperatures spread it.

The unit depends on the logarithm base. Natural logarithms give nats; base-two logarithms give bits.
Machine-learning losses generally use natural logs, but the optimization behavior is the same up to
a constant scale.
