---
title: Optimizers
aliases:
  - Optimizer
types: mechanism
tags:
  - learning
  - optimization
depends-on:
  - "[[Gradient descent]]"
  - "[[Backpropagation]]"
  - "[[Learning rate]]"
---

# Optimizers

An optimizer turns gradients into parameter updates. Plain gradient descent uses the current gradient
directly. Practical optimizers maintain additional state to smooth noisy directions or adapt update
scales.

**Momentum** accumulates a moving average of past gradients, reducing oscillation and carrying
updates through shallow regions. Adaptive methods also track recent squared gradients, taking
smaller steps in consistently large-gradient directions and larger steps in small-gradient ones.

These mechanisms change optimization, not the model's forward function. Optimizer state is needed to
resume training but is discarded for ordinary [[Inference]]. It can occupy substantial memory—often
more than the parameters themselves.

AdamW is a common Transformer optimizer because it combines momentum-like estimates, adaptive
scaling, and decoupled weight decay. No optimizer removes the need for a suitable learning-rate
schedule, stable architecture, and well-formed data.
