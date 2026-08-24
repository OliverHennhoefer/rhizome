---
title: Probability
types: foundation
tags:
  - probability
depends-on:
  - "[[Scalars]]"
  - "[[Addition]]"
---

# Probability

Probability quantifies uncertainty. A probability lies between $0$ and $1$: zero means an event is
impossible under the model, one means it is certain, and intermediate values express degrees of
belief or long-run frequency.

For mutually exclusive outcomes $x_1,\ldots,x_n$, valid probabilities satisfy

$$
p(x_i)\ge 0,
\qquad
\sum_{i=1}^{n}p(x_i)=1.
$$

A language model does not output one fixed next word. It produces a
[[Probability distributions|distribution]] over every token in its vocabulary. The probabilities
describe the model's uncertainty given the current context, not objective truth.

Addition combines probabilities of mutually exclusive alternatives. Joint and conditional probability
uses multiplication to connect sequential events. Softmax converts arbitrary
real-valued logits into numbers that satisfy the probability rules.
