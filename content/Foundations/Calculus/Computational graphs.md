---
title: Computational graphs
aliases:
  - Computational graph
types: mechanism
tags:
  - calculus
  - learning
depends-on:
  - "[[Variables and functions]]"
  - "[[Chain rule]]"
---

# Computational graphs

A computational graph represents a calculation as values connected by operations. For
$y=(ab+c)^2$, nodes can represent $a$, $b$, multiplication, addition, and the final square.

The forward pass evaluates nodes in dependency order and stores useful intermediate values. The
backward pass starts with the output sensitivity and applies the Chain rule through the graph.
When one value influences the result along several paths, its gradient contributions are added.

Modern tensor libraries build this graph while model code runs. Matrix multiplication, softmax,
normalization, and every other differentiable operation contributes a local backward rule.
[[Backpropagation]] then traverses the recorded structure in reverse.

This graph is about numerical computation, not the Rhizome knowledge graph. The former explains how
gradients flow inside one training step; the latter explains how concepts depend on one another.
