---
title: Tokens
aliases:
  - Token
types: concept
tags:
  - language
depends-on:
  - "[[Text corpora and sequences]]"
---

# Tokens

A token is one discrete unit processed by a language model. It may represent a whole word, part of a
word, punctuation, whitespace, or a byte-level fragment. Tokens are determined by a
[[Tokenization|tokenizer]], not by a universal linguistic boundary.

The text `unbelievable` might be one token in one vocabulary and several subword tokens in another.
This affects sequence length, available context, and which patterns share parameters.

Inside the model, each token is represented first by an integer ID and then by an
embedding vector. The model predicts another token ID through a distribution
over its vocabulary.

Tokens should not be casually equated with words. Costs, context limits, and probabilities are
usually measured in tokens, and the number of tokens per word varies across languages and writing
systems.
