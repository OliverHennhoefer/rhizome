---
title: "GQA: Training Generalized Multi-Query Transformer Models from Multi-Head Checkpoints"
aliases:
  - GQA paper
  - arXiv 2305.13245
types: source
tags:
  - attention
  - inference
  - paper
---

# GQA: Training Generalized Multi-Query Transformer Models from Multi-Head Checkpoints

**Authors:** Joshua Ainslie and colleagues

**Source:** [arXiv:2305.13245](https://arxiv.org/abs/2305.13245)

Multi-head attention gives every query head its own key and value heads, while multi-query
attention shares a single key-value head across all query heads. Sharing greatly reduces the
key-value cache and speeds decoder inference, but it can also reduce model quality.

This paper introduces grouped-query attention as an intermediate design. Several query heads share
each key-value head, retaining more key-value capacity than multi-query attention while requiring
less memory traffic than full multi-head attention.

The authors also describe uptraining existing multi-head checkpoints into MQA or GQA models using
about five percent of the original pretraining compute. In their experiments, uptrained GQA reaches
quality close to multi-head attention with speed comparable to MQA, motivating the modern
[[Grouped-query attention]] tradeoff.
