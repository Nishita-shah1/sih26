# LATTICE

Local analyst workbench for actor profiles, identifier linkage, infrastructure-note correlation, persona similarity, timeline query, and export.

## Run

```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt
.\.venv\Scripts\python -m app
```

Open http://127.0.0.1:8000

On startup the app loads the demonstration records and ingests `data/feeds/pending`. A clearnet inventory file is imported. A low-reliability rumor file is rejected and written to the ingest log.

## What you can do

- Filter actors by timeline, category, source, confidence, and identifier text.
- Open a profile for handles, PGP keys, wallets, links, infrastructure notes, and a behavioural profile.
- Inspect the relationship graph and persona clusters.
- Compare a writing sample with stored text and record a stylometric linkage.
- Match imported infrastructure notes to the clearnet asset inventory.
- Export the current result set as CSV, JSON, or PDF.

## Scope

Feeds are JSON documents you place on disk or submit in Sources. LATTICE does not connect to Tor, probe hidden services, or crawl marketplaces. Infrastructure rows are stored observations correlated with an operator inventory.

## Feed document

```json
{
  "source": {"name": "Desk notes", "kind": "feed", "reliability": 85},
  "actors": [
    {
      "display_name": "Example",
      "category": "hacking services",
      "summary": "Operator-supplied profile.",
      "attribution_confidence": 50,
      "identifiers": [{"kind": "handle", "value": "example", "confidence": 80}],
      "events": [{"occurred_at": "2026-09-01T12:00:00", "event_type": "note", "detail": "Recorded by an analyst."}]
    }
  ]
}
```

Categories: drugs, arms, stolen data, hacking services, money laundering, terror financing.

Identifier kinds: handle, pgp, wallet, onion, clearnet, jabber.

## Check

```powershell
.\.venv\Scripts\python scripts\check_api.py
```
