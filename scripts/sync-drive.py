#!/usr/bin/env python3
"""Renueva data/drive-snapshot.json con un barrido en el momento de las carpetas de Drive.

Lo corre .github/workflows/sync-drive.yml a las 06:30, 13:30 y 18:30 de Lima, despues de
que Nexus escribe los informes (06:00, 13:00 y 18:00). Pide ?fresh=1 al Web App de
apps-script/drive-sync.gs -la misma URL que usa el boton Actualizar del tablero- y guarda
la respuesta como la copia del repo, con la forma que ya escribe scripts/drive-snapshot.py:
el tablero (js/drive-sync.js) y el correo semanal la leen con el mismo merge().

Asi el tablero muestra los numeros del dia desde que abre, sin esperar a Drive, y los
muestra igual si el Web App no responde. La copia se publica dentro del HTML cifrado
(scripts/build.js), asi que cada cambio necesita volver a publicar el tablero.

Solo escribe si las hojas cambiaron: generatedAt cambia en cada barrido y, sin esa
comparacion, cada corrida dejaria un commit identico al anterior. Deja changed=true|false
como salida del paso en GITHUB_OUTPUT.

Uso:

    python scripts/sync-drive.py            # la URL sale de js/drive-sync.js
    python scripts/sync-drive.py --check    # solo informa si hay cambios
"""

from __future__ import annotations

import argparse
import json
import os
import re
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data" / "drive-snapshot.json"
CLIENT = ROOT / "js" / "drive-sync.js"
# Un barrido lee las cuatro carpetas y exporta cada pestana: tarda bastante mas que el
# navegador, que se rinde a los 25 s y se queda con la copia.
TIMEOUT_SECONDS = 180
INTENTOS = 3


def script_url() -> str:
    """La URL /exec del Web App: del entorno, o la misma que usa el tablero."""
    env = (os.environ.get("TF_DRIVE_SCRIPT_URL") or "").strip()
    if env:
        return env
    match = re.search(r"DRIVE_SYNC_URL\s*=\s*'([^']+)'", CLIENT.read_text(encoding="utf-8"))
    if not match or not match.group(1).strip():
        raise SystemExit(
            "[sync-drive] no hay URL del Web App: pon TF_DRIVE_SCRIPT_URL o DRIVE_SYNC_URL en js/drive-sync.js"
        )
    return match.group(1).strip()


def sweep(url: str) -> dict:
    """Barrido en el momento. Reintenta: el Web App a veces responde 429 o 500 suelto."""
    separator = "&" if "?" in url else "?"
    error: Exception | None = None
    for intento in range(1, INTENTOS + 1):
        target = f"{url}{separator}fresh=1&t={int(time.time() * 1000)}"
        try:
            request = urllib.request.Request(target, headers={"Accept": "application/json"})
            with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except (urllib.error.URLError, TimeoutError, ValueError) as exception:
            error = exception
            print(f"[sync-drive] intento {intento} de {INTENTOS} fallido: {exception}")
            if intento < INTENTOS:
                time.sleep(5 * intento)
            continue
        if payload.get("ok") is False and payload.get("error"):
            raise SystemExit(f"[sync-drive] el Web App respondio: {payload['error']}")
        if not payload.get("ok") or not isinstance(payload.get("sheets"), list):
            raise SystemExit("[sync-drive] la respuesta del Web App no tiene el formato esperado")
        if not payload["sheets"]:
            raise SystemExit("[sync-drive] el barrido no trajo ninguna hoja; la copia queda como estaba")
        return payload
    raise SystemExit(f"[sync-drive] no se pudo leer el Web App: {error}")


def current_sheets() -> list:
    if not OUTPUT.exists():
        return []
    try:
        return json.loads(OUTPUT.read_text(encoding="utf-8")).get("sheets") or []
    except ValueError:
        # Una copia ilegible se reemplaza; el tablero tampoco podria usarla.
        return []


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="informa si hay cambios y no escribe nada")
    args = parser.parse_args()

    payload = sweep(script_url())
    sheets = payload["sheets"]
    previous = current_sheets()
    changed = sheets != previous

    # El barrido es lo que devolvio Drive; origin y schedule se quedan afuera para que el
    # tablero la trate como la copia del repo ("copia 28 oct") y no como una lectura en vivo.
    body = {
        "ok": True,
        "snapshot": True,
        "folders": payload.get("folders") or {},
        "generatedAt": payload.get("generatedAt") or datetime.now(timezone.utc).isoformat(),
        "sheets": sheets,
    }

    archivos = len({(sheet.get("folder"), sheet.get("file")) for sheet in sheets})
    print(f"[sync-drive] {archivos} archivos y {len(sheets)} pestanas de {len(body['folders'])} carpetas")
    if previous and len(sheets) < len(previous):
        # No es un error: una hoja borrada en Drive baja la cuenta. Pero conviene mirarlo,
        # porque el tablero se queda sin ese informe encima de la data del repo.
        print(f"::warning::El barrido trajo {len(sheets)} pestanas y la copia tenia {len(previous)}")

    if not changed:
        print("[sync-drive] las carpetas no trajeron datos nuevos; la copia sigue igual")
    elif args.check:
        print("[sync-drive] hay datos nuevos (--check: no se escribio nada)")
    else:
        OUTPUT.write_text(json.dumps(body, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"[sync-drive] copia renovada -> {OUTPUT.relative_to(ROOT)} ({payload.get('generatedAt')})")

    report_to_actions(changed)
    return 0


def report_to_actions(changed):
    """En GitHub Actions deja changed como salida del paso."""
    output = os.environ.get("GITHUB_OUTPUT")
    if not output:
        return
    with open(output, "a", encoding="utf-8") as handle:
        handle.write("changed=" + ("true" if changed else "false") + chr(10))


if __name__ == "__main__":
    raise SystemExit(main())
