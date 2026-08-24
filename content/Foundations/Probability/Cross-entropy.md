---
title: Cross-entropy
aliases:
  - Cross entropy
types: foundation
tags:
  - probability
  - learning
depends-on:
  - "[[Entropy]]"
  - "[[Probability distributions]]"
  - "[[Logarithms]]"
---

# Cross-entropy

Cross-entropy measures how costly predictions from a distribution $q$ are when the target follows
$p$:

$$
H(p,q)=-\sum_x p(x)\log q(x).
$$

In next-token training, the target is usually one-hot: it assigns probability one to the observed
token and zero elsewhere. The sum then reduces to $-\log q(x_\text{target})$. Predicting the correct
token with probability $0.8$ costs about $0.22$ nats; assigning it probability $0.01$ costs about
$4.61$.

The model first produces [[Softmax and logits|logits]], which define $q$ through softmax. Cross-entropy
provides a differentiable loss, and Backpropagation calculates how every
parameter contributed to it.

Cross-entropy does not require the model to place all probability on one token. It rewards increasing
the probability of the observed continuation while retaining a full distribution over plausible
alternatives.
