---
title: Backpropagation
aliases:
  - Backprop
types: mechanism
tags:
  - learning
  - calculus
depends-on:
  - "[[Computational graphs]]"
  - "[[Chain rule]]"
  - "[[Loss functions]]"
---

# Backpropagation

Backpropagation computes the gradient of a scalar loss with respect to every parameter efficiently.
It first evaluates the model forward, recording intermediate values, then traverses the computational
graph backward.

At each operation, an incoming gradient says how the final loss depends on that operation's output.
The operation's local derivative converts it into gradients for its inputs. The Chain rule
composes these local sensitivities; branches add gradient contributions.

Reverse-mode differentiation is well suited to neural networks because there is one scalar loss and
many parameters. One backward traversal obtains all parameter gradients at a cost comparable to a
small multiple of the forward pass.

Backpropagation computes gradients; it does not decide the update. An [[Optimizers|optimizer]] such as
AdamW consumes those gradients. Nor does “backward” mean information literally flows backward
during Inference—the backward pass exists for learning.
