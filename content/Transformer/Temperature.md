---
title: Temperature
types: mechanism
tags:
  - probability
  - inference
depends-on:
  - "[[Softmax and logits]]"
  - "[[Sampling]]"
  - "[[Entropy]]"
---

# Temperature

Temperature rescales logits before softmax:

$$
p_i(T)=\frac{e^{z_i/T}}{\sum_j e^{z_j/T}},
\qquad T>0.
$$

When $T<1$, logit differences are enlarged and the distribution becomes more concentrated. When
$T>1$, differences shrink and the distribution becomes flatter. As $T$ approaches zero, sampling
approaches greedy selection.

Temperature does not add knowledge or directly control factuality. It changes how strongly sampling
prefers the model's current ranking. If the logits favor an incorrect token, lowering temperature can
make that mistake more deterministic.

The effect depends on the original distribution and interacts with [[Top-k and nucleus sampling]].
It applies during Inference; training cross-entropy ordinarily uses the model's unadjusted logits.
Temperature is therefore a decoding control, not a measure of model confidence.
