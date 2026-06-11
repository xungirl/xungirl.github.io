---
title: "2026-06-11 FastAPI 响应模型与请求体学习笔记"
date: 2026-06-11
draft: false
tags: ["FastAPI", "Python", "后端", "Pydantic", "学习笔记"]
math: true
ShowToc: true
TocOpen: true
description: "学 FastAPI 时整理的笔记：响应模型 response_model 怎么过滤敏感字段、请求体和查询参数到底怎么分、路由和函数参数各是什么意思。"
---

这篇是我接着上次学 FastAPI 时整理的笔记。上次学的都是「数据怎么**进来**」（查询参数、请求体、校验），这次换了个方向，研究「数据怎么**出去**」——也就是 `response_model`，顺带把困扰我很久的「请求体 vs 查询参数」彻底分清楚了。

一句话总结这次的核心：

> **`response_model` 是给接口出口装的筛子**：你规定它只准返回哪些字段，多余的（比如密码）自动被丢掉。

下面按「响应模型 → 请求体 vs 查询参数 → 路由和参数到底是什么 → 最该记住的几点」来展开。

## 一、响应模型 response_model

### 1. 先讲痛点：返回数据会泄露敏感字段

在 FastAPI 里有条铁律：**你 `return` 什么，前端就收到什么**。

假设数据库里的用户带密码字段：

```python
class User(BaseModel):
    username: str
    password: str      # 敏感字段！
    email: str

@app.post("/users/")
async def create_user(user: User):
    return user        # 灾难：把 password 原样返回给了前端
```

这样写，密码就跟着 JSON 一起发出去了。`response_model` 就是用来堵这个漏洞的。

类比一下：Pydantic 请求体像**安检进站**（检查你带进来的东西）；`response_model` 像**安检出站**（检查你带出去的东西，违禁品没收）。

### 2. 怎么用：进、出各写一个模型

经典套路是定义**两个模型**——一个收（带敏感字段），一个发（不带）。

```python
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

# 进：注册时前端要传的（含密码）
class UserIn(BaseModel):
    username: str
    password: str
    email: str

# 出：返回给前端的（不含密码！）
class UserOut(BaseModel):
    username: str
    email: str

@app.post("/users/", response_model=UserOut)   # 关键在这
async def create_user(user: UserIn):
    return user        # 即使返回了带 password 的对象，也会被过滤成 UserOut
```

神奇之处：函数里 `return` 的明明是带密码的 `user`，但前端收到的 JSON 里**根本没有 password**。FastAPI 在出门那一刻，按 `UserOut` 重新「拓印」了一份。

注意 `response_model=UserOut` 写在**装饰器里**，不是函数参数里。

### 3. response_model 的三大作用

1. **过滤字段**：模型里没声明的字段一律不返回（防敏感字段泄露）。
2. **校验 + 转换**：返回的数据也会被校验一遍，保证给前端的格式永远对。
3. **自动文档**：`/docs` 里会显示这个接口「返回长什么样」。

### 4. 一个易错点：return 必须凑齐出口模型的字段

举个我自己踩的坑。需求是「添加宠物」：传入 `name` / `breed` / `internal_note`（内部备注，不返回），只返回 `name` / `breed` / `status`。

```python
class PetIn(BaseModel):
    name: str
    breed: str
    internal_note: str

class PetOut(BaseModel):
    name: str
    breed: str
    status: str        # 注意：PetIn 里根本没有 status

@app.post("/pets/", response_model=PetOut)
async def create_pet(pet: PetIn):
    return {
        "name": pet.name,
        "breed": pet.breed,
        "status": "available",   # 必须手动补上 status
    }
```

这里**不能** `return pet`。因为 `pet` 是 `PetIn`，里面没有 `status`，而 `PetOut` 要求必须有 `status` → 出门一筛发现缺字段，直接报错（500，这是后端的锅）。

**记住：你 `return` 的东西必须凑齐出口模型要求的所有字段，缺一个都不行。**

> 还有个搭档 `response_model_exclude_none=True`：值为 `None` 的字段就不出现在响应里。先知道有这东西，用到再说。

## 二、请求体 vs 查询参数，到底怎么分

这是我之前一直绕不清的地方，这次终于理顺了。

### 1. 为什么有两种？

- **查询参数（query parameters）**：网址 `?` 后面的 `名字=值`，只适合放**比较小的数据**（页码、关键词、排序方式这类）。
- **请求体（request body）**：对于**复杂数据**——比如用户登录（账号 + 密码）、新建一条完整记录——就得用请求体，把一坨结构化 JSON 放进去。

搭配的 HTTP 方法也不同：

| | 查询参数 | 请求体 |
|---|---|---|
| 数据放哪 | 网址 `?page=1&size=20` | 请求 body 里的 JSON |
| 适合的数据 | 小、简单（筛选、分页） | 大、复杂（登录、新建记录） |
| 常配的方法 | **GET** | **POST**（及 PUT/PATCH） |

### 2. FastAPI 的默认判断规则

FastAPI 看函数参数的**类型**，来决定去哪里取数据：

| 参数类型 | FastAPI 默认去哪找 |
|---|---|
| Pydantic 模型（如 `PetIn`） | **请求体 body** |
| 单一类型（`int` / `str`，且不在路径里） | 查询参数（网址 `?`） |
| 名字在路径 `{}` 里 | 路径参数 |

**最关键的一条**：FastAPI 看到一个 Pydantic 模型当参数，**默认就去请求体 body 里找数据**。

所以：

- 想要 body（POST 新建那种）→ 默认正合意，**直接写 `pet: PetIn` 就行**。
- 想要查询参数（GET 搜索那种）→ 默认判错了，得手动改判。

### 3. 把模型改判成查询参数：Annotated + Query()

如果我想用一个模型来打包一堆查询参数，就得用 `Annotated[模型, Query()]` 告诉 FastAPI「别当请求体，这是查询参数」：

```python
from typing import Annotated, Literal
from fastapi import FastAPI, Query
from pydantic import BaseModel

class PetSearch(BaseModel):
    model_config = {"extra": "forbid"}   # 禁止多余的查询参数
    page: int = 1
    size: int = 20
    sort: Literal["age", "name"] = "age"
    species: str = ""

app = FastAPI()

@app.get("/pets/search")
async def search_pets(search: Annotated[PetSearch, Query()]):   # 关键：Query()
    return search
```

`Annotated[类型, 指示]` 可以理解成：「这是个 `PetSearch`，**但请按查询参数来收**」。第一格是真正的类型，第二格 `Query()` 是给 FastAPI 的额外指示。

**如果忘了 `Query()`**，模型会被当成请求体，GET 请求从网址 `?` 传的数据就拿不到了（FastAPI 跑去空的 body 里找）。这是我踩过好几次的坑。

## 三、路由和函数参数到底是什么

顺手把这两行彻底拆开理解了一遍：

```python
@app.post("/pets/", response_model=PetOut)
async def create_pet(pet: PetIn):
```

### 1. 装饰器那行（路由 route）

```python
@app   .post   ("/pets/"   , response_model=PetOut)
 │       │        │              │
 │       │        │              └─ 出口筛子
 │       │        └─ 路径（URL）
 │       └─ HTTP 方法
 └─ 装饰器，挂在下面那个函数头上
```

连起来读就是一句话：

> 「当有人用 **POST** 方式访问 **`/pets/`** 时，运行下面的 `create_pet` 函数，并把它返回的东西按 **`PetOut`** 筛一遍再发出去。」

`@app.post(...)` 像在门上贴张牌子：「敲这扇门的人，由 `create_pet` 接待」。**我从来不自己调用 `create_pet`**，是 FastAPI 收到请求时自动帮我调用。

### 2. 函数括号里是「参数」，但有点特殊

```python
async def create_pet(pet: PetIn):
#                     │     └─ 类型注解（决定 FastAPI 去哪取数据）
#                     └─ 参数名（自己随便起）
```

普通 Python 函数的参数是「别处调用时手动传进来的」；而 FastAPI 的函数参数，是**前端发请求时 FastAPI 自动把数据塞进来的**。

像点外卖：我只写好「我要什么（`pet: PetIn`）」，外卖小哥（FastAPI）自动把货送到我手里（填进 `pet`）。而**写什么类型，FastAPI 就去对应的地方取数据**（见上面那张表）。

## 四、最该记住的几点

1. **默认值 = 可选，不给默认值 = 必填**（贯穿全程的铁律，参数和模型字段都适用）。
2. **查询参数模型必须 `Annotated[模型, Query()]`**，否则被当成请求体。
3. **限定白名单用 `Literal`，不是 `or`**（`"age" or "name"` 永远只等于 `"age"`，因为非空字符串为真，`or` 短路返回第一个）。
4. **模型默认 = 请求体**；想从网址 `?` 拿，才需要套 `Query()`。
5. **`response_model` 写在装饰器里**，是出口筛子；`return` 的东西要凑齐出口模型的所有字段。

最后别忘了启动方式（不能 `python main.py`）：

```bash
uvicorn main:app --reload
```

`main` 是文件名，`app` 是 FastAPI 实例变量名，`--reload` 是改代码自动重启。然后打开 `/docs`，用 Try it out → Execute 真正发请求测试。
