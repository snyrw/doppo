# backend/worker/inference.py
"""
TLInference: static methods ported from _TLBase in backend/main.py.
Each method takes (model, inp: dict) and yields dicts.
RunPod serializes the yielded dicts; never yield json.dumps strings here.
"""
import torch


def _resolve_pos(tokens, target_position: int | str) -> int:
    return int(tokens.shape[-1]) - 1 if target_position == "last" else int(target_position)


def _gather_next_token_probs(probs, next_tokens):
    """probs: [n_layers, seq, vocab], next_tokens: [seq-1] → [n_layers, seq-1]"""
    return torch.gather(
        probs, dim=-1,
        index=next_tokens.view(1, -1, 1).expand(probs.shape[0], -1, 1),
    ).squeeze(-1)


class TLInference:

    @staticmethod
    def run_logit_lens(model, inp: dict):
        prompt = inp["prompt"]
        top_k = inp.get("top_k", 5)

        yield {"stage": "tokenizing"}
        tokens = model.to_tokens(prompt)

        yield {"stage": "forward_pass"}
        _, cache = model.run_with_cache(tokens)

        yield {"stage": "computing"}
        accumulated_residual, labels = cache.accumulated_resid(
            layer=-1, incl_mid=False, return_labels=True
        )
        resid_at_layers = accumulated_residual[:, 0, :, :]
        scaled_resid = model.ln_final(resid_at_layers)
        layer_logits = model.unembed(scaled_resid)
        layer_probs = layer_logits.softmax(dim=-1)

        pred_probs = layer_probs[:, :-1, :]
        next_tokens = tokens[0, 1:]
        gathered_probs = _gather_next_token_probs(pred_probs, next_tokens)
        token_strings = model.to_str_tokens(tokens)[1:]

        topk_vals, topk_ids = torch.topk(pred_probs, k=top_k, dim=-1)
        n_layers, n_pos, k = topk_ids.shape
        flat_ids = topk_ids.reshape(-1).cpu().tolist()
        flat_strs = [model.tokenizer.decode([int(tid)]) for tid in flat_ids]
        topk_token_strings = [
            [[flat_strs[li * n_pos * k + p * k + j] for j in range(k)] for p in range(n_pos)]
            for li in range(n_layers)
        ]

        eps = 1e-10
        final_probs = pred_probs[-1].float()
        final_top1_ids = final_probs.argmax(dim=-1)
        pos_range = torch.arange(n_pos, device=pred_probs.device)
        kl_data, rank_data, entropy_data = [], [], []
        for li in range(n_layers):
            p = pred_probs[li].float()
            kl_data.append(
                (p * (torch.log(p + eps) - torch.log(final_probs + eps))).sum(dim=-1).cpu().tolist()
            )
            target_p = p[pos_range, final_top1_ids]
            rank_data.append(
                (p > target_p.unsqueeze(-1)).sum(dim=-1).add(1).cpu().tolist()
            )
            entropy_data.append(
                (-(p * torch.log(p + eps)).sum(dim=-1)).cpu().tolist()
            )

        yield {
            "stage": "done",
            "data": {
                "x_labels": token_strings,
                "y_labels": labels,
                "heatmap_data": gathered_probs.float().cpu().tolist(),
                "topk_tokens": topk_token_strings,
                "topk_probs": topk_vals.float().cpu().tolist(),
                "kl_data": kl_data,
                "rank_data": rank_data,
                "entropy_data": entropy_data,
            },
        }

    @staticmethod
    def run_dla(model, inp: dict):
        prompt = inp["prompt"]
        target_position = inp.get("target_position", "last")
        target_token = inp.get("target_token")
        contrastive_token = inp.get("contrastive_token")

        yield {"stage": "tokenizing"}
        tokens = model.to_tokens(prompt)
        pos = _resolve_pos(tokens, target_position)

        yield {"stage": "forward_pass"}
        _, cache = model.run_with_cache(tokens)

        yield {"stage": "computing"}

        n_layers = model.cfg.n_layers
        n_heads = model.cfg.n_heads

        if target_token is None:
            final_resid = cache[f"blocks.{n_layers - 1}.hook_resid_post"]
            final_logits = model.unembed(model.ln_final(final_resid))
            target_idx = int(final_logits[0, pos].argmax())
        else:
            ids = model.to_tokens(target_token, prepend_bos=False)
            target_idx = int(ids[0, 0])
        resolved_token = model.tokenizer.decode([target_idx])

        contrastive_idx: int | None = None
        resolved_contrastive: str | None = None
        if contrastive_token is not None:
            ids = model.to_tokens(contrastive_token, prepend_bos=False)
            contrastive_idx = int(ids[0, 0])
            resolved_contrastive = model.tokenizer.decode([contrastive_idx])

        if contrastive_idx is not None:
            logit_dir = (model.W_U[:, target_idx] - model.W_U[:, contrastive_idx]).float()
        else:
            logit_dir = model.W_U[:, target_idx].float()

        embed_dla = float(cache["blocks.0.hook_in"][0, pos].float() @ logit_dir)

        W_O = model.W_O
        head_dla = []
        for layer in range(n_layers):
            z = cache[f"blocks.{layer}.attn.hook_z"][0, pos, :, :].float()
            head_results = torch.einsum("hd,hdm->hm", z, W_O[layer].float())
            head_dla.append((head_results @ logit_dir).cpu().tolist())

        layer_dla = []
        layer_attn_dla = []
        layer_mlp_dla = []
        for layer in range(n_layers):
            attn_out = cache[f"blocks.{layer}.hook_attn_out"][0, pos].float()
            mlp_out = cache[f"blocks.{layer}.hook_mlp_out"][0, pos].float()
            attn_val = float(attn_out @ logit_dir)
            mlp_val = float(mlp_out @ logit_dir)
            layer_attn_dla.append(attn_val)
            layer_mlp_dla.append(mlp_val)
            layer_dla.append(attn_val + mlp_val)

        y_labels = [f"L{i}" for i in range(n_layers)]
        x_labels = [f"H{i}" for i in range(n_heads)]

        yield {
            "stage": "done",
            "data": {
                "target_token": resolved_token,
                "contrastive_token": resolved_contrastive,
                "target_position": pos,
                "y_labels": y_labels,
                "x_labels": x_labels,
                "embed_dla": embed_dla,
                "layer_dla": layer_dla,
                "layer_attn_dla": layer_attn_dla,
                "layer_mlp_dla": layer_mlp_dla,
                "head_dla": head_dla,
            },
        }

    @staticmethod
    def run_attribution(model, inp: dict):
        clean_prompt = inp["prompt"]
        corrupted_prompt = inp["corrupted_prompt"]
        target_position = inp.get("target_position", "last")
        target_token = inp.get("target_token")
        contrastive_token = inp.get("contrastive_token")
        top_n = inp.get("top_n", 30)

        yield {"stage": "tokenizing"}
        clean_tokens = model.to_tokens(clean_prompt)
        corrupted_tokens = model.to_tokens(corrupted_prompt)
        pos = _resolve_pos(clean_tokens, target_position)

        n_layers = model.cfg.n_layers
        n_heads = model.cfg.n_heads

        yield {"stage": "clean_forward_pass"}
        with torch.no_grad():
            if target_token is None:
                clean_logits = model(clean_tokens)
                target_idx = int(clean_logits[0, pos].argmax())
                del clean_logits
            else:
                ids = model.to_tokens(target_token, prepend_bos=False)
                target_idx = int(ids[0, 0])
        resolved_token = model.tokenizer.decode([target_idx])

        contrastive_idx: int | None = None
        resolved_contrastive: str | None = None
        if contrastive_token is not None:
            ids = model.to_tokens(contrastive_token, prepend_bos=False)
            contrastive_idx = int(ids[0, 0])
            resolved_contrastive = model.tokenizer.decode([contrastive_idx])

        needed_hooks: set[str] = {
            f"blocks.{L}.{suffix}"
            for L in range(n_layers)
            for suffix in ("attn.hook_z", "hook_attn_out", "hook_mlp_out")
        }
        with torch.no_grad():
            _, clean_cache = model.run_with_cache(
                clean_tokens,
                names_filter=lambda name: name in needed_hooks,
            )

        clean_z_cpu    = [clean_cache[f"blocks.{L}.attn.hook_z"][0, pos].float().cpu()    for L in range(n_layers)]
        clean_attn_cpu = [clean_cache[f"blocks.{L}.hook_attn_out"][0, pos].float().cpu()  for L in range(n_layers)]
        clean_mlp_cpu  = [clean_cache[f"blocks.{L}.hook_mlp_out"][0, pos].float().cpu()   for L in range(n_layers)]
        del clean_cache
        torch.cuda.empty_cache()

        yield {"stage": "corrupted_forward_backward"}

        corrupted_z: dict[int, torch.Tensor] = {}
        corrupted_attn_out: dict[int, torch.Tensor] = {}
        corrupted_mlp_out: dict[int, torch.Tensor] = {}

        def make_save_hook(d: dict, key: int):
            def _fn(value, hook):
                d[key] = value
                value.retain_grad()
                return value
            return _fn

        fwd_hooks = []
        for L in range(n_layers):
            fwd_hooks.append((f"blocks.{L}.attn.hook_z",   make_save_hook(corrupted_z, L)))
            fwd_hooks.append((f"blocks.{L}.hook_attn_out", make_save_hook(corrupted_attn_out, L)))
            fwd_hooks.append((f"blocks.{L}.hook_mlp_out",  make_save_hook(corrupted_mlp_out, L)))

        with torch.enable_grad():
            logits_corrupted = model.run_with_hooks(corrupted_tokens, fwd_hooks=fwd_hooks)
            if contrastive_idx is not None:
                metric = logits_corrupted[0, pos, target_idx] - logits_corrupted[0, pos, contrastive_idx]
            else:
                metric = logits_corrupted[0, pos, target_idx]
            metric.backward()

        grad_z_cpu    = {}
        grad_attn_cpu = {}
        grad_mlp_cpu  = {}
        corrupted_z_cpu    = {}
        corrupted_attn_cpu = {}
        corrupted_mlp_cpu  = {}

        for L in range(n_layers):
            if corrupted_z[L].grad is None:
                raise RuntimeError(
                    f"hook_z gradient is None at layer {L}. "
                    "The TL3 bridge may be detaching activations — cannot compute attribution."
                )
            if corrupted_attn_out[L].grad is None or corrupted_mlp_out[L].grad is None:
                raise RuntimeError(
                    f"hook_attn_out or hook_mlp_out gradient is None at layer {L}."
                )
            grad_z_cpu[L]    = corrupted_z[L].grad[0, pos].float().cpu()
            grad_attn_cpu[L] = corrupted_attn_out[L].grad[0, pos].float().cpu()
            grad_mlp_cpu[L]  = corrupted_mlp_out[L].grad[0, pos].float().cpu()
            corrupted_z_cpu[L]    = corrupted_z[L][0, pos].float().cpu()
            corrupted_attn_cpu[L] = corrupted_attn_out[L][0, pos].float().cpu()
            corrupted_mlp_cpu[L]  = corrupted_mlp_out[L][0, pos].float().cpu()

        del logits_corrupted, metric, corrupted_z, corrupted_attn_out, corrupted_mlp_out
        torch.cuda.empty_cache()

        yield {"stage": "computing_attribution"}

        all_components: list[dict] = []
        head_attribution: list[list[float]] = []

        for L in range(n_layers):
            row: list[float] = []
            for H in range(n_heads):
                z_diff = clean_z_cpu[L][H] - corrupted_z_cpu[L][H]
                attr = float((z_diff * grad_z_cpu[L][H]).sum())
                row.append(attr)
                all_components.append({
                    "layer": L,
                    "head": H,
                    "component_type": "attn_head",
                    "attribution_score": attr,
                })
            head_attribution.append(row)

        layer_attribution: list[float] = []
        for L in range(n_layers):
            attn_diff = clean_attn_cpu[L] - corrupted_attn_cpu[L]
            mlp_diff  = clean_mlp_cpu[L]  - corrupted_mlp_cpu[L]
            layer_attribution.append(float(
                (attn_diff * grad_attn_cpu[L]).sum() + (mlp_diff * grad_mlp_cpu[L]).sum()
            ))
            all_components.append({
                "layer": L,
                "head": -1,
                "component_type": "mlp",
                "attribution_score": float((mlp_diff * grad_mlp_cpu[L]).sum()),
            })

        all_components.sort(key=lambda c: abs(c["attribution_score"]), reverse=True)
        top_k_components = all_components[:top_n]

        yield {
            "stage": "done",
            "data": {
                "target_token": resolved_token,
                "target_token_idx": target_idx,
                "contrastive_token": resolved_contrastive,
                "contrastive_token_idx": contrastive_idx,
                "target_position": pos,
                "y_labels": [f"L{i}" for i in range(n_layers)],
                "x_labels": [f"H{i}" for i in range(n_heads)],
                "layer_attribution": layer_attribution,
                "head_attribution": head_attribution,
                "top_k_components": top_k_components,
            },
        }

    @staticmethod
    def run_activation_patch(model, inp: dict):
        clean_prompt = inp["prompt"]
        corrupted_prompt = inp["corrupted_prompt"]
        target_position = inp.get("target_position", "last")
        target_token_idx: int = inp["target_token_idx"]
        contrastive_token_idx: int | None = inp.get("contrastive_token_idx")
        components: list[dict] = inp.get("components", [])
        k: int = inp.get("k", 10)

        yield {"stage": "tokenizing"}
        clean_tokens = model.to_tokens(clean_prompt)
        corrupted_tokens = model.to_tokens(corrupted_prompt)
        pos = _resolve_pos(clean_tokens, target_position)
        top_components = components[:k]

        for comp in top_components:
            layer = comp["layer"]
            head = comp.get("head")
            if not (0 <= layer < model.cfg.n_layers):
                raise ValueError(f"layer {layer} out of range (model has {model.cfg.n_layers} layers)")
            if head is not None and head >= 0 and not (0 <= head < model.cfg.n_heads):
                raise ValueError(f"head {head} out of range (model has {model.cfg.n_heads} heads)")

        hook_names: set[str] = set()
        for comp in top_components:
            L = comp["layer"]
            if comp["component_type"] == "attn_head":
                hook_names.add(f"blocks.{L}.attn.hook_z")
            else:
                hook_names.add(f"blocks.{L}.hook_mlp_out")

        def _metric(logits) -> float:
            val = logits[0, pos, target_token_idx]
            if contrastive_token_idx is not None:
                val = val - logits[0, pos, contrastive_token_idx]
            return float(val)

        yield {"stage": "preparing"}
        device = clean_tokens.device
        with torch.no_grad():
            _, clean_cache = model.run_with_cache(
                clean_tokens,
                names_filter=lambda name: name in hook_names,
            )
            clean_metric = _metric(model(clean_tokens))
            corrupted_metric = _metric(model(corrupted_tokens))
        total_diff = max(abs(clean_metric - corrupted_metric), 1e-8)

        clean_cache_cpu = {name: clean_cache[name].cpu() for name in hook_names}
        del clean_cache
        torch.cuda.empty_cache()

        results: list[dict] = []
        for i, comp in enumerate(top_components):
            L = comp["layer"]
            H = comp.get("head", -1)

            if comp["component_type"] == "attn_head":
                clean_z_val = clean_cache_cpu[f"blocks.{L}.attn.hook_z"][:, :, H, :].to(device)

                def make_head_hook(cached_z, head_idx):
                    def _fn(value, hook):
                        value[:, :, head_idx, :] = cached_z
                        return value
                    return _fn

                hook_fn = make_head_hook(clean_z_val, H)
                hook_name = f"blocks.{L}.attn.hook_z"
            else:
                clean_mlp_val = clean_cache_cpu[f"blocks.{L}.hook_mlp_out"].to(device)

                def make_mlp_hook(cached_mlp):
                    def _fn(value, hook):
                        return cached_mlp
                    return _fn

                hook_fn = make_mlp_hook(clean_mlp_val)
                hook_name = f"blocks.{L}.hook_mlp_out"

            with torch.no_grad():
                patched_logits = model.run_with_hooks(
                    corrupted_tokens,
                    fwd_hooks=[(hook_name, hook_fn)],
                )
            patched_metric = _metric(patched_logits)
            actual_effect = (patched_metric - corrupted_metric) / total_diff

            results.append({
                "layer": L,
                "head": H,
                "component_type": comp["component_type"],
                "attribution_score": comp["attribution_score"],
                "actual_effect": actual_effect,
            })

            yield {"stage": f"patching_{i + 1}_of_{len(top_components)}"}

        yield {"stage": "computing_effects"}
        yield {
            "stage": "done",
            "data": {
                "total_diff": total_diff,
                "components": results,
            },
        }

    @staticmethod
    def run_steering(model, inp: dict):
        clean_prompt = inp["clean_prompt"]
        corrupted_prompt = inp["corrupted_prompt"]
        target_position = inp.get("target_position", "last")
        components: list[dict] = inp.get("components", [])
        alpha: float = inp.get("alpha", 1.0)
        n_tokens: int = inp.get("n_tokens", 50)
        extra_pairs: list[dict] | None = inp.get("extra_pairs")
        temperature: float = inp.get("temperature", 1.0)
        repetition_penalty: float = inp.get("repetition_penalty", 1.3)
        generation_prompt: str | None = inp.get("generation_prompt")

        yield {"stage": "computing"}

        def _fmt(text: str) -> str:
            tmpl = getattr(model.tokenizer, "chat_template", None)
            if tmpl is not None:
                return model.tokenizer.apply_chat_template(
                    [{"role": "user", "content": text}],
                    tokenize=False,
                    add_generation_prompt=True,
                )
            return text

        with torch.no_grad():
            gen_prompt_resolved = generation_prompt if generation_prompt else clean_prompt
            gen_tokens = model.to_tokens(_fmt(gen_prompt_resolved))
            n_layers = model.cfg.n_layers

            all_pairs = [{"clean": clean_prompt, "corrupted": corrupted_prompt}]
            if extra_pairs:
                all_pairs.extend(extra_pairs)

            for comp in components:
                layer = comp["layer"] if comp["layer"] >= 0 else n_layers // 2
                head = comp.get("head")
                if not (0 <= layer < model.cfg.n_layers):
                    raise ValueError(f"layer {layer} out of range (model has {model.cfg.n_layers} layers)")
                if head is not None and not (0 <= head < model.cfg.n_heads):
                    raise ValueError(f"head {head} out of range (model has {model.cfg.n_heads} heads)")

            comp_accumulators: list[torch.Tensor | None] = [None] * len(components)

            _hook_set: set[str] = set()
            for _comp in components:
                _L = _comp["layer"] if _comp["layer"] >= 0 else n_layers // 2
                _inj = _comp.get("injection_type", "residual")
                if _inj == "attn_head" and _comp.get("head") is not None:
                    _hook_set.add(f"blocks.{_L}.attn.hook_z")
                elif _inj == "mlp":
                    _hook_set.add(f"blocks.{_L}.hook_mlp_out")
                else:
                    _hook_set.add(f"blocks.{_L}.hook_in")
            needed_hooks: list[str] = list(_hook_set)

            for pair in all_pairs:
                p_clean = model.to_tokens(_fmt(pair["clean"]))
                p_corrupted = model.to_tokens(_fmt(pair["corrupted"]))

                if target_position == "last":
                    cp_pos = int(p_clean.shape[-1]) - 1
                    rp_pos = int(p_corrupted.shape[-1]) - 1
                else:
                    cp_pos = min(int(target_position), int(p_clean.shape[-1]) - 1)
                    rp_pos = min(int(target_position), int(p_corrupted.shape[-1]) - 1)

                _, cache_clean = model.run_with_cache(p_clean, names_filter=needed_hooks)
                _, cache_corrupted = model.run_with_cache(p_corrupted, names_filter=needed_hooks)

                for ci, comp in enumerate(components):
                    L = comp["layer"] if comp["layer"] >= 0 else n_layers // 2
                    H = comp.get("head")
                    inj = comp.get("injection_type", "residual")
                    if inj == "attn_head" and H is not None:
                        v = (
                            cache_clean[f"blocks.{L}.attn.hook_z"][0, cp_pos, H, :].float()
                            - cache_corrupted[f"blocks.{L}.attn.hook_z"][0, rp_pos, H, :].float()
                        )
                    elif inj == "mlp":
                        v = (
                            cache_clean[f"blocks.{L}.hook_mlp_out"][0, cp_pos, :].float()
                            - cache_corrupted[f"blocks.{L}.hook_mlp_out"][0, rp_pos, :].float()
                        )
                    else:
                        v = (
                            cache_clean[f"blocks.{L}.hook_in"][0, cp_pos, :].float()
                            - cache_corrupted[f"blocks.{L}.hook_in"][0, rp_pos, :].float()
                        )
                    comp_accumulators[ci] = v if comp_accumulators[ci] is None else comp_accumulators[ci] + v

                del cache_clean, cache_corrupted

            torch.cuda.empty_cache()

            pos = _resolve_pos(gen_tokens, target_position)
            n_pairs = len(all_pairs)
            dim_vectors = []
            for ci, comp in enumerate(components):
                L = comp["layer"] if comp["layer"] >= 0 else n_layers // 2
                H = comp.get("head")
                inj = comp.get("injection_type", "residual")
                avg_v = comp_accumulators[ci] / n_pairs
                dim_vectors.append((L, H, inj, avg_v / (avg_v.norm() + 1e-8)))

            fwd_hooks = []
            for L, H, inj, dim_vec in dim_vectors:
                if inj == "attn_head" and H is not None:
                    def make_attn_hook(dv, h, a):
                        def _fn(value, hook):
                            value[:, :, h, :] = value[:, :, h, :] + a * dv.to(value.dtype)
                            return value
                        return _fn
                    fwd_hooks.append((f"blocks.{L}.attn.hook_z", make_attn_hook(dim_vec, H, alpha)))
                elif inj == "mlp":
                    def make_mlp_hook(dv, a):
                        def _fn(value, hook):
                            return value + a * dv.to(value.dtype)
                        return _fn
                    fwd_hooks.append((f"blocks.{L}.hook_mlp_out", make_mlp_hook(dim_vec, alpha)))
                else:
                    def make_resid_hook(dv, a):
                        def _fn(value, hook):
                            return value + a * dv.to(value.dtype)
                        return _fn
                    fwd_hooks.append((f"blocks.{L}.hook_in", make_resid_hook(dim_vec, alpha)))

            def _next_token(logits_row: torch.Tensor, generated: list[int]) -> int:
                logits = logits_row.float().clone()
                if repetition_penalty != 1.0:
                    for tok_id in generated:
                        if logits[tok_id] > 0:
                            logits[tok_id] /= repetition_penalty
                        else:
                            logits[tok_id] *= repetition_penalty
                if temperature <= 0.0:
                    return int(logits.argmax())
                return int(torch.multinomial((logits / temperature).softmax(dim=-1), 1).item())

            baseline_ids = gen_tokens.clone()
            baseline_generated: list[int] = []
            for _ in range(n_tokens):
                logits = model(baseline_ids)
                next_id = _next_token(logits[0, -1], baseline_generated)
                baseline_generated.append(next_id)
                baseline_ids = torch.cat(
                    [baseline_ids, torch.tensor([[next_id]], device=baseline_ids.device)], dim=1
                )
            baseline_text = model.tokenizer.decode(baseline_ids[0, gen_tokens.shape[1]:].tolist())
            baseline_logits = model(gen_tokens)
            vals_b, ids_b = torch.topk(baseline_logits[0, pos].softmax(dim=-1), 5)
            top_k_baseline = [
                {"token": model.tokenizer.decode([int(t)]), "prob": float(p)}
                for t, p in zip(ids_b.tolist(), vals_b.tolist())
            ]

            steered_ids = gen_tokens.clone()
            steered_generated: list[int] = []
            for i in range(n_tokens):
                logits = model.run_with_hooks(steered_ids, fwd_hooks=fwd_hooks)
                next_id = _next_token(logits[0, -1], steered_generated)
                steered_generated.append(next_id)
                steered_ids = torch.cat(
                    [steered_ids, torch.tensor([[next_id]], device=steered_ids.device)], dim=1
                )
                yield {
                    "stage": "token",
                    "data": {"token": model.tokenizer.decode([next_id]), "index": i},
                }
            steered_text = model.tokenizer.decode(steered_ids[0, gen_tokens.shape[1]:].tolist())
            steered_logits = model.run_with_hooks(gen_tokens, fwd_hooks=fwd_hooks)
            vals_s, ids_s = torch.topk(steered_logits[0, pos].softmax(dim=-1), 5)
            top_k_steered = [
                {"token": model.tokenizer.decode([int(t)]), "prob": float(p)}
                for t, p in zip(ids_s.tolist(), vals_s.tolist())
            ]

            target_id = int(baseline_logits[0, pos].argmax())
            logit_diff = float(steered_logits[0, pos, target_id] - baseline_logits[0, pos, target_id])

        yield {
            "stage": "done",
            "data": {
                "steered_text": steered_text,
                "baseline_text": baseline_text,
                "top_k_steered": top_k_steered,
                "top_k_baseline": top_k_baseline,
                "logit_diff": logit_diff,
            },
        }

    @staticmethod
    def run_attn(model, inp: dict):
        prompt = inp["prompt"]

        TOKEN_CAP = 30
        tokens = model.to_tokens(prompt)
        truncated = tokens.shape[1] > TOKEN_CAP
        if truncated:
            tokens = tokens[:, :TOKEN_CAP]

        _, cache = model.run_with_cache(
            tokens,
            names_filter=lambda name: "hook_pattern" in name,
        )

        n_layers = model.cfg.n_layers
        patterns = []
        for layer in range(n_layers):
            layer_pats = cache[f"blocks.{layer}.attn.hook_pattern"][0].cpu().tolist()
            patterns.append(layer_pats)

        token_strs = model.tokenizer.convert_ids_to_tokens(tokens[0].tolist())

        yield {
            "stage": "done",
            "data": {
                "tokens": token_strs,
                "patterns": patterns,
                "n_layers": n_layers,
                "n_heads": model.cfg.n_heads,
                "truncated": truncated,
            },
        }
