---
title: Caching and sharing
---

Every run on the logit lens, DLA, patching, and attention head analysis is cached. This means that rerunning the same configuration allows one to get the cached result instantly at no cost, as these are deterministic results. Caches are limited to your account and are inherently private

The one exception we have is steering with temperature above zero, considering that sampling makes the output nondeterministic (so steering results will rarely be the same). Those runs are not cached and each rerun is a fresh (billed) generation.

Projects save automatically as cards resolve. Sharing a project generates a stable read-only public link (doppo.tools/share/...) of the canvas. The link stays valid until you turn sharing off. Individual cards can also be exported as PNGs.