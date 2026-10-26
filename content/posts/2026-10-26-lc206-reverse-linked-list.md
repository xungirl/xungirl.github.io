---
title: "2026-10-26 LeetCode 206 反转链表学习笔记"
date: 2026-10-26
draft: false
tags: ["LeetCode", "链表", "双指针", "学习笔记"]
math: true
ShowToc: true
TocOpen: true
description: "用可交互的逐行动画看懂 LC 206 反转链表：四行循环里只有一行真的改箭头，其余三行都只是挪 prev / curr / nxt 标签。"
---

这篇是我刷 [206. Reverse Linked List · 反转链表](https://leetcode.cn/problems/reverse-linked-list/) 时整理的笔记。代码只有几行，但很容易背下来却说不清每行在干嘛。所以这次用动画一行一行看。

These are my notes on [206. Reverse Linked List](https://leetcode.com/problems/reverse-linked-list/). The code is only a few lines, but it is easy to memorize it without being able to say what each line does. So this time I step through it line by line with an animation.

一句话总结本质：

> 循环里 4 行代码，**只有 `curr.next = prev` 这一行改箭头**。另外 3 行都只是在挪「标签」（变量 prev / curr / nxt 指向谁）。

The one-sentence version:

> Of the 4 lines in the loop, **only `curr.next = prev` changes an arrow**. The other 3 just move labels (which node prev / curr / nxt point at).

## 一、先分清「箭头」和「标签」 · Arrows vs. labels

链表里有两种东西，搞混了就会晕：

- **箭头（arrow）**：每个节点的 `.next` 字段。这是链表本身的结构，改了它，链表就变了。
- **标签（label）**：`prev`、`curr`、`nxt` 这些变量。它们只是贴在节点上的便利贴，记着「我现在看的是哪个节点」。挪标签不会改链表的任何东西。

A linked list has two kinds of things, and mixing them up is where the confusion comes from:

- **Arrows**: each node's `.next` field. This is the list's actual structure; change it and the list changes.
- **Labels**: variables like `prev`, `curr`, `nxt`. They are sticky notes on nodes that remember "which node am I looking at". Moving a label changes nothing in the list.

所以 `curr.next = prev`（左边有 `.next`）是改箭头，`prev = curr`（左边是光秃秃的变量名）是挪标签。看赋值号左边有没有 `.next` 就能分辨。

So `curr.next = prev` (with `.next` on the left) changes an arrow, while `prev = curr` (a bare variable name on the left) moves a label. Just check whether the left side of `=` has a `.next`.

## 二、代码 · The code

```python
class Solution:
    def reverseList(self, head: Optional[ListNode]) -> Optional[ListNode]:
        prev = None
        curr = head
        while curr:
            nxt = curr.next      # save
            curr.next = prev     # flip
            prev = curr          # move
            curr = nxt           # move
        return prev
```

两个标签的含义（这就是循环不变量 loop invariant）：

- `prev`：**已经反转好**的那一段的头。
- `curr`：**还没处理**的那一段的头。

What the two labels mean (this is the loop invariant):

- `prev`: the head of the part that is **already reversed**.
- `curr`: the head of the part that is **not handled yet**.

每一轮把 curr 这个节点从右边那段「摘下来」，掉个头接到左边那段前面，然后两个标签各往右挪一格。

Each round takes the node at curr off the right part, turns it around, attaches it to the front of the left part, and then both labels move one step right.

## 三、逐行动画（可以点） · Step-through animation

下面这个动画用 1 → 2 → 3 演示每一行代码的效果。点「Next ▶」一行一行看（也可以点一下图解区域后用键盘 ← →），注意观察：哪一步改了箭头，哪一步只是挪了标签。

The animation below shows the effect of each line on 1 → 2 → 3. Step through with "Next ▶" (or click the widget and use ← →), and watch for which steps change an arrow and which only move a label.

{{< ll-reverse list="1,2,3" >}}

图里左右两个 None 其实是同一个 None，画两个只是为了让往左和往右的箭头不交叉。下面的「from prev / from curr」是从这个标签出发、顺着箭头读出来的链表，可以看到左边那段一轮轮变长，右边那段一轮轮变短。

The two None boxes are really the same None, drawn twice so the left and right arrows don't cross. The "from prev / from curr" rows show the list you get by following arrows from that label: the left part grows each round and the right part shrinks.

## 四、几个值得盯住的瞬间 · Moments worth watching

1. **第 1 轮改完箭头之后**：1 指向 None，但 1 和 2 之间一根箭头都没有了。这时候唯一还能找到 2 的，就是 `nxt` 这个标签。这就是为什么 `nxt = curr.next` 必须写在改箭头**之前**。
2. **数一下红色步骤**：3 个节点，一共只有 3 步是红色的。每轮恰好改 1 根箭头，所以时间是 $O(n)$，而且只用了 3 个变量，空间 $O(1)$。
3. **最后一步**：curr 已经是 None 了，新的头在 prev 身上，所以返回 `prev`。

1. **Right after the arrow flips in round 1**: 1 points at None, and there is no arrow at all between 1 and 2. The only way to still reach 2 is the `nxt` label. That is why `nxt = curr.next` has to come **before** the flip.
2. **Count the red steps**: 3 nodes, exactly 3 red steps. Each round changes exactly one arrow, so time is $O(n)$, and with only 3 variables the space is $O(1)$.
3. **The last step**: curr is already None and the new head is at prev, so we return `prev`.

## 五、易错点 · Common mistakes

1. **顺序写反**：先写 `curr.next = prev` 再存 `nxt`，存到的就是刚改好的 prev，后半截链表丢了。口诀：**先存、再改、再挪**。
2. **两个 move 顺序写反**：先写 `curr = nxt` 再写 `prev = curr`，prev 会直接跳到 nxt 上，跟 curr 重合。必须先挪 prev（追上 curr），再挪 curr。
3. **返回 `curr` 或 `head`**：循环结束时 curr 是 None；head 还指着原来的 1，而 1 现在是尾巴。答案是 `prev`。
4. **空链表**：`head` 是 None 时循环一次都不进，直接返回 `prev = None`，正好对。不需要特判。

1. **Wrong order**: if you write `curr.next = prev` before saving `nxt`, you save the prev you just wrote, and the rest of the list is lost. Rule of thumb: **save, flip, move**.
2. **Swapping the two moves**: with `curr = nxt` before `prev = curr`, prev jumps straight to nxt and lands on the same node as curr. Move prev first (catch up to curr), then move curr.
3. **Returning `curr` or `head`**: when the loop ends, curr is None; head still points at the old 1, which is now the tail. The answer is `prev`.
4. **Empty list**: if `head` is None the loop never runs and we return `prev = None`, which is correct. No special case needed.
