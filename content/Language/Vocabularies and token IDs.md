---
title: Vocabularies and token IDs
aliases:
  - Vocabulary
  - Token ID
types: concept
tags:
  - language
depends-on:
  - "[[Tokens]]"
---

# Vocabularies and token IDs

A vocabulary is the finite set of tokens a model can represent directly. Each entry receives an
integer token ID. If the vocabulary has size $V$, valid ordinary IDs lie in a range such as
$0$ through $V-1$.

Special entries can mark end-of-text, padding, or other structural roles. Their exact IDs and
meanings belong to the tokenizer-model pair; swapping a tokenizer without changing the model would
make every learned row refer to the wrong token.

IDs are labels, not measurements. Token 500 is not numerically “more” than token 20. Their useful
geometry begins only after [[Embedding lookup]] maps them to vectors.

At the output, one logit is produced for each vocabulary entry. Vocabulary
size therefore affects both the embedding table and the cost of the final output projection. A
larger vocabulary can shorten sequences but creates more output alternatives.
