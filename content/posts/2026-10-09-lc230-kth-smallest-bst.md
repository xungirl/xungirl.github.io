---
title: "2026-10-09 LeetCode 230 二叉搜索树第 K 小元素学习笔记"
date: 2026-10-09
draft: false
tags: ["LeetCode", "BST", "DFS", "中序遍历", "学习笔记"]
math: true
ShowToc: true
TocOpen: true
description: "用可交互的逐步图解看懂 LC 230：BST 中序遍历为什么天然是升序、k 怎么一路倒数到 0，以及 k = 3 和 k = 4 时递归走向的唯一区别。"
---

这篇是我刷 [230. Kth Smallest Element in a BST · 二叉搜索树中第 K 小的元素](https://leetcode.cn/problems/kth-smallest-element-in-a-bst/) 时整理的笔记。重点不在代码多难，而在于**亲眼看着递归一步步走**，搞清楚它什么时候往右走、什么时候停。

一句话总结本质：

> 二叉搜索树（BST）的**中序遍历（in-order traversal）就是升序**，所以按中序数到第 k 个节点，它就是第 k 小。

## 一、为什么中序遍历 = 升序

BST 的规则是：左子树所有值 < 根 < 右子树所有值。中序遍历的顺序是**左 → 根 → 右**，正好把这条规则从小到大"读"出来。

所以不用排序、不用存数组，只要边遍历边倒数：每访问一个节点就 `k -= 1`，k 变成 0 的那个节点就是答案。

## 二、代码

```python
class Solution:
    def kthSmallest(self, root: Optional[TreeNode], k: int) -> int:
        ans = None

        def dfs(node):
            nonlocal k, ans
            if not node: return
            dfs(node.left)
            if k == 0: return   # found on the left
            k -= 1              # visit node
            if k == 0:
                ans = node.val
                return
            dfs(node.right)

        dfs(root)
        return ans
```

几个关键行：

- `dfs(node.left)`：先一路往左钻到最小值。
- `k -= 1`：这就是"访问"当前节点，相当于数了一个。
- `if k == 0: ans = node.val`：数够了，记答案。
- `if k == 0: return`（紧跟在 `dfs(node.left)` 后面）：**剪枝（pruning）**，左边已经找到答案了，当前节点和右边都不用看。

## 三、逐步图解（可以点）

用题目示例的树 `[5,3,6,2,4,null,null,1]`。节点按中序位置从左到右排开，所以**屏幕上从左到右就是从小到大**。

点 **Next ▶** 一步步走（也可以点一下图解区域后用键盘 ← →），上方可以切换 k。

{{< bst-kth tree="5,3,6,2,4,null,null,1" k="4" >}}

用 k = 4 一步步看，重点留意**第 10 步**：访问完 3 后 k 还没到 0，代码走到 `dfs(node.right)` 进入右孩子 4。

Step through with k = 4, and pay attention to step 10: after visiting 3, k hasn't hit 0, so the code reaches `dfs(node.right)` and goes into the right child 4.

## 四、k = 3 和 k = 4 的区别

在上面把 k 切到 3，再切回 4，对比一下。

和 k = 3 的区别只在**第 9 步之后**：k = 3 时访问完 3 就停了，k = 4 时 k 还剩 1，所以必须走 `dfs(node.right)` 去右边继续数。

The only difference from k = 3 comes after step 9. With k = 3, it stops after visiting 3. With k = 4, k still has 1 left, so it has to take `dfs(node.right)` and keep counting on the right.

| | k = 3 | k = 4 |
|---|---|---|
| 第 9 步访问 3 之后的 k | 0 → 找到答案 | 1 → 还要继续 |
| 会不会进 `dfs(3.right)` | 不会 | 会，进入 4 |
| 答案 | 3 | 4 |
| 总步数 | 10 | 12 |

## 五、易错点

1. **`nonlocal` 别忘了**。内层函数里要改外层的 `k` 和 `ans`，不写 `nonlocal` 会报 `UnboundLocalError`。
2. **找到后要剪枝**。如果 `dfs(node.left)` 后面不检查 `k == 0`，回到上一层时还会继续 `k -= 1`，k 变成负数，还会白白遍历右边的节点。答案碰巧不受影响，但逻辑是错的，也浪费时间。
3. **复杂度**：时间 $O(H + k)$（H 是树高，先钻到最左边要走 H 步，再数 k 个），空间 $O(H)$ 是递归栈。不剪枝的话会退化成 $O(n)$。
