---
title: "2026-06-26 手搓 Agent：权限护栏与 Hook 系统学习笔记"
date: 2026-06-26
draft: false
tags: ["Agent", "LLM", "Claude Code", "Hook", "学习笔记"]
math: true
ShowToc: true
TocOpen: true
description: "手搓 coding agent 课程的第三、四节：怎么在工具执行前加三道权限闸门，怎么把这些检查抽象成 Hook 事件系统；附一个亲手绕过黑名单的实验，理解为什么字符串匹配是假安全。"
---

这是我手搓 coding agent 系列的第 3、4 节笔记（前两节是[最小 agent loop](../2026-06-25-agent-loop-from-scratch/) 和[多工具 dispatch](../2026-06-26-agent-tool-use-dispatch/)）。

前两节做出来的 agent 有个吓人的特点：**模型说调什么工具，循环就直接执行**，包括 `rm -rf /`。这节就是给它装刹车，并且把刹车做成一个可扩展的系统。

一句话总结这两节的本质：

> **s03**：在工具执行前插一道检查，决定放行 / 询问 / 拒绝。
> **s04**：把这道检查从「写死在循环里」抽象成「往事件上挂回调」，以后加功能不用再改循环。

---

## 一、s03 权限护栏：三道闸门

之前的循环是"信任模型"——`handler(**args)` 直接执行。s03 只做一件事：**在执行之前加一段检查**。整个循环、工具、dispatch 表都没动，只在执行前多调了一个 `check_permission()`。

核心是**三道闸门，从严到松**：

```
工具要执行了
   │
闸门1 DENY_LIST ──命中──→ ⛔ 直接拒，连问都不问
   │ 没命中
闸门2 RULES ──命中──→ 闸门3 ask_user ──你按 N──→ 拒绝
   │ 没命中            └──你按 y──→ 放行
   │
  ✅ 执行
```

### 闸门 1：硬拒绝表（deny list）

一张黑名单，命中直接拒：

```python
DENY_LIST = ["rm -rf /", "sudo", "shutdown", "reboot", "mkfs", "dd if=", "> /dev/sda"]

def check_deny_list(command: str) -> str | None:
    for pattern in DENY_LIST:
        if pattern in command:          # 字符串包含就算命中
            return f"Blocked: '{pattern}' is on the deny list"
    return None                         # 没命中 → None
```

这里有个贯穿全节的约定：**命中返回理由字符串（真值），没命中返回 `None`（假值）**。这样上层一句 `if reason:` 就能判断。

### 闸门 2：规则匹配（rules）

比黑名单聪明的地方：每条规则是**数据**，不是写死的 if。一条规则 = 「管哪些工具 + 什么条件触发 + 给用户看的理由」：

```python
PERMISSION_RULES = [
    {
        "tools": ["write_file", "edit_file"],
        "check": lambda args: escapes_workdir(args.get("path", "")),
        "message": "Writing outside workspace",
    },
    {
        "tools": ["bash"],
        "check": lambda args: any(kw in args.get("command", "")
                                  for kw in ["rm ", "> /etc/", "chmod 777"]),
        "message": "Potentially destructive command",
    },
]

def check_rules(tool_name: str, args: dict) -> str | None:
    for rule in PERMISSION_RULES:
        if tool_name in rule["tools"] and rule["check"](args):
            return rule["message"]
    return None
```

这和上一节的 dispatch 表是**同一种思想：把逻辑变成一张表，加规则只加一行，函数不动**。

### 闸门 3：人工审批

就是 `input()` 暂停等你敲 `y`。注意提示是 `[y/N]`，大写 N —— **默认拒绝**，直接回车 = 不允许，这是安全软件的惯例。

### 串联：红绿灯

```python
def check_permission(name: str, args: dict) -> bool:
    if name == "bash":                              # 闸门 1 只对 bash 查命令
        reason = check_deny_list(args.get("command", ""))
        if reason:
            print(f"⛔ {reason}")
            return False                            # 黑名单：直接拒，不问

    reason = check_rules(name, args)                # 闸门 2
    if reason:
        if ask_user(name, args, reason) == "deny":  # 闸门 3
            return False
    return True                                     # 全过 → 放行
```

返回值就是个红绿灯：`True` 放行，`False` 拦下。接进循环也只改一行：

```python
if not check_permission(name, args):
    output = "Permission denied by user/policy."    # 拒绝：不执行，回一句话给模型
else:
    output = handler(**args)                         # 这下面全是原样
```

关键细节：被拒绝时**不是报错崩掉**，而是把 `"Permission denied"` 当工具结果喂回模型。模型于是知道"这条路走不通"，会自己换方式——这正是 Claude Code 被你拒绝后会改方案的原理。

---

## 二、s04 Hook 系统：把检查变成可挂载的事件

s03 把权限检查**写死**在循环里。问题来了：我还想加日志、加大输出提醒、加退出统计……每加一个都得回去改循环，循环越来越臃肿。

s04 的思路：把循环里的"插桩点"抽象成几个**事件**，谁想在某个时刻插逻辑，就往那个事件上**注册**一个回调函数（hook）。循环只负责在对应时刻喊一声"这个事件发生了"。

| 事件名 | 触发时机 | 本节挂的 hook |
|---|---|---|
| `UserPromptSubmit` | 用户输入后、进 LLM 前 | 注入上下文（演示打印 cwd） |
| `PreToolUse` | 每个工具执行**前** | 权限检查 + 日志 |
| `PostToolUse` | 每个工具执行**后** | 大输出提醒 |
| `Stop` | 循环即将退出时 | 打印本轮工具调用数 |

### 核心：一张表 + 两个函数

```python
HOOKS = {"UserPromptSubmit": [], "PreToolUse": [], "PostToolUse": [], "Stop": []}

def register_hook(event: str, callback):
    HOOKS[event].append(callback)

def trigger_hooks(event: str, *args):
    for callback in HOOKS[event]:
        result = callback(*args)
        if result is not None:      # 非 None => hook 说"停/改"，立刻返回（短路）
            return result
    return None
```

这又是「逻辑变数据」的同一个套路。最值得记住的是 `trigger_hooks` 里那句 **`if result is not None: return result`** —— 一句话同时实现了两种控制能力：

- **`PreToolUse` 返回非 None** → 阻止本次工具执行（返回值当拒绝理由）
- **`Stop` 返回非 None** → 强制续跑（返回值当成新的 user 消息塞回去，让没干完的任务接着做）

s03 的权限逻辑这下就从循环里搬进了一个 hook：

```python
def permission_hook(name, args):
    if name == "bash":
        for pattern in DENY_LIST:
            if pattern in args.get("command", ""):
                return f"Permission denied: '{pattern}' is on the deny list"
    # ... 写文件越界则 ask_user
    return None

register_hook("PreToolUse", permission_hook)
register_hook("PreToolUse", log_hook)        # 注意顺序！
```

接进循环也只是把 s03 那行 `check_permission()` 换成 `trigger_hooks()`：

```python
blocked = trigger_hooks("PreToolUse", name, args)
if blocked:
    output = str(blocked)
else:
    output = handler(**args)
    trigger_hooks("PostToolUse", name, args, output)
```

**注册顺序有意义**：`permission_hook` 必须排在 `log_hook` 前面。否则被拒的命令也会先打一条日志——而我们想要的是"被拒的命令根本看不到日志"。这恰好能用来验证短路机制（见下）。

---

## 三、动手实验：亲手绕过黑名单

光说"字符串匹配不安全"没感觉，得自己绕一次。我写了个离线脚本，直接把命令喂给 `permission_hook`，不连大模型：

```python
test_commands = [
    "rm -rf /",          # 命中 → 拒
    "sudo ls",           # 命中 'sudo' → 拒
    "rm /tmp/foo.txt",   # 不含任何子串 → 放行(!)
    "RM -RF /",          # 大写 → ?
    "rm     -rf /",      # 多空格 → ?
    "s u d o",           # 拆字 → ?
]
for cmd in test_commands:
    result = trigger_hooks("PreToolUse", "bash", {"command": cmd})
    print(cmd, "→", "放行" if result is None else f"拒绝: {result}")
```

跑出来的结果让我印象很深——**后面三条全部放行**：

| 命令 | 黑名单里的 | 为什么没拦住 |
|---|---|---|
| `RM -RF /` | `rm -rf /` | `in` **区分大小写**，大写不匹配 |
| `rm     -rf /` | `rm -rf /` | 空格数量不同，不是连续子串 |
| `s u d o` | `sudo` | 字母被空格拆开，不连续 |

`rm     -rf /`（多空格）在真实 shell 里**照样删根目录**，但护栏放行了它。

还有个意外收获：放行的命令**都带着 `[HOOK] PreToolUse:` 日志**，被拒的那几条**没有**。这就是短路机制的现场证据——被拒时 `permission_hook` 先返回理由，`trigger_hooks` 短路，排在后面的 `log_hook` 根本没机会跑。

---

## 四、易错点 & 踩过的坑

1. **`pattern in command` 要求一字不差地连续出现**。大写、多空格、拆字、引号 `r''m`、变量 `$X`、base64…… 坏写法有无穷变体，黑名单永远列不全。**黑名单 + 字符串匹配 = 假安全**。

2. **真实系统走反过来的思路**：
   - **白名单**：只允许明确认可的操作（列"好的"比列"坏的"可控）；
   - **结构化解析**：把命令解析成"程序名 + 参数"再判断，而不是看原始字符串（比如用 `shlex.split` + `.lower()` 先规整）；
   - **沙箱隔离**：就算放行了，也只能在受限环境里跑，删不到真东西。

3. **`args.get("command", "")` 而不是 `args["command"]`**。`args` 是模型生成的，可能漏字段。`.get(键, 默认值)` 取不到返回默认值不崩；默认值给 `""` 而不是 `None`，是因为下一步要做 `in` 字符串判断，`None` 不能参与 `in`。

4. **相邻字符串字面量会自动拼接**。写测试列表时漏了逗号：
   ```python
   ["echo hello",
    "RM -RF /"        # ← 漏逗号
    "rm -rf /"]       # 这两行被 Python 粘成一条字符串！
   ```
   结果列表少一项，实验全乱。Python 里 `"a" "b"` 等价于 `"ab"`，不需要 `+`。

---

## 小结

到这节为止，手搓的 agent 已经有了：一个循环（s01）→ 多工具 dispatch（s02）→ 三道权限闸门（s03）→ 事件化的 Hook 系统（s04）。

回头看，s02 的 dispatch 表、s03 的规则表、s04 的 hook 注册表，**本质是同一个套路：把会变的逻辑变成数据（一张表），让核心循环保持不动**。这大概是整个 coding agent 架构里最值钱的一个思想。

下一站大概是上下文压缩或子 agent，继续记。
