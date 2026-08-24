---
title: Embeddings
aliases:
  - Embedding
  - Token embedding
types: component
tags:
  - neural-network
  - language
depends-on:
  - "[[Learned representations]]"
  - "[[Vectors]]"
  - "[[Vocabularies and token IDs]]"
---

# Embeddings

An embedding maps a discrete item to a learned vector. For a vocabulary of size $V$ and model width
$d$, the embedding table is a matrix $E\in\mathbb{R}^{V\times d}$. Each row is one token's initial
representation.

Tokens with related uses may develop related geometric structure because similar contexts push their
parameters in related directions. This structure is learned from [[Next-token prediction]], not
encoded by the tokenizer.

An embedding is context-free at lookup time: the same token ID retrieves the same initial vector.
Contextual meaning emerges when Self-attention and MLP layers update that vector using surrounding
tokens.

Embeddings also demonstrate how symbolic and continuous computation meet. Tokens remain discrete
IDs for indexing and output, while the model's inner operations use vectors, matrices, derivatives,
and gradients.
