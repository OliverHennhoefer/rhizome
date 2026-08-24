---
title: Queries, keys, and values
aliases:
  - QKV
  - Query
  - Key
  - Value
types: component
tags:
  - attention
depends-on:
  - "[[Linear layers]]"
  - "[[Learned representations]]"
---

# Queries, keys, and values

Attention derives three vectors from each hidden state through learned projections:

$$
Q=XW_Q,\qquad K=XW_K,\qquad V=XW_V.
$$

A **query** represents what a position is looking for. A **key** represents how another position can
be matched. A **value** represents the information returned if that position receives weight.

The distinction is functional, not a fixed semantic labeling. Training learns all three projection
matrices solely through their contribution to the final next-token loss. Different heads can develop
different matching patterns.

Queries and keys interact through [[Dot product|dot products]] to create
scores. The normalized scores then form a weighted sum of values.
Keeping keys separate from values lets “where to read” use different features from “what to retrieve.”
