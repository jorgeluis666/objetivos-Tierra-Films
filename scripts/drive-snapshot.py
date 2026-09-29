#!/usr/bin/env python3
"""Arma data/drive-snapshot.json: la copia local de lo que devuelve el Apps Script.

El tablero la usa mientras no haya conexion con Drive (o si Drive no responde) y
la lee con el mismo codigo que la respuesta en vivo (js/drive-sync.js). Cada
archivo se indica con la carpeta a la que pertenece:

    python scripts/drive-snapshot.py campanas="Accion de conversion setiembre 2026.csv" \
        segmentacion="Terminos de busqueda 22-28 set 2026.csv" segmentacion="Ubicaciones setiembre 2026.csv" \
        keywords="Palabras clave conversiones setiembre 2026.csv"

Los CSV se copian tambien a data/csv-backups/.
"""

from __future__ import annotations

import csv
import json
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data" / "drive-snapshot.json"
BACKUPS = ROOT / "data" / "csv-backups"
FOLDERS = ("campanas", "segmentacion", "keywords")


def read_rows(path: Path) -> list[list[str]]:
    raw = path.read_bytes()
    for encoding in ("utf-8-sig", "utf-16", "latin-1"):
        try:
            text = raw.decode(encoding)
            break
        except UnicodeDecodeError:
            continue
    lines = text.splitlines()
    delimiter = "\t" if any("\t" in line for line in lines[:5]) else ","
    return [row for row in csv.reader(lines, delimiter=delimiter)]


def main() -> int:
    sheets = []
    for arg in sys.argv[1:]:
        folder, _, name = arg.partition("=")
        if folder not in FOLDERS or not name:
            raise SystemExit(f"[drive-snapshot] usa carpeta=archivo.csv con carpeta en {FOLDERS}: {arg}")
        path = Path(name)
        if not path.exists():
            path = BACKUPS / name
        modified = datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).isoformat()
        sheets.append({"folder": folder, "file": path.stem, "sheet": path.stem, "modified": modified, "rows": read_rows(path)})
        target = BACKUPS / path.name
        if path.resolve() != target.resolve():
            shutil.copyfile(path, target)
    if not sheets:
        raise SystemExit(__doc__)
    body = {"ok": True, "snapshot": True, "folders": {}, "generatedAt": datetime.now(timezone.utc).isoformat(), "sheets": sheets}
    OUTPUT.write_text(json.dumps(body, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"[drive-snapshot] {len(sheets)} archivos -> {OUTPUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
