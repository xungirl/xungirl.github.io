---
title: "A Scroll-Animated Roadmap Timeline for My Projects"
date: 2026-06-10
draft: false
tags: ["devlog", "frontend", "Hugo", "TicketCoach", "LLM agents"]
ShowToc: true
TocOpen: false
description: "I liked the progress timeline I built for TicketCoach's landing page so much that I turned it into a reusable Hugo shortcode — bright gradient for what's shipped, gray for what's next, and a line that grows as you scroll."
---

While rebuilding the landing page of [TicketCoach](https://github.com/xungirl/TicketCoach) — my AI sparring-partner system for customer-support training — I replaced the usual feature grid with a **progress timeline**: one vertical line, one dot per milestone. Shipped work glows in a purple gradient; future work stays gray and dashed. As you scroll, the bright line literally *grows* down the page and stops exactly at the last completed dot.

I ended up liking this little UI more than the product page itself. So I extracted it into a Hugo shortcode, and from now on every project I write about here gets one of these. This post is both the first real use of it and a short note on how it works.

## The TicketCoach roadmap

Here it is — live, scroll and watch the line grow:

{{< roadmap >}}
done    | 2026-06-02 | Multi-step agent pipeline | Ticket generation → script extraction → quality review, chained LLM calls with an automatic regenerate-on-low-score loop.
done    | 2026-06-02 | Live roleplay + AI scoring | You play the support agent, the model plays a difficult customer from the script's persona; the session gets scored per rubric dimension afterwards.
done    | 2026-06-03 | Deployed on Google Cloud Run | Access-code protection and a daily generation quota, built from source with cloud build — no local Docker needed.
done    | 2026-06-03 | Real-ticket import & export | Paste or upload real tickets, normalize them into structured JSON, generate scripts, export for other teams' systems.
done    | 2026-06-03 | Streaming, AI demo & script library | Token-by-token streaming replies, an AI-vs-AI demo conversation as a model answer, and a pre-generated script library served instantly.
done    | 2026-06-03 | Animated landing page | GSAP scroll animations, responsive layout, app moved to /app.
current | 2026-06-10 | Eval harness: observable, scorable agents | Execution traces, a 24-case labeled dataset, deterministic checks + LLM-as-judge, and sabotage runs that validate the harness itself.
todo    | Planned    | Independent judge + full baseline | Swap in a separate judge model, run the full 24-case baseline, freeze quality benchmarks per pipeline step.
todo    | Planned    | Automated multi-turn evaluation | A simulated-trainee agent that plays whole roleplay sessions automatically — the hardest part to evaluate.
todo    | Planned    | Evals as a CI gate | Every prompt or model change triggers the eval suite; score regressions block the merge.
{{< /roadmap >}}

A note on the latest milestone, because it deserves one: the eval harness wraps *around* the agent without touching its business logic. The pipeline exposes execution traces (every LLM call's inputs, outputs, latency, retries), a labeled dataset defines what "correct" means per case — hard metrics where answers are checkable, rubrics where they aren't — and an LLM judge grades the soft parts. The step I'm proudest of: **sabotage validation**. I deliberately broke the agent (replaced the trainee's lines with brush-offs), and the scores dropped from 93 to 30. If they hadn't, the eval would have been measuring nothing.

## How the timeline works

The component is one self-contained Hugo shortcode (`layouts/shortcodes/roadmap.html`): scoped CSS, a few lines of vanilla JS, no dependencies. In a post, a milestone is just one pipe-separated line:

```text
{{</* roadmap */>}}
done    | 2026-06-02 | Milestone title | One-line description.
current | 2026-06-10 | Latest shipped  | The newest done item gets a pulsing dot.
todo    | Planned    | Future work     | Gray and dashed until it ships.
{{</* /roadmap */>}}
```

Three details I care about:

1. **The bright line must end at the last completed dot.** The fill height is computed from the real layout (`offsetTop` of the final `done` dot), not a hardcoded percentage — so editing the list never breaks the visual.
2. **Scroll-driven growth, no animation library.** A passive scroll listener maps the timeline's position in the viewport to a 0→1 progress value and multiplies it by that target height. The landing-page version uses GSAP ScrollTrigger; the blog version does the same in ~15 lines of vanilla JS.
3. **Theme-aware.** Cards and text use the blog theme's CSS variables, so the component follows light/dark mode automatically — only the gradient accent stays constant.

## Why a roadmap instead of a feature list

A feature grid says "look what this does." A timeline says "look where this is going" — and, more honestly, what *isn't* done yet. The gray dashed cards are a public to-do list; they cost me nothing to write and they keep me accountable. Plus, watching the bright line crawl further down with every devlog post is exactly the kind of cheap dopamine that keeps side projects alive.

Future projects on this blog will get the same treatment. Same line, same dots — just different milestones.
