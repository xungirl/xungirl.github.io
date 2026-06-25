---
title: "2026-06-25 手搓最小 Agent Loop 学习笔记"
date: 2026-06-25
draft: false
tags: ["Agent", "LLM", "tool-use", "学习笔记"]
math: true
ShowToc: true
TocOpen: true
description: "从零手搓一个最小 agent loop：搞懂 agent 的本质（模型动嘴 + 代码动手 + loop 传话），并用两个亲手做的实验验证『append 就是 agent 的记忆』——鬼打墙实验和记忆对照实验。"
---

这篇是我手搓最小 Agent Loop（s01）时整理的笔记。一句话总结它的**本质**：

> 大模型本身只会"说话"。把它的话**真的执行掉**、再把结果**喂回去**，它就从"会聊天"变成了"会干活"——这就是 agent。

我用的是通义千问 `qwen-plus`（走 OpenAI 兼容接口），但下面的道理换任何模型都一样。

## 一、Agent 到底是什么

一开始我有个困惑:**大模型不是只会问答吗?它怎么还能帮我创建文件?**

答案是:**文件不是模型创建的,是我的代码创建的。** 模型自始至终只做了一件事——输出文字。

拆开看,一个 agent 其实是三个角色凑在一起:

| 角色 | 是谁 | 干什么 |
|------|------|--------|
| 🧠 动嘴的 | 大模型 | 只会输出文字,包括"我想用某个工具"(tool_calls) |
| 📞 传话的 | agent loop 代码 | 读模型的话 → 转给工具 → 把结果再转回给模型 |
| 🔧 动手的 | `run_bash`（subprocess） | 真的在电脑上执行命令 |

所以当我说"创建一个 hello.py",发生的是:

```
我说"建 hello.py"
   ↓
[模型] 动嘴：我想执行 echo ... > hello.py    ← 只是输出文字，文件还不存在
   ↓
[代码 run_bash] 动手：真的执行命令            ← ✨ 文件在这一步才诞生
   ↓
[把结果喂回] → [模型] 看到成功 → 说"搞定了"   ← 不再要工具，结束
```

**关键认知:模型不会"主动调用"工具,它连发消息的能力都没有。** 是我写的 `for call in msg.tool_calls:` 那段循环,替模型把话送到 bash 那儿。没有这段代码,模型说一万句"我想执行 ls"都没用。

### 最小 Agent Loop 的 5 步

整个 loop 的骨架就这么几步,`while True` 不停转:

```python
def agent_loop(messages):
    while True:
        # 1. 把对话历史 + 工具发给模型
        response = client.chat.completions.create(
            model=MODEL, messages=messages, tools=TOOLS,
        )
        msg = response.choices[0].message

        # 2. 把模型的回答 append 进历史
        messages.append(msg)

        # 3. 模型没要工具 => 它说完了 => 退出
        if not msg.tool_calls:
            return

        # 4. 执行模型要的每个工具调用
        for call in msg.tool_calls:
            args = json.loads(call.function.arguments)
            output = run_bash(args["command"])

            # 5. 把工具结果 append 回历史，回到第 1 步
            messages.append({
                "role": "tool",
                "tool_call_id": call.id,
                "content": output,
            })
```

> 注:Anthropic 的 SDK 写法略有不同（`response.content` 拆成 block、`tool_use`/`tool_result`），但这 5 步骨架完全一样,只是"换了套说法"。

下面两个实验,都是围绕**第 5 步那行 `append`** 展开的——它看着不起眼,却是整个 agent 的命根子。

## 二、鬼打墙实验:删掉第 5 步会怎样

我故意把第 5 步那行 `messages.append({"role": "tool", ...})` 删掉,换成 `pass`(什么都不做),让工具结果**不喂回去**。然后问它"列出所有 py 文件",结果:

```
========== 第 1 轮 ==========
📨 发过去 2 条消息：system, user
  🛠  $ ls *.py          ← 执行了，但结果没 append

========== 第 2 轮 ==========
📨 发过去 3 条消息：system, user, assistant   ← 注意：没有 tool！
  🛠  $ ls *.py          ← 🔁 又执行一遍(鬼打墙)

========== 第 3 轮 ==========
📨 发过去 4 条消息：system, user, assistant, assistant
🤖 No Python files found.   ← 🤥 瞎编(明明有 4 个文件)
```

模型暴露了**两种**毛病:

1. **第 2 轮——鬼打墙(重复调用)**:它看不到上一轮的结果,以为没执行过,于是**又调了一遍**同一个命令。
2. **第 3 轮——幻觉(瞎编)**:连着两轮拿不到结果,它放弃挣扎,直接编了个完全错误的答案"没有 py 文件"。

### 为什么会这样:模型没有记忆,全靠 messages

模型每一轮只能看到**当下发过去的 messages**。因为结果被 `pass` 吃掉了,messages 里**永远不会出现 `tool` 这条**,所以模型每轮都看不到结果——要么重试,要么瞎编,就是不会凭空知道真相。

### 一个我一开始没绕过来的点:屏幕输出 ≠ 模型输入

实验里我明明在屏幕上看到了 `ls` 的结果,为什么模型还说没有?因为 **`run_bash` 里的 `print` 是打给我看的,跟模型看不看得到是两条独立的路**:

```python
output = run_bash(...)        # 结果回来了，而且已经 print 到屏幕给我看了
print(f"  ↳ 结果：{output}")   # 又打了一遍给我看
pass                          # ❌ 但没 append 给模型 → 模型啥也没收到
```

> **屏幕上的输出是 `print` 给你看的;模型的"输入"只是 `messages` 里的内容。** 你看得见,不代表模型看得见。

这在真实开发里巨重要:调试时你 print 看到工具跑对了,但 agent 还是犯傻——十有八九就是结果没真正喂回给模型。

## 三、记忆对照实验:append 就是记忆

为了正面验证"append = 记忆",我设计了一个对照实验:**先让它创建一个文件,再问它"我们刚创建了什么文件"**,对比两个版本——

- 🟢 **带记忆版**:两次提问共用**同一个 messages**(历史保留)
- 🔴 **失忆版**:第二问用**全新的 messages**(历史清空)

结果:

```
🟢 带记忆版
👤 第 1 问：创建 memo.txt
  🛠  $ echo 'hello agent' > memo.txt
🤖 文件 memo.txt 已创建。

👤 第 2 问：我们刚创建了什么文件？
🤖 memo.txt          ← ✅ 答对了，而且没再调任何命令！
📊 此刻 memory 攒了 7 条消息

🔴 失忆版（第 2 问用全新 messages）
👤 第 2 问：我们刚创建了什么文件？
🤖 我不知道，这段对话里没有执行过创建文件的命令。   ← ❌
📊 此刻只有 3 条消息
```

同一个问题,天壤之别。差别**只有一个**:历史留没留。

带记忆版第 2 问时,messages 里完整保留着第 1 问的 7 条历史:

```
1. system
2. user:      创建 memo.txt          ← 第1问
3. assistant: 我要执行 echo...
4. tool:      (创建成功)              ← append 进来的执行结果
5. assistant: 已创建 memo.txt
6. user:      刚创建了什么文件?       ← 第2问
7. assistant: memo.txt               ← 它从 2~5 条里"读"出了答案
```

模型一翻历史就看到"哦,我刚建了 memo.txt",所以**连工具都不用调**,直接答出来。而失忆版的 messages 里啥历史都没有,对它来说"历史里没有的事 = 没发生过",文件明明在硬盘上,它也一无所知。

## 四、总结:我今天真正学到的

1. **Agent = 模型(动嘴) + 工具(动手) + loop(传话)**。三者凑齐,模型才从"会聊天"变成"会干活"。模型能干什么,取决于你给它配了什么工具。
2. **模型本身是无状态的(没有记忆)**。它的全部"记忆"就是你每次喂给它的 `messages` 列表。
3. **`append` 就是往记忆里写东西的唯一动作**:
   - 不 append 工具结果 → 模型断片 → 鬼打墙 + 幻觉
   - append 攒历史 → 跨轮记忆 → 答对,还省掉重复劳动
4. **屏幕输出 ≠ 模型输入**。`print` 给人看,`messages` 给模型看,调试时别把这两个搞混。

很多时候 agent "犯傻"或"幻觉",根子不在模型笨,而在**我没把该给的信息喂给它**。
