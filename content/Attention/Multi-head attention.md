---
title: Multi-head attention
aliases:
  - MHA
types: component
tags:
  - attention
  - transformer
depends-on:
  - "[[Self-attention]]"
  - "[[Queries, keys, and values]]"
  - "[[Tensors]]"
---

# Multi-head attention

Multi-head attention runs several attention operations in parallel with different learned
projections. If model width is $d$ and there are $h$ heads, each head commonly uses width
$d_h=d/h$.

$$
\operatorname{MHA}(X)=
\operatorname{Concat}(\text{head}_1,\ldots,\text{head}_h)W_O.
$$

Separate heads can match different features or positional relationships. Their outputs are
concatenated and mixed through an output projection so later layers receive one vector per token.

The split does not guarantee clean human-interpretable roles, and heads can be redundant. Its value
is representational: the model gets several learned query-key-value subspaces within one sublayer.

Standard multi-head attention gives each head its own keys and values. [[Grouped-query attention]]
shares them across groups to reduce KV cache size during inference.
