---
title: Caching and sharing
---

Every result is cached, keyed on the model, the prompt, and all settings that affect the output. Rerun the same configuration and you get the cached result instantly, at no cost. Caches are scoped to your account; another user running the same prompt does not see or share your cache entries.

The one exception is steering with temperature above zero: sampling makes the output nondeterministic, so those runs are not cached and each rerun is a fresh (billed) generation. Set temperature to 0 if you want deterministic, cacheable steering output.

Projects save automatically as cards resolve. Sharing a project generates a stable public link (doppo.tools/share/...) showing a read-only copy of the canvas. The link stays valid until you turn sharing off. Individual cards can also be exported as PNGs.
