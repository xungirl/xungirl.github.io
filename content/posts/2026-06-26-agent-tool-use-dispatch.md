---
title: "2026-06-26 给 Agent 加工具：Tool Dispatch 学习笔记"
date: 2026-06-26
draft: false
tags: ["Agent", "LLM", "tool-use", "学习笔记"]
math: true
ShowToc: true
TocOpen: true
description: "s02 Tool Use 学习笔记：从只有一个 bash，到给 agent 5 个专用工具。核心是 dispatch map（工具名→函数的派发表）和 safe_path 路径护栏，并用实验看清模型何时只调一个工具、何时一次调多个。"
---

这篇是我学「给 Agent 加工具」（s02 Tool Use）时整理的笔记。接着上一篇[手搓最小 Agent Loop]({{< ref "2026-06-25-agent-loop-from-scratch" >}})往下走。

一句话总结这一节的**核心**：

> 给 agent 加一个工具，只需要"加一行"——循环代码完全不动，新工具注册进一张**派发表（dispatch map）**就行。

我用的还是通义千问 `qwen-plus`（OpenAI 兼容接口）。

## 一、为什么要给它多个工具

s01 里 agent 只有一个 `bash`。读文件要 `cat`，写文件要 `echo "..." > file`，找文件要 `find`。问题是：模型脑子里想的是"读这个文件"，却要拼出一条 `cat path/to/file` 的命令——多了一层翻译，浪费 token，还容易拼错。

s02 的做法：给它 5 个**专用工具**，让它直接表达意图。

| 工具 | 干什么 |
|------|--------|
| `read_file` | 读文件 |
| `write_file` | 写文件 |
| `edit_file` | 把文件里一段旧文字换成新文字 |
| `glob` | 按模式找文件，如 `*.py` |
| `bash` | 兜底，其它都不合适时才用 |

system prompt 里写一句"能用专用工具就别用 bash"，模型就会优先挑合适的工具。

## 二、新概念：工具派发（dispatch）

s01 只有 bash，模型一说要工具，代码闭眼调 `run_bash` 就行。现在有 5 个工具，模型说"我要 `read_file`"，代码得**按名字找到对应的那个 Python 函数**去执行——这就是 dispatch。

实现靠一张**派发表**：一个把"工具名字符串"映射到"真正函数"的字典。

```python
TOOL_HANDLERS = {
    "bash":       run_bash,
    "read_file":  run_read,
    "write_file": run_write,
    "edit_file":  run_edit,
    "glob":       run_glob,
}
```

> ⚠️ 易错点：值是 `run_bash`，**不要加括号**。
> - `run_bash`（不加括号）= 把**函数本身**存进表，需要时再调
> - `run_bash()`（加括号）= **立刻执行**它，存进表的是执行结果，错了

循环里执行工具的代码，相比 s01 几乎只改了一行——从硬编码 `run_bash(...)` 变成"查表再调"：

```python
for call in msg.tool_calls:
    name = call.function.name
    args = json.loads(call.function.arguments)

    handler = TOOL_HANDLERS.get(name)   # 查表：按名字取出函数
    output = handler(**args)            # 调用：把参数字典拆成关键字参数

    messages.append({
        "role": "tool",
        "tool_call_id": call.id,
        "content": output,
    })
```

**加一个新工具 = 写一个函数 + 在 TOOLS 菜单加一条描述 + 在 TOOL_HANDLERS 加一行映射。循环一行都不用改。** 这就是 dispatch map 的威力。

### 关于 `**args`：把字典拆成参数

模型给的参数是个字典，比如 `{"path": "a.py"}`，而函数要的是 `read_file(path="a.py")`。`**args` 就是那把"拆包工具"：

```python
args = {"path": "a.py"}
handler(**args)        # 等价于 read_file(path="a.py")
```

好处：不管哪个工具、要几个参数，`handler(**args)` 这一行全搞定，不用为每个工具写 `if`。

## 三、安全护栏：safe_path 和 WORKDIR

文件操作现在是**模型说了算**——它给个路径，代码就去读/写。万一它给的是 `../../../etc/passwd`（用 `../` 一路往上爬，逃出项目目录去读系统文件）呢？这叫**路径穿越攻击（path traversal）**。

`safe_path` 就是挡这个的门卫：

```python
WORKDIR = os.getcwd()   # 你运行程序所在的目录 = agent 的"地盘边界"

def safe_path(path):
    full = os.path.abspath(os.path.join(WORKDIR, path))  # ① 算成真实绝对路径
    if not full.startswith(WORKDIR):                      # ② 检查有没有逃出地盘
        raise ValueError(f"path escapes workdir: {path}")
    return full
```

核心就是第 ② 行那个 `if`。两个关键点：

**1. 校验的是 `full`（算完的真实路径），不是模型给的原始 `path`。**

因为原始 `path` 带着 `../` 的伪装，直接看会被骗。必须先用 `os.path.abspath` 把 `../` **实际算掉**，露出真面目，再检查：

```python
path = "../../../etc/passwd"   # 模型给的，带伪装
full = "/etc/passwd"           # abspath 算完，真面目
```

**2. `full` 跟 `WORKDIR` 比。** `full.startswith(WORKDIR)` 就是问："这个真实路径，是不是以我的地盘开头？"

```
WORKDIR = /Users/xunxun/LearnClaudecode/s02_tool_use

full = .../s02_tool_use/notes.txt    ← 以 WORKDIR 开头 ✅ 在地盘内 → 放行
full = /etc/passwd                   ← 不以 WORKDIR 开头 ❌ 越界 → 拦下
```

> `os.path.abspath` 和 `startswith` 是一对：前者拆穿 `../` 的伪装，后者负责拦截。少了 abspath，带 `../` 的字符串就骗过去了。
>
> 注意 `bash` 没过 safe_path——它本来就是"啥都能干"的兜底工具，没法限制。这也是为什么要优先用专用工具：更安全可控。

## 四、实验：模型什么时候调一个、什么时候调多个

填完代码，我跑了几条 prompt，重点观察**一次调几个工具**。

### 怎么从输出"数"出调了几个工具

每次工具被执行，代码会打印一个带 emoji 的图标行（`📖 read_file` / `✍️ write_file` / `🔍 glob` ...），而 `🤖` 是模型说的话。**数「提问」和「🤖 回答」之间的图标行**，几个图标 = 调了几次工具。

### 三种典型情况

**① 简单任务 → 单工具**
```
👤 Read practice.py and tell me how many tools it defines
  📖 read_file(practice.py)        ← 只有 1 个图标
🤖 它定义了 5 个工具：...
```

**② 有依赖的多步 → 必须分轮（顺序）**
```
👤 Create test.py that prints "hello", then read it back
  ✍️ write_file(test.py)
  📖 read_file(test.py)
```
write 和 read 有**依赖**：得先写完，才能读回来。所以模型先 write、**看到"写成功"的结果**，下一轮才 read。

**③ 独立的多步 → 可以一次调多个（并行）**
```
👤 Read both ANSWER.py and requirements.txt, then write a summary file
  📖 read_file(ANSWER.py)
  📖 read_file(requirements.txt)
  ✍️ write_file(summary.md)
```
两个 read **互相独立**（读 A 不依赖读 B）→ 可以打包一次调；而 write **依赖**两个 read 的内容 → 必须等读完才能写。

### 一个诚实的细节：光数图标看不出"分几轮"

`📖📖✍️` 三个图标只能告诉你"总共调了 3 次"，**看不出**这是"1 轮调 2 个 + 1 轮调 1 个"还是"3 轮各 1 个"。想看清每轮调几个，得在循环里加一行"探针"：

```python
if not msg.tool_calls:
    return
print(f"这一轮模型一次点了 {len(msg.tool_calls)} 个工具")   # ← 探针
for call in msg.tool_calls:
    ...
```

关键认知：`msg.tool_calls` 是个**列表**，模型一轮**可以同时点多个工具**。`len()` 它就知道这轮点了几个，某轮 ≥2 就是并行调用。

## 五、总结

1. **加工具 = 加一行**。靠 `TOOL_HANDLERS` 这张"工具名→函数"的派发表，循环代码完全不动。
2. **`**args`** 把模型给的参数字典拆成关键字参数，一行统一处理所有工具。
3. **safe_path** 是给文件工具的安全护栏：先 `abspath` 拆穿 `../` 伪装，再用 `startswith(WORKDIR)` 拦住逃出地盘的路径。校验的是算完的真实路径，不是模型给的原始字符串。
4. **`msg.tool_calls` 是列表**，模型能一次调多个工具：**独立**的操作可以并行打包，**有依赖**的必须一轮轮等结果。

下一步（s03）会给工具加**权限控制**——模型想执行危险操作时，先问一句 allow / deny / ask。
