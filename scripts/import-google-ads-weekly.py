#!/usr/bin/env python3
"""Importa el "Informe de campaña" de Google Ads segmentado por semana.

El export trae un titulo, una linea con el rango de fechas y luego la tabla:

    Semana,Estado de la campaña,Campaña,Presupuesto,...,Coste,Impr.,CTR,CPC medio,Clics,Conversiones,Coste/conv.,...

Solo se leen las filas por campaña (las que tienen fecha en "Semana" y nombre en
"Campaña"); las filas "Total: ..." se ignoran salvo "Total: Cuenta" sin semana,
que se guarda como referencia. Los numeros vienen en formato es-PE: coma
decimal y punto de miles ("1.247", "8651,95", "10,34%").

Uso:
    python scripts/import-google-ads-weekly.py "Informe de campaña.csv"
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


def read_rows(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    raw = path.read_bytes()
    for encoding in ("utf-8-sig", "utf-16", "latin-1"):
        try:
            text = raw.decode(encoding)
            break
        except UnicodeDecodeError:
            continue
    lines = text.splitlines()
    header_index = next((i for i, line in enumerate(lines) if line.startswith("Semana,")), None)
    if header_index is None:
        raise SystemExit("[tf-import] no se encontro la cabecera 'Semana,...'. ¿Es el informe semanal de campañas?")
    rows = list(csv.DictReader(lines[header_index:]))
    return lines[:header_index], rows


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


def build(path: Path) -> dict:
    preamble, rows = read_rows(path)
    period = next((parse_range(line) for line in preamble if parse_range(line)), None)

    weeks: dict[str, dict] = {}
    campaigns: dict[str, dict] = {}
    account_total = None
    for row in rows:
        week = (row.get("Semana") or "").strip()
        campaign = (row.get("Campaña") or "").strip()
        status = (row.get("Estado de la campaña") or "").strip()
        if status == "Total: Cuenta" and not week:
            account_total = derived({k: parse_number(row.get(col)) for k, col in
                                     zip(METRICS, ("Coste", "Impr.", "Clics", "Conversiones"))})
            continue
        if not re.match(r"^\d{4}-\d{2}-\d{2}$", week) or not campaign or campaign == "--":
            continue
        start = date.fromisoformat(week)
        values = {
            "cost": parse_number(row.get("Coste")) or 0.0,
            "impressions": parse_number(row.get("Impr.")) or 0.0,
            "clicks": parse_number(row.get("Clics")) or 0.0,
            "conversions": parse_number(row.get("Conversiones")) or 0.0,
        }
        campaigns.setdefault(campaign, {
            "name": campaign,
            "status": status,
            "type": "Búsqueda" if (row.get("Tipo de campaña") or "").strip() == "Buscar" else (row.get("Tipo de campaña") or "").strip(),
            "dailyBudget": parse_number(row.get("Presupuesto")),
            "budgetType": (row.get("Tipo de presupuesto") or "").strip(),
            "currency": (row.get("Código de moneda") or "PEN").strip(),
            "optimizationScore": (parse_number(row.get("Nivel de optimización")) or 0) / 100 or None,
        })
        entry = weeks.setdefault(week, {"campaigns": {}})
        entry["campaigns"][campaign] = values
        entry["start"] = start

    if not weeks:
        raise SystemExit("[tf-import] el archivo no tiene filas semanales por campaña.")

    first_week = min(w["start"] for w in weeks.values())
    last_week = max(w["start"] for w in weeks.values())
    period_start, period_end = period if period else (first_week, last_week + timedelta(days=6))

    week_list = []
    for key in sorted(weeks):
        start = weeks[key]["start"]
        end = start + timedelta(days=6)
        # Dias de la semana que caen dentro del rango del informe: la primera
        # semana (29 jun) solo trae datos desde el 1 de julio.
        days = [start + timedelta(days=i) for i in range(7)
                if period_start <= start + timedelta(days=i) <= period_end]
        by_month: dict[str, int] = {}
        for day in days:
            by_month[month_id(day)] = by_month.get(month_id(day), 0) + 1
        totals = {k: round(sum(c[k] for c in weeks[key]["campaigns"].values()), 2) for k in METRICS}
        week_list.append(derived({
            "start": start.isoformat(),
            "end": end.isoformat(),
            "dataStart": days[0].isoformat(),
            "dataEnd": days[-1].isoformat(),
            "days": len(days),
            "daysByMonth": by_month,
            **totals,
            "campaigns": [derived({"campaign": name, **vals}) for name, vals in weeks[key]["campaigns"].items()],
        }))

    # Totales mensuales: las semanas que cruzan de mes se reparten por dias.
    months: dict[str, dict] = {}
    for week in week_list:
        for mid, count in week["daysByMonth"].items():
            share = count / week["days"]
            month = months.setdefault(mid, {"id": mid, "label": month_label(mid), "weeks": [], "days": 0,
                                           **{k: 0.0 for k in METRICS}, "campaigns": {}})
            month["weeks"].append(week["start"])
            month["days"] += count
            for k in METRICS:
                month[k] += week[k] * share
            for camp in week["campaigns"]:
                target = month["campaigns"].setdefault(camp["campaign"], {k: 0.0 for k in METRICS})
                for k in METRICS:
                    target[k] += camp[k] * share

    month_list = []
    for mid in sorted(months):
        month = months[mid]
        year, mon = map(int, mid.split("-"))
        next_month = date(year + (mon == 12), mon % 12 + 1, 1)
        days_in_month = (next_month - date(year, mon, 1)).days
        records = [derived({"campaign": name, **{k: round(v, 2) for k, v in vals.items()}})
                   for name, vals in month["campaigns"].items()]
        month_list.append(derived({
            "id": mid,
            "label": month["label"],
            "sourceFile": path.name,
            "daysWithData": month["days"],
            "daysInMonth": days_in_month,
            "weeks": month["weeks"],
            **{k: round(month[k], 2) for k in METRICS},
            "records": records,
        }))

    totals = {k: round(sum(w[k] for w in week_list), 2) for k in METRICS}
    return {
        "brand": "Tierra Films",
        "dashboard": "Gasto Publicitario",
        "moduleSubtitle": "Google Ads | Búsqueda",
        "schemaVersion": 3,
        "status": "ok",
        "granularity": "week",
        "currency": "PEN",
        "sourceFile": path.name,
        "period": {"start": period_start.isoformat(), "end": period_end.isoformat()},
        "defaultMonth": month_list[-1]["id"],
        "campaigns": list(campaigns.values()),
        "totals": derived(dict(totals)),
        "accountTotal": account_total,
        # Compatibilidad con la calculadora heredada: totales por campaña del periodo.
        "records": [derived({"campaign": name, **{k: round(sum(
            c[k] for w in week_list for c in w["campaigns"] if c["campaign"] == name), 2) for k in METRICS}})
            for name in campaigns],
        "weeks": week_list,
        "months": month_list,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Importa el informe semanal de campañas de Google Ads.")
    parser.add_argument("csv", type=Path)
    parser.add_argument("--output", type=Path, default=OUTPUT)
    parser.add_argument("--no-backup", action="store_true", help="No copiar el CSV a data/csv-backups")
    args = parser.parse_args()

    data = build(args.csv)
    args.output.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if not args.no_backup:
        BACKUPS.mkdir(parents=True, exist_ok=True)
        target = BACKUPS / args.csv.name
        if args.csv.resolve() != target.resolve():
            shutil.copyfile(args.csv, target)
    t = data["totals"]
    print(f"[tf-import] {len(data['weeks'])} semanas ({data['period']['start']} a {data['period']['end']}): "
          f"S/ {t['cost']:.2f} | {t['clicks']:.0f} clics | {t['conversions']:.0f} conv. -> {args.output}")
    for m in data["months"]:
        print(f"   {m['label']}: {m['daysWithData']}/{m['daysInMonth']} dias | S/ {m['cost']:.2f} | {m['conversions']:.1f} conv.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
