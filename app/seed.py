"""Fictional demonstration records. Not live collection."""

from __future__ import annotations

from app.db import connect

SOURCES = [
    ("Market Alpha digest", "marketplace", 90, "Curated marketplace summary supplied by the operator."),
    ("Forum North archive", "forum", 82, "Forum archive export supplied by the operator."),
    ("Deep web mirror index", "deep_web", 76, "Indexed mirror notes supplied by the operator."),
    ("Clearnet asset inventory", "clearnet", 93, "Operator inventory of clearnet hosts and certificates."),
]

ASSETS = [
    ("panel-origin.example.net", "host", "Inventory host listed beside a service-banner note."),
    ("edge-cache.example.net", "certificate", "Inventory certificate name for an edge host."),
    ("ledger-status.example.net", "host", "Inventory host whose status title was cited in a source note."),
    ("relay-edge.example.net", "host", "Inventory host awaiting a matching imported indicator."),
]

NORTHWIND = (
    "I keep the build notes on every box. We ship the panel and we take the fee. "
    "Don't ask for extras in the thread. If the buyer pays late I drop the job. "
    "I don't haggle. We move on. I post the same terms every time. Don't ping me twice. "
    "I close the ticket and I leave. We don't do custom work. That's the whole offer. "
    "I mean it. If you wait I drop you."
)

GLASSKITE = (
    "I keep notes on every box the same way. We ship the panel and we take the fee. "
    "Don't ask for extras in the thread. If a buyer pays late I drop the job. "
    "I don't haggle in public. We move on fast. I post the same terms every time. "
    "Don't ping me twice about it. I close the ticket and I leave. We don't do custom work here. "
    "That's the whole offer. I mean that. If you wait I drop you."
)

PAPERKITE = (
    "I still keep the build notes on every box. We ship the panel and we take the fee. "
    "Don't ask me for extras in the thread. If the buyer pays late I drop that job. "
    "I don't haggle. We move on. I post the same terms every single time. Don't ping me twice. "
    "I close the ticket and then I leave. We don't do custom work. That's the whole offer here. "
    "I mean it. If you wait I drop you."
)

HARBOR = (
    "Regarding the pending settlement, the desk will release funds only after the second "
    "confirmation has been recorded. Therefore counterparties should submit the reference intact "
    "and should not divide the transfer. However we do not amend a ledger line once it has been "
    "closed by the clerk. Please direct further correspondence through the designated channel so "
    "the archive remains complete. Thus the office will not answer fragments or partial requests. "
    "Shall the counterparty require a revision, the request must arrive before the window closes. "
    "Regarding exceptions, the desk declines them. Therefore the record stands as written and the "
    "matter is finished for the day."
)

SABLE = (
    "Regarding the outstanding balance, the desk will release the parcel record only after the "
    "second confirmation has been recorded. Therefore counterparties should submit the reference "
    "intact and should not divide the request. However we do not amend a line once it has been "
    "closed. Please direct further correspondence through the designated channel so the archive "
    "remains complete. Thus the office will not answer fragments. Shall a revision be required, "
    "it must arrive before the window closes. Regarding exceptions, the desk declines them. "
    "Therefore the record stands as written."
)

QUIET = (
    "Regarding the transfer window, the desk will release a receipt only after the second "
    "confirmation has been recorded. Therefore counterparties should submit the reference intact "
    "and should not split the instruction. However we do not amend a ledger line once the clerk "
    "has closed it. Please direct further correspondence through the designated channel. Thus the "
    "office will not answer fragments. Shall a revision be required, it must arrive before the "
    "window closes. Regarding exceptions, the desk declines them. Therefore the record stands."
)

IRON = (
    "Lot 14. Crate 3. Dock 2. Seal intact. No splits. Window 20 minutes. Miss it. Lot returns. "
    "Next list 09. Fee 14. No notes. No edits. Gate 4. Hour 15. Count 8. Drop 11. Wait 0. "
    "Lot 22. Crate 1. Dock 2. Done."
)

ARCHIVIST = (
    "The archive keeps each thread in the order it was posted. Readers should follow the original "
    "title and avoid a second copy. The notes from March remain the reference. A later edit belongs "
    "in a new post. The desk will not merge old threads. Members should cite the date when they reply. "
    "The record is easier to search that way. Off topic replies will be moved. Please keep the subject "
    "line stable."
)

REDLANTERN = (
    "The archive should keep each thread in the order it was posted. Readers ought to follow the "
    "original title and avoid a second copy. The notes from March remain the reference for this desk. "
    "A later edit belongs in a new post so the story stays clear. The desk will not merge old threads. "
    "Members should cite the date when they reply. The record is easier to search in that form. "
    "Off topic replies will be moved. Please keep the subject line stable."
)

ACTORS = [
    {
        "display_name": "Northwind",
        "category": "hacking services",
        "summary": "Hacking-service persona recorded across a marketplace digest and a forum archive.",
        "attribution_confidence": 84,
        "status": "active",
        "primary_source": "Market Alpha digest",
        "first_seen": "2025-11-02",
        "last_seen": "2026-09-18",
        "last_scan": "2026-09-25",
        "identifiers": [
            ("handle", "northwind", 90),
            ("pgp", "DEMO-PGP-CLUSTER-A", 96),
            ("wallet", "demo:wallet:cluster-a:01", 93),
            ("onion", "demo-onion:northwind-01", 70),
        ],
        "events": [
            ("2025-11-02T02:10:00", "listing", "Marketplace digest recorded the handle.", "Market Alpha digest", 90),
            ("2026-03-14T03:40:00", "key-note", "Same PGP identifier seen on a second handle.", "Forum North archive", 82),
            ("2026-09-18T02:05:00", "scan", "Analyst review refreshed the profile.", "Market Alpha digest", 90),
        ],
        "samples": [("market terms", NORTHWIND, "Market Alpha digest", "2026-03-14")],
        "indicators": [
            (
                "demo-onion:northwind-01",
                "banner_note",
                "Source report recorded a default service banner also listed on inventory host panel-origin.example.net.",
                "panel-origin.example.net",
                61,
                "Deep web mirror index",
                "2026-08-02",
            )
        ],
    },
    {
        "display_name": "GlassKite",
        "category": "hacking services",
        "summary": "Marketplace handle that reuses the Northwind PGP identifier.",
        "attribution_confidence": 76,
        "status": "active",
        "primary_source": "Market Alpha digest",
        "first_seen": "2026-01-09",
        "last_seen": "2026-09-12",
        "last_scan": "2026-09-24",
        "identifiers": [
            ("handle", "glasskite", 88),
            ("pgp", "DEMO-PGP-CLUSTER-A", 96),
        ],
        "events": [
            ("2026-01-09T03:15:00", "listing", "Handle appeared on the marketplace digest.", "Market Alpha digest", 90),
            ("2026-09-12T02:20:00", "scan", "PGP overlap with Northwind reconfirmed.", "Market Alpha digest", 90),
        ],
        "samples": [("vendor terms", GLASSKITE, "Market Alpha digest", "2026-06-02")],
        "indicators": [],
    },
    {
        "display_name": "PaperKite",
        "category": "stolen data",
        "summary": "Later stolen-data handle tied to the Northwind wallet, with a similar writing sample.",
        "attribution_confidence": 71,
        "status": "rebranded",
        "primary_source": "Forum North archive",
        "first_seen": "2026-06-21",
        "last_seen": "2026-09-16",
        "last_scan": "2026-09-26",
        "identifiers": [
            ("handle", "paperkite", 86),
            ("wallet", "demo:wallet:cluster-a:01", 92),
        ],
        "events": [
            ("2026-06-21T01:50:00", "migration", "Forum archive noted a handle change.", "Forum North archive", 82),
            ("2026-09-16T03:05:00", "listing", "Stolen-data category listing under the new handle.", "Forum North archive", 82),
        ],
        "samples": [("rebrand post", PAPERKITE, "Forum North archive", "2026-06-21")],
        "indicators": [],
    },
    {
        "display_name": "HarborDesk",
        "category": "money laundering",
        "summary": "Money-laundering desk persona sharing a wallet identifier with QuietLedger.",
        "attribution_confidence": 69,
        "status": "active",
        "primary_source": "Market Alpha digest",
        "first_seen": "2025-12-11",
        "last_seen": "2026-09-09",
        "last_scan": "2026-09-22",
        "identifiers": [
            ("handle", "harbordesk", 84),
            ("wallet", "demo:wallet:cluster-b:01", 91),
        ],
        "events": [
            ("2025-12-11T10:30:00", "listing", "Desk handle recorded on the marketplace digest.", "Market Alpha digest", 90),
            ("2026-05-04T11:10:00", "trust", "Repeated trust notes toward SableRow.", "Market Alpha digest", 90),
            ("2026-09-09T10:05:00", "scan", "Wallet overlap with QuietLedger reviewed.", "Clearnet asset inventory", 93),
        ],
        "samples": [("desk notice", HARBOR, "Market Alpha digest", "2026-05-04")],
        "indicators": [
            (
                "demo-onion:harbordesk-01",
                "status_page_note",
                "Source report referenced a status page title that matches inventory asset ledger-status.example.net.",
                "ledger-status.example.net",
                69,
                "Clearnet asset inventory",
                "2026-07-19",
            )
        ],
    },
    {
        "display_name": "SableRow",
        "category": "drugs",
        "summary": "Drugs-category persona with repeated trust feedback toward HarborDesk.",
        "attribution_confidence": 63,
        "status": "active",
        "primary_source": "Market Alpha digest",
        "first_seen": "2026-02-02",
        "last_seen": "2026-08-28",
        "last_scan": "2026-09-21",
        "identifiers": [
            ("handle", "sablerow", 80),
            ("jabber", "demo:jabber:sablerow", 74),
        ],
        "events": [
            ("2026-02-02T11:40:00", "listing", "Handle recorded on the marketplace digest.", "Market Alpha digest", 90),
            ("2026-08-28T10:15:00", "trust", "Trust feedback left for HarborDesk.", "Market Alpha digest", 90),
        ],
        "samples": [("settlement note", SABLE, "Market Alpha digest", "2026-08-28")],
        "indicators": [],
    },
    {
        "display_name": "QuietLedger",
        "category": "terror financing",
        "summary": "Finance-category persona sharing a wallet identifier with HarborDesk.",
        "attribution_confidence": 58,
        "status": "active",
        "primary_source": "Deep web mirror index",
        "first_seen": "2026-04-17",
        "last_seen": "2026-09-03",
        "last_scan": "2026-09-20",
        "identifiers": [
            ("handle", "quietledger", 77),
            ("wallet", "demo:wallet:cluster-b:01", 90),
        ],
        "events": [
            ("2026-04-17T09:20:00", "listing", "Mirror index recorded the handle.", "Deep web mirror index", 76),
            ("2026-09-03T10:45:00", "scan", "Shared wallet with HarborDesk noted.", "Clearnet asset inventory", 93),
        ],
        "samples": [("receipt language", QUIET, "Deep web mirror index", "2026-09-03")],
        "indicators": [
            (
                "demo-onion:quietledger-01",
                "descriptor_note",
                "Source report noted a descriptor contact field inconsistent with the advertised service name. No inventory match.",
                "",
                44,
                "Deep web mirror index",
                "2026-09-03",
            )
        ],
    },
    {
        "display_name": "RedLantern",
        "category": "stolen data",
        "summary": "Stolen-data persona linked to the forum handle Archivist.",
        "attribution_confidence": 67,
        "status": "active",
        "primary_source": "Forum North archive",
        "first_seen": "2026-01-20",
        "last_seen": "2026-09-11",
        "last_scan": "2026-09-23",
        "identifiers": [
            ("handle", "redlantern", 85),
            ("jabber", "demo:jabber:archive-desk", 88),
        ],
        "events": [
            ("2026-01-20T16:00:00", "listing", "Forum archive recorded the handle.", "Forum North archive", 82),
            ("2026-09-11T18:30:00", "scan", "Shared messenger identifier with Archivist reviewed.", "Forum North archive", 82),
        ],
        "samples": [("archive voice", REDLANTERN, "Forum North archive", "2026-01-20")],
        "indicators": [],
    },
    {
        "display_name": "Archivist",
        "category": "stolen data",
        "summary": "Forum persona linked to RedLantern by a shared messenger identifier and writing similarity.",
        "attribution_confidence": 61,
        "status": "rebranded",
        "primary_source": "Forum North archive",
        "first_seen": "2026-01-22",
        "last_seen": "2026-01-28",
        "last_scan": "2026-01-28",
        "identifiers": [
            ("handle", "archivist", 80),
            ("jabber", "demo:jabber:archive-desk", 88),
        ],
        "events": [
            ("2026-01-22T17:10:00", "listing", "Forum persona posted under Archivist.", "Forum North archive", 82),
            ("2026-01-28T19:40:00", "migration", "Archive noted the persona beside RedLantern.", "Forum North archive", 82),
        ],
        "samples": [("forum guide", ARCHIVIST, "Forum North archive", "2026-01-22")],
        "indicators": [],
    },
    {
        "display_name": "IronMoth",
        "category": "arms",
        "summary": "Arms-category persona with an infrastructure note that matches a clearnet inventory asset.",
        "attribution_confidence": 74,
        "status": "dormant",
        "primary_source": "Deep web mirror index",
        "first_seen": "2025-11-18",
        "last_seen": "2025-12-20",
        "last_scan": "2025-12-20",
        "identifiers": [
            ("handle", "ironmoth", 82),
            ("onion", "demo-onion:ironmoth-01", 73),
        ],
        "events": [
            ("2025-11-18T15:00:00", "listing", "Mirror index recorded the handle.", "Deep web mirror index", 76),
            ("2025-12-20T15:30:00", "scan", "Certificate-name note matched to inventory.", "Clearnet asset inventory", 93),
        ],
        "samples": [("lot sheet", IRON, "Deep web mirror index", "2025-11-18")],
        "indicators": [
            (
                "demo-onion:ironmoth-01",
                "certificate_name_overlap",
                "Source report recorded a certificate subject that matches inventory asset edge-cache.example.net.",
                "edge-cache.example.net",
                74,
                "Clearnet asset inventory",
                "2025-11-18",
            )
        ],
    },
]

PERSONA_LINKS = [
    ("GlassKite", "PaperKite", "stylometry", 86, "Writing-sample similarity on the rebrand posts.", "Forum North archive", "2026-06-21", 1),
    ("RedLantern", "Archivist", "stylometry", 79, "Writing-sample similarity on forum archive posts.", "Forum North archive", "2026-01-28", 1),
]

TRUST_LINKS = [
    ("SableRow", "HarborDesk", "Market Alpha", "Repeated positive trust feedback on Market Alpha.", 64, "2026-08-28", "Market Alpha digest"),
]


def seed_if_empty() -> None:
    with connect() as conn:
        count = conn.execute("SELECT COUNT(*) AS c FROM actors").fetchone()["c"]
        if count:
            return
        _seed(conn)


def _seed(conn) -> None:
    for name, kind, reliability, notes in SOURCES:
        conn.execute(
            """
            INSERT INTO sources(name, kind, reliability, enabled, notes)
            VALUES (?, ?, ?, 1, ?)
            """,
            (name, kind, reliability, notes),
        )
    for asset_ref, kind, notes in ASSETS:
        conn.execute(
            "INSERT INTO clearnet_assets(asset_ref, kind, notes) VALUES (?, ?, ?)",
            (asset_ref, kind, notes),
        )

    ids: dict[str, int] = {}
    for actor in ACTORS:
        cur = conn.execute(
            """
            INSERT INTO actors(
                display_name, category, summary, attribution_confidence, status,
                primary_source, first_seen, last_seen, last_scan, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                actor["display_name"],
                actor["category"],
                actor["summary"],
                actor["attribution_confidence"],
                actor["status"],
                actor["primary_source"],
                actor["first_seen"],
                actor["last_seen"],
                actor["last_scan"],
                actor["last_scan"] + "T00:00:00",
            ),
        )
        actor_id = cur.lastrowid
        ids[actor["display_name"]] = actor_id
        for kind, value, confidence in actor["identifiers"]:
            conn.execute(
                """
                INSERT INTO identifiers(
                    actor_id, kind, value, source, confidence, first_seen, last_seen
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    actor_id,
                    kind,
                    value,
                    actor["primary_source"],
                    confidence,
                    actor["first_seen"],
                    actor["last_seen"],
                ),
            )
        for occurred_at, event_type, detail, source, reliability in actor["events"]:
            conn.execute(
                """
                INSERT INTO events(actor_id, occurred_at, event_type, detail, source, reliability)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (actor_id, occurred_at, event_type, detail, source, reliability),
            )
        for label, body, source, collected_at in actor["samples"]:
            conn.execute(
                """
                INSERT INTO writing_samples(actor_id, label, body, source, collected_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (actor_id, label, body, source, collected_at),
            )
        for service_ref, indicator_type, observation, match, confidence, source, observed_at in actor["indicators"]:
            conn.execute(
                """
                INSERT INTO indicators(
                    actor_id, service_ref, indicator_type, observation, clearnet_match,
                    confidence, source, observed_at, last_scan
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    actor_id,
                    service_ref,
                    indicator_type,
                    observation,
                    match or None,
                    confidence,
                    source,
                    observed_at,
                    observed_at,
                ),
            )

    for left, right, method, score, evidence, source, observed_at, confirmed in PERSONA_LINKS:
        pair = sorted((ids[left], ids[right]))
        conn.execute(
            """
            INSERT INTO persona_links(
                left_actor_id, right_actor_id, method, score, evidence, source,
                observed_at, analyst_confirmed
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (pair[0], pair[1], method, score, evidence, source, observed_at, confirmed),
        )

    for origin, dest, marketplace, note, score, observed_at, source in TRUST_LINKS:
        conn.execute(
            """
            INSERT INTO trust_links(
                from_actor_id, to_actor_id, marketplace, note, score, observed_at, source
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (ids[origin], ids[dest], marketplace, note, score, observed_at, source),
        )
