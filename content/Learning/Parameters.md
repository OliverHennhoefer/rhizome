---
title: Parameters
aliases:
  - Model parameters
  - Weights
types: concept
tags:
  - learning
depends-on:
  - "[[Scalars]]"
  - "[[Matrices]]"
---

# Parameters

Parameters are numerical values learned from data. They include the entries of weight matrices,
bias vectors, embedding tables, and normalization scales. A model may be written $f_\theta$ to show
that its behavior depends on the complete parameter collection $\theta$.

During a forward pass, parameters transform inputs into predictions. A [[Loss functions|loss]]
measures the prediction error, Backpropagation computes gradients with respect to each parameter,
and an optimizer updates them.

Parameters differ from **hyperparameters** such as learning rate, layer count, or model width. Those
settings control training or architecture but are not ordinarily learned by gradient descent in the
same run.

The number of parameters is one dimension of model scale, not a direct measure of quality. Their
architecture, training data, compute budget, and optimization determine what those values can
represent. Scaling laws study these relationships empirically.
