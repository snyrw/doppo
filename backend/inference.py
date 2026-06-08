import modal

from .config import MAX_PROMPT_TOKENS


def _gather_next_token_probs(probs, next_tokens):
    """probs: [n_layers, seq, vocab], next_tokens: [seq-1] → [n_layers, seq-1]"""
    import torch
    return torch.gather(
        probs, dim=-1,
        index=next_tokens.view(1, -1, 1).expand(probs.shape[0], -1, 1),
    ).squeeze(-1)


def _resolve_pos(tokens, target_position: int | str) -> int:
    """Resolve target_position ('last' or an int string/int) to an absolute token index."""
    return int(tokens.shape[-1]) - 1 if target_position == "last" else int(target_position)


# ── TransformerBridge inference ───────────────────────────────────────────────

class _TLBase:
    model_id: str  # declared on each concrete subclass via modal.parameter()

    @modal.enter()
    def load_model(self):
        import torch
        from transformer_lens.model_bridge import TransformerBridge

        torch.set_grad_enabled(False)

        self.model = TransformerBridge.boot_transformers(
            self.model_id,
            dtype=torch.bfloat16,
        )
        self.model.eval()

        # not sure if this is needed since we don't do snapshots anymore
        dummy = self.model.to_tokens("the quick brown fox")
        for _ in range(3):
            self.model(dummy)
        torch.cuda.empty_cache()

    @modal.method()
    def run_dla(self, prompt: str, target_position: int | str = "last", target_token: str | None = None, contrastive_token: str | None = None):
        import json
        import torch

        yield json.dumps({"stage": "tokenizing"})
        tokens = self.model.to_tokens(prompt)
        if tokens.shape[1] > MAX_PROMPT_TOKENS:
            raise ValueError(
                f"Prompt too long: {tokens.shape[1]} tokens (max {MAX_PROMPT_TOKENS}). "
                "Shorten your prompt."
            )
        pos = _resolve_pos(tokens, target_position)

        yield json.dumps({"stage": "forward_pass"})
        _, cache = self.model.run_with_cache(tokens)

        yield json.dumps({"stage": "computing"})

        n_layers = self.model.cfg.n_layers
        n_heads = self.model.cfg.n_heads

        # Final residual needed for both token resolution and LN scaling.
        final_resid = cache[f"blocks.{n_layers - 1}.hook_out"]   # [1, seq, d_model]
        resid_pos = final_resid[0, pos].float()                   # [d_model]

        # Resolve target token.
        if target_token is None:
            final_logits = self.model.unembed(self.model.ln_final(final_resid))
            target_idx = int(final_logits[0, pos].argmax())
        else:
            ids = self.model.to_tokens(target_token, prepend_bos=False)
            target_idx = int(ids[0, 0])
        resolved_token = self.model.tokenizer.decode([target_idx])

        # Resolve contrastive token.
        contrastive_idx: int | None = None
        resolved_contrastive: str | None = None
        if contrastive_token is not None:
            ids = self.model.to_tokens(contrastive_token, prepend_bos=False)
            contrastive_idx = int(ids[0, 0])
            resolved_contrastive = self.model.tokenizer.decode([contrastive_idx])

        # Logit direction: W_U[:,target] or W_U[:,target] - W_U[:,contrastive].
        if contrastive_idx is not None:
            logit_dir = (self.model.W_U[:, target_idx] - self.model.W_U[:, contrastive_idx]).float()
        else:
            logit_dir = self.model.W_U[:, target_idx].float()

        # Fold the final LayerNorm into the logit direction so component dot-products are
        # calibrated to the actual logit.  For LayerNorm: LN(x) = (x-mean)/scale * w + b.
        # For RMSNorm (no bias): LN(x) = x/scale * w.  We bake w/scale into logit_dir; the
        # bias term is a position-independent constant captured separately in ln_bias_dla.
        # Per-component mean-centering is a standard approximation in canonical DLA.
        has_ln_bias = hasattr(self.model.ln_final, "b")
        x_for_scale = (resid_pos - resid_pos.mean()) if has_ln_bias else resid_pos
        ln_scale = (x_for_scale.pow(2).mean() + getattr(self.model.ln_final, "eps", 1e-5)).sqrt()
        ln_bias_dla = float(self.model.ln_final.b.float() @ logit_dir) if has_ln_bias else 0.0
        logit_dir = logit_dir * self.model.ln_final.w.float() / ln_scale

        # Embedding contribution: residual stream before block 0 = token embed + pos embed
        # (for RoPE models the positional information lives in attention, not the residual stream,
        # so hook_in at block 0 is simply W_E[token] — still the correct starting point).
        embed_dla = float(cache["blocks.0.hook_in"][0, pos].float() @ logit_dir)

        # Head-level DLA: [n_layers][n_heads]
        W_O = self.model.W_O  # [n_layers, n_heads, d_head, d_model]
        head_dla = []
        for layer in range(n_layers):
            z = cache[f"blocks.{layer}.attn.hook_z"][0, pos, :, :].float()  # [n_heads, d_head]
            head_results = torch.einsum("hd,hdm->hm", z, W_O[layer].float())  # [n_heads, d_model]
            head_dla.append((head_results @ logit_dir).cpu().tolist())

        # Layer-level DLA: attn and MLP reported separately and as combined sum.
        layer_dla = []
        layer_attn_dla = []
        layer_mlp_dla = []
        for layer in range(n_layers):
            attn_out = cache[f"blocks.{layer}.attn.hook_out"][0, pos].float()
            mlp_out = cache[f"blocks.{layer}.mlp.hook_out"][0, pos].float()
            attn_val = float(attn_out @ logit_dir)
            mlp_val = float(mlp_out @ logit_dir)
            layer_attn_dla.append(attn_val)
            layer_mlp_dla.append(mlp_val)
            layer_dla.append(attn_val + mlp_val)

        y_labels = [f"L{i}" for i in range(n_layers)]
        x_labels = [f"H{i}" for i in range(n_heads)]

        yield json.dumps({
            "stage": "done",
            "data": {
                "target_token": resolved_token,
                "contrastive_token": resolved_contrastive,
                "target_position": pos,
                "y_labels": y_labels,
                "x_labels": x_labels,
                "embed_dla": embed_dla,
                "ln_bias_dla": ln_bias_dla,
                "layer_dla": layer_dla,
                "layer_attn_dla": layer_attn_dla,
                "layer_mlp_dla": layer_mlp_dla,
                "head_dla": head_dla,
            },
        })

    @modal.method()
    def run_attribution(
        self,
        clean_prompt: str,
        corrupted_prompt: str,
        target_position: int | str = "last",
        target_token: str | None = None,
        contrastive_token: str | None = None,
        top_n: int = 30,
    ):
        import json
        import torch

        yield json.dumps({"stage": "tokenizing"})
        clean_tokens = self.model.to_tokens(clean_prompt)
        if clean_tokens.shape[1] > MAX_PROMPT_TOKENS:
            raise ValueError(
                f"Prompt too long: {clean_tokens.shape[1]} tokens (max {MAX_PROMPT_TOKENS}). "
                "Shorten your prompt."
            )
        corrupted_tokens = self.model.to_tokens(corrupted_prompt)
        pos = _resolve_pos(clean_tokens, target_position)

        n_layers = self.model.cfg.n_layers
        n_heads = self.model.cfg.n_heads

        # Resolve target/contrastive tokens via a plain forward pass (no cache overhead).
        yield json.dumps({"stage": "clean_forward_pass"})
        with torch.no_grad():
            if target_token is None:
                clean_logits = self.model(clean_tokens)
                target_idx = int(clean_logits[0, pos].argmax())
                del clean_logits
            else:
                ids = self.model.to_tokens(target_token, prepend_bos=False)
                target_idx = int(ids[0, 0])
        resolved_token = self.model.tokenizer.decode([target_idx])

        contrastive_idx: int | None = None
        resolved_contrastive: str | None = None
        if contrastive_token is not None:
            ids = self.model.to_tokens(contrastive_token, prepend_bos=False)
            contrastive_idx = int(ids[0, 0])
            resolved_contrastive = self.model.tokenizer.decode([contrastive_idx])

        # Clean cache — only hook_z (per-head) and mlp.hook_out needed for diffs.
        # Filtered to avoid storing all TL3 intermediates for a 27-70B model.
        needed_hooks: set[str] = {
            f"blocks.{L}.{suffix}"
            for L in range(n_layers)
            for suffix in ("attn.hook_z", "mlp.hook_out")
        }
        with torch.no_grad():
            _, clean_cache = self.model.run_with_cache(
                clean_tokens,
                names_filter=lambda name: name in needed_hooks,
            )

        # Extract only the [pos] slice for each activation and move to CPU immediately.
        # This frees the GPU tensors before the expensive backward pass.
        clean_z_cpu   = [clean_cache[f"blocks.{L}.attn.hook_z"][0, pos].float().cpu()   for L in range(n_layers)]
        clean_mlp_cpu = [clean_cache[f"blocks.{L}.mlp.hook_out"][0, pos].float().cpu()  for L in range(n_layers)]
        del clean_cache
        torch.cuda.empty_cache()

        # Corrupted forward pass with gradients — first-order Taylor attribution.
        # torch.enable_grad() overrides the global set_grad_enabled(False) from load_model.
        yield json.dumps({"stage": "corrupted_forward_backward"})

        corrupted_z: dict[int, torch.Tensor] = {}
        corrupted_mlp_out: dict[int, torch.Tensor] = {}

        def make_save_hook(d: dict, key: int):
            def _fn(value, hook):
                d[key] = value
                value.retain_grad()
                return value
            return _fn

        fwd_hooks = []
        for L in range(n_layers):
            fwd_hooks.append((f"blocks.{L}.attn.hook_z",  make_save_hook(corrupted_z, L)))
            fwd_hooks.append((f"blocks.{L}.mlp.hook_out", make_save_hook(corrupted_mlp_out, L)))

        with torch.enable_grad():
            logits_corrupted = self.model.run_with_hooks(corrupted_tokens, fwd_hooks=fwd_hooks)
            if contrastive_idx is not None:
                metric = logits_corrupted[0, pos, target_idx] - logits_corrupted[0, pos, contrastive_idx]
            else:
                metric = logits_corrupted[0, pos, target_idx]
            metric.backward()

        # Move gradients and corrupted activations to CPU before the computation loop,
        # then free all GPU tensors. Attribution math on CPU is negligible time.
        grad_z_cpu   = {}
        grad_mlp_cpu = {}
        corrupted_z_cpu   = {}
        corrupted_mlp_cpu = {}

        for L in range(n_layers):
            if corrupted_z[L].grad is None:
                raise RuntimeError(
                    f"hook_z gradient is None at layer {L}. "
                    "The TL3 bridge may be detaching activations — cannot compute attribution."
                )
            if corrupted_mlp_out[L].grad is None:
                raise RuntimeError(
                    f"mlp.hook_out gradient is None at layer {L}."
                )
            grad_z_cpu[L]   = corrupted_z[L].grad[0, pos].float().cpu()
            grad_mlp_cpu[L] = corrupted_mlp_out[L].grad[0, pos].float().cpu()
            corrupted_z_cpu[L]   = corrupted_z[L][0, pos].float().cpu()
            corrupted_mlp_cpu[L] = corrupted_mlp_out[L][0, pos].float().cpu()

        del logits_corrupted, metric, corrupted_z, corrupted_mlp_out
        torch.cuda.empty_cache()

        yield json.dumps({"stage": "computing_attribution"})

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
            mlp_diff = clean_mlp_cpu[L] - corrupted_mlp_cpu[L]
            mlp_attr = float((mlp_diff * grad_mlp_cpu[L]).sum())
            layer_attribution.append(sum(head_attribution[L]) + mlp_attr)
            all_components.append({
                "layer": L,
                "head": -1,
                "component_type": "mlp",
                "attribution_score": mlp_attr,
            })

        all_components.sort(key=lambda c: abs(c["attribution_score"]), reverse=True)
        top_k_components = all_components[:top_n]

        yield json.dumps({
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
        })

    @modal.method()
    def run_activation_patch(
        self,
        clean_prompt: str,
        corrupted_prompt: str,
        target_position: int | str = "last",
        target_token_idx: int = 0,
        contrastive_token_idx: int | None = None,
        components: list[dict] | None = None,
        k: int = 10,
    ):
        import json
        import torch

        if components is None:
            components = []

        yield json.dumps({"stage": "tokenizing"})
        clean_tokens = self.model.to_tokens(clean_prompt)
        if clean_tokens.shape[1] > MAX_PROMPT_TOKENS:
            raise ValueError(
                f"Prompt too long: {clean_tokens.shape[1]} tokens (max {MAX_PROMPT_TOKENS}). "
                "Shorten your prompt."
            )
        corrupted_tokens = self.model.to_tokens(corrupted_prompt)
        pos = _resolve_pos(clean_tokens, target_position)
        top_components = components[:k]

        # Validate component layer/head indices against model architecture.
        for comp in top_components:
            layer = comp["layer"]
            head = comp.get("head")
            if not (0 <= layer < self.model.cfg.n_layers):
                raise ValueError(f"layer {layer} out of range (model has {self.model.cfg.n_layers} layers)")
            if head is not None and head >= 0 and not (0 <= head < self.model.cfg.n_heads):
                raise ValueError(f"head {head} out of range (model has {self.model.cfg.n_heads} heads)")

        # Build set of hook names needed for corrupted cache
        hook_names: set[str] = set()
        for comp in top_components:
            L = comp["layer"]
            if comp["component_type"] == "attn_head":
                hook_names.add(f"blocks.{L}.attn.hook_z")
            else:
                hook_names.add(f"blocks.{L}.mlp.hook_out")

        def _metric(logits) -> float:
            val = logits[0, pos, target_token_idx]
            if contrastive_token_idx is not None:
                val = val - logits[0, pos, contrastive_token_idx]
            return float(val)

        yield json.dumps({"stage": "preparing"})
        device = clean_tokens.device
        with torch.no_grad():
            _, clean_cache = self.model.run_with_cache(
                clean_tokens,
                names_filter=lambda name: name in hook_names,
            )
            clean_metric = _metric(self.model(clean_tokens))
            corrupted_metric = _metric(self.model(corrupted_tokens))
        signed_diff = clean_metric - corrupted_metric
        total_diff = signed_diff if abs(signed_diff) >= 1e-8 else 1e-8

        # CPU-offload the clean cache so it doesn't compete with the k patching
        # forward passes for the limited headroom above model weights.
        clean_cache_cpu = {name: clean_cache[name].cpu() for name in hook_names}
        del clean_cache
        torch.cuda.empty_cache()

        results: list[dict] = []
        for i, comp in enumerate(top_components):
            L = comp["layer"]
            H = comp.get("head", -1)

            if comp["component_type"] == "attn_head":
                # Slice only the target position — shape [d_head].
                # hook_z is [batch, pos, n_heads, d_head] (pre-W_O, per-head).
                clean_z_val = clean_cache_cpu[f"blocks.{L}.attn.hook_z"][0, pos, H, :].to(device)

                def make_head_hook(cached_z, head_idx, target_pos):
                    def _fn(value, hook):
                        value[:, target_pos, head_idx, :] = cached_z
                        return value
                    return _fn

                hook_fn = make_head_hook(clean_z_val, H, pos)
                hook_name = f"blocks.{L}.attn.hook_z"
            else:
                # Slice only the target position — shape [d_model].
                # mlp.hook_out is [batch, pos, d_model].
                clean_mlp_val = clean_cache_cpu[f"blocks.{L}.mlp.hook_out"][0, pos, :].to(device)

                def make_mlp_hook(cached_mlp, target_pos):
                    def _fn(value, hook):
                        value[:, target_pos, :] = cached_mlp
                        return value
                    return _fn

                hook_fn = make_mlp_hook(clean_mlp_val, pos)
                hook_name = f"blocks.{L}.mlp.hook_out"

            with torch.no_grad():
                patched_logits = self.model.run_with_hooks(
                    corrupted_tokens,
                    fwd_hooks=[(hook_name, hook_fn)],
                )
            patched_metric = _metric(patched_logits)
            # Denoising: 0 = no recovery (stays corrupted), 1 = full recovery (matches clean).
            actual_effect = (patched_metric - corrupted_metric) / total_diff

            results.append({
                "layer": L,
                "head": H,
                "component_type": comp["component_type"],
                "attribution_score": comp["attribution_score"],
                "actual_effect": actual_effect,
            })

            yield json.dumps({"stage": f"patching_{i + 1}_of_{len(top_components)}"})

        yield json.dumps({"stage": "computing_effects"})
        yield json.dumps({
            "stage": "done",
            "data": {
                "total_diff": total_diff,
                "components": results,
            },
        })

    @modal.method()
    def run_steering(
        self,
        clean_prompt: str,
        corrupted_prompt: str,
        target_position: int | str = "last",
        components: list[dict] | None = None,
        alpha: float = 1.0,
        n_tokens: int = 50,
        extra_pairs: list[dict] | None = None,
        temperature: float = 1.0,
        repetition_penalty: float = 1.3,
        generation_prompt: str | None = None,
        method: str = "caa",
    ):
        import json
        import torch

        if components is None:
            components = []

        yield json.dumps({"stage": "computing"})

        _cap_tokens = self.model.to_tokens(clean_prompt)
        if _cap_tokens.shape[1] > MAX_PROMPT_TOKENS:
            raise ValueError(
                f"Prompt too long: {_cap_tokens.shape[1]} tokens (max {MAX_PROMPT_TOKENS}). "
                "Shorten your prompt."
            )
        del _cap_tokens

        # Apply chat template for instruct-tuned models so generation is in-distribution.
        # Base models (GPT-2, Qwen base, etc.) have no chat_template and get text as-is.
        def _fmt(text: str) -> str:
            tmpl = getattr(self.model.tokenizer, "chat_template", None)
            if tmpl is not None:
                return self.model.tokenizer.apply_chat_template(
                    [{"role": "user", "content": text}],
                    tokenize=False,
                    add_generation_prompt=True,
                )
            return text

        with torch.no_grad():
            gen_prompt_resolved = generation_prompt if generation_prompt else clean_prompt
            gen_tokens = self.model.to_tokens(_fmt(gen_prompt_resolved))
            n_layers = self.model.cfg.n_layers

            # Full pair list: primary pair + any extra CAA-mode pairs.
            all_pairs = [{"clean": clean_prompt, "corrupted": corrupted_prompt}]
            if extra_pairs:
                all_pairs.extend(extra_pairs)

            # Validate component layer/head indices against model architecture.
            for comp in components:
                layer = comp["layer"] if comp["layer"] >= 0 else n_layers // 2
                head = comp.get("head")
                if not (0 <= layer < self.model.cfg.n_layers):
                    raise ValueError(f"layer {layer} out of range (model has {self.model.cfg.n_layers} layers)")
                if head is not None and not (0 <= head < self.model.cfg.n_heads):
                    raise ValueError(f"head {head} out of range (model has {self.model.cfg.n_heads} heads)")

            # Accumulate unnormalized DIM vectors across all pairs, then average.
            # Each component gets its own accumulator tensor (initialized on first pair).
            comp_accumulators: list[torch.Tensor | None] = [None] * len(components)

            # "caa"    → hook_out (resid_post, after the full block — captures what the layer contributes).
            # "actadd" → hook_in  (resid_pre, before the block — captures the incoming residual stream).
            def _resid_hook_name(L: int) -> str:
                return f"blocks.{L}.hook_out" if method == "caa" else f"blocks.{L}.hook_in"

            # Pre-compute the set of hook names needed so run_with_cache only stores
            # the activations we actually read. Drops each forward pass's cache from
            # ~64 MB to a few KB, making multi-pair runs fast.
            _hook_set: set[str] = set()
            for _comp in components:
                _L = _comp["layer"] if _comp["layer"] >= 0 else n_layers // 2
                _inj = _comp.get("injection_type", "residual")
                if _inj == "attn_head" and _comp.get("head") is not None:
                    _hook_set.add(f"blocks.{_L}.attn.hook_z")
                elif _inj == "mlp":
                    _hook_set.add(f"blocks.{_L}.mlp.hook_out")
                else:
                    _hook_set.add(_resid_hook_name(_L))
            needed_hooks: list[str] = list(_hook_set)

            for pair in all_pairs:
                p_clean = self.model.to_tokens(_fmt(pair["clean"]))
                p_corrupted = self.model.to_tokens(_fmt(pair["corrupted"]))

                # Extract from each sequence's own last token independently.
                # Using a shared min-length index would pull a mid-sequence position from
                # the longer prompt instead of its pre-generation state (per IBM/ActAdd).
                if target_position == "last":
                    cp_pos = int(p_clean.shape[-1]) - 1
                    rp_pos = int(p_corrupted.shape[-1]) - 1
                else:
                    cp_pos = min(int(target_position), int(p_clean.shape[-1]) - 1)
                    rp_pos = min(int(target_position), int(p_corrupted.shape[-1]) - 1)

                _, cache_clean = self.model.run_with_cache(p_clean, names_filter=needed_hooks)
                _, cache_corrupted = self.model.run_with_cache(p_corrupted, names_filter=needed_hooks)

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
                            cache_clean[f"blocks.{L}.mlp.hook_out"][0, cp_pos, :].float()
                            - cache_corrupted[f"blocks.{L}.mlp.hook_out"][0, rp_pos, :].float()
                        )
                    else:
                        v = (
                            cache_clean[_resid_hook_name(L)][0, cp_pos, :].float()
                            - cache_corrupted[_resid_hook_name(L)][0, rp_pos, :].float()
                        )
                    comp_accumulators[ci] = v if comp_accumulators[ci] is None else comp_accumulators[ci] + v

                del cache_clean, cache_corrupted

            torch.cuda.empty_cache()

            # Average accumulated difference vectors; alpha scales them directly (no unit normalization).
            pos = _resolve_pos(gen_tokens, target_position)
            n_pairs = len(all_pairs)
            dim_vectors = []
            for ci, comp in enumerate(components):
                L = comp["layer"] if comp["layer"] >= 0 else n_layers // 2
                H = comp.get("head")
                inj = comp.get("injection_type", "residual")
                avg_v = comp_accumulators[ci] / n_pairs
                dim_vectors.append((L, H, inj, avg_v))

            # Build hooks with factory functions to avoid Python late-binding closure bug.
            # Cast dv to value.dtype inside each hook — DIM vectors are float32 but model
            # activations are bfloat16 (loaded with dtype=torch.bfloat16).
            # CAA: inject from the last prompt token onward, leaving earlier context unsteered.
            # ActAdd: inject at all positions (standard algebraic value editing).
            anchor = gen_tokens.shape[1] - 1
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
                    fwd_hooks.append((f"blocks.{L}.mlp.hook_out", make_mlp_hook(dim_vec, alpha)))
                elif method == "caa":
                    def make_caa_hook(dv, a, anch):
                        def _fn(value, hook):
                            value[:, anch:, :] = value[:, anch:, :] + a * dv.to(value.dtype)
                            return value
                        return _fn
                    fwd_hooks.append((_resid_hook_name(L), make_caa_hook(dim_vec, alpha, anchor)))
                else:
                    def make_actadd_hook(dv, a):
                        def _fn(value, hook):
                            return value + a * dv.to(value.dtype)
                        return _fn
                    fwd_hooks.append((_resid_hook_name(L), make_actadd_hook(dim_vec, alpha)))

            # Closure: apply repetition penalty to already-generated tokens, then sample.
            # Penalizes only the generated portion to avoid interfering with deliberate
            # repetition in the original prompt.
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

            # Baseline generation + top-K at target position
            baseline_ids = gen_tokens.clone()
            baseline_generated: list[int] = []
            for _ in range(n_tokens):
                logits = self.model(baseline_ids)
                next_id = _next_token(logits[0, -1], baseline_generated)
                baseline_generated.append(next_id)
                baseline_ids = torch.cat(
                    [baseline_ids, torch.tensor([[next_id]], device=baseline_ids.device)], dim=1
                )
            baseline_text = self.model.tokenizer.decode(baseline_ids[0, gen_tokens.shape[1]:].tolist())
            baseline_logits = self.model(gen_tokens)
            vals_b, ids_b = torch.topk(baseline_logits[0, pos].softmax(dim=-1), 5)
            top_k_baseline = [
                {"token": self.model.tokenizer.decode([int(t)]), "prob": float(p)}
                for t, p in zip(ids_b.tolist(), vals_b.tolist())
            ]

            # Steered generation + streaming + top-K at target position
            steered_ids = gen_tokens.clone()
            steered_generated: list[int] = []
            for i in range(n_tokens):
                logits = self.model.run_with_hooks(steered_ids, fwd_hooks=fwd_hooks)
                next_id = _next_token(logits[0, -1], steered_generated)
                steered_generated.append(next_id)
                steered_ids = torch.cat(
                    [steered_ids, torch.tensor([[next_id]], device=steered_ids.device)], dim=1
                )
                yield json.dumps({
                    "stage": "token",
                    "data": {"token": self.model.tokenizer.decode([next_id]), "index": i},
                })
            steered_text = self.model.tokenizer.decode(steered_ids[0, gen_tokens.shape[1]:].tolist())
            steered_logits = self.model.run_with_hooks(gen_tokens, fwd_hooks=fwd_hooks)
            vals_s, ids_s = torch.topk(steered_logits[0, pos].softmax(dim=-1), 5)
            top_k_steered = [
                {"token": self.model.tokenizer.decode([int(t)]), "prob": float(p)}
                for t, p in zip(ids_s.tolist(), vals_s.tolist())
            ]

            target_id = int(baseline_logits[0, pos].argmax())
            logit_diff = float(steered_logits[0, pos, target_id] - baseline_logits[0, pos, target_id])

        yield json.dumps({
            "stage": "done",
            "data": {
                "steered_text": steered_text,
                "baseline_text": baseline_text,
                "top_k_steered": top_k_steered,
                "top_k_baseline": top_k_baseline,
                "logit_diff": logit_diff,
            },
        })

    @modal.method()
    def run_logit_lens(self, prompt: str, top_k: int = 5):
        import json
        import torch

        yield json.dumps({"stage": "tokenizing"})
        tokens = self.model.to_tokens(prompt)
        if tokens.shape[1] > MAX_PROMPT_TOKENS:
            raise ValueError(
                f"Prompt too long: {tokens.shape[1]} tokens (max {MAX_PROMPT_TOKENS}). "
                "Shorten your prompt."
            )

        yield json.dumps({"stage": "forward_pass"})
        _, cache = self.model.run_with_cache(tokens)

        yield json.dumps({"stage": "computing"})
        accumulated_residual, labels = cache.accumulated_resid(
            layer=-1, incl_mid=False, return_labels=True
        )
        resid_at_layers = accumulated_residual[:, 0, :, :]
        scaled_resid = self.model.ln_final(resid_at_layers)
        layer_logits = self.model.unembed(scaled_resid)
        layer_probs = layer_logits.softmax(dim=-1)

        pred_probs = layer_probs[:, :-1, :]
        next_tokens = tokens[0, 1:]
        gathered_probs = _gather_next_token_probs(pred_probs, next_tokens)
        token_strings = self.model.to_str_tokens(tokens)[1:]

        topk_vals, topk_ids = torch.topk(pred_probs, k=top_k, dim=-1)
        n_layers, n_pos, k = topk_ids.shape
        flat_ids = topk_ids.reshape(-1).cpu().tolist()
        flat_strs = [self.model.tokenizer.decode([int(tid)]) for tid in flat_ids]
        topk_token_strings = [
            [[flat_strs[li * n_pos * k + p * k + j] for j in range(k)] for p in range(n_pos)]
            for li in range(n_layers)
        ]

        # Per-layer metrics in a single pass: KL divergence from final layer,
        # rank of the final layer's top-1 token, and Shannon entropy.
        eps = 1e-10
        final_probs = pred_probs[-1].float()          # [n_pos, vocab]
        final_top1_ids = final_probs.argmax(dim=-1)   # [n_pos]
        pos_range = torch.arange(n_pos, device=pred_probs.device)
        kl_data, rank_data, entropy_data = [], [], []
        for li in range(n_layers):
            p = pred_probs[li].float()  # [n_pos, vocab]
            kl_data.append(
                (p * (torch.log(p + eps) - torch.log(final_probs + eps))).sum(dim=-1).cpu().tolist()
            )
            target_p = p[pos_range, final_top1_ids]   # [n_pos]
            rank_data.append(
                (p > target_p.unsqueeze(-1)).sum(dim=-1).add(1).cpu().tolist()
            )
            entropy_data.append(
                (-(p * torch.log(p + eps)).sum(dim=-1)).cpu().tolist()
            )

        yield json.dumps({
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
        })

    @modal.method()
    def run_attn(self, prompt: str):
        import json
        import torch

        TOKEN_CAP = 30
        tokens = self.model.to_tokens(prompt)
        if tokens.shape[1] > MAX_PROMPT_TOKENS:
            raise ValueError(
                f"Prompt too long: {tokens.shape[1]} tokens (max {MAX_PROMPT_TOKENS}). "
                "Shorten your prompt."
            )
        truncated = tokens.shape[1] > TOKEN_CAP
        if truncated:
            tokens = tokens[:, :TOKEN_CAP]

        _, cache = self.model.run_with_cache(
            tokens,
            names_filter=lambda name: "hook_pattern" in name,
        )

        n_layers = self.model.cfg.n_layers
        patterns = []
        for layer in range(n_layers):
            layer_pats = cache[f"blocks.{layer}.attn.hook_pattern"][0].cpu().tolist()
            patterns.append(layer_pats)

        token_strs = self.model.tokenizer.convert_ids_to_tokens(tokens[0].tolist())

        yield json.dumps({
            "stage": "done",
            "data": {
                "tokens": token_strs,
                "patterns": patterns,
                "n_layers": n_layers,
                "n_heads": self.model.cfg.n_heads,
                "truncated": truncated,
            },
        })

    @modal.method()
    def run_logit_lens_result(self, prompt: str, top_k: int = 5) -> dict:
        import json
        for chunk_str in self.run_logit_lens.local(prompt, top_k):
            chunk = json.loads(chunk_str)
            if chunk.get("stage") == "done":
                return chunk["data"]
        raise RuntimeError("run_logit_lens produced no done event")

    @modal.method()
    def run_attn_result(self, prompt: str) -> dict:
        import json
        for chunk_str in self.run_attn.local(prompt):
            chunk = json.loads(chunk_str)
            if chunk.get("stage") == "done":
                return chunk["data"]
        raise RuntimeError("run_attn produced no done event")

    @modal.method()
    def run_dla_result(
        self,
        prompt: str,
        target_position: int | str = "last",
        target_token: str | None = None,
        contrastive_token: str | None = None,
    ) -> dict:
        import json
        for chunk_str in self.run_dla.local(prompt, target_position, target_token, contrastive_token):
            chunk = json.loads(chunk_str)
            if chunk.get("stage") == "done":
                return chunk["data"]
        raise RuntimeError("run_dla produced no done event")

    @modal.method()
    def run_attribution_result(
        self,
        clean_prompt: str,
        corrupted_prompt: str,
        target_position: int | str = "last",
        target_token: str | None = None,
        contrastive_token: str | None = None,
        top_n: int = 30,
    ) -> dict:
        import json
        for chunk_str in self.run_attribution.local(
            clean_prompt, corrupted_prompt, target_position, target_token, contrastive_token, top_n
        ):
            chunk = json.loads(chunk_str)
            if chunk.get("stage") == "done":
                return chunk["data"]
        raise RuntimeError("run_attribution produced no done event")

    @modal.method()
    def run_activation_patch_result(
        self,
        clean_prompt: str,
        corrupted_prompt: str,
        target_position: int | str = "last",
        target_token_idx: int = 0,
        contrastive_token_idx: int | None = None,
        components: list[dict] | None = None,
        k: int = 10,
    ) -> dict:
        import json
        for chunk_str in self.run_activation_patch.local(
            clean_prompt, corrupted_prompt, target_position, target_token_idx, contrastive_token_idx,
            components or [], k
        ):
            chunk = json.loads(chunk_str)
            if chunk.get("stage") == "done":
                return chunk["data"]
        raise RuntimeError("run_activation_patch produced no done event")

    @modal.method()
    def run_steering_result(
        self,
        clean_prompt: str,
        corrupted_prompt: str,
        target_position: int | str = "last",
        components: list[dict] | None = None,
        alpha: float = 1.0,
        n_tokens: int = 50,
        extra_pairs: list[dict] | None = None,
        temperature: float = 1.0,
        repetition_penalty: float = 1.3,
        generation_prompt: str | None = None,
        method: str = "caa",
    ) -> dict:
        import json
        for chunk_str in self.run_steering.local(
            clean_prompt, corrupted_prompt, target_position, components or [], alpha,
            n_tokens, extra_pairs, temperature, repetition_penalty, generation_prompt,
            method,
        ):
            chunk = json.loads(chunk_str)
            if chunk.get("stage") == "done":
                return chunk["data"]
        raise RuntimeError("run_steering produced no done event")
