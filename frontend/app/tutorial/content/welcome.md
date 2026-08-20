---
id: welcome
heading: Welcome to Doppo!
paper:
  label: "Wang et al., 2022: Interpretability in the Wild"
  url: "https://arxiv.org/abs/2211.00593"
links:
  - label: "Neel Nanda: Mech Interp Glossary (old, but demo content is mostly from this era)"
    url: "https://dynalist.io/d/n2ZWtnoYHrU1s4vnFSAQ519J"
  - label: "ARENA: Chapter 0 & 1 (enough to quickstart, full thing is great)"
    url: "https://learn.arena.education/"
  - label: "Elhage et al., 2021: A Mathematical Framework for Transformer Circuits (jargon-dense, established transformer interpretability vocab)"
    url: "https://transformer-circuits.pub/2021/framework/index.html"
  - label: "Neel Nanda: Mathematical Framework Walkthrough (core author explains the paper step-by-step)"
    url: "https://www.youtube.com/watch?v=KV5gbOmHbjU"
cta:
  label: "Go to projects"
  url: "/projects"
---

Hello! Brief introduction, Doppo is a site for looking at and playing with AI internals. We host several techniques to do this, which are showcased here in our read-only demo. The demo itself has all of our current techniques (6 in total with 8 cards), shown by their colored tooltip. You'll want to focus on the "?" tooltip first, which shows a short brief on the card you're looking at. The "i" will show separate information about model architecture and so on. 

It is recommended that you go in chromatic order starting with red, the logit lens. That will introduce you to the canonical indirect object identification (IOI) circuit found by Wang et al., 2022. From there, cycle through yellow (attention head analysis), green (direct logit attribution), both blues (patching), and purple (activation steering). Red through blue are one unit, and steering is its own. There's also a link to the IOI paper directly below, which you might find yourself wanting to reference:

The writing will try (and hopefully succeed) to explain these concepts well enough without a strong interpretability background, but if you've found yourself not understanding things fully here, it is recommended that you skim through or take notes on the following sources below. Some of these have conceptually driven interpretability for many years now and are where much of the jargon comes from.

If you've found yourself interested in exploring these concepts more afterward, feel free to head on over to the projects page! You can run any of these on a wide range of models, and perhaps even tweak them based on your own curiosities if you'd like.
