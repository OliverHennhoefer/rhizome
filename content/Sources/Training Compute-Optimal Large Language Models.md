---
title: Training Compute-Optimal Large Language Models
aliases:
  - Chinchilla paper
  - arXiv 2203.15556
types: source
tags:
  - transformer
  - learning
  - paper
---

# Training Compute-Optimal Large Language Models

**Authors:** Jordan Hoffmann and colleagues

**Source:** [arXiv:2203.15556](https://arxiv.org/abs/2203.15556)

This study asks how a fixed training-compute budget should be divided between model parameters and
training tokens. Its experiments cover more than 400 language models, ranging from 70 million to
more than 16 billion parameters and from 5 to 500 billion training tokens.

The central result is that compute-optimal training scales model size and token count together:
doubling the number of parameters should be accompanied by roughly twice as many training tokens.
This challenged the then-common practice of making models larger while holding the amount of data
comparatively fixed.

The authors tested the prediction with Chinchilla, a 70-billion-parameter model trained on four
times as much data as the larger Gopher model for the same compute budget. Chinchilla performed
better across the paper's evaluated tasks, making the work a key empirical basis for modern
[[Scaling laws|compute-optimal scaling]].
