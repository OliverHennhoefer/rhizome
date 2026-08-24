---
title: Summation notation
aliases:
  - Sigma notation
types: foundation
tags:
  - arithmetic
depends-on:
  - "[[Addition]]"
  - "[[Variables and functions]]"
---

# Summation notation

Summation notation compresses repeated addition. The expression

$$
\sum_{i=1}^{n} x_i=x_1+x_2+\cdots+x_n
$$

means “add the values $x_i$ while the index $i$ runs from $1$ through $n$.” The index is local: it
identifies which element is currently being used, not a learned model parameter.

Sums appear in [[Dot product|dot products]], Matrix multiplication, averages, normalization, and
losses over a batch. A weighted sum $\sum_i a_i v_i$ scales each value $v_i$ by a weight $a_i$ before
adding. Attention uses exactly this pattern to combine information from different token
positions.

The notation can hide computational scale. A compact sum over vocabulary items may involve tens of
thousands of terms, while nested sums can express millions of multiply-and-add operations. Reading
the index bounds and the meaning of each indexed quantity makes the operation concrete.
