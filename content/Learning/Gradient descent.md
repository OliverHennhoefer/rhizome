---
title: Gradient descent
types: mechanism
tags:
  - learning
  - optimization
depends-on:
  - "[[Gradients]]"
  - "[[Loss functions]]"
  - "[[Parameters]]"
---

# Gradient descent

Gradient descent updates parameters in the direction that locally reduces the loss. For parameters
$\theta$, learning rate $\eta$, and loss $\mathcal{L}$,

$$
\theta_{t+1}=\theta_t-\eta\nabla_\theta\mathcal{L}(\theta_t).
$$

The gradient points toward steepest increase, so the minus sign moves the other way. The learning
rate determines the step size.

This is a local method. A loss surface can curve, flatten, contain noisy directions, or vary greatly
across parameter scales. Consequently, practical training uses [[Mini-batches and stochastic gradient descent]]
and adaptive optimizers rather than exact plain gradient descent.

One update barely changes a large model. Learning emerges from many steps whose gradients are
estimated from different examples. Initialization, data order, normalization, and residual paths
all affect whether useful gradients can travel through the network.
