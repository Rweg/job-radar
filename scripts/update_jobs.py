#!/usr/bin/env python3
"""Refresh active employer-posting checks without copying private application data.

The updater uses public Lever JSON endpoints for companies that expose them and
simple reachability checks for manually curated sources. It preserves the
human-written fit and preparation fields in data/jobs.json.
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "data" / "jobs.json"
LEVER_BOARDS = {
    "Waabi": "https://api.lever.co/v0/postings/waabi?mode=json",
    "Shield AI": "https://api.lever.co/v0/postings/shieldai?mode=json",
}


def fetch_json(url: str):
    request = Request(url, headers={"User-Agent": "RwegoJobRadarSourceCheck/1.0"})
    with urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def check_url(url: str) -> bool:
    request = Request(url, headers={"User-Agent": "RwegoJobRadarSourceCheck/1.0"})
    try:
        with urlopen(request, timeout=20) as response:
            return 200 <= response.status < 400
    except (HTTPError, URLError, TimeoutError):
        return False


def main() -> int:
    dataset = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    jobs = dataset.get("jobs", [])
    checked_at = datetime.now(timezone.utc).date().isoformat()
    live_urls = {}
    failures = []

    for company, endpoint in LEVER_BOARDS.items():
        try:
            for posting in fetch_json(endpoint):
                live_urls[posting.get("hostedUrl", "")] = posting
        except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as error:
            failures.append(f"{company} Lever API: {error}")

    for job in jobs:
        source_url = job.get("sourceUrl", "")
        if "jobs.lever.co/" in source_url:
            posting = live_urls.get(source_url)
            if posting:
                job["status"] = "active"
                job["lastVerified"] = checked_at
                note = job.get("sourceNote", "")
                prefix = "Verified through the public Lever postings API on this update."
                if not note.startswith(prefix):
                    job["sourceNote"] = f"{prefix} {note}".strip()
            else:
                job["status"] = "closed"
                job["lastVerified"] = checked_at
                job["sourceNote"] = "This URL was not returned by the public Lever postings API on this update. Confirm manually before treating it as closed."
        elif job.get("status") == "active":
            if check_url(source_url):
                job["lastVerified"] = checked_at
            else:
                failures.append(f"Source unreachable: {source_url}")

    dataset["verifiedAt"] = datetime.now(timezone.utc).strftime("%d %b %Y")
    DATA_PATH.write_text(json.dumps(dataset, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")
    print(f"Updated {len(jobs)} job records; checked {checked_at} UTC.")
    if failures:
        print("Warnings:")
        for failure in failures:
            print(f"- {failure}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
