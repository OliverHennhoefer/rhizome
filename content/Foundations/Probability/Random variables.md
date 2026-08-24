---
title: Random variables
aliases:
  - Random variable
types: foundation
tags:
  - probability
depends-on:
  - "[[Probability]]"
  - "[[Variables and functions]]"
---

# Random variables

A random variable assigns a numerical value or category to an uncertain outcome. Before observing
the outcome, its value is unknown but governed by a probability distribution.

For a die roll, $X$ might take values $1$ through $6$. For language modeling, $X_{t+1}$ can denote
the next token. It is discrete: it takes one value from a finite [[Vocabularies and token IDs|vocabulary]].

Capital letters commonly denote random variables and lowercase letters observed values. Thus
$p(X=x)$ means the probability that the variable $X$ takes the particular value $x$.

A sequence $X_1,\ldots,X_T$ contains related random variables. Autoregressive factorization
models each next variable conditionally on the values already observed. During generation,
Sampling turns the model's distribution into one realized token and then repeats the process.
