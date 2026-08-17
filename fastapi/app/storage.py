import json
import os
import shutil
import tempfile
from pathlib import Path
from typing import Protocol


class CatalogueStorage(Protocol):
    """Swappable storage contract used by both artwork and catalogue publishing."""

    def put_bytes(self, key: str, content: bytes) -> str: ...
    def put_json_atomic(self, version: str, payload: dict) -> str: ...
    def get_json(self, key: str) -> dict | None: ...


class LocalFileStorage:
    def __init__(self, root: str | None = None):
        self.root = Path(root or os.getenv("LOCAL_STORAGE_PATH", "/tmp/peblo")).resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def _path(self, key: str) -> Path:
        path = (self.root / key).resolve()
        if self.root not in path.parents and path != self.root:
            raise ValueError("Invalid storage key")
        path.parent.mkdir(parents=True, exist_ok=True)
        return path

    def put_bytes(self, key: str, content: bytes) -> str:
        path = self._path(key)
        path.write_bytes(content)
        return key

    def put_json_atomic(self, version: str, payload: dict) -> str:
        key = f"catalogue/snapshots/{version}.json"
        final_path = self._path(key)
        with tempfile.NamedTemporaryFile("w", encoding="utf-8", delete=False, dir=final_path.parent) as handle:
            json.dump(payload, handle, separators=(",", ":"))
            temporary = Path(handle.name)
        os.replace(temporary, final_path)
        pointer = self._path("catalogue/active.json")
        pointer_tmp = pointer.with_suffix(".tmp")
        shutil.copyfile(final_path, pointer_tmp)
        os.replace(pointer_tmp, pointer)
        return key

    def get_json(self, key: str) -> dict | None:
        path = self._path(key)
        return json.loads(path.read_text(encoding="utf-8")) if path.exists() else None


class R2Storage:
    """Cloudflare R2 adapter. Configure S3-compatible endpoint and credentials in production."""

    def __init__(self):
        import boto3
        self.bucket = os.environ["R2_BUCKET"]
        self.client = boto3.client(
            "s3",
            endpoint_url=os.environ["R2_ENDPOINT"],
            aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
            aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
            region_name="auto",
        )

    def put_bytes(self, key: str, content: bytes) -> str:
        self.client.put_object(Bucket=self.bucket, Key=key, Body=content)
        return key

    def put_json_atomic(self, version: str, payload: dict) -> str:
        key = f"catalogue/snapshots/{version}.json"
        self.client.put_object(Bucket=self.bucket, Key=key, Body=json.dumps(payload), ContentType="application/json")
        self.client.put_object(Bucket=self.bucket, Key="catalogue/active.json", Body=json.dumps(payload), ContentType="application/json")
        return key

    def get_json(self, key: str) -> dict | None:
        try:
            return json.loads(self.client.get_object(Bucket=self.bucket, Key=key)["Body"].read())
        except self.client.exceptions.NoSuchKey:
            return None


def get_storage() -> CatalogueStorage:
    return R2Storage() if os.getenv("CATALOGUE_STORAGE_BACKEND", "local") == "r2" else LocalFileStorage()


def public_asset_url(key: str) -> str:
    """Return a browser-reachable URL for the configured storage backend."""
    if os.getenv("CATALOGUE_STORAGE_BACKEND", "local") == "r2":
        base = os.environ["PUBLIC_ASSET_BASE_URL"].rstrip("/")
        return f"{base}/{key}"
    return f"/static/{key}"
