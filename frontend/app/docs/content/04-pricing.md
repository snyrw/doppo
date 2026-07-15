---
title: Usage and pricing
---

Billing is essentially what Modal lists as a their public pricing across GPU, CPU, and memory usage. You are charged for your job's execution time on the GPU plus the small CPU and memory usage the worker meters, and time your job spends waiting in a queue is never billed. When your job is the one that caused a fresh container to boot, the model load time is attributed to it, and runs on a warm container skip that entirely.

As of July 2026, these are the prices that we run with:

| GPU | Rate |
| --- | --- |
| L4 | about $0.80 per hour |
| L40S | about $1.95 per hour |
| A100-80GB | about $2.50 per hour |
| H200 | about $4.54 per hour |
| B200 | about $6.25 per hour |

Every account resets to $1.00 in free usage each month, applied automatically the first time you use the site that month. Starting a job requires a minimum balance sized to a worst-case run at that tier, from about $0.02 on an L4 up to about $0.69 on a B200. If a job runs longer than expected your balance can go slightly negative. We do not kill jobs mid-run except for ones that may fail. You can personally kill your own cards by deleting them mid-run (press the X in the top corner).

Usage is bought in fixed volumes ($2, $5, $10, $25) through Stripe checkout, and as discussed, the only upmark should be the Stripe fee. That again means that your $2 you receive on your account will carry the same weight on Modal as it does here.