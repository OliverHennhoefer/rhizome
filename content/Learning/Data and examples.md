---
title: Data and examples
aliases:
  - Dataset
  - Training example
types: concept
tags:
  - learning
  - data
---

# Data and examples

Learning needs examples of the behavior a model should capture. For language modeling, the raw data
are text documents. [[Tokenization]] turns them into token sequences that can be divided into
training examples.

An example typically contains a context and target tokens. From the sequence `[the, cat, sat]`, the
model can learn that `[the, cat]` is context for the target `sat`. In practice, one sequence supplies
many adjacent next-token predictions at once.

The model never receives “meaning” directly. It observes statistical regularities in the examples:
which tokens co-occur, which patterns repeat, and which continuations are likely under different
contexts. Data composition therefore shapes what representations can be
learned.

Training, validation, and test partitions serve different purposes. Training examples update
parameters; held-out examples estimate Generalization without being used for those updates.
