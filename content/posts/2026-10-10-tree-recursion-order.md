---
title: "2026-10-10 二叉树递归调用顺序学习笔记（左 → 右 → 自己）"
date: 2026-10-10
draft: false
tags: ["LeetCode", "递归", "DFS", "后序遍历", "学习笔记"]
math: true
ShowToc: true
TocOpen: true
description: "用可交互的逐步图解看清二叉树递归到底按什么顺序走：一路先钻到最左，左边返回后才去右边，两边都返回后才处理自己。以 LC 124 的 gain 函数为例。"
---

这篇是我做 [124. Binary Tree Maximum Path Sum · 二叉树中的最大路径和](https://leetcode.cn/problems/binary-tree-maximum-path-sum/) 时整理的笔记。卡住我的不是公式，而是**递归到底按什么顺序走**。

This is a note from working on LeetCode 124. What tripped me up wasn't the formula. It was the order the recursion actually runs in.

一句话总结本质：

> 每进入一个节点，先一路往左钻到底；左边返回后，**同一个节点**才去右边；进了右子树，又重新「先左后右」。两边都返回后，才处理自己。完整规则：**左 → 右 → 自己**（后序遍历，post-order）。

> Every time you enter a node, you dive all the way left first. Once the left side returns, **that same node** goes right. Inside the right subtree, "left first, then right" starts over. Only after both sides return does the node process itself. The full rule: **left → right → self** (post-order).

## 一、代码 · The Code

```python
class Solution:
    def maxPathSum(self, root: Optional[TreeNode]) -> int:
        ans = float("-inf")

        def gain(node):
            nonlocal ans
            if not node: return 0
            left  = max(gain(node.left), 0)   # 1 left
            right = max(gain(node.right), 0)  # 2 right
            ans = max(ans, node.val + left + right) # 3
            return node.val + max(left, right)

        gain(root)
        return ans
```

顺序完全由代码决定：`gain(node.left)` 写在前一行，`gain(node.right)` 写在后一行，处理自己的 `ans = ...` 和 `return` 写在最后。**程序必须等前一行的递归完全结束，才会执行下一行。**

The order comes straight from the code: `gain(node.left)` is on the first line, `gain(node.right)` on the next, and the self-processing `ans = ...` and `return` come last. **The program must wait for each recursive call to fully finish before moving to the next line.**

## 二、手推一遍调用顺序 · Tracing the Calls by Hand

用这棵树：

Using this tree:

```text
          1
        /   \
      -6     3
     /  \     \
    2   -4    -1
```

```text
进入 1 → 先左，进入 -6 → 先左，进入 2 → 左是 None，右是 None → 处理 2，返回
                    -6 再去右，进入 -4 → 左右都是 None → 处理 -4，返回
                    -6 两边都完成 → 处理 -6，返回
       1 再去右，进入 3 → 左是 None → 3 再去右，进入 -1 → 处理 -1，返回
                    3 两边都完成 → 处理 3，返回
       1 两边都完成 → 处理 1，返回
```

```text
Enter 1 → left, enter -6 → left, enter 2 → left None, right None → process 2, return
                     -6 now goes right, enter -4 → both None → process -4, return
                     -6 both sides done → process -6, return
        1 now goes right, enter 3 → left None → 3 goes right, enter -1 → process -1, return
                     3 both sides done → process 3, return
        1 both sides done → process 1, return
```

**处理顺序 / Processing order：2 → -4 → -6 → -1 → 3 → 1**

## 三、逐步图解（可以点）· Step-Through Visualizer

点 **Next ▶** 一步步走，或点 **▶ Play** 自动播放（也可以点一下图解区域后用键盘 ← →）。紫色是当前所在的栈帧，粉色是「正在处理自己」，绿色是已经返回的节点：右上角数字是处理顺序，左上角 ↑ 是它返回给父节点的值。

Click **Next ▶** to step through, or **▶ Play** to auto-play (you can also click the visualizer and use the ← → keys). Purple is the current frame, pink means "processing itself", and green nodes have returned: the top-right badge is the processing order, and the ↑ number is what it returned to its parent.

{{< tree-postorder tree="1,-6,3,2,-4,null,-1" >}}

留意几个时刻：

Watch for these moments:

- **第 1～3 步**：从 1 一路往左钻到 2，1 和 -6 都还在栈上等着，一个都没处理。
  **Steps 1–3**: it dives from 1 all the way left to 2. Both 1 and -6 are still waiting on the stack, and neither has been processed.
- **-6 去右边**：是 2 返回之后，回到 -6 这一层才去的，不是从 2 「横着跳」过去。
  **-6 going right**: this happens only after 2 returns and control is back in -6's frame. It doesn't "jump sideways" from 2.
- **1 最后才变绿**：它是第一个进入的，却是最后一个处理的。
  **1 turns green last**: it's the first node entered, but the last one processed.

## 四、为什么这题必须是后序 · Why This Problem Must Be Post-Order

`ans = max(ans, node.val + left + right)` 需要**左右两边的结果都已经算好**。只有「左 → 右 → 自己」这个顺序能保证处理自己时，`left` 和 `right` 已经有值了。

`ans = max(ans, node.val + left + right)` needs **both children's results ready**. Only "left → right → self" guarantees that `left` and `right` already have values when a node processes itself.

前序、中序、后序其实是同一个模板，区别只是「处理自己」那行放在哪：

Pre-order, in-order and post-order are really the same template. The only difference is where the "process self" line goes:

| | 处理自己的位置 · Where "self" goes | 顺序 · Order | 典型用途 · Typical use |
|---|---|---|---|
| 前序 Pre-order | 两次递归**之前** · before both calls | 自己 → 左 → 右 | 复制树、打印路径 · copy a tree, print paths |
| 中序 In-order | 两次递归**中间** · between the calls | 左 → 自己 → 右 | BST 升序（[LC 230](/posts/2026-10-09-lc230-kth-smallest-bst/)）· BST in sorted order |
| 后序 Post-order | 两次递归**之后** · after both calls | 左 → 右 → 自己 | 需要子树结果：高度、路径和（LC 124）· needs subtree results: height, path sum |

## 五、易错点 · Common Mistakes

1. **「进入」≠「处理」**。1 是第一个进入的，却是最后一个处理的。递归往下走时只是在栈上排队，往上返回时才真正干活。
   **"Entering" ≠ "processing".** Node 1 is entered first but processed last. Going down just queues frames on the stack; the real work happens on the way back up.
2. **右子树不是从左孩子「跳」过去的**。一定是左子树整个返回到父节点，再由父节点调用 `gain(node.right)`。
   **The right subtree isn't reached by jumping from the left child.** The whole left subtree returns to the parent first, and then the parent calls `gain(node.right)`.
3. **负数贡献要截成 0**：`max(gain(...), 0)`。-4 返回 -4，-6 拿到的 right 是 0，相当于「不要这条边」。
   **Clamp negative gains to 0** with `max(gain(...), 0)`. -4 returns -4, but -6 sees right = 0, which means "don't take that branch".
4. **`ans` 和 `return` 不是一回事**：`ans` 算的是「经过这个节点、两边都可以要」的整条路径；`return` 给父节点的只能带**一条**边（`max(left, right)`），因为路径不能分叉。
   **`ans` and `return` are different things.** `ans` covers the full path through this node using both sides. The value returned to the parent can carry only **one** side (`max(left, right)`), because a path can't fork.
5. **`ans` 初值用 `float("-inf")`**，不能用 0。全是负数的树（比如 `[-3]`）答案是 -3。
   **Start `ans` at `float("-inf")`, not 0.** For an all-negative tree like `[-3]`, the answer is -3.
6. **复杂度**：时间 $O(n)$，每个节点进出各一次；空间 $O(H)$，是递归栈的深度。
   **Complexity**: $O(n)$ time, since each node is entered and left once; $O(H)$ space for the recursion stack.
