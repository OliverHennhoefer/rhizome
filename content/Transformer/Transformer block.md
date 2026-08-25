---
title: Transformer block
aliases:
  - Transformer layer
types: architecture
tags:
  - transformer
depends-on:
  - "[[Multi-head attention]]"
  - "[[Feed-forward sublayer]]"
  - "[[Residual connections]]"
  - "[[Pre-normalization]]"
supported-by:
  - "[[Sources/Attention Is All You Need]]"
---

# Transformer block

A Transformer block updates every token representation through two main sublayers: attention and a
position-wise feed-forward network. In a common pre-normalized decoder block,

$$
H'=H+\operatorname{Attention}(\operatorname{Norm}(H)),
$$

$$
H''=H'+\operatorname{MLP}(\operatorname{Norm}(H')).
$$

Attention moves information between permitted token positions. The MLP transforms features at each
position independently. Residual additions preserve a shared stream through both operations.

One block has limited processing depth, so models stack many blocks. Later layers attend to hidden
states that already contain contextual information from earlier layers, allowing increasingly
composed transformations.

The formula names stable roles rather than one mandatory implementation. Normalization type,
activation, gating, attention grouping, and bias choices vary across models. [[Decoder-only Transformer]]
describes how these blocks become an autoregressive language model.
