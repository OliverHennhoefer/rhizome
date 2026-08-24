---
title: Text corpora and sequences
aliases:
  - Text corpus
  - Sequence
  - Corpus
types: concept
tags:
  - language
  - data
depends-on:
  - "[[Data and examples]]"
---

# Text corpora and sequences

A corpus is a collection of text used as data. Documents have structure, but a language model
ultimately receives ordered sequences of [[Tokens|tokens]]. Order matters: “dog bites person” and
“person bites dog” contain similar tokens but express different relationships.

A sequence can be written $x_1,x_2,\ldots,x_T$, where $t$ indexes position and $T$ is its length.
Training divides long token streams into examples that fit the model's Context window. Boundaries,
special tokens, and packing rules determine which tokens can condition which targets.

Text quality, duplication, language mixture, and formatting influence what statistical patterns are
available to learn. The corpus is not a neutral container; it defines the empirical distribution
sampled by the Training loop.

Once tokenized, the model operates on IDs and vectors rather than characters or words directly.
Position information preserves where those items occur within each sequence.
