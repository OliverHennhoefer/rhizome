---
title: Subword tokenization
aliases:
  - BPE
  - Byte pair encoding
types: mechanism
tags:
  - language
depends-on:
  - "[[Tokenization]]"
  - "[[Probability]]"
---

# Subword tokenization

Subword tokenization builds a vocabulary of reusable text fragments. Frequent words or fragments can
remain single tokens, while rare words are decomposed into smaller pieces.

Byte-pair encoding begins with small units and repeatedly merges frequent adjacent pairs. Unigram
tokenization instead starts with candidate pieces and selects segmentations using a probabilistic
model. Byte-level variants guarantee that arbitrary input can be represented without an unknown-word
token.

The result balances vocabulary size against sequence length. A tiny vocabulary produces long
sequences; a huge one consumes more embedding and output parameters while giving rare entries little
training evidence.

Subword pieces are not morphemes in a strict linguistic sense. Their boundaries reflect corpus
statistics and tokenizer rules. [[Embeddings]] learn how those pieces behave, while
Self-attention combines them contextually within the model.
