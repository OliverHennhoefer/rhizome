---
title: Output projection and tied embeddings
aliases:
  - Unembedding
  - LM head
  - Output projection
  - Weight tying
types: component
tags:
  - transformer
  - language
depends-on:
  - "[[Linear layers]]"
  - "[[Embeddings]]"
  - "[[Softmax and logits]]"
  - "[[Vocabularies and token IDs]]"
---

# Output projection and tied embeddings

The output projection maps a final hidden vector of width $d$ to $V$ vocabulary logits:

$$
\mathbf{z}=W_\text{out}\mathbf{h}+\mathbf{b},
\qquad
W_\text{out}\in\mathbb{R}^{V\times d}.
$$

Softmax turns these logits into next-token probabilities. Because this operation runs for each
predicted position, a large vocabulary makes it computationally significant.

**Weight tying** reuses the input embedding matrix as $W_\text{out}$. Input lookup and output scoring
then share one learned geometry: a token's row both represents it at the input and scores compatibility
with a final hidden state at the output.

Tying reduces parameter count and often improves learning, but it is an architectural choice rather
than a requirement. Either way, the projection closes the path from continuous
[[Learned representations|representations]] back to discrete tokens.
