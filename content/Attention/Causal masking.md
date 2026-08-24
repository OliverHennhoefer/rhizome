---
title: Causal masking
aliases:
  - Causal mask
  - Autoregressive mask
types: mechanism
tags:
  - attention
  - language
depends-on:
  - "[[Autoregressive factorization]]"
  - "[[Attention scores and weights]]"
  - "[[Shape and dimension]]"
---

# Causal masking

Causal masking prevents a token position from attending to future positions. In a score matrix, the
allowed region is lower triangular: position $t$ can use positions $1$ through $t$, but not
$t+1$ onward.

Before softmax, forbidden scores receive a value equivalent to $-\infty$. Their exponentials become
zero, so they receive no attention weight:

$$
M_{ij}=\begin{cases}
0 & j\le i,\\
-\infty & j>i.
\end{cases}
$$

The mask lets training process every sequence position in parallel without leaking the target token
into its own prediction. It therefore enforces the direction assumed by [[Next-token prediction]].

During one-token-at-a-time Inference, future tokens do not exist yet, but the same causal rule
still defines the architecture. Padding masks solve a different problem: hiding positions that do not
contain actual sequence data.
