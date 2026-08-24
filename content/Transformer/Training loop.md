---
title: Training loop
types: mechanism
tags:
  - transformer
  - learning
depends-on:
  - "[[Mini-batches and stochastic gradient descent]]"
  - "[[Backpropagation]]"
  - "[[Optimizers]]"
  - "[[Initialization]]"
---

# Training loop

The training loop repeats a small sequence of operations:

1. Sample and tokenize a mini-batch.
2. Run the model forward to produce logits.
3. Compute next-token cross-entropy.
4. Backpropagate gradients.
5. Let the optimizer update parameters.
6. Advance the learning-rate schedule and repeat.

Real systems add gradient accumulation, mixed-precision arithmetic, distributed communication,
checkpointing, validation, and failure recovery. These make large training feasible but do not change
the conceptual update.

The loop must keep numerical scales stable. Non-finite losses, exploding gradients, bad data, or an
overlarge learning rate can invalidate a run. Monitoring catches symptoms; architecture and
optimization choices address causes.

[[Pretraining]] applies this loop across a broad corpus. The browser does not run any of it—Rhizome
only visualizes the concepts and their dependencies.
