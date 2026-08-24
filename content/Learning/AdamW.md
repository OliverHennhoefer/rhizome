---
title: AdamW
types: mechanism
tags:
  - learning
  - optimization
depends-on:
  - "[[Optimizers]]"
  - "[[Regularization]]"
supported-by:
  - https://arxiv.org/abs/1711.05101
---

# AdamW

AdamW is an adaptive optimizer widely used for Transformer training. Adam maintains exponential
moving averages of the gradient $g_t$ and its square:

$$
m_t=\beta_1m_{t-1}+(1-\beta_1)g_t,
\qquad
v_t=\beta_2v_{t-1}+(1-\beta_2)g_t^2.
$$

After bias correction, the ratio $m_t/(\sqrt{v_t}+\epsilon)$ gives a momentum-smoothed, per-parameter
scaled update. This helps when gradient magnitudes differ across parameters.

The “W” identifies **decoupled weight decay**. Rather than folding the penalty into the adaptive
gradient, AdamW shrinks selected parameters separately. That makes the regularization strength more
predictable under adaptive scaling.

AdamW requires extra state for both moving averages, increasing training memory. Its effectiveness
also depends on [[Learning rate|learning-rate schedules]], batch size, numerical precision, and model
parameterization; it is a strong default, not a guarantee of stable training.
