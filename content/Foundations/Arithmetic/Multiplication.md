---
title: Multiplication
types: foundation
tags:
  - arithmetic
depends-on:
  - "[[Scalars]]"
  - "[[Addition]]"
---

# Multiplication

Multiplication scales one quantity by another. For positive integers, $3\times4$ can be read as four
copies of three; for real numbers, the same operation also handles fractions, signs, and continuous
scaling.

Multiplication is reused throughout a language model. [[Vector operations]] scale vectors,
dot products multiply matching entries before adding them, and
Matrix multiplication arranges many multiply-and-add operations into one transformation.
Probabilities multiply in a joint probability, while the
Chain rule multiplies local derivatives to propagate sensitivity through a computation.

A product may express interaction. In $y=wx$, the scalar $w$ controls how strongly $x$ affects
$y$. Learning changes weights like $w$ so those interactions produce better predictions. Hardware
accelerators spend much of their time evaluating these products in large batches.

Multiplication is therefore not connected directly to “the Transformer” as a shortcut. It becomes a
high-degree foundation because many intermediate concepts genuinely depend on it.
