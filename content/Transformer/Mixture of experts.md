---
title: Mixture of experts
aliases:
  - MoE
  - Sparse mixture of experts
types: component
tags:
  - transformer
  - modern-refinement
depends-on:
  - "[[Feed-forward sublayer]]"
  - "[[Softmax and logits]]"
  - "[[Parameters]]"
supported-by:
  - "[Switch Transformers: Scaling to Trillion Parameter Models with Simple and Efficient Sparsity](https://arxiv.org/abs/2101.03961)"
---

# Mixture of experts

A sparse mixture-of-experts layer contains several feed-forward “experts” and a learned router. For
each token, the router scores experts and activates only a small subset, often one or two.

This makes total parameter count much larger than the computation used for one token. Different
experts can specialize statistically, while the router learns which routes reduce the shared training
loss.

Routing introduces new problems. Tokens must be balanced across experts so one expert is not
overloaded, and distributed systems must move activations to the machines holding selected experts.
Auxiliary losses and capacity limits help manage these effects.

MoE usually replaces some dense feed-forward sublayers while leaving
attention, residual paths, and the autoregressive objective intact. It is therefore a scaling
refinement, not a separate foundation for all [[Modern large language model|modern LLMs]].
