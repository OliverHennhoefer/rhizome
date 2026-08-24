---
title: Attention
types: mechanism
tags:
  - attention
depends-on:
  - "[[Expectation]]"
  - "[[Learned representations]]"
  - "[[Softmax and logits]]"
---

# Attention

Attention lets one position gather information from a set of positions. It assigns a relevance weight
to each available value and returns their weighted sum:

$$
\mathbf{o}_i=\sum_j a_{ij}\mathbf{v}_j,
\qquad
\sum_j a_{ij}=1.
$$

$a_{ij}$ says how much position $i$ uses value $j$. Because the weights depend on the current input,
the same network can follow different relationships in different sequences.

The mechanism separates three roles: a [[Queries, keys, and values|query]] describes what the current
position seeks, keys describe what positions offer, and values contain the information to combine.
Attention scores and weights connect queries to keys.

Attention is not an explanation of model reasoning and its weights are not guaranteed causal
importance. Operationally, it is an input-dependent routing and aggregation mechanism used by
Self-attention inside each Transformer block.
