---
title: Initialization
aliases:
  - Parameter initialization
types: mechanism
tags:
  - learning
  - optimization
depends-on:
  - "[[Parameters]]"
  - "[[Probability distributions]]"
---

# Initialization

Initialization chooses parameter values before learning begins. Setting every weight to the same
value would make many units behave identically, so weights are typically sampled from a zero-centered
distribution with a carefully chosen scale.

If initial values are too large, activations and gradients can explode through deep compositions. If
they are too small, signals can vanish. The appropriate variance depends on a layer's input and output
dimensions, activation function, residual structure, and normalization.

Embeddings, projection matrices, biases, and normalization scales may use different rules. Random
initialization also means two training runs can diverge even with the same data and code.

[[Residual connections]] and Layer normalization make deep Transformers less sensitive to
initialization, but do not eliminate the issue. A stable Training loop begins with compatible
choices across all three.
