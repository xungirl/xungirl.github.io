---
title: "2026-10-12 回溯（Backtracking）学习笔记：走迷宫、子集与全排列"
date: 2026-10-12
draft: false
tags: ["LeetCode", "回溯", "DFS", "递归", "学习笔记"]
math: true
ShowToc: true
TocOpen: true
cover:
  image: "cover.png"
  alt: "LC 78 子集的回溯决策树：往下走 = append，往上退 = pop / Backtracking decision tree for LC 78 Subsets"
description: "用三个可交互的逐步动画搞懂回溯：先用日常走迷宫看「前进—碰壁—后退」，再看 LC 78 子集的决策树（每个节点都是答案、start 不回头），最后看 LC 46 全排列（只有叶子是答案、used[] 剪枝）。中英双语。"
---

这篇是我做 [78. Subsets · 子集](https://leetcode.cn/problems/subsets/) 时整理的回溯（backtracking）笔记。一开始我能背模板，但说不清 `path.pop()` 到底在干嘛、为什么子集不会重复。后来配合动画一步步走，才真的看懂。

This is my note on backtracking, written while working on LeetCode 78 Subsets. At first I could recite the template, but I couldn't explain what `path.pop()` was actually doing, or why subsets never come out duplicated. Stepping through it with animations is what finally made it click.

一句话总结本质：

> 回溯就是**在一棵决策树上做 DFS**。每走一步都是三件事：**做选择（append）→ 往下走（递归）→ 撤销选择（pop）**。撤销是为了回到岔路口，让下一个选项拿到一条干净的 path。

> Backtracking is **DFS on a decision tree**. Every step is three moves: **choose (append) → explore (recurse) → un-choose (pop)**. Un-choosing walks you back to the fork, so the next option starts from a clean path.

## 一、先别看代码：走迷宫 · Forget the Code: Walking a Maze

回溯其实是我们每个人都会的事。想象你走进一个迷宫，手里拿着一卷绳子，绳头拴在入口：

Backtracking is something everyone already knows how to do. Picture walking into a maze with a ball of rope, one end tied to the entrance:

1. **前进**：每到一个路口，挑一个没走过的方向往前走，边走边放绳子。
2. **碰壁**：前面是死路，四个方向都走不通。
3. **后退**：沿着绳子退回上一个路口，**把这段绳子收回来**，再试下一个方向。
4. **粉笔做记号**：走过的格子画个叉，以后不再进去，避免绕圈。

1. **Move forward**: at each junction, pick a direction you haven't tried and walk on, letting out rope.
2. **Hit a wall**: a dead end, with no way forward.
3. **Step back**: follow the rope back to the last junction, **rolling that rope back in**, then try the next direction.
4. **Chalk marks**: mark every cell you've been to so you never walk in circles.

绳子就是 `path`：放绳子是 `path.append`，收绳子是 `path.pop`。走到出口时，手里还拉着的那条绳子就是答案。

The rope is `path`: letting out rope is `path.append`, rolling it in is `path.pop`. When you reach the exit, the rope still in your hand is the answer.

下面的动画每一步按 → ↓ ← ↑ 的固定顺序试方向。注意看：一开始往右一路走进了一个**6 格长的死胡同**，然后要一格一格退回起点（那是最后一个还有别的方向没试的岔路口），才能换成往下走。

In the animation below, each cell tries directions in the fixed order → ↓ ← ↑. Watch how going right leads into a **6-cell dead end**, and then you have to step back one cell at a time to the start (the last fork with an untried direction) before you can go down instead.

{{< bt-maze >}}

动画里值得盯的三点：

Three things to watch in the animation:

- **后退的时候不产生任何进展**，只是把绳子收回来。但没有这一步，下一个方向就会接在一条错误的 path 后面。
- **退到哪里停？** 退到第一个「还有方向没试」的格子为止。死胡同里的格子都没有别的路，所以一路退回 (0,0)。
- **粉笔叉（`seen`）不擦掉。** 迷宫只要找到一条路，死路进过一次就够了。（后面的排列题不一样，`used` 是要擦掉的。）

- **Stepping back makes no progress on its own**, it only rolls the rope in. But without it, the next direction would be attached to a wrong path.
- **Where does the retreat stop?** At the first cell that still has an untried direction. No cell in the dead end has another way out, so you retreat all the way to (0,0).
- **The chalk mark (`seen`) is never erased.** In a maze you only need one route, so entering a dead end once is enough. (Permutations below are different: `used` does get erased.)

## 二、回溯模板 · The Template

把走迷宫抽象一下，几乎所有回溯题都长这样：

Abstract the maze away, and almost every backtracking problem looks like this:

```python
def backtrack(状态 / state):
    if 到达终点 / reached a goal:
        res.append(path[:])        # 记录答案（注意是拷贝）
        return
    for 选项 in 当前能做的选择 / options:
        if 不合法 / invalid: continue   # 剪枝
        path.append(选项)           # 1. 做选择  choose
        backtrack(新状态)            # 2. 往下走  explore
        path.pop()                  # 3. 撤销    un-choose
```

不同的题，只是三个地方不一样：**什么时候记录答案**、**有哪些选项**、**怎么剪枝**。下面两道题刚好是两种最典型的写法。

Different problems only change three things: **when to record an answer**, **which options exist**, and **how to prune**. The two problems below are the two most typical variations.

## 三、LC 78 子集：每个节点都是答案 · Subsets: Every Node Is an Answer

```python
class Solution:
    def subsets(self, nums: List[int]) -> List[List[int]]:
        res, path = [], []

        def backtrack(start):
            res.append(path[:])          # 每个节点都是答案，所以写在第一行
            for i in range(start, len(nums)):
                path.append(nums[i])     # 做选择
                backtrack(i + 1)         # 下一层只能从 i+1 往后选
                path.pop()               # 撤销选择

        backtrack(0)
        return res
```

先把 `nums = [1,2,3]` 的决策树一步步走一遍。

Let's step through the decision tree for `nums = [1,2,3]`.

{{< bt-tree mode="subsets" nums="1,2,3" >}}

看动画时重点盯三件事：

Watch for three things:

1. **橙色节点往下走 = append，往上退 = pop。** `path` 的长度永远等于当前节点的深度。
2. **撤销那几步没有新答案。** 它们只是「回到岔路口」，为下一个选择腾出位置。
3. **到 `[2]` 时 `start = 2`，所以 1 永远不会再被选。** 这就是「不回头」：右边 `nums` 那一行里，下标小于 `start` 的都被划掉了。

1. **Moving down is append, moving back up is pop.** The length of `path` always equals the current depth.
2. **Un-choose steps add nothing to `res`.** They just return to the fork so the next option has a clean path.
3. **At `[2]`, `start = 2`, so 1 is never picked again.** That's the "never look back" rule: in the `nums` row on the right, every index below `start` is crossed out.

动画也顺便回答了「为什么没有终止条件」：**每个节点都是答案**，所以 `res.append` 写在函数第一行，不用等到叶子。`start` 越过末尾时 `for` 循环自然一次都不跑，函数自己就结束了。

The animation also answers "why is there no base case?": **every node is an answer**, so `res.append` is the first line and we don't wait for a leaf. Once `start` runs past the end, the `for` loop simply runs zero times and the function ends by itself.

### 为什么不会出现重复？· Why No Duplicates?

是 `start` 规则决定了这棵树的形状，而这个形状保证了**每个子集只对应树上唯一一条路径**。

The `start` rule decides the shape of the tree, and that shape guarantees **each subset maps to exactly one path in the tree**.

原因是：树上每条路径的下标都是**严格递增**的；而一个集合按递增顺序排列的方式只有一种。比如 `{1,3}` 只能是 `[1,3]`，不可能出现 `[3,1]`。所以同一个子集不会被走到两次。

Here's why: indices along every path are **strictly increasing**, and a set has only one increasing arrangement. `{1,3}` can only appear as `[1,3]`, never `[3,1]`. So no subset is reached twice.

**前提：`nums` 的元素互不相同。** 看 `nums = [1,2,2]`，把两个 2 记作 2a、2b：

**This only holds when all elements are distinct.** Take `nums = [1,2,2]` and call the two 2s 2a and 2b:

```text
[1, 2a]   ← 下标 0,1 / indices 0,1
[1, 2b]   ← 下标 0,2 / indices 0,2
```

两条路径下标都递增，树认为它们不同，但值都是 `[1,2]`，重复了。这就是 [90. Subsets II](https://leetcode.cn/problems/subsets-ii/) 要解决的问题：**树结构能防住「顺序不同」造成的重复，防不住「值相同」造成的重复。** 解法是先排序，再做「同层剪枝」（same-level pruning）：同一层里，和前一个值相同的选项直接跳过。

Both paths have increasing indices, so the tree treats them as different, but both are `[1,2]` by value. That's exactly what LC 90 Subsets II fixes: **the tree prevents duplicates from ordering, not duplicates from equal values.** The fix is to sort first, then apply same-level pruning: within one level, skip an option whose value equals the previous one.

```python
nums.sort()
def backtrack(start):
    res.append(path[:])
    for i in range(start, len(nums)):
        if i > start and nums[i] == nums[i - 1]:   # 同层、同值 → 跳过
            continue
        path.append(nums[i])
        backtrack(i + 1)
        path.pop()
```

注意是 `i > start` 而不是 `i > 0`：只在**同一层**里跳过，往下一层走时（`i == start`）用第二个 2 是允许的，所以 `[1,2,2]` 还是能被选出来。

Note it's `i > start`, not `i > 0`: we only skip **within the same level**. Going one level deeper (`i == start`) may still use the second 2, so `[1,2,2]` is still produced.

## 四、常规回溯题：LC 46 全排列 · A Classic: LC 46 Permutations

子集是「选或不选」，[46. Permutations · 全排列](https://leetcode.cn/problems/permutations/) 是「排顺序」：`[1,2]` 和 `[2,1]` 是两个不同的答案。所以 `start` 不回头的规则不能用了，每一层都要从头试，改用 `used[]` 记住哪些数已经在 path 里。

Subsets is about "pick or don't pick". Permutations is about **order**: `[1,2]` and `[2,1]` are different answers. So the "never look back" `start` rule no longer works. Every level tries from the beginning, and a `used[]` array remembers which numbers are already in the path.

```python
class Solution:
    def permute(self, nums: List[int]) -> List[List[int]]:
        res, path = [], []
        used = [False] * len(nums)

        def backtrack():
            if len(path) == len(nums):        # 叶子才是答案
                res.append(path[:])
                return
            for i in range(len(nums)):
                if used[i]:                   # 已经在 path 里 → 剪掉
                    continue
                used[i] = True
                path.append(nums[i])          # 做选择
                backtrack()                   # 往下走
                used[i] = False
                path.pop()                    # 撤销（两样都要还原）

        backtrack()
        return res
```

{{< bt-tree mode="permute" nums="1,2,3" >}}

和子集对比着看：

Compare it with subsets:

- **只有叶子是绿色的。** 中间节点 `[1]`、`[1,2]` 都不是答案，因为还没排满。所以终止条件 `len(path) == len(nums)` 必须有。
- **每一层都从下标 0 开始试**，被划掉的是 `used` 为 True 的数，而不是下标小于 `start` 的数。所以 `[2]` 下面还能选 1，得到 `[2,1,3]`。
- **撤销要还原两样东西**：`path.pop()` 和 `used[i] = False`。这就是和迷宫最大的不同：迷宫的粉笔叉不擦，排列的 `used` 必须擦。因为 1 在 `[1,...]` 这条分支里用过，换到 `[2,...]` 分支时 1 又得能用。

- **Only leaves turn green.** Inner nodes like `[1]` and `[1,2]` aren't answers yet, so the base case `len(path) == len(nums)` is required.
- **Every level starts trying from index 0.** What's crossed out are the numbers with `used` set to True, not the indices below `start`. That's why `[2]` can still pick 1 and reach `[2,1,3]`.
- **Un-choosing restores two things**: `path.pop()` and `used[i] = False`. This is the big difference from the maze: the maze's chalk marks stay, but `used` must be erased. 1 was used in the `[1,...]` branch, and it has to be available again in the `[2,...]` branch.

## 五、三个例子放在一起 · All Three Side by Side

| | 走迷宫 Maze | 78 子集 Subsets | 46 全排列 Permutations |
|---|---|---|---|
| 什么时候记录答案 · When to record | 到出口 · at the exit | 每个节点 · every node | 只在叶子 · leaves only |
| 选项 · Options | 4 个方向 · 4 directions | 下标 `start..n-1` | 所有没用过的 · every unused number |
| 防止走回头路 · Avoiding repeats | `seen`（不擦）· never erased | `start`（只往后）· only forward | `used`（要擦）· erased on undo |
| 撤销 · Undo | `path.pop()` | `path.pop()` | `path.pop()` + `used[i] = False` |
| 找到一个就停？· Stop at first? | 是 · yes（`return True`） | 否，全部列出 · no, list all | 否，全部列出 · no, list all |

## 六、易错点 · Common Pitfalls

1. **`res.append(path)` 没拷贝。** `path` 只有一个列表，一直被 append/pop。存的是引用，最后所有答案都变成同一个空列表。必须写 `path[:]` 或 `list(path)`。
2. **忘了 `pop()`。** 下一个选项会接在上一个选项后面，path 越来越长，答案全乱。
3. **排列题只 `pop` 没还原 `used`**（或反过来）。做选择时改了几样状态，撤销时就要还原几样。
4. **子集题把 `backtrack(i + 1)` 写成 `backtrack(start + 1)`。** 下一层应该从「刚选的那个」后面开始，而不是从「这一层的起点」后面开始，否则会出现 `[2,2]` 这种重复用同一个元素的结果。

1. **`res.append(path)` without copying.** There's only one `path` list being appended to and popped. Storing the reference means every answer ends up as the same empty list. Write `path[:]` or `list(path)`.
2. **Forgetting `pop()`.** The next option gets attached after the previous one, path keeps growing, and every answer is wrong.
3. **In permutations, popping but not resetting `used`** (or the other way around). However many pieces of state you change when choosing, you must restore all of them when un-choosing.
4. **Writing `backtrack(start + 1)` instead of `backtrack(i + 1)` in subsets.** The next level must start after **the element just chosen**, not after this level's starting point. Otherwise you get results like `[2,2]` that reuse one element.

## 七、一句话收尾 · Takeaway

> 回溯 = 拿着绳子走决策树。**往下走放绳子（append），往回退收绳子（pop）。** 题目之间的区别只在三处：什么时候记答案、有哪些选项、用什么规则不走回头路。

> Backtracking = walking a decision tree with a rope. **Let rope out going down (append), roll it in coming back (pop).** Problems differ in only three places: when to record an answer, which options exist, and which rule keeps you from repeating yourself.
