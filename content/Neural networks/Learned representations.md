---
title: Learned representations
aliases:
  - Representation
  - Hidden state
types: concept
tags:
  - neural-network
depends-on:
  - "[[Models and predictions]]"
  - "[[Vectors]]"
  - "[[Parameters]]"
---

# Learned representations

A representation is an internal numerical description that makes useful distinctions available to
later computation. In a language model, each token position carries a vector called a hidden state.

The entries are not manually assigned concepts. Training adjusts the network so distributed patterns
across many dimensions support lower next-token loss. Information about syntax, position, topic, or
other regularities may be recoverable from the vector without occupying one dedicated coordinate.

The first representations come from [[Embeddings]]. Each Transformer block then updates them by
combining context through attention and transforming features through an MLP. Residual connections
preserve an evolving stream across the stack.

Calling a vector a “representation” is a functional claim: downstream operations can use it. It does
not imply that every dimension has a simple human interpretation or that geometric similarity alone
captures the complete meaning.
