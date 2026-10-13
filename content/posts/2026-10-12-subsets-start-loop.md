---
title: "2026-10-12 子集回溯树学习笔记：节点的 start 和它自己的循环"
date: 2026-10-12
draft: false
tags: ["LeetCode", "回溯", "递归树", "子集", "学习笔记"]
math: true
ShowToc: true
TocOpen: true
description: "LC 78 子集画递归树时最容易错位的一点：每个节点都有「我的 start → 我的循环」和「循环里每个 i → 一个孩子」两件事，要分开看。附可逐步播放的动画、带缩进打印的验证代码和一张总表。中英双语。"
---

这篇接着上一篇 [回溯学习笔记](/posts/2026-10-12-backtracking/)。我在给 `nums = [1,2,3,4]` 画 [78. Subsets](https://leetcode.cn/problems/subsets/) 的递归树时，好几次把**节点**和**循环**对错了位置，比如把 `range(2,4)` 安到 `[1,2,3]` 头上。这篇把怎么对齐整理清楚。

This follows my earlier [backtracking note](/posts/2026-10-12-backtracking/). While drawing the recursion tree of LC 78 Subsets for `nums = [1,2,3,4]`, I kept attaching loops to the wrong nodes, for example putting `range(2,4)` on `[1,2,3]`. This note is about how to line them up.

一句话总结：

> **节点的 start 是几，它自己的循环就是 `range(几, 4)`。** 循环里的每个 `i` 产生一个孩子，孩子的 start 是 `i + 1`。

> **A node's own loop always uses its own start: `range(start, 4)`.** Each `i` in that loop makes one child, and that child's start is `i + 1`.

## 一、代码 · The Code

```python
from typing import List

class Solution:
    def subsets(self, nums: List[int]) -> List[List[int]]:
        res, path = [], []
        n = len(nums)

        def backtrack(start):
            res.append(path[:])            # 每个节点都是答案
            for i in range(start, n):      # 我自己的循环：用的是我的 start
                path.append(nums[i])       # 选 nums[i]
                backtrack(i + 1)           # 孩子的 start = i + 1
                path.pop()                 # 撤销

        backtrack(0)
        return res
```

代码里只有两处跟 start 有关，刚好对应两件事：

Only two spots in the code touch `start`, and they are exactly the two facts:

- `for i in range(start, n)`：**我的** start 决定**我的**循环。
- `backtrack(i + 1)`：每个 `i` 造一个孩子，并且把 `i + 1` 交给**孩子**当 start。

- `for i in range(start, n)`: **my** start decides **my** loop.
- `backtrack(i + 1)`: each `i` makes one child and hands `i + 1` to **the child** as its start.

> 下文的 `i` 都是**下标**。因为 `nums = [1,2,3,4]`，`nums[i] = i + 1`，所以「`i=1` → `[1,2]`」的意思是选了 `nums[1] = 2`。

> Throughout, `i` is an **index**. Since `nums = [1,2,3,4]`, `nums[i] = i + 1`, so "`i=1` → `[1,2]`" means we picked `nums[1] = 2`.

## 二、两件事要分开看 · Two Separate Facts per Node

每个节点身上都有两条信息，最容易把它们混在一起：

Every node carries two pieces of information, and the classic mistake is to blur them:

1. **我的 start → 我的循环**。例：`[1,2]` 的 start = 2 → `range(2,4)` → i ∈ {2, 3}。
2. **我的循环里每个 i → 一个孩子**。例：`[1,2]` 的 `i=2` → `[1,2,3]`，`i=3` → `[1,2,4]`。

1. **My start → my loop.** E.g. `[1,2]` has start = 2 → `range(2,4)` → i ∈ {2, 3}.
2. **Each i in my loop → one child.** E.g. for `[1,2]`, `i=2` → `[1,2,3]` and `i=3` → `[1,2,4]`.

而 `range(3,4)`、`range(4,4)` 是 `[1,2,3]`、`[1,2,4]` **自己的**循环，是孩子的，不是 `[1,2]` 的。

Meanwhile `range(3,4)` and `range(4,4)` are the **own** loops of `[1,2,3]` and `[1,2,4]`. They belong to the children, not to `[1,2]`.

## 三、动画：一个节点一个节点地对齐 · Animation: Lining Up Node by Node

动画按 DFS 顺序走完 16 个节点。每个节点分两步：先亮<span style="color:#f97316;font-weight:700">橙色</span>，是它自己和它自己的循环；再亮<span style="color:#6366f1;font-weight:700">紫色</span>，是循环里每个 `i` 造出的孩子，以及孩子们各自的循环。每个节点下面的小字就是它自己的 `range(start,4)`。也可以直接点树上任意一个节点跳过去。

The animation visits all 16 nodes in DFS order, two steps per node. First <span style="color:#f97316;font-weight:700">orange</span>: the node and its own loop. Then <span style="color:#6366f1;font-weight:700">purple</span>: the children each `i` makes, plus the children's own loops. The small text under each node is its own `range(start,4)`. You can also click any node to jump straight to it.

{{< bt-start nums="1,2,3,4" >}}

看动画时盯住一件事：**橙色的 range 永远写在橙色节点自己脚下**。紫色的 range 写在紫色孩子脚下，跟橙色节点没关系。

One thing to watch: **the orange range always sits under the orange node itself**. The purple ranges sit under the purple children and have nothing to do with the orange node.

## 四、以 [1] 为例完整展开 · Fully Expanded: [1]

```text
[1]        start=1   自己的循环 / own loop: range(1,4) → i ∈ {1,2,3}
├─ i=1 → [1,2]      start=2   range(2,4) → i ∈ {2,3}
│        ├─ i=2 → [1,2,3]    start=3   range(3,4) → i ∈ {3}
│        │        └─ i=3 → [1,2,3,4]  start=4  range(4,4) 空
│        └─ i=3 → [1,2,4]    start=4   range(4,4) 空
├─ i=2 → [1,3]      start=3   range(3,4) → i ∈ {3}
│        └─ i=3 → [1,3,4]    start=4   range(4,4) 空
└─ i=3 → [1,4]      start=4   range(4,4) 空
```

每一行的读法都一样：左边的 `i=k` 是**父亲**循环里的那一次，右边的 `range(...)` 是**这一行节点自己**的循环。

Every line reads the same way: the `i=k` on the left is one iteration of the **parent's** loop, and the `range(...)` on the right is **this line's own** loop.

## 五、我错位的地方 · Where I Got Shifted

| 我写的 / I wrote | 实际 / Actually |
|---|---|
| `[1]` 里面是 `(2,4)`、`(3,4)` | `[1]` 自己是 `range(1,4)`，它有 3 个孩子，孩子的循环分别是 `(2,4)`、`(3,4)`、`(4,4)`。漏了 `[1,4]` 的 `(4,4)` / it has three children; `[1,4]`'s `(4,4)` was missing |
| `(2,4)` 是 `[1,2,3]` 的，start=3 | `(2,4)` 属于 `[1,2]`，start=2 / belongs to `[1,2]` |
| `[1,2,3]` 里面是 `(3,4)` | ✓ 对，`[1,2,3]` 的 start=3 |
| `(3,4)` 里面是 `[1,2,4]`，start=4 | `[1,2,4]` 是 `[1,2]` 的 `(2,4)` 在 `i=3` 时产生的 / created by `[1,2]`'s loop at `i=3` |
| `[3]` 的孩子是 `(3,4)` | `range(3,4)` 是 `[3]` **自己的**循环。它唯一的孩子是 `[3,4]`，孩子的循环是 `(4,4)` / that's `[3]`'s own loop; its only child `[3,4]` has `(4,4)` |

最后一条最典型：我把「自己的循环」那一列当成了「孩子」那一列，错开了一格。

The last row is the textbook case: I read the "own loop" column as if it were the "children" column, one column off.

## 六、总表与规律 · The Table and the Pattern

把第一层四个节点放进一张表：

The four first-level nodes in one table:

| 节点 / Node | 自己的循环 / Own loop | 孩子 / Children | 孩子的循环 / Children's loops |
|---|---|---|---|
| `[1]` | `range(1,4)` | `[1,2]`、`[1,3]`、`[1,4]` | `(2,4)`、`(3,4)`、`(4,4)` |
| `[2]` | `range(2,4)` | `[2,3]`、`[2,4]` | `(3,4)`、`(4,4)` |
| `[3]` | `range(3,4)` | `[3,4]` | `(4,4)` |
| `[4]` | `range(4,4)` 空 / empty | 无（叶子）/ none (leaf) | — |

三条规律：

Three patterns:

1. **孩子个数 = 4 − start。** `[1]` 有 3 个，`[2]` 有 2 个，`[3]` 有 1 个，`[4]` 有 0 个。所以树**从左往右越来越瘦**，`[1]` 下面的子树最大，`[4]` 下面什么都没有。
2. **孩子的循环起点永远比父亲大。** 因为孩子的 start = `i + 1`，而 `i ≥ 父亲的 start`。这就是子集「不回头」、不会出现 `[2,1]` 的原因。
3. **孩子的循环一个比一个短。** `[2]` 的两个孩子，`(3,4)` 有 1 个选项，`(4,4)` 有 0 个。

1. **Number of children = 4 − start.** `[1]` has 3, `[2]` has 2, `[3]` has 1, `[4]` has 0, so the tree **gets thinner from left to right**: `[1]` has the biggest subtree and `[4]` has nothing under it.
2. **A child's range always starts later than its parent's**, because the child's start is `i + 1` and `i ≥ parent's start`. That is why subsets "never look back" and `[2,1]` can't appear.
3. **Sibling loops get shorter one by one.** For `[2]`'s children, `(3,4)` has 1 option and `(4,4)` has 0.

一般地，长度为 $n$ 的数组，start 为 $s$ 的节点有 $n - s$ 个孩子；整棵树共 $2^n$ 个节点，$n = 4$ 时正好 16 个子集。

In general, for an array of length $n$, a node with start $s$ has $n - s$ children, and the whole tree has $2^n$ nodes: 16 subsets when $n = 4$.

## 七、用代码自己验证 · Verify It Yourself

不确定的时候，让程序把每个节点和**它自己的**循环打印出来，缩进就是树的深度：

When in doubt, let the program print each node next to **its own** loop. The indentation is the depth in the tree:

```python
nums = [1, 2, 3, 4]
n = len(nums)
res, path = [], []

def backtrack(start, depth=0):
    res.append(path[:])
    own = list(range(start, n))
    print("    " * depth + f"{path}  start={start}  range({start},{n}) → i ∈ {own or '空'}")
    for i in range(start, n):
        path.append(nums[i])
        backtrack(i + 1, depth + 1)
        path.pop()

backtrack(0)
print("共", len(res), "个子集")
```

输出：

Output:

```text
[]  start=0  range(0,4) → i ∈ [0, 1, 2, 3]
    [1]  start=1  range(1,4) → i ∈ [1, 2, 3]
        [1, 2]  start=2  range(2,4) → i ∈ [2, 3]
            [1, 2, 3]  start=3  range(3,4) → i ∈ [3]
                [1, 2, 3, 4]  start=4  range(4,4) → i ∈ 空
            [1, 2, 4]  start=4  range(4,4) → i ∈ 空
        [1, 3]  start=3  range(3,4) → i ∈ [3]
            [1, 3, 4]  start=4  range(4,4) → i ∈ 空
        [1, 4]  start=4  range(4,4) → i ∈ 空
    [2]  start=2  range(2,4) → i ∈ [2, 3]
        [2, 3]  start=3  range(3,4) → i ∈ [3]
            [2, 3, 4]  start=4  range(4,4) → i ∈ 空
        [2, 4]  start=4  range(4,4) → i ∈ 空
    [3]  start=3  range(3,4) → i ∈ [3]
        [3, 4]  start=4  range(4,4) → i ∈ 空
    [4]  start=4  range(4,4) → i ∈ 空
共 16 个子集
```

每一行的 `range` 都和**同一行**的节点在一起，不会跑到上一行或下一行去。这就是「对齐」。

Each line's `range` sits next to the node **on that same line**, never the line above or below. That is what "lined up" means.

## 小结 · Summary

- 每个节点两件事：**我的 start → 我的循环**；**循环里每个 i → 一个孩子**。
- 孩子的 start = `i + 1`，所以孩子的循环永远从更右边开始。
- 孩子个数 = n − start，树从左到右越来越瘦，start = n 的节点是叶子。

- Two facts per node: **my start → my loop**, and **each i in that loop → one child**.
- A child's start is `i + 1`, so its loop always begins further right.
- Children = n − start; the tree thins out to the right, and a node with start = n is a leaf.
