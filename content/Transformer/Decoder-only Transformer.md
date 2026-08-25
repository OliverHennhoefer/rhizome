---
title: Decoder-only Transformer
aliases:
  - Causal Transformer
  - GPT-style Transformer
types: architecture
tags:
  - transformer
  - language-model
depends-on:
  - "[[Transformer block]]"
  - "[[Causal masking]]"
  - "[[Embedding lookup]]"
  - "[[Position information and encodings]]"
  - "[[Output projection and tied embeddings]]"
supported-by:
  - "[[Sources/Attention Is All You Need]]"
---

# Decoder-only Transformer

A decoder-only Transformer maps a token prefix to next-token logits. It begins with token embeddings
and position information, passes them through a stack of causally masked Transformer blocks, then
projects the final hidden states to the vocabulary.

“Decoder-only” distinguishes this stack from encoder-decoder architectures that use a separate input
encoder and cross-attention. Here every block uses causal self-attention over one evolving sequence.

During training, the model processes many positions in parallel because the mask prevents future
leakage. During [[Inference]], it extends the sequence one token at a time while a KV cache avoids
recomputing earlier keys and values.

The architecture defines a family of functions, not a complete model. Width, depth, number of heads,
normalization, position method, tokenizer, parameters, and training data all remain choices.
Pretraining turns one initialized member of this family into a language model.
