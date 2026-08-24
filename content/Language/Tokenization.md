---
title: Tokenization
aliases:
  - Tokenizer
types: mechanism
tags:
  - language
depends-on:
  - "[[Text corpora and sequences]]"
  - "[[Tokens]]"
  - "[[Vocabularies and token IDs]]"
---

# Tokenization

Tokenization converts text into token IDs and reverses IDs back into text. It is a deterministic
preprocessing system paired with the model, not a learned Transformer layer.

A tokenizer must represent any supported input, preserve enough information for decoding, and avoid
sequences that are unnecessarily long. Normalization, whitespace handling, and special-token rules
are part of its behavior.

Word-level tokenization struggles with unseen words and enormous vocabularies. Character or byte
tokenization covers arbitrary text but produces long sequences. [[Subword tokenization]] provides a
practical middle ground by keeping frequent fragments together and decomposing rarer strings.

Token boundaries shape learning. A concept split into many fragments requires the model to compose
them across positions, while a frequent single token receives its own embedding row.
The tokenizer also determines how much text fits in the Context window.
