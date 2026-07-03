# backend/tests/test_boot_heartbeat.py
import os

from backend.inference import _BootHeartbeat, _boot_stage, _cache_dir_bytes


class TestBootStage:
    def test_known_total_below_threshold_is_downloading(self):
        assert _boot_stage(done=500, prev_done=0, total=1000) == "downloading_weights"

    def test_known_total_reached_is_loading(self):
        assert _boot_stage(done=995, prev_done=990, total=1000) == "loading_model"

    def test_warm_cache_first_beat_is_cached(self):
        # Fully cached: first observation already >= total.
        assert _boot_stage(done=1000, prev_done=-1, total=1000) == "loading_model_cached"

    def test_cached_is_sticky_across_beats(self):
        # Once classified cached, later beats (prev_done >= 0) keep the label.
        assert (
            _boot_stage(done=1000, prev_done=1000, total=1000, prev_stage="loading_model_cached")
            == "loading_model_cached"
        )

    def test_no_total_nonempty_cache_first_beat_stays_generic_loading(self):
        # Without a known total we can't distinguish cached from partial —
        # stay conservative, not "loading_model_cached".
        assert _boot_stage(done=123, prev_done=-1, total=None) == "loading_model"

    def test_no_total_empty_cache_first_beat_is_downloading(self):
        assert _boot_stage(done=0, prev_done=-1, total=None) == "downloading_weights"

    def test_no_total_growth_is_downloading(self):
        assert _boot_stage(done=200, prev_done=100, total=None) == "downloading_weights"

    def test_no_total_no_growth_is_loading(self):
        assert _boot_stage(done=200, prev_done=200, total=None) == "loading_model"


class _RecordingDict:
    """Stand-in for the modal.Dict handle: records every write in order."""

    def __init__(self):
        self.writes = []

    def __setitem__(self, key, value):
        self.writes.append((key, value))

    def pop(self, key):
        pass


class TestBootHeartbeatBeacon:
    def _boot(self, monkeypatch, tmp_path, total):
        import modal

        fake = _RecordingDict()
        monkeypatch.setattr(
            modal.Dict, "from_name", staticmethod(lambda name, create_if_missing=False: fake)
        )
        monkeypatch.setattr("backend.inference._expected_download_bytes", lambda repos: total)
        monkeypatch.setattr(
            "backend.inference._repo_cache_root", lambda repo_id: str(tmp_path)
        )
        return fake

    def test_constructor_writes_starting_runtime_synchronously(self, monkeypatch, tmp_path):
        fake = self._boot(monkeypatch, tmp_path, total=None)
        hb = _BootHeartbeat("boot:m:r", [("m", "r")])
        try:
            # The very first write must happen on the constructor's thread,
            # before the daemon thread's Hub-metadata call can delay it.
            assert fake.writes[0][0] == "boot:m:r"
            assert fake.writes[0][1]["stage"] == "starting_runtime"
        finally:
            hb.clear()

    def test_cached_boot_omits_download_progress(self, monkeypatch, tmp_path):
        import time

        (tmp_path / "blobs").mkdir()
        (tmp_path / "blobs" / "a").write_bytes(b"x" * 100)
        fake = self._boot(monkeypatch, tmp_path, total=100)
        hb = _BootHeartbeat("boot:m:r", [("m", "r")])
        try:
            deadline = time.time() + 5
            while len(fake.writes) < 2 and time.time() < deadline:
                time.sleep(0.05)
            stage_writes = [w for _, w in fake.writes[1:]]
            assert stage_writes, "daemon thread never wrote an observation"
            assert stage_writes[0]["stage"] == "loading_model_cached"
            assert stage_writes[0].get("progress") is None
        finally:
            hb.clear()


class TestCacheDirBytes:
    def test_missing_dir_is_zero(self, tmp_path):
        assert _cache_dir_bytes(str(tmp_path / "nope")) == 0

    def test_sums_nested_files(self, tmp_path):
        (tmp_path / "blobs").mkdir()
        (tmp_path / "blobs" / "a").write_bytes(b"x" * 100)
        (tmp_path / "blobs" / "b.incomplete").write_bytes(b"x" * 50)
        assert _cache_dir_bytes(str(tmp_path)) == 150

    def test_symlinks_not_double_counted(self, tmp_path):
        # HF cache layout: snapshots/ contains symlinks into blobs/.
        (tmp_path / "blobs").mkdir()
        (tmp_path / "snapshots").mkdir()
        blob = tmp_path / "blobs" / "a"
        blob.write_bytes(b"x" * 100)
        os.symlink(blob, tmp_path / "snapshots" / "model.safetensors")
        assert _cache_dir_bytes(str(tmp_path)) == 100
