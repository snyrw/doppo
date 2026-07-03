# backend/tests/test_validation.py
from types import SimpleNamespace
from unittest.mock import patch

# Pre-warm the lazy transformers import _custom_code_rejection does at call time:
# several tests below patch builtins.open / json.load globally, which corrupts a
# first-time transformers import happening under the mock.
import transformers.models.auto.configuration_auto  # noqa: F401

from backend.validation import (
    _adapter_decision,
    _detect_gpu_tier,
    _vlm_rejection,
    validate_hf_repo,
)


def test_gemma3_1b_param_count():
    assert _detect_gpu_tier(999_885_952) == "tl_small"  # google/gemma-3-1b-it


def test_gemma3_27b_param_count():
    # Multimodal Gemma-3-27B: safetensors total counts the whole checkpoint
    # (text tower + vision) — correct, since boot_transformers loads all of it.
    assert _detect_gpu_tier(27_432_406_640) == "tl_xlarge"


BRIDGEABLE = {"architectures": ["Gemma3ForConditionalGeneration"],
              "text_config": {}, "vision_config": {}}
UNBRIDGEABLE = {"architectures": ["Qwen2_5_VLForConditionalGeneration"],
                "text_config": {}, "vision_config": {}}
TEXT_ONLY = {"architectures": ["Gemma3ForCausalLM"], "num_hidden_layers": 26, "hidden_size": 1152}
TEXT_WITH_NESTED_CONFIG = {"architectures": ["SomeForCausalLM"], "text_config": {"hidden_size": 4096}}


def test_bridgeable_vlm_accepted():
    assert _vlm_rejection(BRIDGEABLE) is None


def test_unbridgeable_vlm_rejected():
    reason = _vlm_rejection(UNBRIDGEABLE)
    assert reason is not None and "text-only" in reason


def test_text_only_not_treated_as_vlm():
    assert _vlm_rejection(TEXT_ONLY) is None


def test_nested_text_config_without_vision_not_treated_as_vlm():
    # A nested text_config alone is not a vision tower — pure-text composite
    # configs ship one, and the old text_config-implies-VLM heuristic
    # false-rejected them against the arch allowlist.
    assert _vlm_rejection(TEXT_WITH_NESTED_CONFIG) is None


# ── LoRA/PEFT adapter validation (_adapter_decision is the pure decision core;
#    base_validator is injected so no network/HF calls are needed) ──────────────

def _ok_base(_base_id):
    return {"valid": True, "gpu_tier": "tl_medium", "reason": "OK", "revision": "base-sha"}


def _bad_base(_base_id):
    return {"valid": False, "gpu_tier": None, "reason": "only pickle weights"}


def test_adapter_safetensors_base_valid():
    files = {"adapter_config.json", "adapter_model.safetensors"}
    ac = {"peft_type": "LORA", "base_model_name_or_path": "meta/base"}
    res = _adapter_decision("user/lora", files, ac, "adapter-sha", _ok_base)
    assert res["valid"] is True
    assert res["gpu_tier"] == "tl_medium"  # inherits the base's tier
    assert res["revision"] == "adapter-sha"
    assert res["adapter"] == {
        "base_id": "meta/base", "adapter_id": "user/lora", "base_revision": "base-sha",
    }


def test_adapter_dora_accepted():
    # DoRA rides on a LORA config via use_dora=True — must be accepted.
    files = {"adapter_config.json", "adapter_model.safetensors"}
    ac = {"peft_type": "LORA", "use_dora": True, "base_model_name_or_path": "meta/base"}
    assert _adapter_decision("user/dora", files, ac, "sha", _ok_base)["valid"] is True


def test_adapter_bin_only_rejected():
    files = {"adapter_config.json", "adapter_model.bin"}
    ac = {"peft_type": "LORA", "base_model_name_or_path": "meta/base"}
    res = _adapter_decision("user/lora", files, ac, "sha", _ok_base)
    assert res["valid"] is False
    assert "safetensors" in res["reason"]


def test_adapter_null_auto_mapping_accepted():
    # Recent PEFT writes "auto_mapping": null into every adapter_config.json
    # (full dataclass serialization). Key presence alone must NOT reject —
    # regression: ModelOrganismsForEM/Qwen2.5-7B-Instruct_bad-medical-advice.
    files = {"adapter_config.json", "adapter_model.safetensors"}
    ac = {"peft_type": "LORA", "base_model_name_or_path": "meta/base",
          "auto_mapping": None}
    assert _adapter_decision("user/lora", files, ac, "sha", _ok_base)["valid"] is True


def test_adapter_auto_mapping_rejected():
    files = {"adapter_config.json", "adapter_model.safetensors"}
    ac = {"peft_type": "LORA", "base_model_name_or_path": "meta/base",
          "auto_mapping": {"base_model_class": "x.Y"}}
    res = _adapter_decision("user/lora", files, ac, "sha", _ok_base)
    assert res["valid"] is False
    assert "auto_mapping" in res["reason"]


def test_adapter_bad_peft_type_rejected():
    files = {"adapter_config.json", "adapter_model.safetensors"}
    ac = {"peft_type": "PREFIX_TUNING", "base_model_name_or_path": "meta/base"}
    assert _adapter_decision("user/lora", files, ac, "sha", _ok_base)["valid"] is False


def test_adapter_missing_base_rejected():
    files = {"adapter_config.json", "adapter_model.safetensors"}
    ac = {"peft_type": "LORA"}
    res = _adapter_decision("user/lora", files, ac, "sha", _ok_base)
    assert res["valid"] is False
    assert "base_model_name_or_path" in res["reason"]


def test_adapter_unsafe_base_rejected():
    # base fails the recursive gate -> adapter rejected, surfacing the base reason.
    files = {"adapter_config.json", "adapter_model.safetensors"}
    ac = {"peft_type": "LORA", "base_model_name_or_path": "evil/base"}
    res = _adapter_decision("user/lora", files, ac, "sha", _bad_base)
    assert res["valid"] is False
    assert "evil/base" in res["reason"]


# ── validate_hf_repo I/O paths (HfApi.model_info mocked — offline) ─────────────

def _mock_info(files, sha="deadbeef", params=137_022_720, model_type="gpt2"):
    return SimpleNamespace(
        siblings=[SimpleNamespace(rfilename=f) for f in files],
        sha=sha,
        safetensors=SimpleNamespace(total=params) if params is not None else None,
        config={"model_type": model_type} if model_type else None,
    )


def test_safetensors_repo_accepted_with_pinned_revision():
    files = ["config.json", "model.safetensors"]
    with patch("huggingface_hub.HfApi.model_info", return_value=_mock_info(files, sha="abc123")), \
         patch("huggingface_hub.hf_hub_download", return_value="/tmp/config.json"), \
         patch("builtins.open"), \
         patch("json.load", return_value={"num_hidden_layers": 12, "hidden_size": 768}):
        res = validate_hf_repo("some/model", hf_token=None)
    assert res["valid"] is True
    assert res["revision"] == "abc123"
    assert res["gpu_tier"] == "tl_small"


def test_pickle_only_repo_rejected():
    files = ["config.json", "pytorch_model.bin"]
    with patch("huggingface_hub.HfApi.model_info", return_value=_mock_info(files)):
        res = validate_hf_repo("some/model", hf_token=None)
    assert res["valid"] is False
    assert "pickle" in res["reason"]


def test_gated_repo_reported_as_gated_not_missing():
    # GatedRepoError subclasses RepositoryNotFoundError — if caught in the wrong
    # order, gated repos misreport as "not found".
    from huggingface_hub.utils import GatedRepoError
    with patch("huggingface_hub.HfApi.model_info", side_effect=GatedRepoError("403")):
        res = validate_hf_repo("meta-llama/gated", hf_token=None)
    assert res["valid"] is False
    assert "gated" in res["reason"]


def test_custom_code_only_arch_rejected():
    # model_type absent from transformers' registry ⇒ loadable only via
    # trust_remote_code, which the load path never enables.
    files = ["config.json", "model.safetensors"]
    info = _mock_info(files, model_type="chatglm")
    with patch("huggingface_hub.HfApi.model_info", return_value=info):
        res = validate_hf_repo("zai-org/chatglm3-6b", hf_token=None)
    assert res["valid"] is False
    assert "custom code" in res["reason"]


def test_over_100b_param_count_rejected():
    files = ["config.json", "model.safetensors.index.json"]
    info = _mock_info(files, params=405_000_000_000, model_type="llama")
    with patch("huggingface_hub.HfApi.model_info", return_value=info):
        res = validate_hf_repo("meta-llama/huge", hf_token=None)
    assert res["valid"] is False
    assert "100B" in res["reason"]


def test_missing_safetensors_metadata_falls_back_conservative():
    files = ["config.json", "model.safetensors"]
    info = _mock_info(files, params=None, model_type="llama")
    with patch("huggingface_hub.HfApi.model_info", return_value=info), \
         patch("huggingface_hub.hf_hub_download", return_value="/tmp/config.json"), \
         patch("builtins.open"), \
         patch("json.load", return_value={"num_hidden_layers": 32, "hidden_size": 4096}):
        res = validate_hf_repo("some/model", hf_token=None)
    assert res["valid"] is True
    assert res["gpu_tier"] == "tl_large"


def test_redundant_auto_map_no_longer_rejected():
    # A natively-supported model that also ships a dotted auto_map pointing at a
    # bundled modeling_*.py that duplicates the native arch. trust_remote_code=False
    # everywhere in the load path means this code never runs — see validation.py
    # module context. Previously wrongly rejected; must now be accepted.
    files = ["config.json", "model.safetensors"]
    config = {
        "num_hidden_layers": 12, "hidden_size": 768,
        "auto_map": {"AutoModel": "modeling_foo.FooModel"},
    }
    with patch("huggingface_hub.HfApi.model_info", return_value=_mock_info(files)), \
         patch("huggingface_hub.hf_hub_download", return_value="/tmp/config.json"), \
         patch("builtins.open"), \
         patch("json.load", return_value=config):
        res = validate_hf_repo("some/model", hf_token=None)
    assert res["valid"] is True


def test_adapter_pins_both_adapter_and_base_revision():
    adapter_files = ["adapter_config.json", "adapter_model.safetensors"]
    base_files = ["config.json", "model.safetensors"]

    def fake_model_info(repo_id, token=None):
        if repo_id == "user/lora":
            return _mock_info(adapter_files, sha="adapter-sha")
        return _mock_info(base_files, sha="base-sha")

    def fake_hf_hub_download(repo_id, filename, revision=None, token=None):
        return f"/tmp/{repo_id.replace('/', '_')}_{filename}"

    def fake_open(path, *a, **kw):
        import io
        if "adapter_config.json" in path:
            content = '{"peft_type": "LORA", "base_model_name_or_path": "meta/base"}'
        else:
            content = '{"num_hidden_layers": 12, "hidden_size": 768}'
        return io.StringIO(content)

    with patch("huggingface_hub.HfApi.model_info", side_effect=fake_model_info), \
         patch("huggingface_hub.hf_hub_download", side_effect=fake_hf_hub_download), \
         patch("builtins.open", side_effect=fake_open):
        res = validate_hf_repo("user/lora", hf_token=None)

    assert res["valid"] is True
    assert res["revision"] == "adapter-sha"
    assert res["adapter"]["base_revision"] == "base-sha"