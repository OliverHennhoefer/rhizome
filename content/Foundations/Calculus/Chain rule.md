---
title: Chain rule
types: foundation
tags:
  - calculus
depends-on:
  - "[[Derivatives]]"
  - "[[Multiplication]]"
  - "[[Variables and functions]]"
---

# Chain rule

The chain rule differentiates composed functions. If $u=g(x)$ and $y=f(u)$, then

$$
\frac{dy}{dx}=\frac{dy}{du}\frac{du}{dx}.
$$

Each factor is a local sensitivity. Their product tells how a change in $x$ travels through the
intermediate value $u$ to affect $y$.

A deep network is a long composition: linear transformations feed activations, which feed attention
and more layers, until logits produce a loss. The chain rule lets the final loss gradient propagate
back through every operation. Shared paths cause contributions to be added, while serial paths cause
local derivatives to be multiplied.

[[Backpropagation]] is an efficient procedure for applying this rule over a
computational graph. It reuses intermediate results rather than expanding
one enormous symbolic derivative. This is why every differentiable component must define both its
forward calculation and how gradients pass backward through it.
