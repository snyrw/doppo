---
title: Overview
---

Doppo runs mechanistic interpretability techniques on HuggingFace models without code. You pick a model, type a prompt, and get an interactive visualization on a canvas. Every run loads the actual model with TransformerLens on a serverless GPU, so results come from the real internals, not a proxy.

You need an account to run anything. GPU time is billed from a credit balance, and every account gets a small free grant each month (see [Credits and pricing](#credits-and-pricing)). Repeating a run with identical settings hits a cache and is free.

If you are new to interpretability, the [tutorial](/tutorial) walks through the IOI circuit on GPT-2 Small and a steering example. All of its results are pre-computed, so it needs no account and costs nothing.

## Quick start

1. Sign in and create a project.
2. Pick a technique from the toolbar, then a model: choose a featured one or paste any HuggingFace ID and validate it.
3. Enter a prompt and run. The first run on a model takes longer because the worker has to download and load the weights; later runs reuse them.
4. Results land as cards on the canvas. Drag them around, hover cells for detail, spawn follow-up analyses from a card, and share the project with a public link if you want.
