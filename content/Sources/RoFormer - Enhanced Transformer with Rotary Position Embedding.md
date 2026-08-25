---
title: "RoFormer: Enhanced Transformer with Rotary Position Embedding"
aliases:
  - RoFormer paper
  - arXiv 2104.09864
types: source
tags:
  - attention
  - transformer
  - paper
---

# RoFormer: Enhanced Transformer with Rotary Position Embedding

**Authors:** Jianlin Su and colleagues

**Source:** [arXiv:2104.09864](https://arxiv.org/abs/2104.09864)

RoFormer introduces rotary position embedding, or RoPE, as a way to inject sequence position into
self-attention. Instead of adding a position vector to each token representation, RoPE rotates
pairs of query and key coordinates by angles determined by their absolute positions.

Because attention compares the rotated queries and keys through dot products, their interaction
depends explicitly on relative displacement. The construction therefore encodes absolute position
through each rotation while exposing relative position in the resulting attention score.

The paper analyzes properties including flexible sequence length and distance-sensitive token
interactions, then evaluates RoFormer on long-text classification tasks. RoPE subsequently became a
widely used form of [[Rotary position embeddings|position information]] in decoder language models.
