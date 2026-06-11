---
title: "2026-06-11 FastAPI 入门：查询参数、请求体与接口调试"
date: 2026-06-11
draft: false
tags: ["FastAPI", "Python", "后端", "Pydantic", "学习笔记"]
math: true
ShowToc: true
TocOpen: true
description: "从零上手 FastAPI 的一次完整记录：什么是后端接口、查询参数 vs 路径参数、用 Pydantic 接收请求体、装饰器路径怎么读、如何用 uvicorn 跑起来，以及怎么用 /docs 测试并读懂 200/422 状态码。"
---

这是我学 FastAPI 时整理的入门笔记。FastAPI 是现在最流行的 Python 后端框架之一，我用它完整走了一遍「写接口 → 启动服务 → 测试 → 读懂报错」的闭环。

一句话总结它的**本质**：

> 用 Python 写「后端接口（API）」的框架，靠**类型注解**自动帮你校验数据、生成文档。

下面按我实际学习的顺序展开。

## 一、FastAPI 是什么

先拆解几个词：

- **后端接口（API）**：你刷新页面、点开 App 时，背后有个服务器在「收到请求 → 处理 → 返回数据」。写这个逻辑就是写后端，对外的"窗口"就是 API。
- **框架（framework）**：别人提前搭好的脚手架，你只填业务逻辑，不用从零造轮子。

类比：你开餐厅，FastAPI 就是**已经装修好的厨房**——灶台水管都通了，你只管炒菜。

它这几年特别火，三个杀手锏：

1. **快**：性能在 Python 框架里数一数二（基于异步 asyncio）。
2. **自动生成交互式文档**：写完代码自动给你一个能点击测试的网页。
3. **自动校验数据**：声明字段类型，传错自动报错，不用手写校验。

> 对新手尤其友好：它强依赖 Python 类型提示，学它的同时 Python 基本功也会变扎实。

## 二、最小可运行例子

```python
from fastapi import FastAPI

app = FastAPI()          # 创建一个"应用"实例

@app.get("/")            # 当有人 GET 访问根路径 "/" 时...
def read_root():
    return {"hello": "world"}   # ...就返回这个 JSON
```

逐行看：

| 代码 | 人话解释 |
|------|---------|
| `app = FastAPI()` | 开张，建一个 app |
| `@app.get("/")` | 装饰器：下面这个函数负责处理 GET 访问 `/` 的请求 |
| `def read_root()` | 真正干活的函数 |
| `return {...}` | 返回的字典会被**自动转成 JSON** 发出去 |

## 三、接收数据的三件套

写接口的核心就是「怎么接收别人传来的数据」。FastAPI 有三种方式。

### 1. 查询参数（query parameters）

你肯定见过这种网址：

```
https://shop.com/search?keyword=猫粮&page=2
```

`?` 后面那部分就是**查询参数**：每个是 `名字=值`，多个用 `&` 连接。它是你给接口的"附加条件"（搜什么、第几页）。

在 FastAPI 里，**没出现在路径里的函数参数，就当成查询参数**：

```python
@app.get("/search")
def search(keyword: str, page: int = 1):
    return {"你搜的是": keyword, "第几页": page}
```

访问 `/search?keyword=猫粮&page=2` 返回 `{"你搜的是": "猫粮", "第几页": 2}`。

- `keyword: str` —— **没默认值 → 必填**，不传会 422 报错。
- `page: int = 1` —— **有默认值 → 可选**，不传就用 1；`: int` 让 FastAPI 自动把网址里的字符串 `"2"` 转成整数。

### 2. 路径参数 vs 查询参数

这两个容易混：

```
/users/123          ← 123 是「路径参数」，是地址的一部分
/users?id=123       ← id=123 是「查询参数」，挂在 ? 后面
```

| | 路径参数 | 查询参数 |
|---|---------|---------|
| 位置 | 在路径里 `/users/{id}` | 在 `?` 后面 |
| 语义 | 定位**某个具体资源** | **筛选 / 配置**，常可选 |
| 例子 | 第几号用户 | 排序、分页、关键词 |

### 3. 请求体（request body）+ Pydantic

查询参数只能塞简单小数据。要传一坨结构化数据（比如注册表单），就放进**请求体**——相当于寄快递时，网址是"收件地址"，请求体是"箱子里装的东西"。请求体通常配合 **POST / PUT / PATCH**。

用 **Pydantic 的 `BaseModel`** 定义一张"数据格式说明书"：

```python
from pydantic import BaseModel

class Item(BaseModel):
    name: str                       # 必填
    description: str | None = None  # 可选（有默认值 None）
    price: float                    # 必填
    tax: float | None = None        # 可选
```

字段规则和查询参数完全一样：**有默认值 = 可选，没默认值 = 必填**。`str | None = None` 表示"要么是字符串，要么不传（None）"。

然后声明成函数参数，类型写成这个模型：

```python
@app.post("/items/")
async def create_item(item: Item):
    return item
```

就一句 `item: Item`，FastAPI 自动帮你干完一串脏活：读取 JSON → 转类型 → 校验 → 数据非法就返回精确报错 → 把数据塞进 `item` 对象 → 写进交互文档。**你一行校验代码都没写。**

## 四、三种参数怎么自动区分

当三者同时出现时，FastAPI 按参数特征自动分配来源：

```python
@app.put("/items/{item_id}")
async def update_item(item_id: int, item: Item, q: str | None = None):
    ...
```

| 看参数特征 | 判定为 |
|-----------|--------|
| 名字出现在路径 `{}` 里 | **路径参数** → `item_id` |
| 单一类型（int/str/float/bool） | **查询参数** → `q` |
| 类型是 Pydantic 模型 | **请求体** → `item` |

> 易错点：判断"必填还是可选"看的是**有没有默认值**，不是 `str | None`。`| None` 只是给编辑器看的类型提示。

## 五、读懂装饰器后面的路径

以这一行为例：

```python
@app.post("/shelters/{shelter_id}/items/")
```

它在说：「当有人用 **POST** 访问 `/shelters/某编号/items/` 时，交给下面的函数处理。」

路径用 `/` 切成一段段，分两种：

```
/shelters/{shelter_id}/items
 └──┬───┘ └────┬─────┘ └─┬─┘
 固定段     占位符      固定段
```

- **固定段**（`shelters`、`items`）：写死的文字，表示资源种类。
- **占位符 `{shelter_id}`**：带 `{}`，表示"这里填会变的值"，就是路径参数。

**最关键的连接**：路径里 `{}` 的名字，必须和函数参数名**完全一致**，FastAPI 才能把值喂进去：

```python
@app.post("/shelters/{shelter_id}/items/")     # 路径写 {shelter_id}
async def update_item(shelter_id: int, ...):    # 函数参数也叫 shelter_id
```

这也是我踩的一个坑：路径写 `{shelter_id}`、参数却叫 `item_id`，对不上就会出错。

路径设计一般遵循 RESTful 风格，读起来像"某资源下面的子资源"：

```
/users/{user_id}/orders     ← 某用户的订单
/posts/{post_id}/comments   ← 某文章的评论
```

## 六、综合例子

把三件套合在一起：

```python
from fastapi import FastAPI
from pydantic import BaseModel


class Item(BaseModel):
    name: str                    # 必填
    age: int                     # 必填
    breed: str | None = None     # 可选
    vaccinated: bool = False     # 可选，默认 False


app = FastAPI()


@app.post("/shelters/{shelter_id}/items/")
async def update_item(shelter_id: int, item: Item, notify: bool = False):
    result = {
        "shelter_id": shelter_id,    # 路径参数
        **item.model_dump(),         # 请求体展开进字典
        "notify": notify,            # 查询参数
    }
    return result
```

- `shelter_id` → 路径参数（在 `{}` 里）
- `item` → 请求体（Pydantic 模型）
- `notify` → 查询参数（单一类型 + 默认值 = 可选）
- `item.model_dump()` → 把 Pydantic 对象转回普通字典

## 七、怎么跑起来（重要的坑）

FastAPI **不能用 `python main.py` 启动**——那样只是把文件执行一遍，定义完 app 就退出了，看起来"没反应"。因为代码里没有任何"启动服务器"的命令。

正确方式是用 **uvicorn** 这个服务器：

```bash
uvicorn main:app --reload
```

| 部分 | 含义 |
|------|------|
| `uvicorn` | 启动服务器的工具 |
| `main` | 文件名 `main.py`（不带 .py） |
| `app` | 文件里 `app = FastAPI()` 那个变量 |
| `--reload` | 改代码后自动重启，开发时很方便 |

看到下面这两行就是成功了：

```
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Application startup complete.
```

如果提示 `command not found: uvicorn`，先装：`pip install "uvicorn[standard]"`。

## 八、用 /docs 测试接口

启动后打开 **`http://127.0.0.1:8000/docs`**，这是 FastAPI 自动生成的交互式文档（Swagger UI）。

测试流程：

1. 点开接口，点 **"Try it out"** —— 把只读的参数框**解锁成可输入**。
2. 填好路径参数、请求体、查询参数。
3. 点 **"Execute"** —— 浏览器**真的发一次请求**。
4. 看 **Response body** —— 服务器真实返回的结果。

> 一句话：**Try it out = 解锁输入框；Execute = 真正发请求。**

## 九、读懂状态码：200 与 422

每次请求，服务器都会附一个三位数字的**状态码**，说明这次请求的结局：

| 开头 | 含义 |
|------|------|
| **2xx** | ✅ 成功（200） |
| **4xx** | ❌ 请求方的问题（422 数据格式错、404 找不到） |
| **5xx** | 💥 服务器自己崩了（500） |

> 口诀：**4 开头怪请求方，5 开头怪服务器。**

`/docs` 里的接口会列出 `200` 和 `422` 两种可能的返回。`422` 是 FastAPI **自动加的**——因为接口带了数据校验，传错就会被 Pydantic 拦下。

### 422 报错的标准格式

故意漏传必填的 `age` 字段，会返回：

```json
{
  "detail": [
    {
      "type": "missing",          // 错误类型：缺失
      "loc": ["body", "age"],     // 错在：请求体里的 age
      "msg": "Field required",    // 说明：这个字段必填
      "input": { "name": "小白" }  // 你实际传进来的东西
    }
  ]
}
```

每个字段含义：

| 字段 | 含义 |
|------|------|
| `loc` | location，错在哪个位置。第一个元素是来源（`body`/`query`/`path`），后面精确到字段名 |
| `msg` | 给人看的错误说明 |
| `type` | 错误类型代号（`missing` 缺失、`int_parsing` 类型不对…） |
| `input` | 你实际传进来的值，方便对照 |

> `loc` 最有用：一看 `["body", "age"]` 就知道是"请求体的 age 字段"出问题。

## 小结

今天完整走通了一个后端开发的核心闭环：

> **写接口（路径 / 查询 / 请求体）→ 启动服务（uvicorn）→ 测试（/docs + Try it out）→ 读懂 200 成功 / 422 报错**

几个最该记住的点：

1. 三件套靠特征自动区分：**在路径 `{}` 里 = 路径参数；单一类型 = 查询参数；Pydantic 模型 = 请求体**。
2. **可选不可选只看"有没有默认值"**，对查询参数和模型字段通用。
3. FastAPI 用 **uvicorn** 启动，不是 `python main.py`。
4. `/docs` 能直接测接口，`422` 的 `loc` / `msg` / `input` 让报错精确到字段。
