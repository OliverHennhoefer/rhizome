---
title: Mini-batches and stochastic gradient descent
aliases:
  - Mini-batch
  - SGD
  - Stochastic gradient descent
types: mechanism
tags:
  - learning
  - optimization
depends-on:
  - "[[Gradient descent]]"
  - "[[Data and examples]]"
  - "[[Expectation]]"
---

# Mini-batches and stochastic gradient descent

The exact gradient over an entire corpus is too expensive to compute for every update. Stochastic
gradient descent estimates it from a small sample. A **mini-batch** groups several examples and
averages their gradients:

$$
\hat{g}=\frac{1}{B}\sum_{i=1}^{B}\nabla_\theta\mathcal{L}_i.
$$

Here $B$ is batch size. Larger batches usually give a less noisy estimate but require more memory
and computation per update. Smaller batches inject more sampling noise, which can be useful or
destabilizing.

Batching also makes [[Matrix multiplication]] efficient because hardware processes many examples in
parallel. Sequence length and padding affect how much of that work contains useful tokens.

In common speech, “SGD” may mean the plain optimizer or the broader practice of mini-batch updates.
Large language models usually use mini-batches with an adaptive optimizer such as AdamW.
