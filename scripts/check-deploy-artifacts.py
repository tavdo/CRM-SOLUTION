"""Check the prepared hosting bundle without printing credential values."""
import json
import os
import sys
from pathlib import Path
from urllib.parse import urlparse, unquote
from zipfile import ZipFile

root = Path(__file__).resolve().parents[1]


def environment(name):
    result = {}
    for line in (root / name).read_text(encoding="utf-8-sig").splitlines():
        if "=" not in line or line.lstrip().startswith("#"):
            continue
        key, value = line.split("=", 1)
        try:
            result[key] = json.loads(value)
        except (ValueError, TypeError):
            result[key] = value.strip("\"'")
    return result


live = environment(".env.live.local")
local = environment(".env")
preview = environment(".env.preview.local")
forbidden = {
    "live backup key": live.get("BACKUP_ENCRYPTION_KEY"),
    "local backup key": local.get("BACKUP_ENCRYPTION_KEY"),
    "live session key": live.get("SESSION_SECRET"),
    "local session key": local.get("SESSION_SECRET"),
    "database administrator password": unquote(urlparse(live.get("DIRECT_URL", "")).password or ""),
    "read-only backup password": unquote(urlparse(live.get("BACKUP_DATABASE_URL", "")).password or ""),
}
forbidden = {name: value.encode() for name, value in forbidden.items() if value and len(value) >= 12}
violations = []
linux_engine = False
archives = list((root / ".netlify/functions").glob("*.zip"))
if not archives:
    raise SystemExit("No prepared Netlify function archive found")
if "--strip-generated-env" in sys.argv:
    # The Next adapter explicitly copies local .env files independently of NFT
    # tracing. Runtime settings are already configured in Netlify; remove only
    # generated copies, preserving every original local configuration file.
    generated = (root / ".netlify/functions-internal").resolve()
    for file in generated.rglob(".env*"):
        if file.is_file() and generated in file.resolve().parents:
            file.unlink()
    for archive in archives:
        temporary = archive.with_suffix(".clean.zip")
        with ZipFile(archive) as original, ZipFile(temporary, "w") as clean:
            for member in original.infolist():
                if member.filename.replace("\\", "/").rsplit("/", 1)[-1].startswith(".env"):
                    continue
                clean.writestr(member, original.read(member))
        os.replace(temporary, archive)
entries = 0
for archive in archives:
    with ZipFile(archive) as bundle:
        for member in bundle.infolist():
            if member.is_dir():
                continue
            entries += 1
            name = member.filename.replace("\\", "/")
            filename = name.rsplit("/", 1)[-1]
            if filename.startswith(".env") and not filename.endswith(".example"):
                violations.append({"kind": "environment file", "path": name})
            if filename in {"dev.db", "demo-seed.db", "deployment-demo.db"}:
                violations.append({"kind": "SQLite snapshot", "path": name})
            linux_engine |= "libquery_engine-rhel-openssl-3.0.x.so.node" in name
            data = bundle.read(member)
            for label, secret in forbidden.items():
                if secret in data:
                    violations.append({"kind": label, "path": name})

browser_secrets = {
    key: value.encode() for key, value in preview.items()
    if key in {"SESSION_SECRET", "SMTP_PASS", "AWS_SECRET_ACCESS_KEY", "S3_SECRET_ACCESS_KEY", "DATABASE_URL", "DIRECT_URL"} and value
}
for file in (root / ".netlify/static").rglob("*"):
    if file.is_file():
        data = file.read_bytes()
        for label, secret in browser_secrets.items():
            if secret in data:
                violations.append({"kind": "browser credential: " + label, "path": str(file.relative_to(root))})
if not linux_engine:
    violations.append({"kind": "Linux Prisma engine missing"})
print(json.dumps({"functionArchives": len(archives), "entriesChecked": entries, "linuxEnginePresent": linux_engine, "violations": violations}))
if violations:
    raise SystemExit(1)
