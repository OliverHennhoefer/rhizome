---
title: Scaling laws
aliases:
  - Compute-optimal scaling
types: concept
tags:
  - transformer
  - learning
depends-on:
  - "[[Pretraining]]"
  - "[[Parameters]]"
  - "[[Data and examples]]"
  - "[[Loss functions]]"
supported-by:
  - "[[Sources/Training Compute-Optimal Large Language Models]]"
---

# Scaling laws

Scaling laws are empirical relationships between model loss and resources such as parameter count,
training tokens, and compute. Across broad ranges, loss often improves predictably as these resources
increase, with diminishing returns.

More parameters without enough data can be undertrained; more data without enough model capacity can
also waste compute. Compute-optimal studies estimate how to balance model size and token count for a
fixed training budget.

These laws explain the word “large” in LLM, but they are trends rather than architectural rules. They
depend on the model family, data, tokenizer, optimizer, and measured objective. Extrapolation beyond
the observed range remains uncertain.

Scaling lowers average prediction loss; it does not guarantee every capability, fact, or behavior.
The underlying model is still a [[Decoder-only Transformer]] trained by the same Training loop.
