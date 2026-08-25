---
title: Start here
types: map
tags:
  - overview
---

# Start here

A modern language model is not one mysterious algorithm. It is a layered construction made from
ordinary mathematical operations, a learning procedure, and an architecture for moving information
through a sequence.

Begin with [[Multiplication]] if the equations are unfamiliar. The shortest conceptual route is:

1. [[Matrix multiplication]] combines many numbers at once.
2. [[Gradient descent]] changes parameters to reduce a [[Loss function|loss]].
3. [[Embeddings]] turn discrete [[Tokens|tokens]] into learned vectors.
4. [[Scaled dot-product attention]] lets each token gather relevant context.
5. A [[Decoder-only Transformer]] stacks those operations.
6. [[Next-token prediction]] turns the stack into a [[Modern large language model]].

The graph is intentionally not a checklist. Concepts recur: [[Softmax and logits|softmax]] appears
in attention, training, and sampling; [[Residual connections]] help both optimization and information
flow; [[Exponentials]] connect probability, cross-entropy, and temperature. Follow incoming
relationships to see where a foundation is reused, or outgoing relationships to inspect what a
concept requires.

> [!tip] Reading the graph
>
> **Depends on** means a direct prerequisite. Ordinary links add context without claiming that one
> idea must be learned first.
