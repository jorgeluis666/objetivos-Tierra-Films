#!/usr/bin/env python3
"""Importa el "Informe de campaña" de Google Ads segmentado por semana o por dia.

Los export traen un titulo, una linea con el rango de fechas y luego la tabla:

    Semana,Estado de la campaña,Campaña,Presupuesto,...,Coste,Impr.,CTR,CPC medio,Clics,Conversiones,...
    Día,Estado de la campaña,Campaña,...

Solo se leen las filas por campaña (las que tienen fecha y nombre de campaña);
las filas "Total: ..." se ignoran salvo "Total: Cuenta" sin fecha, que se guarda
como referencia. Los numeros vienen en formato es-PE: coma decimal y punto de
miles ("1.247", "8651,95", "10,34%").

Se pueden pasar los dos archivos a la vez. Con el export diario el dashboard
dibuja la curva dia a dia; sin el, estima cada dia repartiendo la semana.

Uso:
    python scripts/import-google-ads-weekly.py "Informe semanal.csv" "Informe diario.csv"
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import shutil
import sys
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data" / "tierra-films-lima-retail-2026.json"
BACKUPS = ROOT / "data" / "csv-backups"

MONTHS_ES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
             "agosto", "setiembre", "octubre", "noviembre", "diciembre"]
MONTH_LABELS = [m.capitalize() for m in MONTHS_ES]
METRICS = ("cost", "impressions", "clicks", "conversions")
DATE_COLUMNS = {"Semana": "week", "Día": "day", "Dia": "day", "Day": "day", "Week": "week"}


def parse_number(value: str | None) -> float | None:
    text = str(value or "").strip().replace("%", "").replace(" ", "")
    if not text or text == "--":
        return None
    # "1.247" es mil doscientos cuarenta y siete; "8651,95" usa coma decimal.
    text = text.replace(".", "").replace(",", ".")
    try:
        return float(text)
    except ValueError:
        return None


def parse_range(line: str) -> tuple[date, date] | None:
    """'1 de julio de 2026 - 20 de septiembre de 2026' -> (date, date)."""
    names = {name: index + 1 for index, name in enumerate(MONTHS_ES)}
    names["septiembre"] = 9
    found = re.findall(r"(\d{1,2}) de (\w+) de (\d{4})", line.lower())
    if len(found) != 2:
        return None
    try:
        return tuple(date(int(y), names[m], int(d)) for d, m, y in found)  # type: ignore[return-value]
    except KeyError:
        return None


def read_table(path: Path) -> tuple[str, list[str], list[dict[str, str]], str]:
    """Devuelve (tipo, preambulo, filas, nombre de la columna de fecha)."""
    raw = path.read_bytes()
    text = ""
    for encoding in ("utf-8-sig", "utf-16", "latin-1"):
        try:
            text = raw.decode(encoding)
            break
        except UnicodeDecodeError:
            continue
    lines = text.splitlines()
    for index, line in enumerate(lines):
        column = line.split(",")[0].strip().strip('"')
        if column in DATE_COLUMNS and "," in line:
            rows = list(csv.DictReader(lines[index:]))
            return DATE_COLUMNS[column], lines[:index], rows, column
    raise SystemExit(f"[tf-import] {path.name}: no se encontro una cabecera 'Semana,...' o 'Día,...'.")


def round2(value: float | None) -> float | None:
    return None if value is None else round(value, 2)


def derived(item: dict) -> dict:
    cost, impressions, clicks, conversions = (item.get(k) or 0 for k in METRICS)
    item["ctr"] = round(clicks / impressions, 6) if impressions else None
    item["cpc"] = round2(cost / clicks) if clicks else None
    item["costPerConversion"] = round2(cost / conversions) if conversions else None
    return item


def month_id(day: date) -> str:
    return f"{day.year}-{day.month:02d}"


def month_label(mid: str) -> str:
    year, month = mid.split("-")
    return f"{MONTH_LABELS[int(month) - 1]} {year}"


def parse_source(path: Path) -> dict:
    """Lee un export y devuelve sus filas por fecha y campaña."""
    kind, preamble, rows, date_column = read_table(path)
    period = next((parse_range(line) for line in preamble if parse_range(line)), None)
    entries: dict[date, dict[str, dict]] = {}
    campaigns: dict[str, dict] = {}
    account_total = None
    for row in rows:
        stamp = (row.get(date_column) or "").strip()
        campaign = (row.get("Campaña") or "").strip()
        status = (row.get("Estado de la campaña") or "").strip()
        if status == "Total: Cuenta" and not stamp:
            account_total = derived({k: parse_number(row.get(col)) for k, col in
                                     zip(METRICS, ("Coste", "Impr.", "Clics", "Conversiones"))})
            continue
        if not re.match(r"^\d{4}-\d{2}-\d{2}$", stamp) or not campaign or campaign == "--":
            continue
        campaigns.setdefault(campaign, {
            "name": campaign,
            "status": status,
            "type": "Búsqueda" if (row.get("Tipo de campaña") or "").strip() == "Buscar" else (row.get("Tipo de campaña") or "").strip(),
            "dailyBudget": parse_number(row.get("Presupuesto")),
            "budgetType": (row.get("Tipo de presupuesto") or "").strip(),
            "currency": (row.get("Código de moneda") or "PEN").strip(),
            "optimizationScore": (parse_number(row.get("Nivel de optimización")) or 0) / 100 or None,
        })
        entries.setdefault(date.fromisoformat(stamp), {})[campaign] = {
            "cost": parse_number(row.get("Coste")) or 0.0,
            "impressions": parse_number(row.get("Impr.")) or 0.0,
            "clicks": parse_number(row.get("Clics")) or 0.0,
            "conversions": parse_number(row.get("Conversiones")) or 0.0,
        }
    if not entries:
        raise SystemExit(f"[tf-import] {path.name}: no tiene filas por campaña con fecha.")
    return {"kind": kind, "file": path.name, "period": period, "entries": entries,
            "campaigns": campaigns, "accountTotal": account_total}


def totals_of(by_campaign: dict[str, dict]) -> dict:
    return {k: round(sum(values[k] for values in by_campaign.values()), 2) for k in METRICS}


def build(paths: list[Path]) -> dict:
    sources = [parse_source(path) for path in paths]
    weekly = next((s for s in sources if s["kind"] == "week"), None)
    daily = next((s for s in sources if s["kind"] == "day"), None)
    if not weekly and not daily:
        raise SystemExit("[tf-import] hace falta al menos un export con fechas.")

    campaigns: dict[str, dict] = {}
    for source in sources:
        for name, meta in source["campaigns"].items():
            campaigns.setdefault(name, meta)

    # Rango del informe: el del preambulo o el que cubran las fechas leidas.
    stamps = [stamp for source in sources for stamp in source["entries"]]
    base = weekly or daily
    if base["period"]:
        period_start, period_end = base["period"]
    else:
        period_start = min(stamps)
        period_end = max(stamps) + (timedelta(days=6) if base["kind"] == "week" else timedelta())

    # Semanas: del export semanal, o agrupando el diario de lunes a domingo.
    week_entries: dict[date, dict[str, dict]] = {}
    if weekly:
        week_entries = weekly["entries"]
    else:
        for stamp, by_campaign in daily["entries"].items():
            monday = stamp - timedelta(days=stamp.weekday())
            target = week_entries.setdefault(monday, {})
            for name, values in by_campaign.items():
                acc = target.setdefault(name, {k: 0.0 for k in METRICS})
                for k in METRICS:
                    acc[k] += values[k]

    week_list = []
    for start in sorted(week_entries):
        end = start + timedelta(days=6)
        # Dias de la semana dentro del rango del informe: la primera semana
        # (29 jun) solo trae datos desde el 1 de julio.
        days = [start + timedelta(days=i) for i in range(7)
                if period_start <= start + timedelta(days=i) <= period_end]
        by_month: dict[str, int] = {}
        for day in days:
            by_month[month_id(day)] = by_month.get(month_id(day), 0) + 1
        week_list.append(derived({
            "start": start.isoformat(),
            "end": end.isoformat(),
            "dataStart": days[0].isoformat(),
            "dataEnd": days[-1].isoformat(),
            "days": len(days),
            "daysByMonth": by_month,
            **totals_of(week_entries[start]),
            "campaigns": [derived({"campaign": name, **values}) for name, values in week_entries[start].items()],
        }))

    day_list = []
    if daily:
        for stamp in sorted(daily["entries"]):
            day_list.append(derived({
                "date": stamp.isoformat(),
                **totals_of(daily["entries"][stamp]),
                "campaigns": [derived({"campaign": name, **values}) for name, values in daily["entries"][stamp].items()],
            }))

    # Totales mensuales: exactos con data diaria; con solo semanas, las que
    # cruzan de mes se reparten por dias.
    months: dict[str, dict] = {}

    def month_bucket(mid: str) -> dict:
        return months.setdefault(mid, {"id": mid, "label": month_label(mid), "weeks": [], "days": 0,
                                       **{k: 0.0 for k in METRICS}, "campaigns": {}})

    if day_list:
        for day in day_list:
            bucket = month_bucket(day["date"][:7])
            bucket["days"] += 1
            for k in METRICS:
                bucket[k] += day[k]
            for camp in day["campaigns"]:
                target = bucket["campaigns"].setdefault(camp["campaign"], {k: 0.0 for k in METRICS})
                for k in METRICS:
                    target[k] += camp[k]
        for week in week_list:
            for mid in week["daysByMonth"]:
                month_bucket(mid)["weeks"].append(week["start"])
    else:
        for week in week_list:
            for mid, count in week["daysByMonth"].items():
                share = count / week["days"]
                bucket = month_bucket(mid)
                bucket["weeks"].append(week["start"])
                bucket["days"] += count
                for k in METRICS:
                    bucket[k] += week[k] * share
                for camp in week["campaigns"]:
                    target = bucket["campaigns"].setdefault(camp["campaign"], {k: 0.0 for k in METRICS})
                    for k in METRICS:
                        target[k] += camp[k] * share

    month_list = []
    for mid in sorted(months):
        month = months[mid]
        year, mon = map(int, mid.split("-"))
        next_month = date(year + (mon == 12), mon % 12 + 1, 1)
        month_list.append(derived({
            "id": mid,
            "label": month["label"],
            "sourceFile": base["file"],
            "daysWithData": month["days"],
            "daysInMonth": (next_month - date(year, mon, 1)).days,
            "weeks": month["weeks"],
            **{k: round(month[k], 2) for k in METRICS},
            "records": [derived({"campaign": name, **{k: round(v, 2) for k, v in values.items()}})
                        for name, values in month["campaigns"].items()],
        }))

    totals = {k: round(sum(w[k] for w in week_list), 2) for k in METRICS}
    return {
        "brand": "Tierra Films",
        "dashboard": "Gasto Publicitario",
        "moduleSubtitle": "Google Ads | Búsqueda",
        "schemaVersion": 4,
        "status": "ok",
        "granularity": "day" if day_list else "week",
        "currency": "PEN",
        "sourceFile": base["file"],
        "sourceFiles": [source["file"] for source in sources],
        "period": {"start": period_start.isoformat(), "end": period_end.isoformat()},
        "defaultMonth": month_list[-1]["id"],
        "campaigns": list(campaigns.values()),
        "totals": derived(dict(totals)),
        "accountTotal": base["accountTotal"],
        # Compatibilidad con la calculadora heredada: totales por campaña del periodo.
        "records": [derived({"campaign": name, **{k: round(sum(
            c[k] for w in week_list for c in w["campaigns"] if c["campaign"] == name), 2) for k in METRICS}})
            for name in campaigns],
        "weeks": week_list,
        "days": day_list,
        "months": month_list,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Importa los informes de campañas de Google Ads (semanal y/o diario).")
    parser.add_argument("csv", type=Path, nargs="+", help="Export semanal, diario o ambos")
    parser.add_argument("--output", type=Path, default=OUTPUT)
    parser.add_argument("--no-backup", action="store_true", help="No copiar los CSV a data/csv-backups")
    args = parser.parse_args()

    data = build(args.csv)
    args.output.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if not args.no_backup:
        BACKUPS.mkdir(parents=True, exist_ok=True)
        for source in args.csv:
            target = BACKUPS / source.name
            if source.resolve() != target.resolve():
                shutil.copyfile(source, target)
    t = data["totals"]
    detail = f"{len(data['days'])} dias" if data["days"] else "sin detalle diario"
    print(f"[tf-import] {len(data['weeks'])} semanas, {detail} ({data['period']['start']} a {data['period']['end']}): "
          f"S/ {t['cost']:.2f} | {t['clicks']:.0f} clics | {t['conversions']:.0f} conv. -> {args.output}")
    for m in data["months"]:
        print(f"   {m['label']}: {m['daysWithData']}/{m['daysInMonth']} dias | S/ {m['cost']:.2f} | {m['conversions']:.1f} conv.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
