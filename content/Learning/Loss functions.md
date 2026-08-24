---
title: Loss functions
aliases:
  - Loss function
  - Objective function
types: concept
tags:
  - learning
depends-on:
  - "[[Models and predictions]]"
  - "[[Expectation]]"
---

# Loss functions

A loss function converts prediction quality into a scalar that optimization can minimize. If
$\hat{y}$ is a prediction and $y$ its target, the loss is written $\mathcal{L}(\hat{y},y)$.

The choice of loss defines what “better” means. Next-token language models use
[[Cross-entropy]], which penalizes low probability on the observed next token. A training step often
averages this loss across token positions and examples:

$$
\mathcal{L}_\text{batch}=\frac{1}{N}\sum_{i=1}^{N}\mathcal{L}_i.
$$

Because the loss is scalar, its gradient gives one coherent update direction for every
parameter. Gradient descent then seeks parameters with lower loss.

Low training loss is not the final goal by itself. A model can memorize examples without
generalizing, and a numerical objective only approximates the behavior people
ultimately care about.
