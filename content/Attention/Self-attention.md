---
title: Self-attention
aliases:
  - Self attention
types: component
tags:
  - attention
  - transformer
depends-on:
  - "[[Scaled dot-product attention]]"
  - "[[Causal masking]]"
  - "[[Learned representations]]"
---

# Self-attention

Self-attention uses the same sequence as the source of queries, keys, and values. Each token
representation can therefore gather information from other positions in that sequence.

In a decoder-only model, the causal mask restricts each query to its own position and earlier ones.
The output at position $i$ is contextual: it depends not only on token $i$'s embedding, but also on
the relevant preceding hidden states.

Unlike a recurrence, self-attention has a short path between any permitted pair of positions and can
process all training positions in parallel. Its standard score matrix grows quadratically with
sequence length, creating the main pressure behind context-window efficiency work.

One attention pattern is limiting, so Transformers use [[Multi-head attention]]. Repeated
blocks also let later attention operate on representations already enriched by
earlier layers.
