#!/usr/bin/env python3
import hashlib
import json
import os
import re
import shutil
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

REPO = "BeHuk-D/vipn-client"
API_URL = f"https://api.github.com/repos/{REPO}/releases/latest"
ROOT = Path("/var/www/vipn-downloads")
STATE = Path("/var/lib/vipn/releases")
MANIFEST = ROOT / "releases.json"
ETAG_FILE = STATE / "etag"
KEEP_RELEASES = 2
USER_AGENT = "vipn-release-sync/1.0"
CHUNK = 1 << 20

ALLOWED_HOSTS = {
    "api.github.com",
    "github.com",
    "objects.githubusercontent.com",
    "release-assets.githubusercontent.com",
}

ASSET_SUFFIXES = {
    "_linux_x64.run": ("linux", "x64", "installer", 0),
    "_windows_x64.exe": ("windows", "x64", "installer", 0),
    "_windows_x64.msi": ("windows", "x64", "installer", 1),
    "_android_arm64-v8a.apk": ("android", "arm64-v8a", "apk", 0),
    "_android_armeabi-v7a.apk": ("android", "armeabi-v7a", "apk", 1),
    "_android_x86_64.apk": ("android", "x86_64", "apk", 2),
}

PLATFORM_ORDER = {"linux": 0, "windows": 1, "android": 2}
TAG_RE = re.compile(r"[A-Za-z0-9._-]+")
NAME_RE = re.compile(r"[A-Za-z0-9._-]+")


class SyncError(Exception):
    pass


class SafeRedirectHandler(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        parsed = urllib.parse.urlsplit(newurl)
        host = (parsed.hostname or "").lower()
        if parsed.scheme != "https" or not (host in ALLOWED_HOSTS or host.endswith(".githubusercontent.com")):
            raise SyncError(f"redirect to disallowed host: {newurl}")
        return super().redirect_request(req, fp, code, msg, headers, newurl)


OPENER = urllib.request.build_opener(SafeRedirectHandler())


def log(message):
    print(message, flush=True)


def fsync_dir(path):
    fd = os.open(path, os.O_RDONLY)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def http_open(request, timeout):
    return OPENER.open(request, timeout=timeout)


def fetch_release(etag):
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    if etag:
        headers["If-None-Match"] = etag
    token = os.environ.get("GITHUB_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = urllib.request.Request(API_URL, headers=headers)
    for attempt in range(4):
        try:
            with http_open(request, timeout=30) as response:
                return json.load(response), response.headers.get("ETag")
        except urllib.error.HTTPError as error:
            if error.code == 304:
                return None, etag
            if error.code in (429, 500, 502, 503, 504) and attempt < 3:
                delay = int(error.headers.get("Retry-After") or 0) or 2 ** attempt
                time.sleep(min(delay, 30))
                continue
            raise SyncError(f"GitHub API returned {error.code}") from error
    raise SyncError("GitHub API is unavailable")


def select_assets(release):
    selected = []
    for asset in release.get("assets", []):
        name = asset.get("name", "")
        match = next((suffix for suffix in ASSET_SUFFIXES if name.endswith(suffix)), None)
        if not match:
            continue
        if not NAME_RE.fullmatch(name):
            raise SyncError(f"unsupported asset name: {name}")
        digest = asset.get("digest") or ""
        if not digest.startswith("sha256:"):
            raise SyncError(f"asset {name} has no sha256 digest")
        platform, arch, kind, order = ASSET_SUFFIXES[match]
        selected.append({
            "name": name,
            "size": int(asset["size"]),
            "digest": digest.split(":", 1)[1].lower(),
            "url": asset["browser_download_url"],
            "platform": platform,
            "arch": arch,
            "kind": kind,
            "order": order,
        })
    selected.sort(key=lambda item: (PLATFORM_ORDER[item["platform"]], item["order"], item["name"]))
    return selected


def read_manifest():
    try:
        with MANIFEST.open() as file:
            return json.load(file)
    except (OSError, ValueError):
        return None


def manifest_complete(manifest):
    if not manifest:
        return False
    tag_dir = ROOT / str(manifest.get("tag", ""))
    assets = manifest.get("assets") or []
    if not assets:
        return False
    for asset in assets:
        path = tag_dir / str(asset.get("name", ""))
        if not path.is_file() or path.stat().st_size != int(asset.get("size", -1)):
            return False
    return True


def tag_complete(tag, assets):
    tag_dir = ROOT / tag
    return all((tag_dir / asset["name"]).is_file()
               and (tag_dir / asset["name"]).stat().st_size == asset["size"]
               for asset in assets)


def download(asset, directory):
    target = directory / asset["name"]
    part = directory / f"{asset['name']}.part"
    expected_size = asset["size"]
    expected_hash = asset["digest"]

    if part.exists() and part.stat().st_size > expected_size:
        part.unlink()
    offset = part.stat().st_size if part.exists() else 0

    hasher = hashlib.sha256()
    if offset:
        with part.open("rb") as file:
            while chunk := file.read(CHUNK):
                hasher.update(chunk)

    for attempt in range(3):
        headers = {"User-Agent": USER_AGENT}
        if offset:
            headers["Range"] = f"bytes={offset}-"
        request = urllib.request.Request(asset["url"], headers=headers)
        try:
            with http_open(request, timeout=120) as response:
                if offset:
                    content_range = response.headers.get("Content-Range", "")
                    if response.status != 206 or not content_range.startswith(f"bytes {offset}-"):
                        log(f"restarting {asset['name']}: server ignored resume")
                        part.unlink(missing_ok=True)
                        return download(asset, directory)
                mode = "ab" if offset else "wb"
                with part.open(mode) as file:
                    while chunk := response.read(CHUNK):
                        file.write(chunk)
                        hasher.update(chunk)
                    file.flush()
                    os.fsync(file.fileno())
            break
        except (urllib.error.URLError, TimeoutError, OSError) as error:
            if attempt == 2:
                raise SyncError(f"download failed for {asset['name']}: {error}") from error
            offset = part.stat().st_size if part.exists() else 0
            if offset:
                hasher = hashlib.sha256()
                with part.open("rb") as file:
                    while chunk := file.read(CHUNK):
                        hasher.update(chunk)
            time.sleep(2 ** attempt)

    actual_size = part.stat().st_size
    if actual_size != expected_size:
        part.unlink(missing_ok=True)
        raise SyncError(f"size mismatch for {asset['name']}: {actual_size} != {expected_size}")
    actual_hash = hasher.hexdigest()
    if actual_hash != expected_hash:
        part.unlink(missing_ok=True)
        raise SyncError(f"sha256 mismatch for {asset['name']}")
    os.replace(part, target)
    os.chmod(target, 0o644)


def write_manifest(manifest):
    temporary = ROOT / ".releases.json.tmp"
    with temporary.open("w") as file:
        json.dump(manifest, file, ensure_ascii=False, indent=2)
        file.write("\n")
        file.flush()
        os.fsync(file.fileno())
    os.chmod(temporary, 0o644)
    os.replace(temporary, MANIFEST)
    fsync_dir(ROOT)


def build_manifest(tag, release, assets):
    version = tag[1:] if tag.startswith("v") else tag
    return {
        "tag": tag,
        "version": version,
        "published_at": release.get("published_at") or "",
        "synced_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "assets": [
            {
                "name": asset["name"],
                "size": asset["size"],
                "platform": asset["platform"],
                "arch": asset["arch"],
                "kind": asset["kind"],
                "url": f"/downloads/{tag}/{asset['name']}",
                "sha256": asset["digest"],
            }
            for asset in assets
        ],
    }


def cleanup_stale(active_tag):
    for path in ROOT.iterdir():
        if not path.is_dir():
            continue
        if path.name.startswith(".trash-"):
            shutil.rmtree(path, ignore_errors=True)
        elif path.name.startswith(".partial-") and path.name != f".partial-{active_tag}":
            shutil.rmtree(path, ignore_errors=True)


def prune(current_tag):
    releases = [path for path in ROOT.iterdir() if path.is_dir() and TAG_RE.fullmatch(path.name)]
    releases.sort(key=lambda path: path.stat().st_mtime, reverse=True)
    keep = {current_tag}
    for path in releases:
        if len(keep) >= KEEP_RELEASES:
            break
        keep.add(path.name)
    for path in releases:
        if path.name not in keep:
            shutil.rmtree(path, ignore_errors=True)
            log(f"removed old release {path.name}")


def run():
    ROOT.mkdir(parents=True, exist_ok=True)
    STATE.mkdir(parents=True, exist_ok=True)

    current = read_manifest()
    complete = manifest_complete(current)
    etag = ETAG_FILE.read_text().strip() if ETAG_FILE.exists() else None
    release, new_etag = fetch_release(etag if complete else None)
    if release is None:
        log(f"up to date: {current.get('tag')}")
        return

    tag = release.get("tag_name", "")
    if not TAG_RE.fullmatch(tag):
        raise SyncError(f"unexpected tag: {tag}")
    cleanup_stale(tag)
    assets = select_assets(release)
    if not assets:
        raise SyncError("latest release has no supported assets")

    if not tag_complete(tag, assets):
        directory = ROOT / f".partial-{tag}"
        directory.mkdir(parents=True, exist_ok=True)
        for asset in assets:
            target = directory / asset["name"]
            if target.is_file() and target.stat().st_size == asset["size"]:
                continue
            log(f"downloading {asset['name']} ({asset['size']} bytes)")
            download(asset, directory)
        tag_dir = ROOT / tag
        trash = ROOT / f".trash-{os.getpid()}"
        if tag_dir.exists():
            os.replace(tag_dir, trash)
        os.replace(directory, tag_dir)
        fsync_dir(ROOT)
        if trash.exists():
            shutil.rmtree(trash, ignore_errors=True)
        os.chmod(tag_dir, 0o755)
        log(f"mirrored {tag}")

    manifest = build_manifest(tag, release, assets)
    write_manifest(manifest)
    if new_etag:
        ETAG_FILE.write_text(f"{new_etag}\n")
        os.chmod(ETAG_FILE, 0o644)
    prune(tag)
    total = sum(asset["size"] for asset in assets)
    log(f"published {tag}: {len(assets)} assets, {total} bytes")


if __name__ == "__main__":
    try:
        run()
    except SyncError as error:
        print(f"error: {error}", file=sys.stderr, flush=True)
        sys.exit(1)
