---
title: "How Transformers Work: Attention Is All You Need, Explained"
date: 2026-04-20
draft: false
tags: ["deep-learning", "transformer", "NLP", "math"]
math: true
ShowToc: true
TocOpen: true
description: "A from-scratch walkthrough of the Transformer architecture — self-attention, multi-head attention, positional encoding, and why it replaced RNNs."
---

The 2017 paper *Attention Is All You Need* changed NLP forever. Before it, sequence models meant RNNs or LSTMs — sequential, slow, and bad at long-range dependencies. The Transformer threw all of that out and replaced it with pure attention. This post walks through the key components with the actual math.

## The Problem with RNNs

An RNN processes tokens one at a time. To compute the hidden state at step $t$, you need the state at $t-1$:

$$h_t = f(W_h h_{t-1} + W_x x_t + b)$$

This means:
- **No parallelism** — you can't compute $h_{10}$ until you have $h_9$
- **Vanishing gradients** — gradients shrink exponentially over long sequences
- **Long-range forgetting** — information from position 1 barely survives to position 100

Transformers solve all three by computing all positions simultaneously using attention.

---

## Scaled Dot-Product Attention

The core operation. Given three matrices — **Queries** $Q$, **Keys** $K$, and **Values** $V$ — attention is:

$$\text{Attention}(Q, K, V) = \text{softmax}\!\left(\frac{QK^\top}{\sqrt{d_k}}\right) V$$

where $d_k$ is the dimension of the key vectors.

**Intuition:** For each query (a token asking "what do I need?"), compute a dot product with every key (every token advertising "what I contain"). Softmax turns those scores into a probability distribution. Then take a weighted sum of the values.

**Why divide by $\sqrt{d_k}$?** Without scaling, when $d_k$ is large the dot products grow large in magnitude, pushing softmax into regions with near-zero gradients. Dividing by $\sqrt{d_k}$ keeps the variance of the dot product at ~1 regardless of dimension.

Formally, if $q$ and $k$ are independent random vectors with zero mean and unit variance, then:

$$\text{Var}(q \cdot k) = \sum_{i=1}^{d_k} \text{Var}(q_i k_i) = d_k$$

So $\text{Std}(q \cdot k) = \sqrt{d_k}$, and dividing by it re-normalizes to unit variance.

---

## Multi-Head Attention

A single attention head lets each token attend to the whole sequence — but it can only capture one type of relationship at a time. Multi-head attention runs $h$ attention heads in parallel:

$$\text{MultiHead}(Q, K, V) = \text{Concat}(\text{head}_1, \ldots, \text{head}_h)\, W^O$$

where each head is:

$$\text{head}_i = \text{Attention}(Q W_i^Q,\; K W_i^K,\; V W_i^V)$$

The projection matrices $W_i^Q \in \mathbb{R}^{d_{\text{model}} \times d_k}$, $W_i^K \in \mathbb{R}^{d_{\text{model}} \times d_k}$, $W_i^V \in \mathbb{R}^{d_{\text{model}} \times d_v}$, and $W^O \in \mathbb{R}^{h d_v \times d_{\text{model}}}$ are all learned.

In the original paper: $d_{\text{model}} = 512$, $h = 8$, $d_k = d_v = 64$.

**Why multiple heads?** Different heads learn different relationships. In practice, some heads attend to syntactic structure, others to coreference, others to positional proximity. A single head would have to average all of these.

---

## Positional Encoding

Attention is permutation-invariant — shuffle the input tokens and you get the same output (just shuffled). The model has no notion of order. We fix this by injecting positional information.

The original Transformer uses sinusoidal encoding:

$$PE_{(pos,\, 2i)} = \sin\!\left(\frac{pos}{10000^{2i/d_{\text{model}}}}\right)$$

$$PE_{(pos,\, 2i+1)} = \cos\!\left(\frac{pos}{10000^{2i/d_{\text{model}}}}\right)$$

where $pos$ is the token index and $i$ ranges over the embedding dimension.

This has a nice property: the relative position between two tokens can be expressed as a linear function of their encodings. Specifically, $PE_{pos+k}$ can be written as a linear transformation of $PE_{pos}$, so the model can learn to attend by relative offset.

Modern models (like BERT, GPT) use **learned** positional embeddings instead — a trainable matrix $E \in \mathbb{R}^{T \times d_{\text{model}}}$ where $T$ is max sequence length.

---

## The Full Encoder Block

Each encoder layer has two sub-layers:

1. **Multi-Head Self-Attention**
2. **Position-wise Feed-Forward Network**

Each sub-layer is wrapped in a residual connection + layer norm:

$$x \leftarrow \text{LayerNorm}(x + \text{Sublayer}(x))$$

The FFN is a simple two-layer MLP applied independently to each position:

$$\text{FFN}(x) = \max(0,\; xW_1 + b_1)\,W_2 + b_2$$

with inner dimension $d_{ff} = 2048$ in the original paper (4× the model dimension).

**Layer norm** normalizes across the feature dimension:

$$\text{LayerNorm}(x) = \frac{x - \mu}{\sigma + \epsilon} \odot \gamma + \beta$$

where $\mu$ and $\sigma$ are computed per token, and $\gamma$, $\beta$ are learned scale/shift parameters.

---

## The Decoder and Masked Attention

The decoder has three sub-layers:

1. **Masked Multi-Head Self-Attention** — same as encoder, but tokens can only attend to earlier positions
2. **Cross-Attention** — queries come from the decoder, keys/values come from the encoder output
3. **Feed-Forward Network**

The masking in (1) is implemented by adding $-\infty$ to positions that shouldn't be attended to before softmax:

$$\text{mask}_{ij} = \begin{cases} 0 & \text{if } i \geq j \\ -\infty & \text{if } i < j \end{cases}$$

After softmax, $e^{-\infty} = 0$, so those positions contribute nothing to the weighted sum. This prevents the model from "cheating" by looking at future tokens during training.

---

## Complexity Comparison

| Model | Time per layer | Sequential ops | Max path length |
|-------|---------------|----------------|-----------------|
| RNN | $O(n \cdot d^2)$ | $O(n)$ | $O(n)$ |
| CNN | $O(k \cdot n \cdot d^2)$ | $O(1)$ | $O(\log_k n)$ |
| **Transformer** | $O(n^2 \cdot d)$ | $O(1)$ | $O(1)$ |

The $O(n^2)$ in attention is the bottleneck for long sequences (it's why GPT-3 context windows were initially limited). Modern variants like FlashAttention, Longformer, and Mamba address this.

---

## Why It Works So Well

A few properties that make Transformers dominant:

- **Full parallelism** — every layer runs in $O(1)$ sequential steps, perfect for GPUs
- **Constant path length** — any two tokens interact directly in one layer, no degradation
- **Expressivity** — with enough heads and layers, attention can approximate any continuous function on sequences (universality results from 2019–2020)
- **Transfer learning** — scale up pre-training on unlabeled text, fine-tune on anything

The architecture has barely changed since 2017. GPT-4, LLaMA, Gemini — all Transformers.

---

## Further Reading

- [Attention Is All You Need](https://arxiv.org/abs/1706.03762) — the original paper
- [The Illustrated Transformer](https://jalammar.github.io/illustrated-transformer/) — best visual explanation I've found
- [FlashAttention](https://arxiv.org/abs/2205.14135) — IO-aware exact attention, 2–4× faster in practice
