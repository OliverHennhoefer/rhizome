---
title: GLU Variants Improve Transformer
aliases:
  - SwiGLU paper
  - arXiv 2002.05202
types: source
tags:
  - neural-network
  - transformer
  - paper
---

# GLU Variants Improve Transformer

**Author:** Noam Shazeer

**Source:** [arXiv:2002.05202](https://arxiv.org/abs/2002.05202)

This paper studies gated linear units inside the Transformer's feed-forward sublayers. A GLU
multiplies two learned projections elementwise, using one path as a content-dependent gate for the
other. The original sigmoid gate can be replaced by other nonlinearities—or by a linear path—to
create a family of related activations.

The experiments compare these gated variants with the ReLU and GELU activations commonly used in
Transformer MLPs. Several variants improve model quality, showing that the feed-forward activation
is an important architectural choice rather than a minor implementation detail.

One tested variant uses the SiLU or Swish function and is now known as SwiGLU. The result directly
motivates the [[Gated MLPs and SwiGLU]] component used by many later language-model architectures.
