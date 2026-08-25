---
title: "Switch Transformers: Scaling to Trillion Parameter Models with Simple and Efficient Sparsity"
aliases:
  - Switch Transformer paper
  - arXiv 2101.03961
types: source
tags:
  - transformer
  - mixture-of-experts
  - paper
---

# Switch Transformers: Scaling to Trillion Parameter Models with Simple and Efficient Sparsity

**Authors:** William Fedus, Barret Zoph, and Noam Shazeer

**Source:** [arXiv:2101.03961](https://arxiv.org/abs/2101.03961)

Switch Transformer simplifies sparse mixture-of-experts layers by routing each token to a single
expert. Different tokens can therefore use different parameter subsets while the computation per
token remains much smaller than activating the entire model.

The paper addresses practical obstacles in sparse models, including routing complexity,
communication cost, expert load balancing, and training instability. Its techniques enabled sparse
models to train with bfloat16 and produced substantial pretraining speed improvements in the
reported T5-based experiments.

The work also demonstrated models with up to a trillion parameters. The parameter count should not
be confused with dense computation: the essential idea is conditional activation, which is the
defining mechanism of a [[Mixture of experts]].
