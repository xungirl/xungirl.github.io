---
title: "2026-10-19 LeetCode 230 self.k 写法的执行顺序学习笔记"
date: 2026-10-19
draft: false
tags: ["LeetCode", "BST", "中序遍历", "递归调用栈", "学习笔记"]
math: true
ShowToc: true
TocOpen: true
description: "用逐步图解看 LC 230 的 self.k 写法怎么执行：先一路向左钻到底，每个节点在自己的调用里减一次 k，以及找到答案后为什么还会「多减一次」。"
---

这篇是我重做 [230. Kth Smallest Element in a BST · 二叉搜索树中第 K 小的元素](https://leetcode.cn/problems/kth-smallest-element-in-a-bst/) 时整理的笔记。[上一篇](/posts/2026-10-09-lc230-kth-smallest-bst/)用的是 `nonlocal` 加剪枝的写法，这次换成 `self.k`、**不剪枝**的写法，重点看递归到底按什么顺序执行。

These are my notes from redoing LeetCode 230. [The previous post](/posts/2026-10-09-lc230-kth-smallest-bst/) used `nonlocal` with pruning. This time I use `self.k` with **no pruning**, and focus on the exact order in which the recursion runs.

一句话总结本质：

> 二叉搜索树（BST）的中序遍历（in-order traversal）是升序，所以**每个节点在自己的调用里把 k 减 1**，减到 0 的那个节点就是第 k 小。

In one sentence:

> A BST's in-order traversal is ascending, so **each node decrements k once, inside its own call**, and the node that brings k to 0 is the k-th smallest.

## 一、代码 / The code

```python
class Solution:
    def kthSmallest(self, root: Optional[TreeNode], k: int) -> int:
        self.k = k
        self.ans = None
        self.dfs(root)
        return self.ans

    def dfs(self, node):
        if node is None or self.k <= 0:
            return
        self.dfs(node.left)
        self.k -= 1           # visit node
        if self.k == 0:
            self.ans = node.val
        self.dfs(node.right)
```

为什么用 `self.k`：递归的每一层都要改**同一个**计数器。把它挂在实例属性上，所有调用共享它，效果和 `nonlocal k` 一样。

Why `self.k`: every level of the recursion needs to change the **same** counter. Storing it as an instance attribute makes all calls share it, which works the same way as `nonlocal k`.

注意这里的结构就是中序遍历的「左 → 根 → 右」：

The structure is exactly in-order "left → node → right":

- `self.dfs(node.left)`：先把左子树（更小的数）全部数完。
  First count the entire left subtree (the smaller values).
- `self.k -= 1`：访问当前节点，数一个。
  Visit the current node and count it.
- `self.dfs(node.right)`：再去右子树（更大的数）。
  Then go to the right subtree (the larger values).

开头的 `self.k <= 0` 只挡住**新的**调用。已经在调用栈上等着的那些层，回来之后还是会执行 `self.k -= 1`，这一点后面会看到。

The `self.k <= 0` check at the top only blocks **new** calls. Frames already waiting on the call stack still run `self.k -= 1` when control comes back to them, as we'll see below.

## 二、逐步图解 / Step-through diagram

用 LeetCode 的示例树 `[5,3,6,2,4,null,null,1]`，中序结果是 1, 2, 3, 4, 5, 6。节点按中序位置从左到右排开，所以**屏幕上从左到右就是从小到大**。

This uses LeetCode's example tree `[5,3,6,2,4,null,null,1]`, whose in-order sequence is 1, 2, 3, 4, 5, 6. Nodes are placed left to right by in-order position, so **left to right on screen means smallest to largest**.

上方可以切换 k；点 **Next ▶** 一步步走，或者点 **Play** 自动播放（点一下图解区域后也能用键盘 ← →）。每一步能看到正在执行的代码行、`self.k` 的变化和调用栈（call stack）。

Switch k at the top, click **Next ▶** to step, or **Play** to autoplay (after clicking the diagram you can also use ← →). Each step shows the active code line, how `self.k` changes, and the call stack.

{{< bst-kth-self tree="5,3,6,2,4,null,null,1" k="3" >}}

## 三、播放时看三件事 / Three things to watch

### 1. 先一路往左走到底 / It goes all the way left first

从 5 进入，到 3，到 2，到 1，再到 1 的左孩子 None。这时调用栈最深：`dfs(5) → dfs(3) → dfs(2) → dfs(1)`。在这之前**一次 k 都没减**，第一次 `self.k -= 1` 发生在节点 1 上。

It enters at 5, then 3, 2, 1, and finally 1's left child, None. The call stack is deepest here: `dfs(5) → dfs(3) → dfs(2) → dfs(1)`. **No decrement happens before this point**; the first `self.k -= 1` is on node 1.

原因是 `self.dfs(node.left)` 写在 `self.k -= 1` 前面：每个节点都得等左边整个算完，才轮到自己减 k。

The reason is that `self.dfs(node.left)` comes before `self.k -= 1`: every node must wait for its whole left side to finish before it gets to decrement.

### 2. 每个节点只减一次，顺序从小到大 / Each node decrements once, in ascending order

每个节点只在**自己的调用**里减一次 k。k = 3 时顺序是 1 → 2 → 3，正好从小到大，所以数到第 3 个就是 3。

Each node decrements k exactly once, **inside its own call**. With k = 3 the order is 1 → 2 → 3, which is ascending, so the third one counted is 3.

这也回答了我之前的疑问：**左子树的节点不会被漏掉**。5 的调用一开始就把整个左子树（1, 2, 3, 4）交给 `dfs(3)` 去处理，左边每个节点都会在各自的调用里被数到，而 5 要等它们全数完才轮到自己。

This also answers my earlier question: **left-subtree nodes never get skipped**. The call for 5 starts by handing its whole left subtree (1, 2, 3, 4) to `dfs(3)`. Each of those nodes is counted in its own call, and 5 only gets its turn after all of them are done.

| 步骤 / Step | 正在执行的调用 / Active call | self.k |
|---|---|---|
| 访问 1 / visit 1 | `dfs(1)` | 3 → 2 |
| 访问 2 / visit 2 | `dfs(2)` | 2 → 1 |
| 访问 3 / visit 3 | `dfs(3)` | 1 → 0，`ans = 3` |
| 进入 4 / enter 4 | `dfs(4)` | 0，开头检查直接 return / guard returns |
| 回到 5 / back to 5 | `dfs(5)` | 0 → **-1**（多减的一次 / extra） |
| 进入 6 / enter 6 | `dfs(6)` | -1，开头检查直接 return / guard returns |

### 3. k = 3 时注意节点 5：多减的一次 / With k = 3, watch node 5: the extra decrement

答案 3 找到后，`dfs(3)` 返回到 `dfs(5)`。但 `dfs(5)` 当时是停在 `self.dfs(node.left)` 这一行等结果的，回来之后它会**接着往下执行**，照样跑 `self.k -= 1`，让 k 变成 -1。图里这一步节点 5 是橙色的。

After answer 3 is found, `dfs(3)` returns to `dfs(5)`. But `dfs(5)` was paused on the `self.dfs(node.left)` line, so when control comes back it **continues to the next line** and still runs `self.k -= 1`, bringing k to -1. Node 5 turns orange at this step.

这一次多减**不影响结果**：k 变成 -1 不等于 0，`self.ans` 不会被改；接下来的 `dfs(6)` 也被开头的 `self.k <= 0` 挡住。

This extra decrement **doesn't affect the result**: -1 isn't 0, so `self.ans` isn't overwritten, and the following `dfs(6)` is blocked by the `self.k <= 0` check.

可以切到 **k = 6** 对比：答案 6 是最后一个被访问的节点，后面没有还在等着的调用要减 k，所以不会多减。再试 **k = 1**：找到 1 之后，2、3、5 三层都还在栈上等着，会连续多减三次，k 最后是 -3。

Switch to **k = 6** for comparison: the answer 6 is the last node visited, and no waiting call remains to decrement k, so there is no extra decrement. Then try **k = 1**: after 1 is found, frames for 2, 3, and 5 are still on the stack, so k gets decremented three extra times and ends at -3.

规律是：**多减的次数 = 找到答案时，栈上还在等着、而且值比答案大的祖先节点个数**（它们是从左孩子方向进来的，回来后还要访问自己）。

The rule: **number of extra decrements = ancestors still on the stack when the answer is found that are larger than it** (they were entered via their left child, so they still have to visit themselves).

## 四、易错点 / Pitfalls

1. **开头的 `self.k <= 0` 只挡新调用，不挡已经在栈上的调用**。想彻底不多减，就要在 `self.dfs(node.left)` 后面再加一句 `if self.k <= 0: return`，这就是上一篇的剪枝写法。
   **The `self.k <= 0` guard only blocks new calls, not frames already on the stack.** To avoid extra decrements completely, add `if self.k <= 0: return` right after `self.dfs(node.left)`, which is the pruning version from the previous post.
2. **判断要写 `self.k == 0`，不能写 `self.k <= 0`**。否则多减的那一次会把 `self.ans` 改成 5，答案就错了。
   **The check must be `self.k == 0`, not `self.k <= 0`.** Otherwise the extra decrement would overwrite `self.ans` with 5 and give the wrong answer.
3. **复杂度**：时间 $O(H + k)$，H 是树高（先钻到最左边，再数 k 个，多减的那几次也最多 H 次）；空间 $O(H)$，就是递归调用栈的深度。
   **Complexity**: time $O(H + k)$, where H is the tree height (dig to the leftmost node, then count k; the extra decrements are at most H more). Space $O(H)$, the depth of the recursion stack.
