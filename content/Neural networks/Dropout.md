---
title: Dropout
types: mechanism
tags:
  - neural-network
  - learning
depends-on:
  - "[[Regularization]]"
  - "[[Probability distributions]]"
  - "[[Learned representations]]"
---

# Dropout

Dropout randomly sets some activations to zero during training. If a unit is retained with probability
$q$, its retained value is typically divided by $q$ so the expected activation remains unchanged.

The changing masks prevent the network from relying on one exact collection of features for every
example. This can improve [[Generalization]], especially when data are limited or the model would
otherwise overfit.

Dropout is disabled during Inference; all activations are used. Its rescaling convention makes the
deterministic inference value match the expected training value without sampling masks.

The original Transformer applies dropout in several places, including attention weights and residual
branches. Some large-scale modern training regimes use little or none because abundant data provides
other regularizing effects. Dropout is therefore a general neural-network mechanism, not a defining
property of an LLM.
