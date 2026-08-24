---
title: Attention scores and weights
aliases:
  - Attention score
  - Attention weight
types: mechanism
tags:
  - attention
depends-on:
  - "[[Queries, keys, and values]]"
  - "[[Dot product]]"
  - "[[Softmax and logits]]"
---

# Attention scores and weights

An attention score measures the compatibility between one query and one key. Dot-product attention
uses $s_{ij}=\mathbf{q}_i\cdot\mathbf{k}_j$. Scores are logits: they can be any real values and only
their differences matter.

After scaling and masking, softmax converts the scores for one query into weights:

$$
a_{ij}=\frac{e^{s_{ij}}}{\sum_k e^{s_{ik}}}.
$$

The weights are non-negative and sum to one across available key positions. They determine the
weighted average of value vectors returned for the query.

A [[Causal masking|causal mask]] makes forbidden future positions behave as if their scores were
$-\infty$, giving them zero weight after softmax. Scaled dot-product attention combines scoring,
scaling, masking, normalization, and value aggregation into one operation.

Weights vary by input, layer, head, and query position. They describe routing inside the calculation,
not a complete measure of which input caused a final prediction.
