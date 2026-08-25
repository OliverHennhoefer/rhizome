---
title: Root Mean Square Layer Normalization
aliases:
  - RMSNorm paper
  - arXiv 1910.07467
types: source
tags:
  - neural-network
  - normalization
  - paper
---

# Root Mean Square Layer Normalization

**Authors:** Biao Zhang and Rico Sennrich

**Source:** [arXiv:1910.07467](https://arxiv.org/abs/1910.07467)

This paper asks whether layer normalization needs to subtract the mean of its inputs. It proposes
RMSNorm, which divides activations by their root mean square but does not recenter them around zero.
The operation preserves the rescaling invariance associated with normalization while requiring less
computation.

The authors also describe partial RMSNorm, which estimates the root mean square from only a portion
of the input dimensions. Across the paper's tested architectures and tasks, RMSNorm achieved
performance comparable to LayerNorm while reducing runtime by amounts that varied from 7 to 64
percent.

RMSNorm is especially relevant to modern pre-normalized Transformers, where it provides a simpler
alternative to [[Layer normalization]]. The paper supplies the direct basis for the
[[RMS normalization]] mechanism described in this graph.
