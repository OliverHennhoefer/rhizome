---
title: Regularization
types: concept
tags:
  - learning
depends-on:
  - "[[Loss functions]]"
  - "[[Parameters]]"
---

# Regularization

Regularization discourages a model from fitting training examples in brittle ways. It changes the
training process so performance on unseen data can improve, even if training loss becomes slightly
higher.

**Weight decay** gently shrinks selected parameter values during optimization. [[Dropout]] randomly
removes some activations during training. Large, diverse datasets and stopping at an appropriate
point can also limit overfitting without appearing as explicit penalty terms.

Regularization is not synonymous with making every parameter small. Different parameter groups—such
as biases and normalization scales—may be treated differently. AdamW decouples weight decay from
its adaptive gradient update.

The useful amount depends on data scale and model capacity. A method that helps a small dataset may
unnecessarily constrain large-scale Pretraining. The outcome of interest is Generalization,
not the presence of a particular technique.
