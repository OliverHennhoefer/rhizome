---
title: Grouped-query attention
aliases:
  - GQA
  - Multi-query attention
  - MQA
types: component
tags:
  - attention
  - inference
  - modern-refinement
depends-on:
  - "[[Multi-head attention]]"
  - "[[Queries, keys, and values]]"
  - "[[KV cache]]"
supported-by:
  - "[[Sources/GQA - Training Generalized Multi-Query Transformer Models from Multi-Head Checkpoints]]"
---

# Grouped-query attention

Grouped-query attention uses many query heads but fewer key-value heads. Several query heads share
one set of keys and values. Standard multi-head attention has one key-value pair per query head;
multi-query attention shares one pair across all query heads; GQA lies between them.

Sharing reduces the key-value states stored and read during autoregressive decoding. This matters
because the KV cache can dominate inference memory bandwidth for long contexts and large batches.

The query heads remain separate, preserving multiple learned ways to ask for information. The grouped
keys and values trade some representational freedom for efficiency and often retain much of standard
multi-head attention's quality.

GQA changes an implementation detail inside attention, not the causal language-model objective. It
is a modern serving-oriented refinement layered on the same [[Scaled dot-product attention]]
calculation.
