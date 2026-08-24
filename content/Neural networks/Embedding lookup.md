---
title: Embedding lookup
types: mechanism
tags:
  - neural-network
  - language
depends-on:
  - "[[Embeddings]]"
  - "[[Vocabularies and token IDs]]"
---

# Embedding lookup

Embedding lookup selects rows from an embedding matrix using token IDs. If token ID $i$ occurs, the
model retrieves row $E_i$. A sequence of $t$ IDs becomes a matrix of shape $[t,d]$.

This is equivalent to multiplying a one-hot token vector by the embedding matrix, but direct indexing
avoids constructing a mostly zero vector:

$$
\operatorname{onehot}(i)^\mathsf{T}E=E_i.
$$

During [[Backpropagation]], only rows used by the current batch receive direct input-embedding
gradients. Over many examples, frequent and rare tokens accumulate very different amounts of
evidence.

Lookup does not inspect neighboring tokens. It supplies the initial hidden states that attention
contextualizes. Lookup itself adds no context. Some architectures reuse the same table in the final
output projection.
