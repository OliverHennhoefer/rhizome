---
title: Attention Is All You Need
aliases:
  - Transformer paper
  - arXiv 1706.03762
types: source
tags:
  - attention
  - transformer
  - paper
---

# Attention Is All You Need

**Authors:** Ashish Vaswani, Noam Shazeer, Niki Parmar, Jakob Uszkoreit, Llion Jones, Aidan N.
Gomez, Lukasz Kaiser, and Illia Polosukhin

**Source:** [arXiv:1706.03762](https://arxiv.org/abs/1706.03762)

This paper introduces the Transformer, an encoder-decoder sequence model built around attention
rather than recurrence or convolution. Its core operations include [[Scaled dot-product attention]],
multiple attention heads, position-wise feed-forward networks, residual connections, and
normalization.

Removing recurrence allows the model to process all positions in a training sequence in parallel.
The paper demonstrated both stronger translation quality and shorter training time than the
recurrent and convolutional systems used as its main comparisons.

The original architecture contains both an encoder and a decoder, whereas many modern language
models retain only the autoregressive decoder side. Even so, its attention formulation and
[[Transformer block]] established the foundation from which the [[Decoder-only Transformer]] was
developed.
