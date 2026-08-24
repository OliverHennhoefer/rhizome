---
title: Pretraining
types: mechanism
tags:
  - transformer
  - learning
depends-on:
  - "[[Decoder-only Transformer]]"
  - "[[Next-token prediction]]"
  - "[[Text corpora and sequences]]"
  - "[[Training loop]]"
---

# Pretraining

Pretraining fits a model on a broad text corpus before any narrower use. For a decoder-only language
model, it repeatedly minimizes next-token cross-entropy across token sequences.

The task supplies its own targets: each observed token is the target for the prefix before it. This
allows learning from large quantities of unlabeled text, although collecting and preparing that text
is substantial work.

As optimization progresses, shared parameters must support predictions across many contexts.
Useful [[Learned representations|representations]] emerge because syntax, reference, topic, factual
patterns, and document structure all help reduce the same objective.

Pretraining is expensive because it combines many parameters, tokens, and optimizer steps. Its result
is a base language model, not a database of copied passages or an assurance of truthful output.
Scaling laws describe broad empirical tradeoffs among the resources used.
