---
title: Decoupled Weight Decay Regularization
aliases:
  - AdamW paper
  - arXiv 1711.05101
types: source
tags:
  - optimization
  - learning
  - paper
---

# Decoupled Weight Decay Regularization

**Authors:** Ilya Loshchilov and Frank Hutter

**Source:** [arXiv:1711.05101](https://arxiv.org/abs/1711.05101)

This paper distinguishes true weight decay from adding an $L_2$ penalty to the loss. The two
operations can be equivalent for ordinary stochastic gradient descent after accounting for the
learning rate, but that equivalence does not hold for adaptive optimizers such as Adam.

The proposed change applies parameter shrinkage separately from the loss-gradient update. This
decoupling produces the optimizer now called [[AdamW]] and makes the weight-decay setting less
entangled with the learning-rate setting.

The paper reports that decoupled weight decay improves Adam's generalization on its image
classification experiments and allows it to compete more closely with momentum SGD. Its lasting
contribution is the clean separation between optimizing the training objective and explicitly
shrinking parameter magnitudes.
