CATEGORIES = [
    "drugs",
    "arms",
    "stolen data",
    "hacking services",
    "money laundering",
    "terror financing",
]

IDENTIFIER_KINDS = ["handle", "pgp", "wallet", "onion", "clearnet", "jabber"]

IDENTIFIER_WEIGHTS = {
    "pgp": 96,
    "wallet": 92,
    "handle": 88,
    "jabber": 84,
    "onion": 80,
    "clearnet": 78,
}

INDICATOR_TYPES = {
    "certificate_name_overlap": "Certificate overlap",
    "banner_note": "Banner note",
    "descriptor_note": "Descriptor note",
    "status_page_note": "Status page note",
}

CLUSTER_THRESHOLD = 60
