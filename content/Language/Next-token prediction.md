---
title: Next-token prediction
aliases:
  - Next token prediction
types: model
tags:
  - language
  - learning
depends-on:
  - "[[Language modeling]]"
  - "[[Autoregressive factorization]]"
  - "[[Cross-entropy]]"
  - "[[Softmax and logits]]"
---

# Next-token prediction

Next-token prediction trains a model to assign high probability to the token that actually follows a
context. For tokens $x_1,\ldots,x_T$, one sequence supplies targets at every position:

$$
\mathcal{L}=-\sum_{t=1}^{T}\log p_\theta(x_t\mid x_{<t}).
$$

The input and target are shifted versions of the same sequence. Causal masking prevents the model
from reading the target token or anything after it while making each prediction.

This objective is simple but demanding. Reducing loss requires learning regularities spanning
spelling, syntax, reference, style, facts, and recurring structures because all can influence the
next token. Shared parameters must support these predictions across many contexts.

During [[Pretraining]], teacher forcing provides every true preceding token in parallel. During
Inference, the model conditions on its own previously generated tokens, so errors can alter later
contexts.
