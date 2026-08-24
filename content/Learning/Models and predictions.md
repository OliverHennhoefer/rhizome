---
title: Models and predictions
aliases:
  - Model
  - Prediction
  - Target
types: concept
tags:
  - learning
depends-on:
  - "[[Variables and functions]]"
  - "[[Parameters]]"
  - "[[Data and examples]]"
---

# Models and predictions

A model is a parameterized function that turns an input into a prediction. Written abstractly,

$$
\hat{y}=f_\theta(x),
$$

where $x$ is the input, $\theta$ the parameters, and $\hat{y}$ the prediction. The hat distinguishes
a prediction from the observed target $y$.

For a language model, $x$ is a token context and the prediction is a
[[Probability distributions|distribution]] over the next token. The target is the token that
actually followed in the training text.

Learning compares prediction and target with a loss, then changes $\theta$ so
future predictions improve. The architecture restricts which functions can be represented;
Transformer layers provide a particularly effective family for
sequences.

A model output remains a statistical prediction. Even a high-probability continuation is not a
guarantee, and several continuations can be reasonable for the same context.
