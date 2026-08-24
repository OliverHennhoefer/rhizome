---
title: Learning rate
types: concept
tags:
  - learning
  - optimization
depends-on:
  - "[[Gradient descent]]"
  - "[[Scalar multiplication|Vector operations]]"
---

# Learning rate

The learning rate $\eta$ scales each optimizer update. In basic gradient descent,
$\Delta\theta=-\eta\nabla_\theta\mathcal{L}$. It is a hyperparameter, not usually a learned model
parameter.

If the rate is too large, updates can overshoot useful regions or make training unstable. If it is
too small, progress may be extremely slow or stall in flat regions. The useful scale depends on the
optimizer, batch size, parameterization, and stage of training.

Training commonly uses a **schedule**. A short warm-up gradually raises the learning rate while early
activations and optimizer statistics stabilize. Later decay reduces the step size so optimization can
settle more precisely.

Adaptive methods such as [[AdamW]] rescale individual parameter updates, but they still have a global
learning rate. It remains one of the most consequential choices in a Training loop.
