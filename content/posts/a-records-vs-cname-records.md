---
title: "A Records vs CNAME Records: How to Point a Domain at Your Website"
date: 2026-06-09
draft: false
tags: ["DNS", "domains", "networking", "GitHub Pages", "web"]
ShowToc: true
TocOpen: true
description: "What A records and CNAME records actually do, how they differ, and how I used them to connect a custom domain to a GitHub Pages site — including the gotchas that tripped me up."
---

I recently bought a domain and pointed it at my GitHub Pages site. It sounds like a one-click thing, but it comes down to two little DNS records: an **A record** and a **CNAME record**. Once I understood what each one does, the whole process stopped feeling like magic. Here's the explanation I wish I'd had.

## A 30-Second DNS Refresher

When someone types `example.com` into a browser, computers don't actually understand names — they only talk to **IP addresses** (like `185.199.108.153`). **DNS (Domain Name System)** is the giant phone book that translates a human-friendly *name* into a machine-friendly *address*.

A **DNS record** is a single entry in that phone book. The two you'll touch most often are **A** and **CNAME**.

## A Records: Name → IP Address

An **A record** maps a domain directly to an **IP address** (a numeric server location).

```
Type   Name   Value
A      @      185.199.108.153
```

- **`Type`** is `A`.
- **`Name`** is the part of the domain. `@` means the **root/apex domain** itself (e.g. `example.com` with nothing in front).
- **`Value`** must be an **IP address** — four numbers, never a name.

When I connected my domain to GitHub Pages, GitHub asked for **four** A records, all on `@`:

```
A   @   185.199.108.153
A   @   185.199.109.153
A   @   185.199.110.153
A   @   185.199.111.153
```

Four IPs for the same name is intentional: it's **redundancy**. If one of GitHub's servers is down, your visitors are quietly routed to one of the other three. This is called *round-robin DNS*.

## CNAME Records: Name → Another Name

A **CNAME record** (Canonical Name) doesn't point to an IP. It points to **another domain name**, basically saying *"I'm an alias — go ask that other name where to go."*

```
Type    Name   Value
CNAME   www    xungirl.github.io
```

This makes `www.example.com` an alias for `xungirl.github.io`. Whatever IP that target resolves to, `www` follows along. If GitHub ever changes its server IPs, I don't have to update anything — the CNAME just keeps pointing at the name, and the name handles the rest.

## The Key Difference

This is the part that actually matters, and the mistake I made first:

| | **A record** | **CNAME record** |
|---|---|---|
| Points to | an **IP address** | another **domain name** |
| Value looks like | `185.199.108.153` | `xungirl.github.io` |
| Typical use | root domain (`@`) | subdomains (`www`, `blog`, `shop`) |

> **The gotcha:** I first tried to create the `www` entry as an **A record** with the value `xungirl.github.io`. It failed with *"invalid data."* Of course it did — an A record's value **must** be an IP, and `xungirl.github.io` is a name. The moment I switched the type to **CNAME**, it saved fine.

Rule of thumb: **value is a number → A record. Value is a name → CNAME record.**

## Why the Root Domain Uses A, but `www` Uses CNAME

You might wonder: if CNAME is so convenient, why not use it for the root domain too?

Because of a DNS rule: the **root/apex domain (`@`) cannot be a CNAME.** The apex already carries other mandatory records (like `NS` and `SOA`), and CNAME isn't allowed to coexist with them. So:

- **Root domain (`@`)** → must use **A records** (point straight at IPs).
- **Subdomains (`www`, etc.)** → can use **CNAME** (point at a name).

That's exactly why my setup ended up as *four A records on `@`* plus *one CNAME on `www`*.

## Putting It Together: Connecting a Domain to GitHub Pages

The full recipe I used:

1. In **GitHub → Settings → Pages**, set the **Custom domain** to my domain and save.
2. In my registrar's **DNS management**, add:
   - **4 A records** on `@` → GitHub's IPs (`185.199.108–111.153`)
   - **1 CNAME record** on `www` → `myusername.github.io`
3. **Delete the registrar's default "parking" records.** New domains often ship with auto-generated A records that point to the registrar's own placeholder page. These were *locked* until I disconnected the domain from the registrar's website builder — and if you leave them in, your domain resolves to the **wrong** servers part of the time, and HTTPS won't provision.
4. Wait for DNS to propagate, then let GitHub issue a free **Let's Encrypt** certificate and enable **Enforce HTTPS**.

## One More Term: TTL

Every record has a **TTL (Time To Live)** — how long resolvers are allowed to **cache** it (e.g. `600 seconds`). This is why, right after I fixed my records, my own laptop still showed the *old* values for a few minutes: it was serving a cached copy. New visitors saw the correct records immediately; my machine just needed the cache to expire.

## TL;DR

- **A record** = name → **IP address** (use it for the root `@`).
- **CNAME record** = name → **another name** (use it for `www` and other subdomains).
- The apex domain **can't** be a CNAME, so the root always uses A records.
- If a value is an IP, it's an A record; if it's a hostname, it's a CNAME. Mixing them up gives an "invalid data" error.
- Don't forget to remove leftover parking/forwarding records, and give DNS a little time to propagate.

Two tiny records, one custom domain. Not magic after all.
