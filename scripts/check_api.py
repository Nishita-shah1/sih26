"""End-to-end checks against a temporary database and feed folder."""

from __future__ import annotations

import json
import os
import shutil
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    temp = tempfile.TemporaryDirectory()
    feeds = Path(temp.name) / "feeds"
    pending = feeds / "pending"
    pending.mkdir(parents=True)
    examples = ROOT / "data" / "feeds" / "examples"
    for path in examples.glob("*.json"):
        shutil.copy(path, pending / path.name)
    os.environ["LATTICE_DB"] = str(Path(temp.name) / "lattice.db")
    os.environ["LATTICE_FEEDS"] = str(feeds)
    sys.path.insert(0, str(ROOT))

    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as client:
        health = client.get("/api/health")
        assert health.status_code == 200, health.text
        assert health.json()["actors"] == 10, health.text

        names = {row["display_name"] for row in client.get("/api/actors").json()}
        assert "RelayWatch" in names
        assert "RumorGhost" not in names
        assert "IronMoth" in names

        only_2026 = {row["display_name"] for row in client.get("/api/actors", params={"start": "2026-01-01", "end": "2026-12-31"}).json()}
        assert "IronMoth" not in only_2026
        assert "Archivist" in only_2026
        assert "Northwind" in only_2026

        july = {node["label"] for node in client.get("/api/graph", params={"start": "2026-07-01", "end": "2026-12-31"}).json()["nodes"]}
        assert "IronMoth" not in july
        assert "Archivist" not in july
        assert "Northwind" in july
        assert "RedLantern" in july

        graph = client.get("/api/graph", params={"start": "2025-10-01", "end": "2026-12-31"}).json()
        ids = {node["label"]: node["id"] for node in graph["nodes"]}

        def linked(left: str, right: str) -> bool:
            pair = {ids[left], ids[right]}
            return any({edge["source"], edge["target"]} == pair for edge in graph["edges"])

        assert linked("Northwind", "GlassKite")
        assert linked("Northwind", "PaperKite")
        assert linked("Northwind", "RelayWatch")
        assert linked("HarborDesk", "QuietLedger")
        assert linked("SableRow", "HarborDesk")
        assert linked("RedLantern", "Archivist")
        assert "Northwind" in {cluster["label"] for cluster in graph["clusters"]}

        informal = client.post(
            "/api/stylometry/rank",
            json={
                "text": (
                    "I keep build notes on every box. We ship the panel and we take the fee. "
                    "Don't ask for extras. If the buyer pays late I drop the job. "
                    "I don't haggle and we move on. That's the whole offer. "
                    "I post the same terms every time."
                )
            },
        )
        assert informal.status_code == 200, informal.text
        top = informal.json()["matches"][0]["display_name"]
        print("informal top", [(row["display_name"], row["score"]) for row in informal.json()["matches"][:4]])
        assert top in {"Northwind", "GlassKite", "PaperKite"}

        terse = client.post(
            "/api/stylometry/rank",
            json={"text": "Lot 19. Crate 4. Dock 2. Window 15 minutes. Gate 7. Count 3. Drop 12. No splits. Done."},
        )
        print("terse top", [(row["display_name"], row["score"]) for row in terse.json()["matches"][:4]])
        assert terse.json()["matches"][0]["display_name"] == "IronMoth"

        formal = client.post(
            "/api/stylometry/rank",
            json={
                "text": (
                    "Regarding the closed ledger, the desk will answer only after the second confirmation. "
                    "Therefore counterparties should keep the reference intact. However the office will not "
                    "amend a line once the clerk has closed it. Please use the designated channel. Thus the "
                    "record stands as written."
                )
            },
        )
        print("formal top", [(row["display_name"], row["score"]) for row in formal.json()["matches"][:4]])
        assert formal.json()["matches"][0]["display_name"] in {"HarborDesk", "SableRow", "QuietLedger"}

        exported = client.get("/api/export/json", params={"start": "2025-10-01", "end": "2026-12-31"})
        assert exported.status_code == 200
        body = exported.json()
        assert body["actor_count"] == 10
        assert any(actor["display_name"] == "Northwind" for actor in body["actors"])

        csv_bytes = client.get("/api/export/csv").content
        assert csv_bytes.startswith("\ufeff".encode("utf-8")) or b"display_name" in csv_bytes
        assert b"Northwind" in csv_bytes
        assert b"RumorGhost" not in csv_bytes

        pdf = client.get("/api/export/report", params={"category": "arms", "start": "2025-10-01", "end": "2026-12-31"})
        assert pdf.status_code == 200
        assert pdf.content.startswith(b"%PDF")
        assert b"IronMoth" in pdf.content

        empty = client.get("/api/export/csv", params={"category": "arms", "start": "2026-06-01", "end": "2026-12-31"})
        assert empty.status_code == 200
        assert b"IronMoth" not in empty.content

        iron = next(row for row in client.get("/api/actors", params={"q": "IronMoth"}).json())
        created = client.post(
            "/api/indicators",
            json={
                "actor_id": iron["id"],
                "indicator_type": "certificate_name_overlap",
                "observation": "Analyst note recorded a certificate name present on edge-cache.example.net.",
                "service_ref": "demo-onion:ironmoth-01",
                "clearnet_match": "edge-cache.example.net",
                "confidence": 70,
                "source": "analyst",
            },
        )
        assert created.status_code == 200, created.text
        assert created.json()["inventory_match"] is True

        rejected = client.post(
            "/api/ingest/feed",
            json=json.loads((examples / "rumor_board.json").read_text(encoding="utf-8")),
        )
        assert rejected.status_code == 200, rejected.text
        assert rejected.json()["status"] == "rejected"
        assert all(row["display_name"] != "RumorGhost" for row in client.get("/api/actors").json())

        log = client.get("/api/ingest/log").json()
        assert any(item["status"] == "imported" for item in log)
        assert any(item["status"] == "rejected" for item in log)

        settings = client.put("/api/settings", json={"autonomous_enabled": False, "min_reliability": 80})
        assert settings.json()["autonomous_enabled"] is False
        assert settings.json()["min_reliability"] == 80

        linked_persona = client.post(
            "/api/persona-links",
            json={
                "candidate_name": "NightPanel",
                "matched_actor_id": ids["Northwind"],
                "score": 90,
                "sample": "I keep the notes. We ship the panel. Don't ask twice. I drop the job.",
                "evidence": "Check linkage",
            },
        )
        assert linked_persona.status_code == 200, linked_persona.text
        assert linked_persona.json()["candidate"]["display_name"] == "NightPanel"

        page = client.get("/")
        assert page.status_code == 200
        assert "EchoLeaks" in page.text
        assert client.get("/static/app.js").status_code == 200
        assert client.get("/static/styles.css").status_code == 200

    print("LATTICE checks passed")


if __name__ == "__main__":
    main()
