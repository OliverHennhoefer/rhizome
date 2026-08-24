---
title: Softmax and logits
aliases:
  - Softmax
  - Logits
types: mechanism
tags:
  - neural-network
  - probability
depends-on:
  - "[[Exponentials]]"
  - "[[Probability distributions]]"
  - "[[Summation notation]]"
---

# Softmax and logits

Logits are unrestricted real-valued scores. Softmax converts a vector of logits $\mathbf{z}$ into a
probability distribution:

$$
\operatorname{softmax}(z_i)=\frac{e^{z_i}}{\sum_j e^{z_j}}.
$$

Exponentiation makes every numerator positive; division by their sum makes the outputs total one.
Adding the same constant to every logit leaves the probabilities unchanged, so stable implementations
subtract the maximum logit first.

Only differences between logits matter. A large gap creates a concentrated distribution; similar
logits produce a flatter one. [[Temperature]] rescales these gaps before softmax.

Softmax has two central uses in an LLM. Attention weights normalize
scores across token positions, while the final
output projection normalizes logits across vocabulary items. The axes differ, but the operation is the
same.
