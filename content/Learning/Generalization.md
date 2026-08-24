---
title: Generalization
types: concept
tags:
  - learning
depends-on:
  - "[[Data and examples]]"
  - "[[Loss functions]]"
  - "[[Regularization]]"
---

# Generalization

Generalization is a model's ability to perform well on examples it did not train on. Training loss
measures fit to observed data; held-out validation loss estimates whether the learned patterns extend
beyond those examples.

A model can underfit because it lacks capacity or training, or overfit by memorizing details that do
not transfer. Model size alone does not determine which occurs. Data diversity, optimization,
regularization, and the match between training and evaluation distributions all matter.

Language models often exhibit useful transfer because [[Pretraining]] exposes them to many contexts
and forces shared representations to support next-token prediction across
them. This is still statistical generalization, not guaranteed reasoning or factual accuracy.

When the deployment context differs from the training data, even a low validation loss can mislead.
Generalization must always be interpreted relative to a specified distribution and task.
