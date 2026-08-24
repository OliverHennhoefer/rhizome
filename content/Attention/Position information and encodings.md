---
title: Position information and encodings
aliases:
  - Position information
  - Positional encoding
  - Position embedding
types: mechanism
tags:
  - attention
  - transformer
depends-on:
  - "[[Text corpora and sequences]]"
  - "[[Embeddings]]"
  - "[[Vector operations]]"
---

# Position information and encodings

Self-attention alone treats its input as a set: permuting token positions would permute outputs in the
same way. Language requires order, so the model must receive position information.

The original Transformer adds sinusoidal vectors to token embeddings. Learned absolute position
embeddings instead assign each position a trainable vector. Relative schemes encode distances or
modify attention scores so relationships depend on how far positions are apart.

Adding a positional vector preserves model width:

$$
\mathbf{h}_t^{(0)}=\mathbf{e}_{x_t}+\mathbf{p}_t.
$$

$\mathbf{e}_{x_t}$ is the token embedding and $\mathbf{p}_t$ carries position $t$. Because addition
mixes both into one representation, later projections can use token and position jointly.

Position design affects extrapolation beyond training lengths and effective use of a long
[[Context window]]. Many modern decoder models use Rotary position embeddings, which encode
relative offsets through query and key rotations.
