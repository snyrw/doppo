---
title: Usage and pricing
---

While Doppo would be ideal as a completely free app where anyone can run these techniques, it would be largely unaffordable to maintain due to the compute costs (at the moment, at least). We have tried to balance this by providing compute costs at no upmark against our provider (Modal) and a free monthly allowance of compute per user. 

As just alluded to, billing is essentially what [Modal lists as their public pricing across GPU, CPU, and memory usage](https://modal.com/pricing). You are charged for your job's execution time on the GPU plus the small CPU and memory usage the worker meters, and time your job spends waiting in a queue is never billed. When your job is the one that caused a fresh container to boot, the model load time is attributed to it, and runs on a warm container skip that entirely.

As of August 2026, these are the *raw prices* that we run with:

| GPU | Rate |
| --- | --- |
| L4 | about $0.80 per hour |
| L40S | about $1.95 per hour |
| A100-80GB | about $2.50 per hour |
| H200 | about $4.54 per hour |
| B200 | about $6.25 per hour |

Claude API costs for pair generation have not been measured as carefully, but they can be expected to be around 2-3 cents. More on this will be included soon.

Every account gets $1.00 in free usage each month, added automatically the first time you use the site that month. It stacks on top of whatever balance you already have rather than replacing it, so anything you bought earlier stays with you. Starting a job requires a minimum balance sized to a worst-case run at that tier, from about $0.02 on an L4 up to about $0.69 on a B200. If a job runs longer than expected your balance can go slightly negative. We do not kill jobs mid-run except for ones that may fail, plus a 30 minute hard cap that catches jobs which have hung. You can personally kill your own cards by deleting them mid-run (press the X in the top corner).

Usage is bought in fixed volumes ($2, $5, $10, $25) through Stripe checkout, and as discussed, the only upmark should be the Stripe fee. This is almost never over a dollar. That again means that your $2 you specifically receive on your account will carry the same weight on Modal as it does here.