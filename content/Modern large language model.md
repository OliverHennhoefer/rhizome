---
title: Modern large language model
aliases:
  - LLM
  - Large language model
types: model
tags:
  - language-model
  - transformer
depends-on:
  - "[[Decoder-only Transformer]]"
  - "[[Next-token prediction]]"
  - "[[Pretraining]]"
  - "[[Inference]]"
  - "[[Scaling laws]]"
---

# Modern large language model

A large language model is a parameterized probability model for text. Given tokens
$x_1,\ldots,x_t$, it produces a distribution for the next token:

$$
p(x_{t+1}\mid x_1,\ldots,x_t).
$$

“Large” means that the model, training data, and computation are scaled far enough for the learned
representations to capture broad regularities of language. It does not introduce a new mathematical
primitive. The model still consists mostly of matrix multiplications,
normalization, nonlinearities, and attention.

During Pretraining, billions of next-token examples adjust the model's parameters
through Backpropagation and an optimizer such as AdamW. During Inference, the same model
reuses a growing context and repeatedly samples or selects another token.

Current designs often refine the basic Transformer with [[Rotary position embeddings]],
[[RMS normalization]], [[Gated MLPs and SwiGLU]], [[Grouped-query attention]], or
[[Mixture of experts]]. These are important engineering choices, not requirements in the definition
of an LLM. The durable core is the path from arithmetic to learned conditional probabilities.
