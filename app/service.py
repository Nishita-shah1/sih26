"""Query, correlation, ingest, and export."""

from __future__ import annotations

import csv
import io
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

from fpdf import FPDF

from app.constants import (
    CATEGORIES,
    CLUSTER_THRESHOLD,
    IDENTIFIER_KINDS,
    IDENTIFIER_WEIGHTS,
    INDICATOR_TYPES,
)
from app.db import connect, feeds_root
from app.stylometry import rank_samples, word_count

HOUR_BUCKETS = (
    ("night", range(0, 5)),
    ("morning", range(5, 12)),
    ("afternoon", range(12, 18)),
    ("evening", range(18, 24)),
)


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def start_bound(value: str | None) -> str | None:
    if not value:
        return None
    value = value.strip()
    return value if "T" in value else value + "T00:00:00"


def end_bound(value: str | None) -> str | None:
    if not value:
        return None
    value = value.strip()
    return value if "T" in value else value + "T23:59:59"


def _like(term: str) -> str:
    escaped = term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


def _setting(conn, key: str, default: str) -> str:
    row = conn.execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
    return row["value"] if row else default


def get_settings() -> dict:
    with connect() as conn:
        enabled = _setting(conn, "autonomous_enabled", "1") == "1"
        reliability = float(_setting(conn, "min_reliability", "70"))
        interval = int(float(_setting(conn, "ingest_interval_seconds", "30")))
    return {
        "autonomous_enabled": enabled,
        "min_reliability": reliability,
        "ingest_interval_seconds": interval,
    }


def update_settings(autonomous_enabled: bool, min_reliability: float) -> dict:
    with connect() as conn:
        conn.execute(
            "UPDATE settings SET value = ? WHERE key = 'autonomous_enabled'",
            ("1" if autonomous_enabled else "0",),
        )
        conn.execute(
            "UPDATE settings SET value = ? WHERE key = 'min_reliability'",
            (str(min_reliability),),
        )
    return get_settings()


def autonomous_enabled() -> bool:
    return get_settings()["autonomous_enabled"]


def ingest_interval() -> int:
    return max(15, get_settings()["ingest_interval_seconds"])


def _normalize_filters(filters: dict | None) -> dict:
    filters = filters or {}
    return {
        "q": (filters.get("q") or "").strip(),
        "category": (filters.get("category") or "").strip(),
        "source": (filters.get("source") or "").strip(),
        "min_confidence": float(filters.get("min_confidence") or 0),
        "start": filters.get("start"),
        "end": filters.get("end"),
    }


def actor_ids(conn, filters: dict | None = None) -> list[int]:
    filters = _normalize_filters(filters)
    clauses = ["a.attribution_confidence >= ?"]
    params: list = [filters["min_confidence"]]
    if filters["category"]:
        clauses.append("a.category = ?")
        params.append(filters["category"])
    if filters["source"]:
        clauses.append(
            """
            (
                a.primary_source = ?
                OR EXISTS (
                    SELECT 1 FROM events ev
                    WHERE ev.actor_id = a.id AND ev.source = ?
                )
            )
            """
        )
        params.extend([filters["source"], filters["source"]])
    if filters["q"]:
        pattern = _like(filters["q"])
        clauses.append(
            """
            (
                a.display_name LIKE ? ESCAPE '\\'
                OR a.summary LIKE ? ESCAPE '\\'
                OR a.category LIKE ? ESCAPE '\\'
                OR EXISTS (
                    SELECT 1 FROM identifiers i
                    WHERE i.actor_id = a.id AND i.value LIKE ? ESCAPE '\\'
                )
                OR EXISTS (
                    SELECT 1 FROM indicators ind
                    WHERE ind.actor_id = a.id
                      AND (
                        ind.observation LIKE ? ESCAPE '\\'
                        OR IFNULL(ind.clearnet_match, '') LIKE ? ESCAPE '\\'
                        OR IFNULL(ind.service_ref, '') LIKE ? ESCAPE '\\'
                      )
                )
            )
            """
        )
        params.extend([pattern] * 7)
    if filters["start"] or filters["end"]:
        start = filters["start"] or "0001-01-01T00:00:00"
        end = filters["end"] or "9999-12-31T23:59:59"
        clauses.append(
            """
            EXISTS (
                SELECT 1 FROM events e
                WHERE e.actor_id = a.id AND e.occurred_at >= ? AND e.occurred_at <= ?
            )
            """
        )
        params.extend([start, end])
    sql = f"SELECT a.id FROM actors a WHERE {' AND '.join(clauses)} ORDER BY a.attribution_confidence DESC, a.display_name"
    return [row["id"] for row in conn.execute(sql, params)]


def _actors_by_ids(conn, ids: list[int]) -> list[dict]:
    if not ids:
        return []
    placeholders = ",".join("?" * len(ids))
    rows = conn.execute(
        f"SELECT * FROM actors WHERE id IN ({placeholders})",
        ids,
    ).fetchall()
    order = {actor_id: index for index, actor_id in enumerate(ids)}
    actors = [dict(row) for row in rows]
    actors.sort(key=lambda actor: order[actor["id"]])
    return actors


def _pair(left: int, right: int) -> tuple[int, int]:
    return (left, right) if left < right else (right, left)


def edges_for(conn, ids: list[int]) -> list[dict]:
    if not ids:
        return []
    id_set = set(ids)
    placeholders = ",".join("?" * len(ids))
    identifiers = conn.execute(
        f"SELECT actor_id, kind, value FROM identifiers WHERE actor_id IN ({placeholders})",
        ids,
    ).fetchall()
    grouped: dict[tuple[str, str], list[int]] = {}
    for row in identifiers:
        grouped.setdefault((row["kind"], row["value"]), []).append(row["actor_id"])

    merged: dict[tuple[int, int], list[dict]] = {}

    def add(left: int, right: int, method: dict) -> None:
        if left == right or left not in id_set or right not in id_set:
            return
        merged.setdefault(_pair(left, right), []).append(method)

    for (kind, value), owners in grouped.items():
        unique_owners = sorted(set(owners))
        if len(unique_owners) < 2:
            continue
        score = IDENTIFIER_WEIGHTS.get(kind, 70)
        for index, left in enumerate(unique_owners):
            for right in unique_owners[index + 1 :]:
                add(
                    left,
                    right,
                    {
                        "method": kind,
                        "score": score,
                        "detail": f"Shared {kind} {value}",
                        "analyst_confirmed": 0,
                    },
                )

    links = conn.execute(
        f"""
        SELECT * FROM persona_links
        WHERE left_actor_id IN ({placeholders}) AND right_actor_id IN ({placeholders})
        """,
        [*ids, *ids],
    ).fetchall()
    for link in links:
        add(
            link["left_actor_id"],
            link["right_actor_id"],
            {
                "method": link["method"],
                "score": link["score"],
                "detail": link["evidence"] or link["method"],
                "analyst_confirmed": link["analyst_confirmed"],
            },
        )

    trusts = conn.execute(
        f"""
        SELECT * FROM trust_links
        WHERE from_actor_id IN ({placeholders}) AND to_actor_id IN ({placeholders})
        """,
        [*ids, *ids],
    ).fetchall()
    for trust in trusts:
        add(
            trust["from_actor_id"],
            trust["to_actor_id"],
            {
                "method": "trust",
                "score": trust["score"],
                "detail": trust["note"] or "Trust feedback",
                "analyst_confirmed": 0,
            },
        )

    edges = []
    for (left, right), methods in merged.items():
        methods.sort(key=lambda item: item["score"], reverse=True)
        edges.append(
            {
                "source": left,
                "target": right,
                "score": methods[0]["score"],
                "methods": methods,
            }
        )
    edges.sort(key=lambda edge: edge["score"], reverse=True)
    return edges


def _clusters(actors: list[dict], edges: list[dict]) -> list[dict]:
    parent = {actor["id"]: actor["id"] for actor in actors}

    def find(actor_id: int) -> int:
        while parent[actor_id] != actor_id:
            parent[actor_id] = parent[parent[actor_id]]
            actor_id = parent[actor_id]
        return actor_id

    for edge in edges:
        if edge["score"] < CLUSTER_THRESHOLD:
            continue
        left, right = find(edge["source"]), find(edge["target"])
        if left != right:
            parent[right] = left

    groups: dict[int, list[dict]] = {}
    for actor in actors:
        groups.setdefault(find(actor["id"]), []).append(actor)

    clusters = []
    for members in groups.values():
        if len(members) < 2:
            continue
        lead = max(members, key=lambda actor: actor["attribution_confidence"])
        clusters.append(
            {
                "label": lead["display_name"],
                "confidence": lead["attribution_confidence"],
                "members": [
                    {
                        "id": member["id"],
                        "display_name": member["display_name"],
                        "category": member["category"],
                        "attribution_confidence": member["attribution_confidence"],
                    }
                    for member in sorted(members, key=lambda item: item["display_name"])
                ],
            }
        )
    clusters.sort(key=lambda cluster: (-len(cluster["members"]), cluster["label"]))
    return clusters


def list_actors(filters: dict | None = None) -> list[dict]:
    with connect() as conn:
        ids = actor_ids(conn, filters)
        actors = _actors_by_ids(conn, ids)
        if not actors:
            return []
        placeholders = ",".join("?" * len(ids))
        identifier_rows = conn.execute(
            f"""
            SELECT actor_id, kind, value FROM identifiers
            WHERE actor_id IN ({placeholders})
            ORDER BY IFNULL(confidence, 0) DESC, kind
            """,
            ids,
        ).fetchall()
        previews: dict[int, list[str]] = {}
        counts: dict[int, int] = {}
        for row in identifier_rows:
            counts[row["actor_id"]] = counts.get(row["actor_id"], 0) + 1
            bucket = previews.setdefault(row["actor_id"], [])
            if len(bucket) < 3:
                bucket.append(f"{row['kind']}: {row['value']}")
        edges = edges_for(conn, ids)
        link_counts = {actor_id: 0 for actor_id in ids}
        for edge in edges:
            link_counts[edge["source"]] += 1
            link_counts[edge["target"]] += 1
        for actor in actors:
            actor["identifier_count"] = counts.get(actor["id"], 0)
            actor["identifier_preview"] = previews.get(actor["id"], [])
            actor["link_count"] = link_counts.get(actor["id"], 0)
        return actors


def build_graph(filters: dict | None = None) -> dict:
    with connect() as conn:
        ids = actor_ids(conn, filters)
        actors = _actors_by_ids(conn, ids)
        edges = edges_for(conn, ids)
        clusters = _clusters(actors, edges)
        identifiers = []
        if ids:
            placeholders = ",".join("?" * len(ids))
            identifiers = [
                dict(row)
                for row in conn.execute(
                    f"""
                    SELECT id, actor_id, kind, value
                    FROM identifiers
                    WHERE actor_id IN ({placeholders})
                    ORDER BY kind, value
                    """,
                    ids,
                )
            ]
    return {
        "nodes": [
            {
                "id": actor["id"],
                "label": actor["display_name"],
                "category": actor["category"],
                "confidence": actor["attribution_confidence"],
                "status": actor["status"],
            }
            for actor in actors
        ],
        "edges": edges,
        "clusters": clusters,
        "identifiers": identifiers,
    }


def _behavior(conn, actor_id: int) -> dict:
    events = conn.execute(
        "SELECT occurred_at, source FROM events WHERE actor_id = ? ORDER BY occurred_at",
        (actor_id,),
    ).fetchall()
    buckets = {name: 0 for name, _ in HOUR_BUCKETS}
    sources = []
    for event in events:
        stamp = event["occurred_at"]
        hour = 0
        if "T" in stamp:
            hour = int(stamp.split("T", 1)[1][:2])
        for name, hours in HOUR_BUCKETS:
            if hour in hours:
                buckets[name] += 1
                break
        if event["source"] and event["source"] not in sources:
            sources.append(event["source"])
    identifiers = conn.execute(
        "SELECT kind, value FROM identifiers WHERE actor_id = ?",
        (actor_id,),
    ).fetchall()
    shared = 0
    for identifier in identifiers:
        others = conn.execute(
            """
            SELECT COUNT(*) AS c FROM identifiers
            WHERE kind = ? AND value = ? AND actor_id != ?
            """,
            (identifier["kind"], identifier["value"], actor_id),
        ).fetchone()["c"]
        if others:
            shared += 1
    span = 0
    if len(events) >= 2:
        first = datetime.fromisoformat(events[0]["occurred_at"])
        last = datetime.fromisoformat(events[-1]["occurred_at"])
        span = max((last - first).days, 0)
    return {
        "event_count": len(events),
        "active_span_days": span,
        "hour_buckets": buckets,
        "sources": sources,
        "identifier_count": len(identifiers),
        "shared_identifier_count": shared,
    }


def get_actor(actor_id: int) -> dict | None:
    with connect() as conn:
        row = conn.execute("SELECT * FROM actors WHERE id = ?", (actor_id,)).fetchone()
        if row is None:
            return None
        actor = dict(row)
        identifiers = [
            dict(item)
            for item in conn.execute(
                "SELECT * FROM identifiers WHERE actor_id = ? ORDER BY kind, value",
                (actor_id,),
            )
        ]
        indicators = _decorate_indicators(
            conn,
            [
                dict(item)
                for item in conn.execute(
                    "SELECT * FROM indicators WHERE actor_id = ? ORDER BY observed_at DESC",
                    (actor_id,),
                )
            ],
        )
        events = [
            dict(item)
            for item in conn.execute(
                "SELECT * FROM events WHERE actor_id = ? ORDER BY occurred_at DESC",
                (actor_id,),
            )
        ]
        samples = [
            dict(item)
            for item in conn.execute(
                "SELECT id, actor_id, label, source, collected_at FROM writing_samples WHERE actor_id = ?",
                (actor_id,),
            )
        ]
        names = {
            item["id"]: item["display_name"]
            for item in conn.execute("SELECT id, display_name FROM actors")
        }
        edges = [edge for edge in edges_for(conn, list(names)) if actor_id in (edge["source"], edge["target"])]
        links = []
        for edge in edges:
            other = edge["target"] if edge["source"] == actor_id else edge["source"]
            links.append(
                {
                    "actor_id": other,
                    "display_name": names.get(other, str(other)),
                    "score": edge["score"],
                    "methods": edge["methods"],
                }
            )
        links.sort(key=lambda item: item["score"], reverse=True)
        return {
            "actor": actor,
            "identifiers": identifiers,
            "indicators": indicators,
            "events": events,
            "samples": samples,
            "links": links,
            "behavior": _behavior(conn, actor_id),
        }


def _inventory_refs(conn) -> set[str]:
    return {
        row["asset_ref"].lower()
        for row in conn.execute("SELECT asset_ref FROM clearnet_assets")
    }


def _decorate_indicators(conn, indicators: list[dict]) -> list[dict]:
    refs = _inventory_refs(conn)
    for indicator in indicators:
        match = (indicator.get("clearnet_match") or "").lower()
        indicator["inventory_match"] = bool(match) and match in refs
        indicator["type_label"] = INDICATOR_TYPES.get(
            indicator["indicator_type"], indicator["indicator_type"]
        )
    return indicators


def list_indicators(filters: dict | None = None) -> list[dict]:
    with connect() as conn:
        ids = actor_ids(conn, filters)
        if not ids:
            return []
        placeholders = ",".join("?" * len(ids))
        rows = [
            dict(row)
            for row in conn.execute(
                f"""
                SELECT i.*, a.display_name
                FROM indicators i
                LEFT JOIN actors a ON a.id = i.actor_id
                WHERE i.actor_id IN ({placeholders})
                ORDER BY i.observed_at DESC
                """,
                ids,
            )
        ]
        filters = _normalize_filters(filters)
        if filters["start"] or filters["end"]:
            start = (filters["start"] or "0001-01-01")[:10]
            end = (filters["end"] or "9999-12-31")[:10]
            rows = [
                row
                for row in rows
                if row.get("observed_at") and start <= row["observed_at"][:10] <= end
            ]
        return _decorate_indicators(conn, rows)


def list_inventory() -> list[dict]:
    with connect() as conn:
        assets = [dict(row) for row in conn.execute("SELECT * FROM clearnet_assets ORDER BY asset_ref")]
        indicators = _decorate_indicators(
            conn,
            [dict(row) for row in conn.execute("SELECT * FROM indicators")],
        )
    matched = {}
    for indicator in indicators:
        if indicator["inventory_match"]:
            matched.setdefault(indicator["clearnet_match"].lower(), []).append(indicator["id"])
    for asset in assets:
        asset["indicator_ids"] = matched.get(asset["asset_ref"].lower(), [])
    return assets


def add_indicator(payload: dict) -> dict:
    indicator_type = payload["indicator_type"]
    if indicator_type not in INDICATOR_TYPES:
        raise ValueError("Unknown indicator type.")
    with connect() as conn:
        actor = conn.execute("SELECT id FROM actors WHERE id = ?", (payload["actor_id"],)).fetchone()
        if actor is None:
            raise ValueError("Actor not found.")
        observed = now_iso()[:10]
        conn.execute(
            """
            INSERT INTO indicators(
                actor_id, service_ref, indicator_type, observation, clearnet_match,
                confidence, source, observed_at, last_scan
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                payload["actor_id"],
                payload.get("service_ref") or None,
                indicator_type,
                payload["observation"].strip(),
                (payload.get("clearnet_match") or "").strip() or None,
                payload["confidence"],
                payload.get("source") or "analyst",
                observed,
                observed,
            ),
        )
        row = conn.execute("SELECT * FROM indicators ORDER BY id DESC LIMIT 1").fetchone()
        return _decorate_indicators(conn, [dict(row)])[0]


def list_sources() -> list[dict]:
    with connect() as conn:
        return [dict(row) for row in conn.execute("SELECT * FROM sources ORDER BY reliability DESC, name")]


def ingest_log(limit: int = 20) -> list[dict]:
    with connect() as conn:
        return [
            dict(row)
            for row in conn.execute(
                "SELECT * FROM ingest_log ORDER BY id DESC LIMIT ?",
                (limit,),
            )
        ]


def _log(conn, feed_name: str, source_name: str, reliability: float, status: str, records: int, detail: str) -> None:
    conn.execute(
        """
        INSERT INTO ingest_log(feed_name, source_name, reliability, status, records, detail, imported_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (feed_name, source_name, reliability, status, records, detail, now_iso()),
    )


def _upsert_source(conn, source: dict, imported_at: str) -> None:
    name = (source.get("name") or "unnamed source").strip()
    kind = (source.get("kind") or "feed").strip()
    reliability = float(source.get("reliability") or 0)
    notes = source.get("notes") or ""
    conn.execute(
        """
        INSERT INTO sources(name, kind, reliability, enabled, last_ingest, notes)
        VALUES (?, ?, ?, 1, ?, ?)
        ON CONFLICT(name) DO UPDATE SET
            kind = excluded.kind,
            reliability = excluded.reliability,
            last_ingest = excluded.last_ingest,
            notes = excluded.notes
        """,
        (name, kind, reliability, imported_at, notes),
    )


def _require_actor(conn, name: str) -> int | None:
    row = conn.execute("SELECT id FROM actors WHERE display_name = ?", (name,)).fetchone()
    return row["id"] if row else None


def ingest_document(doc: dict, origin: str = "upload") -> dict:
    source = doc.get("source") or {}
    reliability = float(source.get("reliability") or 0)
    source_name = (source.get("name") or "unnamed source").strip()
    with connect() as conn:
        threshold = float(_setting(conn, "min_reliability", "70"))
        if reliability < threshold:
            detail = f"Reliability {reliability:g} is below the threshold {threshold:g}."
            _log(conn, origin, source_name, reliability, "rejected", 0, detail)
            return {
                "status": "rejected",
                "source": source_name,
                "reliability": reliability,
                "threshold": threshold,
                "detail": detail,
                "records": 0,
            }

        warnings: list[str] = []
        records = 0
        names: dict[str, int] = {}
        imported_at = now_iso()
        _upsert_source(conn, source, imported_at)

        for raw in doc.get("actors") or []:
            name = (raw.get("display_name") or "").strip()
            category = (raw.get("category") or "").strip()
            if not name or category not in CATEGORIES:
                warnings.append(f"Skipped actor '{name or 'unnamed'}'.")
                continue
            conn.execute(
                """
                INSERT INTO actors(
                    display_name, category, summary, attribution_confidence, status,
                    primary_source, first_seen, last_seen, last_scan, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(display_name) DO UPDATE SET
                    last_seen = excluded.last_seen,
                    last_scan = excluded.last_scan,
                    summary = excluded.summary,
                    attribution_confidence = excluded.attribution_confidence
                """,
                (
                    name,
                    category,
                    (raw.get("summary") or "").strip(),
                    float(raw.get("attribution_confidence") or 0),
                    raw.get("status") or "active",
                    source_name,
                    raw.get("first_seen"),
                    raw.get("last_seen"),
                    raw.get("last_scan") or imported_at[:10],
                    imported_at,
                ),
            )
            actor_id = _require_actor(conn, name)
            names[name] = actor_id
            records += 1
            for identifier in raw.get("identifiers") or []:
                kind = identifier.get("kind")
                value = (identifier.get("value") or "").strip()
                if kind not in IDENTIFIER_KINDS or not value:
                    warnings.append(f"Skipped identifier on {name}.")
                    continue
                conn.execute(
                    """
                    INSERT OR IGNORE INTO identifiers(
                        actor_id, kind, value, source, confidence, first_seen, last_seen
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        actor_id,
                        kind,
                        value,
                        source_name,
                        identifier.get("confidence"),
                        raw.get("first_seen"),
                        raw.get("last_seen"),
                    ),
                )
            for event in raw.get("events") or []:
                occurred_at = event.get("occurred_at")
                event_type = event.get("event_type") or "note"
                detail = event.get("detail") or ""
                if not occurred_at:
                    continue
                conn.execute(
                    """
                    INSERT OR IGNORE INTO events(
                        actor_id, occurred_at, event_type, detail, source, reliability
                    ) VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (
                        actor_id,
                        occurred_at,
                        event_type,
                        detail,
                        source_name,
                        event.get("reliability", reliability),
                    ),
                )
            for sample in raw.get("writing_samples") or []:
                body = (sample.get("body") or "").strip()
                label = (sample.get("label") or "imported sample").strip()
                if not body:
                    continue
                conn.execute(
                    """
                    INSERT OR IGNORE INTO writing_samples(actor_id, label, body, source, collected_at)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (actor_id, label, body, source_name, imported_at[:10]),
                )
            for indicator in raw.get("indicators") or []:
                indicator_type = indicator.get("indicator_type")
                observation = (indicator.get("observation") or "").strip()
                if indicator_type not in INDICATOR_TYPES or len(observation) < 8:
                    warnings.append(f"Skipped indicator on {name}.")
                    continue
                conn.execute(
                    """
                    INSERT OR IGNORE INTO indicators(
                        actor_id, service_ref, indicator_type, observation, clearnet_match,
                        confidence, source, observed_at, last_scan
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        actor_id,
                        indicator.get("service_ref"),
                        indicator_type,
                        observation,
                        (indicator.get("clearnet_match") or "").strip() or None,
                        float(indicator.get("confidence") or 0),
                        source_name,
                        indicator.get("observed_at") or imported_at[:10],
                        imported_at[:10],
                    ),
                )

        def resolve(label: str) -> int | None:
            if label in names:
                return names[label]
            return _require_actor(conn, label)

        for link in doc.get("persona_links") or []:
            left = resolve(link.get("left") or "")
            right = resolve(link.get("right") or "")
            if not left or not right or left == right:
                warnings.append("Skipped a persona link with an unknown actor.")
                continue
            pair = _pair(left, right)
            conn.execute(
                """
                INSERT INTO persona_links(
                    left_actor_id, right_actor_id, method, score, evidence, source,
                    observed_at, analyst_confirmed
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 0)
                ON CONFLICT(left_actor_id, right_actor_id, method) DO UPDATE SET
                    score = excluded.score,
                    evidence = excluded.evidence
                """,
                (
                    pair[0],
                    pair[1],
                    link.get("method") or "analyst",
                    float(link.get("score") or 0),
                    link.get("evidence") or "",
                    source_name,
                    imported_at[:10],
                ),
            )
            records += 1

        for trust in doc.get("trust_links") or []:
            left = resolve(trust.get("from") or "")
            right = resolve(trust.get("to") or "")
            if not left or not right or left == right:
                warnings.append("Skipped a trust link with an unknown actor.")
                continue
            conn.execute(
                """
                INSERT OR IGNORE INTO trust_links(
                    from_actor_id, to_actor_id, marketplace, note, score, observed_at, source
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    left,
                    right,
                    trust.get("marketplace") or "",
                    trust.get("note") or "",
                    float(trust.get("score") or 0),
                    imported_at[:10],
                    source_name,
                ),
            )
            records += 1

        detail = " ".join(warnings) if warnings else "Imported."
        _log(conn, origin, source_name, reliability, "imported", records, detail)
        return {
            "status": "imported",
            "source": source_name,
            "reliability": reliability,
            "records": records,
            "detail": detail,
        }


def _move(path: Path, folder: str) -> None:
    dest_dir = feeds_root() / folder
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / path.name
    if dest.exists():
        dest = dest_dir / f"{path.stem}-{now_iso().replace(':', '')}{path.suffix}"
    shutil.move(str(path), str(dest))


def ingest_pending() -> list[dict]:
    pending = feeds_root() / "pending"
    pending.mkdir(parents=True, exist_ok=True)
    results = []
    for path in sorted(pending.glob("*.json")):
        try:
            document = json.loads(path.read_text(encoding="utf-8"))
            result = ingest_document(document, origin=path.name)
        except Exception as exc:
            with connect() as conn:
                _log(conn, path.name, "", 0, "error", 0, str(exc))
            results.append({"status": "error", "feed": path.name, "detail": str(exc)})
            continue
        _move(path, "processed" if result["status"] == "imported" else "rejected")
        result["feed"] = path.name
        results.append(result)
    return results


def retry_rejected() -> list[dict]:
    rejected = feeds_root() / "rejected"
    pending = feeds_root() / "pending"
    pending.mkdir(parents=True, exist_ok=True)
    if not rejected.exists():
        return []
    for path in sorted(rejected.glob("*.json")):
        dest = pending / path.name
        if dest.exists():
            continue
        shutil.move(str(path), str(dest))
    return ingest_pending()


def rank_text(text: str) -> dict:
    with connect() as conn:
        samples = [
            dict(row)
            for row in conn.execute(
                """
                SELECT s.actor_id, s.label, s.body, a.display_name, a.category
                FROM writing_samples s
                JOIN actors a ON a.id = s.actor_id
                """
            )
        ]
    ranked = rank_samples(text, samples)
    names = {sample["actor_id"]: sample for sample in samples}
    matches = []
    for item in ranked:
        actor = names[item["actor_id"]]
        matches.append(
            {
                **item,
                "display_name": actor["display_name"],
                "category": actor["category"],
            }
        )
    return {
        "word_count": word_count(text),
        "short_text": word_count(text) < 25,
        "matches": matches,
    }


def record_persona(payload: dict) -> dict:
    name = payload["candidate_name"].strip()
    matched_id = int(payload["matched_actor_id"])
    score = float(payload["score"])
    sample = payload["sample"].strip()
    with connect() as conn:
        matched = conn.execute("SELECT * FROM actors WHERE id = ?", (matched_id,)).fetchone()
        if matched is None:
            raise ValueError("Matched actor not found.")
        existing = conn.execute("SELECT * FROM actors WHERE display_name = ?", (name,)).fetchone()
        if existing is not None and existing["id"] == matched_id:
            raise ValueError("Choose a persona name that is not the matched actor.")
        if existing is None:
            created = now_iso()
            conn.execute(
                """
                INSERT INTO actors(
                    display_name, category, summary, attribution_confidence, status,
                    primary_source, first_seen, last_seen, last_scan, created_at
                ) VALUES (?, ?, ?, ?, 'candidate', 'analyst', ?, ?, ?, ?)
                """,
                (
                    name,
                    matched["category"],
                    "Candidate persona recorded from an analyst-supplied writing sample.",
                    score,
                    created[:10],
                    created[:10],
                    created[:10],
                    created,
                ),
            )
            candidate_id = _require_actor(conn, name)
        else:
            candidate_id = existing["id"]
        label = f"analyst sample {now_iso()}"
        conn.execute(
            """
            INSERT INTO writing_samples(actor_id, label, body, source, collected_at)
            VALUES (?, ?, ?, 'analyst', ?)
            """,
            (candidate_id, label, sample, now_iso()[:10]),
        )
        pair = _pair(candidate_id, matched_id)
        evidence = payload.get("evidence") or (
            f"Stylometric similarity {score:g} against {matched['display_name']}."
        )
        conn.execute(
            """
            INSERT INTO persona_links(
                left_actor_id, right_actor_id, method, score, evidence, source,
                observed_at, analyst_confirmed
            ) VALUES (?, ?, 'stylometry', ?, ?, 'analyst', ?, 1)
            ON CONFLICT(left_actor_id, right_actor_id, method) DO UPDATE SET
                score = excluded.score,
                evidence = excluded.evidence,
                analyst_confirmed = 1
            """,
            (pair[0], pair[1], score, evidence, now_iso()[:10]),
        )
        conn.execute(
            """
            INSERT INTO events(actor_id, occurred_at, event_type, detail, source, reliability)
            VALUES (?, ?, 'persona-link', ?, 'analyst', 100)
            """,
            (
                candidate_id,
                now_iso(),
                f"Analyst linked this persona to {matched['display_name']} at {score:g}.",
            ),
        )
    profile = get_actor(candidate_id)
    return {"candidate": profile["actor"], "links": profile["links"]}


def _result_set(filters: dict | None) -> dict:
    actors = list_actors(filters)
    graph = build_graph(filters)
    indicators = list_indicators(filters)
    by_id = {actor["id"]: actor for actor in actors}
    member_lists = {cluster["label"]: cluster for cluster in graph["clusters"]}
    cluster_of = {}
    for cluster in graph["clusters"]:
        for member in cluster["members"]:
            cluster_of[member["id"]] = cluster["label"]
    detailed = []
    with connect() as conn:
        for actor in actors:
            identifiers = [
                dict(row)
                for row in conn.execute(
                    "SELECT kind, value, confidence, source FROM identifiers WHERE actor_id = ?",
                    (actor["id"],),
                )
            ]
            links = []
            for edge in graph["edges"]:
                if actor["id"] not in (edge["source"], edge["target"]):
                    continue
                other = edge["target"] if edge["source"] == actor["id"] else edge["source"]
                other_actor = by_id.get(other)
                links.append(
                    {
                        "actor": other_actor["display_name"] if other_actor else str(other),
                        "score": edge["score"],
                        "methods": [method["method"] for method in edge["methods"]],
                    }
                )
            actor_indicators = [
                indicator for indicator in indicators if indicator.get("actor_id") == actor["id"]
            ]
            detailed.append(
                {
                    **actor,
                    "identifiers": identifiers,
                    "links": links,
                    "indicators": [
                        {
                            "type": item["indicator_type"],
                            "clearnet_match": item.get("clearnet_match"),
                            "inventory_match": item["inventory_match"],
                            "confidence": item["confidence"],
                            "observation": item["observation"],
                        }
                        for item in actor_indicators
                    ],
                    "cluster": cluster_of.get(actor["id"]),
                }
            )
    return {
        "generated_at": now_iso(),
        "filters": _normalize_filters(filters),
        "actor_count": len(detailed),
        "cluster_count": len(member_lists),
        "actors": detailed,
    }


def _csv_safe(value) -> str:
    text = "" if value is None else str(value)
    if text[:1] in ("=", "+", "-", "@"):
        return "'" + text
    return text


def export_csv(filters: dict | None) -> bytes:
    payload = _result_set(filters)
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        [
            "display_name",
            "category",
            "status",
            "attribution_confidence",
            "cluster",
            "primary_source",
            "first_seen",
            "last_seen",
            "last_scan",
            "identifiers",
            "linked_actors",
            "indicator_types",
            "summary",
        ]
    )
    for actor in payload["actors"]:
        identifiers = " | ".join(f"{item['kind']}:{item['value']}" for item in actor["identifiers"])
        linked = " | ".join(
            f"{item['actor']} ({', '.join(item['methods'])})" for item in actor["links"]
        )
        indicator_types = " | ".join(item["type"] for item in actor["indicators"])
        writer.writerow(
            [
                _csv_safe(actor["display_name"]),
                _csv_safe(actor["category"]),
                _csv_safe(actor["status"]),
                actor["attribution_confidence"],
                _csv_safe(actor.get("cluster") or ""),
                _csv_safe(actor.get("primary_source") or ""),
                actor.get("first_seen") or "",
                actor.get("last_seen") or "",
                actor.get("last_scan") or "",
                _csv_safe(identifiers),
                _csv_safe(linked),
                _csv_safe(indicator_types),
                _csv_safe(actor.get("summary") or ""),
            ]
        )
    return buffer.getvalue().encode("utf-8-sig")


def export_json(filters: dict | None) -> dict:
    return _result_set(filters)


def _pdf_safe(value: str) -> str:
    return (value or "").encode("latin-1", "replace").decode("latin-1")


def _pdf_line(pdf: FPDF, text: str, height: float = 6, size: int = 10, bold: bool = False) -> None:
    pdf.set_font("Helvetica", "B" if bold else "", size)
    pdf.multi_cell(0, height, _pdf_safe(text) or " ", new_x="LMARGIN", new_y="NEXT")


def export_pdf(filters: dict | None) -> bytes:
    payload = _result_set(filters)
    pdf = FPDF()
    pdf.compress = False
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.set_title("LATTICE result set")
    pdf.add_page()
    _pdf_line(pdf, "LATTICE result set", height=9, size=16, bold=True)
    _pdf_line(pdf, f"Generated {payload['generated_at']}")
    filters = payload["filters"]
    _pdf_line(
        pdf,
        "Filters: "
        f"query='{filters['q'] or 'all'}', "
        f"category='{filters['category'] or 'all'}', "
        f"source='{filters['source'] or 'all'}', "
        f"min confidence={filters['min_confidence']:g}, "
        f"from={filters['start'] or 'open'}, to={filters['end'] or 'open'}",
    )
    _pdf_line(pdf, f"Actors {payload['actor_count']}. Persona clusters {payload['cluster_count']}.")
    pdf.ln(2)
    if not payload["actors"]:
        _pdf_line(pdf, "No actors matched the query.")
    for actor in payload["actors"]:
        _pdf_line(
            pdf,
            f"{actor['display_name']}  |  {actor['category']}  |  "
            f"confidence {actor['attribution_confidence']:g}  |  {actor['status']}",
            height=7,
            size=12,
            bold=True,
        )
        _pdf_line(
            pdf,
            f"Source {actor.get('primary_source') or '-'}  |  "
            f"last scan {actor.get('last_scan') or '-'}  |  "
            f"cluster {actor.get('cluster') or 'unlinked'}",
            height=5,
        )
        _pdf_line(pdf, actor.get("summary") or "", height=5)
        if actor["identifiers"]:
            ident = "; ".join(f"{item['kind']} {item['value']}" for item in actor["identifiers"])
            _pdf_line(pdf, f"Identifiers: {ident}", height=5)
        if actor["links"]:
            linked = "; ".join(
                f"{item['actor']} via {', '.join(item['methods'])} ({item['score']:g})"
                for item in actor["links"]
            )
            _pdf_line(pdf, f"Links: {linked}", height=5)
        for indicator in actor["indicators"]:
            match = indicator.get("clearnet_match") or "no clearnet match"
            flag = "inventory match" if indicator["inventory_match"] else "unmatched"
            _pdf_line(
                pdf,
                f"Indicator {indicator['type']}: {match} ({flag}). {indicator['observation']}",
                height=5,
            )
        pdf.ln(2)
    output = pdf.output()
    if isinstance(output, str):
        return output.encode("latin-1")
    return bytes(output)


def overview(filters: dict | None = None) -> dict:
    actors = list_actors(filters)
    graph = build_graph(filters)
    indicators = list_indicators(filters)
    ids = [actor["id"] for actor in actors]
    months: dict[str, int] = {}
    with connect() as conn:
        if ids:
            placeholders = ",".join("?" * len(ids))
            bounds = _normalize_filters(filters)
            clauses = [f"actor_id IN ({placeholders})"]
            params: list = list(ids)
            if bounds["start"]:
                clauses.append("occurred_at >= ?")
                params.append(bounds["start"])
            if bounds["end"]:
                clauses.append("occurred_at <= ?")
                params.append(bounds["end"])
            for row in conn.execute(
                f"SELECT occurred_at FROM events WHERE {' AND '.join(clauses)}",
                params,
            ):
                month = row["occurred_at"][:7]
                months[month] = months.get(month, 0) + 1
    category_counts: dict[str, int] = {}
    for actor in actors:
        category_counts[actor["category"]] = category_counts.get(actor["category"], 0) + 1
    settings = get_settings()
    log = ingest_log(8)
    matched = sum(1 for indicator in indicators if indicator["inventory_match"])
    return {
        "actor_count": len(actors),
        "link_count": len(graph["edges"]),
        "cluster_count": len(graph["clusters"]),
        "clusters": graph["clusters"],
        "indicator_count": len(indicators),
        "matched_indicator_count": matched,
        "categories": [
            {"category": key, "count": value}
            for key, value in sorted(category_counts.items())
        ],
        "timeline": [
            {"month": key, "count": months[key]} for key in sorted(months)
        ],
        "settings": settings,
        "ingest_log": log,
        "unlinked_count": len(actors) - sum(len(cluster["members"]) for cluster in graph["clusters"]),
    }


def meta() -> dict:
    return {
        "categories": CATEGORIES,
        "indicator_types": [
            {"id": key, "label": label} for key, label in INDICATOR_TYPES.items()
        ],
        "identifier_kinds": IDENTIFIER_KINDS,
        "defaults": {"start": "2025-10-01", "end": "2026-12-31"},
        "scope": (
            "LATTICE correlates operator-supplied records. "
            "It does not connect to Tor or probe hidden services."
        ),
    }
