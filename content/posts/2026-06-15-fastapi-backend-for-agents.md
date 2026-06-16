---
title: "2026-06-15 FastAPI 进阶：搭一个能跑 Agent 的后端"
date: 2026-06-15
draft: false
tags: ["FastAPI", "后端", "Agent", "异步", "数据库", "学习笔记"]
math: true
ShowToc: true
TocOpen: true
description: "vibe coding 时代学 FastAPI 的进阶笔记：错误处理 HTTPException、文件上传、依赖注入 Depends、async/await 异步原理、数据库 SQLModel 与事务 ACID。每个知识点都标了「为什么 agent 要用」和「大厂面试怎么答」。"
---

这是我学 FastAPI 进阶部分整理的笔记。和入门那篇（查询参数、请求体、response_model）不同，这次的目标很明确：**搭一个能真正跑 agent 的后端**——能调 LLM、能存对话记忆、能扛并发、能鉴权。

我现在是 vibe coding 的方式在学：**不追求闭卷默写，而是「读得懂 AI 写的代码 + 能指出哪里不对 + 能说清自己要什么」**。所以下面每个知识点我都标了两件事——它对**写 agent** 有什么用，以及**大厂面试**会怎么考。

先一句话串起全篇：

> 一个 agent 后端的骨架 = **接口（处理请求）+ 错误处理（诚实报错）+ 异步（扛并发）+ 数据库（存记忆）+ 依赖注入（管连接和鉴权）**。

---

## 一、HTTPException：出错了要「诚实地报错」

### 痛点：硬返回 None 是在「撒谎」

查一只不存在的宠物，如果这么写：

```python
@app.get("/pets/{pet_id}")
def get_pet(pet_id: int):
    pet = pets_db.get(pet_id)   # 没找到，pet = None
    return pet                  # 直接返回 None
```

后果是：状态码还是 `200 OK`，body 是 `null`。这等于**明明失败了却告诉前端「成功了」**。前端通常这么判断：

```javascript
if (response.ok) {        // 200 → ok 是 true，以为成功了
    showPet(data.name);   // data 是 null → 💥 报错 "Cannot read 'name' of null"
}
```

更糟的是用中括号取值 `pets_db[999]`——直接 `KeyError`，FastAPI 兜底返回 **500**，把「用户查了个不存在的 id」（用户的锅，4xx）甩锅成「服务器坏了」（服务器的锅，5xx）。

### 正确做法：主动 raise

```python
from fastapi import FastAPI, HTTPException

@app.get("/pets/{pet_id}")
def get_pet(pet_id: int):
    if pet_id not in pets_db:
        raise HTTPException(status_code=404, detail="找不到这只宠物")
    return pets_db[pet_id]
```

前端会收到状态码 `404` + body `{"detail": "找不到这只宠物"}`，一切尽在掌控。

### 关键：`raise` vs `return`

| | `return` | `raise` |
|---|---|---|
| 含义 | 正常返回结果 | 中断，抛出错误 |
| 之后的代码 | —— | **立刻停止，下面不再执行** |
| 状态码 | 默认 200 | 你指定的（404/400…） |

正因为 `raise` 会中断，所以**不用写 `else`**：

```python
if pet_id not in pets_db:
    raise HTTPException(404, "找不到")
return pets_db[pet_id]   # 只有"找到了"才会走到这里
```

### 一个顺序铁律

```python
# ✅ 永远「先查存在(404) → 再碰属性/查状态(400)」
if pet_id not in pets_db:
    raise HTTPException(404, "找不到这只宠物")
if pets_db[pet_id]["adopted"]:
    raise HTTPException(400, "这只宠物已经被领养了")
```

如果顺序反了，先碰 `pets_db[pet_id]["adopted"]`，遇到不存在的 id 会先 `KeyError` 崩成 500，轮不到那句友好的 404。

> **怎么理解 HTTPException 的定位**：`if` 负责「发现问题」，`HTTPException` 负责「用前端听得懂的语言把问题喊出去」。它是「**报告异常**」的工具，不是「判断异常」的工具。
>
> 对比：`raise ValueError` 会被 FastAPI 兜底成 500（前端看不懂）；`HTTPException` 是 Web 专用、能带状态码的异常（404/400/401/403/409）。

**agent 视角**：AI 写接口经常图省事直接 `return pet`，少了 404 检查。能一眼看出「这里该报 404」就是你的价值。

---

## 二、文件上传：把图片喂给多模态模型

接收上传文件用 `UploadFile`：

```python
from fastapi import FastAPI, File, UploadFile

@app.post("/uploadfile/")
async def create_upload_file(file: UploadFile):
    return {"filename": file.filename}
```

`bytes` 和 `UploadFile` 怎么选：

| | `bytes` | `UploadFile` ✅ |
|---|---|---|
| 怎么存 | 整个文件全塞进内存 | 小文件放内存，大了自动写硬盘 |
| 适合 | 小文件 | 大文件（图片/视频/PDF），不爆内存 |
| 能拿到信息 | 只有内容 | 还有 `filename`、`content_type` |

`UploadFile` 三件套：`file.filename`、`file.content_type`、`await file.read()`。

**agent 视角**（文件上传唯一对 agent 重要的点）：做多模态 agent 时，链路是——

```
用户上传图片 → UploadFile 接住 → await file.read() 拿 bytes → base64 编码 → 喂给多模态 LLM → 返回结果
```

```python
import base64
from anthropic import Anthropic
from fastapi import FastAPI, UploadFile

@app.post("/analyze-image/")
async def analyze_image(file: UploadFile):
    image_bytes = await file.read()                              # 读出原始字节
    image_b64 = base64.standard_b64encode(image_bytes).decode("utf-8")
    message = client.messages.create(
        model="claude-opus-4-8",
        max_tokens=1024,
        messages=[{
            "role": "user",
            "content": [
                {"type": "image", "source": {
                    "type": "base64",
                    "media_type": file.content_type,   # 复用 UploadFile 给的类型
                    "data": image_b64,
                }},
                {"type": "text", "text": "这张图里是什么宠物？"},
            ],
        }],
    )
    return {"answer": message.content[0].text}
```

> 本质：后端在这里是个「翻译官 + 二传手」——把用户的文件翻译成模型吃得下的格式（bytes → base64），传给模型，再把回答传回去。

注意这里出现了 `await`——下一节解释它。

---

## 三、async / await：后端为什么要异步

### 要解决的问题：大量时间在「干等」

后端干的活几乎都是 **I/O 操作**——查数据库、调 LLM API、读文件，共同点是「发出请求后自己啥也不干，纯等外部返回」。等的时候 CPU 是空闲的，浪费了。

### 核心类比：一个服务员

把服务器想成一个服务员，请求是客人点的菜：

- **同步（普通 `def`）**：客人 A 点了菜，服务员走进厨房盯着锅等 3 分钟，这期间 B、C 喊破喉咙也不理。一次只能伺候一桌。
- **异步（`async def`）**：A 点完菜下单给厨房就立刻转身去服务 B、C，厨房喊"A 的菜好了"再回来端。**等菜的时间用来服务别人**。

```python
# ✅ 异步：等 LLM 的 3 秒，服务员去处理别的请求
@app.get("/ask")
async def ask(q: str):
    answer = await call_llm(q)   # "下单给 LLM，我先去忙别的，回来再接着"
    return answer
```

- `async def` = 声明「这个函数里有要等的活儿，**允许中途让出去**」
- `await` = 标出「**就是这一步要等**，让出空闲时间去服务别人」
- **铁律**：`await` 只能用在 `async def` 里，俩配套。

### 面试必考三连

**1. 并发 ≠ 并行（concurrency vs parallelism）**

| | 并发 Concurrency | 并行 Parallelism |
|---|---|---|
| 比喻 | 一个服务员轮流招呼多桌 | 多个服务员各管各的桌 |
| 本质 | 一个 CPU 核交替处理 | 多个 CPU 核真同时跑 |
| async 属于 | ✅ 并发 | ❌ 不是并行 |

async 是**一个线程**在多个任务间快速切换（趁等待间隙切走），不是真同时跑。

**2. async 治「等」不治「算」**

只对 I/O 有用；纯 CPU 暴力计算（如把 1 加到 1 亿）用 async 没意义，那要靠多进程/多核。判断口诀：

> 🔑 **等外部（API/数据库/文件/网络）= async；纯计算 = async 没用。**

注意一个陷阱：「调一个外部 API 等 2 秒」是**等**不是**算**，所以该用 `async def`。

**3. 事件循环（event loop）**

背后那个调度员。它盯着所有 `await` 的任务，谁在等就挂起、CPU 让给能干的任务；谁的外部结果回来了就捞回来接着跑。

**面试金句**：async 靠**单线程 + 事件循环**，在 I/O 等待时切换任务实现**并发**（不是并行）。

---

## 四、Depends 依赖注入：管连接和鉴权的命脉

### 痛点：公共逻辑被抄很多遍

3 个接口都要先检查 token，于是同一段「查 token」抄了 3 遍，改一处要改三处、漏一个就出 bug。

### Depends：把公共前置逻辑抽出来，自动注入

```python
from fastapi import FastAPI, Depends, HTTPException

def verify_token(token: str):
    if token != "secret":
        raise HTTPException(401, "没登录")
    return {"user": "Maggie"}

@app.get("/profile")
def profile(user: dict = Depends(verify_token)):
    return {"page": "个人主页", "user": user}
```

### 完整流程（六步）

请求打到 `/profile?token=secret`：

1. 请求进来，FastAPI 准备跑 `profile`。
2. 扫参数，看到 `user: dict = Depends(verify_token)`，意识到「跑 profile 之前得先跑 verify_token」。**注意此刻 profile 函数体还没开始执行**。
3. FastAPI 替你调用 `verify_token`，`token` 从网址 `?token=secret` 来（普通参数走「外面传进来」那条路）。
4. `verify_token` 内部分两种结果：token 错 → `raise HTTPException(401)`，请求当场中断，profile 永不执行；token 对 → `return {"user": "Maggie"}`。
5. **注入**：FastAPI 把返回值塞进 `profile` 的 `user` 参数。
6. `profile` 这才开始执行，此刻 `user` 已经是 `{"user": "Maggie"}`。

浓缩成一句话：

> 看到 `Depends` → 先替你跑那个函数 → 要么拦下请求(401)、要么算出值注入参数 → 接口才开跑。

这里有两个细节值得校准：

- **依赖是「之前」跑，不是「跑到一半」跑**。FastAPI 收到请求后先把所有 Depends 解析完、值备齐，最后才带着备好的值调用接口。正因为依赖在接口开跑前就执行完了，它才有资格把人挡在门外。
- **普通参数 vs Depends 参数，区别在「值的来源」**：`pet_id: int` 是 FastAPI 去请求里**解析外部输入**；`user = Depends(verify_token)` 是 FastAPI **执行你写的函数取返回值**。记法：**普通参数 = 框架替你取外部的值；Depends 参数 = 框架替你算一个值**（取 vs 算）。这也是为什么 Depends 能塞复杂逻辑（查数据库、解 JWT、连 Redis）。

### 依赖有两种「工种」

| | 守门员型（`verify_token`） | 服务员型（`get_db`） |
|---|---|---|
| 它的活儿 | 检查你够不够格 | 递给你一个工具 |
| 有对/错判断吗 | ✅ 有，错了 `raise 401` 拦下 | ❌ 没有，来了就给 |
| 类比 | 门口查证件的保安 | 进门递笔的前台 |

### yield 版依赖：管「用完要清理」的资源

```python
def get_db():
    db = SessionLocal()
    try:
        yield db          # 把连接交给接口
    finally:
        db.close()        # 接口用完，自动关闭
```

- `yield` 之前 = 准备资源（开连接）
- `yield db` = 把资源交给接口
- `yield` 之后（`finally`）= 接口跑完后自动清理（关连接）

> 类比「借充电宝」：取出充电宝给你 → 你用 → 用完自动帮你归还。`return` 是给你东西就走人不管你还不还；`yield` 是借给你、等你用完再来收。数据库连接、文件句柄这类「开了必须关」的资源都用 yield。

一个容易混的点：**`get_db` 只负责「开会话 + 用完关会话」，写动作（add/commit）不在它里面，在接口里做**。前台递笔（开会话），你拿笔写字（接口里 add/commit）。

**agent 视角**：真实 agent 后端里，数据库连接、LLM client、当前登录用户、配置全靠 Depends 注入。这是它最值的地方。

---

## 五、数据库 SQLModel + 事务：让 agent「记得住」

### 地基：内存 vs 硬盘

| | 内存（RAM） | 硬盘（SSD/HDD） |
|---|---|---|
| 比喻 | 办公桌桌面 | 书柜 |
| 断电后 | **全清空** ❌ | **东西还在** ✅ |
| 存啥 | 程序正在用的临时数据 | 长期保存的数据 |

Python 变量（字典、列表）都活在内存里 → 重启就没。之前练习用的 `pets_db = {...}` 服务器一重启就全丢。数据库把数据写进硬盘 → 重启还在。**agent 要记得住对话和记忆，就必须用数据库。**

### SQLModel：用 Python 类操作数据库

把数据库想成一张永久的 Excel 表：表 = 表格，字段 = 列，记录 = 行，主键（primary key）= 身份证号那列（唯一不重复）。

```python
from sqlmodel import SQLModel, Field

class Pet(SQLModel, table=True):     # table=True 表示这是一张真表
    id: int | None = Field(default=None, primary_key=True)
    name: str
    age: int
```

这个类就是表的「表头说明书」。它长得像 Pydantic 的 `BaseModel`，因为 **SQLModel = Pydantic + 数据库**。这种「用类映射表」的工具叫 **ORM**（Object-Relational Mapping）——让你用操作对象的方式操作数据库，不用手写 SQL（面试会问「什么是 ORM」）。

### Session = 一次会话

```python
from sqlmodel import create_engine, Session, select

engine = create_engine("sqlite:///pets.db")   # 连到硬盘上的文件
SQLModel.metadata.create_all(engine)           # 照着类把表建出来

with Session(engine) as db:        # 拨通会话，叫它 db
    pet = Pet(name="旺财", age=3)
    db.add(pet)                     # 放进"待保存"篮子
    db.commit()                     # 按下"保存键"，真正写进硬盘
# 缩进结束 → 会话自动关闭
```

- **Session = 和数据库的「一通电话/一次会话」**，里面才能增删改查。用 `with` 开、缩进结束自动关。`engine` 是电话号码（存一次），Session 是每次拨通（用一次开一次）。
- **`commit` = 保存键**：增/改/删完要 commit 才真正落盘；查不用。不 commit 等于敲完字没按 Ctrl+S。

### 和 Depends 合体（真实接口长相）

```python
def get_db():
    with Session(engine) as db:
        yield db                  # 借出会话，用完自动关

@app.post("/pets")
def add_pet(pet: Pet, db: Session = Depends(get_db)):
    db.add(pet); db.commit(); db.refresh(pet)
    return pet
```

第①站的 Depends + 第⑤站的 Session 在 `get_db` 这里合体：**Depends 自动把数据库会话注入接口，接口操作完 commit，框架自动关连接**。

### 事务 Transaction（面试必考）

经典例子——转账，A 给 B 转 100 块分两步：① A 扣 100，② B 加 100。如果做完①正要做②时崩了，钱就凭空蒸发了。

> **事务 = 把一组操作捆成一个整体，「要么全部成功，要么全部当没发生」，不允许做一半。**

```python
def transfer(db: Session):
    try:
        account_a.balance -= 100      # ①
        account_b.balance += 100      # ②
        db.commit()                   # 两步都没事 → 一起提交 ✅
    except Exception:
        db.rollback()                 # 任何一步出错 → 全部撤销，回到转账前 ↩️
        raise
```

`commit` 是确认存盘、`rollback` 是一键撤销（当无事发生）。其实 `db.commit()` 本身就是提交一个事务。

**面试金句 ACID**：

| 字母 | 名字 | 人话 | 转账例子 |
|---|---|---|---|
| A | 原子性 Atomicity | 要么全做、要么全不做 | 不会只扣不加 |
| C | 一致性 Consistency | 前后数据都合法 | 总金额不变 |
| I | 隔离性 Isolation | 多笔事务并发互不干扰 | 你转账时别人转账不打架 |
| D | 持久性 Durability | 一旦 commit，断电也不丢 | 转成功就永久记下 |

回答事务时先说「要么全成要么全败」（是什么），再说「靠 commit/rollback 实现」（怎么做），配上转账例子就满分。

---

## 六、串起来的几个基础铁律

学进阶时反复用到的几个入门铁律，顺手记一下：

- **请求体 vs 查询参数**：查询参数（网址 `?` 后面）只适合放小数据；用户登录这种复杂结构化数据用请求体（配 POST）。
- **默认值 = 可选，不给默认值 = 必填**——贯穿全程。
- **查询参数模型**必须 `Annotated[模型, Query()]`，否则被当请求体。
- **限定白名单用 `Literal`**，不是 `or`（`sort = "age" or "name"` 只会返回 `"age"`）。
- **字段校验交给 Pydantic 的 `Field`**（如 `price: float = Field(gt=0)`），别在函数里手写 if。校验自动化、不会漏。
- **启动**：`uvicorn main:app --reload`（不能 `python main.py`），配 `/docs` 的 Try it out 调试。

---

## 小结

这次进阶的本质，是把一个 agent 后端的骨架拼齐了：

> **接口收请求 → HTTPException 诚实报错 → async 扛并发 → 数据库存记忆 → Depends 管连接和鉴权。**

vibe coding 时代我的判断标准没变：这些知识**不用闭卷默写**，但要能**读懂 AI 写的、指出哪里不对、说清自己要什么**。其中 Depends、async、数据库+事务是真要嚼透的（也是面试高频），文件上传、状态码这些速通即可。
