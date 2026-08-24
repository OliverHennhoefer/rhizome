---
title: Matrices
aliases:
  - Matrix
types: foundation
tags:
  - linear-algebra
depends-on:
  - "[[Vectors]]"
  - "[[Shape and dimension]]"
---

# Matrices

A matrix is a rectangular array of scalars. A matrix with $m$ rows and $n$ columns is written
$A\in\mathbb{R}^{m\times n}$. Each row and each column can be viewed as a vector.

$$
A=\begin{bmatrix}1&2&3\\4&5&6\end{bmatrix}
$$

has shape $[2,3]$. A language model stores many learned [[Parameters|parameters]] as matrices. A
weight matrix determines how input features combine to form output features; a sequence of token
vectors is also commonly stored as a matrix.

Matrices support entrywise addition and scaling, but their defining operation is
Matrix multiplication. The transpose swaps rows with columns, often making the
desired dimensions line up.

Uppercase symbols such as $W$, $Q$, $K$, and $V$ often denote matrices. The letter hints at a role,
while the declared shape tells you what the operation can actually do.
