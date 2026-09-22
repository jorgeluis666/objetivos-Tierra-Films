#!/usr/bin/env python3
"""Importa el "Informe de campaña" de Google Ads: mensual, semanal o diario.

Los export traen un titulo, una linea con el rango de fechas y luego la tabla:

    Semana,Estado de la campaña,Campaña,Presupuesto,...,Coste,Impr.,CTR,CPC medio,Clics,Conversiones,...
    Día,Estado de la campaña,Campaña,...

Solo se leen las filas por campaña (las que tienen fecha y nombre de campaña);
las filas "Total: ..." se ignoran salvo "Total: Cuenta" sin fecha, que se guarda
como referencia. Los numeros vienen en formato es-PE: coma decimal y punto de
miles ("1.247", "8651,95", "10,34%").

Se pueden pasar varios archivos a la vez:

- Sin segmento (un informe por mes): manda como total del mes.
- Segmentado por Semana: llena la tabla y los graficos semanales.
- Segmentado por Dia: dibuja la curva real dia a dia.
- Grafico de serie temporal ("Fecha,Coste"): curva diaria de las columnas que
  traiga, con fechas en español ("sáb, 1 ago 2026") e importes con moneda.

Los meses sin informe propio se calculan repartiendo por dias las semanas que
los cruzan, y quedan marcados como estimados.

Uso:
    python scripts/import-google-ads-weekly.py "Junio.csv" "Julio.csv" "Semanal.csv"
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
MONTH_ABBR = {"ene": 1, "feb": 2, "mar": 3, "abr": 4, "may": 5, "jun": 6, "jul": 7,
              "ago": 8, "sep": 9, "set": 9, "oct": 10, "nov": 11, "dic": 12}
# Nombres de columna de la serie temporal -> metrica del dashboard.
SERIES_COLUMNS = {
    "cost": ("coste", "costo", "inversion", "inversión", "importe gastado", "gasto"),
    "impressions": ("impr.", "impresiones", "impresion", "impresión"),
    "clicks": ("clics", "clics.", "clicks"),
    "conversions": ("conversiones", "conv.", "conversion", "conversión", "resultados"),
}


def parse_es_date(value: str) -> date | None:
    """'sáb, 1 ago 2026' o '2026-08-01' -> date."""
    text = str(value or "").strip().strip('"')
    if re.match(r"^\d{4}-\d{2}-\d{2}$", text):
        return date.fromisoformat(text)
    match = re.search(r"(\d{1,2})\s+([a-záéíóúñ]+)\.?\s+(\d{4})", text.lower())
    if not match:
        return None
    month = MONTH_ABBR.get(match.group(2)[:3])
    return date(int(match.group(3)), month, int(match.group(1))) if month else None


def parse_number(value: str | None) -> float | None:
    text = re.sub(r"[A-Za-z$€]+", "", str(value or "")).strip().replace("%", "").replace(" ", "")
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
    for index, line in enumerate(lines):
        if line.startswith("Estado de la campaña,"):
            return "period", lines[:index], list(csv.DictReader(lines[index:])), ""
    for index, line in enumerate(lines):
        first = line.split(",")[0].strip().strip('"').lower()
        if first in ("fecha", "día", "dia", "date") and "," in line:
            return "series", lines[:index], list(csv.DictReader(lines[index:])), line.split(",")[0].strip().strip('"')
    raise SystemExit(f"[tf-import] {path.name}: no se reconocio la cabecera del informe.")


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


def parse_series(path: Path, rows: list[dict[str, str]], date_column: str) -> dict:
    """Serie temporal: una fila por fecha con las columnas que traiga el export."""
    columns: dict[str, str] = {}
    for header in (rows[0].keys() if rows else []):
        name = str(header or "").strip().strip('"').lower()
        for metric, aliases in SERIES_COLUMNS.items():
            if name in aliases and metric not in columns:
                columns[metric] = header
    series: dict[date, dict[str, float]] = {}
    for row in rows:
        stamp = parse_es_date(row.get(date_column))
        if not stamp:
            continue
        values = {metric: parse_number(row.get(column)) for metric, column in columns.items()}
        values = {k: v for k, v in values.items() if v is not None}
        if values:
            series[stamp] = values
    if not series:
        raise SystemExit(f"[tf-import] {path.name}: la serie temporal no tiene fechas legibles.")
    return {"kind": "series", "file": path.name, "period": (min(series), max(series)),
            "entries": {}, "series": series, "metrics": sorted(columns),
            "campaigns": {}, "accountTotal": None}


def parse_source(path: Path) -> dict:
    """Lee un export y devuelve sus filas por fecha y campaña."""
    kind, preamble, rows, date_column = read_table(path)
    if kind == "series":
        return parse_series(path, rows, date_column)
    period = next((parse_range(line) for line in preamble if parse_range(line)), None)
    entries: dict[date, dict[str, dict]] = {}
    campaigns: dict[str, dict] = {}
    account_total = None
    for row in rows:
        stamp = (row.get(date_column) or "").strip() if date_column else ""
        campaign = (row.get("Campaña") or "").strip()
        status = (row.get("Estado de la campaña") or "").strip()
        if status == "Total: Cuenta" and not stamp:
            account_total = derived({k: parse_number(row.get(col)) for k, col in
                                     zip(METRICS, ("Coste", "Impr.", "Clics", "Conversiones"))})
            continue
        if not campaign or campaign == "--":
            continue
        if kind == "period":
            if not period:
                raise SystemExit(f"[tf-import] {path.name}: el informe no trae el rango de fechas en la cabecera.")
            stamp = period[0].isoformat()
        elif not re.match(r"^\d{4}-\d{2}-\d{2}$", stamp):
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
        raise SystemExit(f"[tf-import] {path.name}: no tiene filas por campaña.")
    return {"kind": kind, "file": path.name, "period": period, "entries": entries,
            "campaigns": campaigns, "accountTotal": account_total}


def totals_of(by_campaign: dict[str, dict]) -> dict:
    return {k: round(sum(values[k] for values in by_campaign.values()), 2) for k in METRICS}


def build(paths: list[Path]) -> dict:
    sources = [parse_source(path) for path in paths]
    weekly = next((s for s in sources if s["kind"] == "week"), None)
    daily = next((s for s in sources if s["kind"] == "day"), None)
    periods = [s for s in sources if s["kind"] == "period"]
    series_sources = [s for s in sources if s["kind"] == "series"]
    if not weekly and not daily and not periods and not series_sources:
        raise SystemExit("[tf-import] hace falta al menos un informe.")

    campaigns: dict[str, dict] = {}
    for source in sources:
        for name, meta in source["campaigns"].items():
            campaigns.setdefault(name, meta)

    # Rango del informe: el del preambulo o el que cubran las fechas leidas.
    stamps = [stamp for source in sources for stamp in source["entries"]]
    base = weekly or daily or periods[0]
    ranges = [source["period"] for source in sources if source["period"]]
    if ranges:
        period_start = min(r[0] for r in ranges)
        period_end = max(r[1] for r in ranges)
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

    # Las semanas se recortan con el rango de SU informe, no con el del periodo
    # completo: la primera semana (29 jun) solo trae datos desde el 1 de julio
    # aunque otro informe agregue junio al dashboard.
    week_source = weekly or daily
    if week_source["period"]:
        week_start_limit, week_end_limit = week_source["period"]
    else:
        week_start_limit, week_end_limit = period_start, period_end

    week_list = []
    for start in sorted(week_entries):
        end = start + timedelta(days=6)
        days = [start + timedelta(days=i) for i in range(7)
                if week_start_limit <= start + timedelta(days=i) <= week_end_limit]
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

    series_days: dict[date, dict[str, float]] = {}
    series_metrics: set[str] = set()
    series_files: list[str] = []
    for source in series_sources:
        series_files.append(source["file"])
        series_metrics.update(source["metrics"])
        for stamp, values in source["series"].items():
            series_days.setdefault(stamp, {}).update(values)

    day_list = []
    if daily:
        for stamp in sorted(daily["entries"]):
            day_list.append(derived({
                "date": stamp.isoformat(),
                **totals_of(daily["entries"][stamp]),
                "campaigns": [derived({"campaign": name, **values}) for name, values in daily["entries"][stamp].items()],
            }))

    if not day_list and series_days:
        day_list = [derived({"date": stamp.isoformat(), **series_days[stamp]})
                    for stamp in sorted(series_days)]

    # Meses cubiertos de punta a punta por la serie: su total es exacto para las
    # metricas que trae el archivo (aqui, el coste).
    series_months: dict[str, dict] = {}
    for stamp, values in series_days.items():
        bucket = series_months.setdefault(month_id(stamp), {"days": 0, **{k: 0.0 for k in series_metrics}})
        bucket["days"] += 1
        for k in series_metrics:
            bucket[k] += values.get(k, 0.0)

    # Totales mensuales: exactos con data diaria; con solo semanas, las que
    # cruzan de mes se reparten por dias.
    months: dict[str, dict] = {}

    def month_bucket(mid: str) -> dict:
        return months.setdefault(mid, {"id": mid, "label": month_label(mid), "weeks": [], "days": 0,
                                       **{k: 0.0 for k in METRICS}, "campaigns": {}})

    if daily and day_list:
        for day in day_list:
            bucket = month_bucket(day["date"][:7])
            bucket["days"] += 1
            for k in METRICS:
                bucket[k] += day.get(k, 0.0)
            for camp in day.get("campaigns", []):
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

    # Informes sin segmento: cada uno manda como total real de su mes.
    exports: dict[str, dict] = {}
    for source in periods:
        start, end = source["period"]
        if month_id(start) != month_id(end):
            print(f"[tf-import] aviso: {source['file']} cruza de mes ({start} a {end}); se ignora.")
            continue
        by_campaign = next(iter(source["entries"].values()))
        exports[month_id(start)] = {
            "file": source["file"],
            "start": start,
            "end": end,
            "days": (end - start).days + 1,
            "campaigns": by_campaign,
            **totals_of(by_campaign),
        }
        month_bucket(month_id(start))

    month_list = []
    for mid in sorted(months):
        month = months[mid]
        export = exports.get(mid)
        year, mon = map(int, mid.split("-"))
        next_month = date(year + (mon == 12), mon % 12 + 1, 1)
        source_values = dict(export) if export else dict(month)
        source_campaigns = export["campaigns"] if export else month["campaigns"]
        days_in_month = (next_month - date(year, mon, 1)).days
        # Sin informe mensual, la serie diaria completa manda en sus metricas.
        from_series = series_months.get(mid)
        series_exact = []
        if not export and from_series and from_series["days"] >= min(days_in_month, month["days"] or days_in_month):
            for metric in series_metrics:
                source_values[metric] = from_series[metric]
                series_exact.append(metric)
        month_list.append(derived({
            "id": mid,
            "label": month["label"],
            "sourceFile": export["file"] if export else base["file"],
            "source": ("informe mensual" if export
                       else ("serie diaria" if series_exact else "semanas prorrateadas")),
            "exact": bool(export),
            "exactMetrics": ([] if export else series_exact),
            "rangeStart": (export["start"].isoformat() if export
                           else (f"{mid}-01" if from_series and series_exact else None)),
            "rangeEnd": (export["end"].isoformat() if export
                         else (f"{mid}-{from_series['days']:02d}" if from_series and series_exact else None)),
            "daysWithData": (export["days"] if export
                             else (from_series["days"] if series_exact else month["days"])),
            "weekDays": month["days"],
            "daysInMonth": days_in_month,
            "weeks": month["weeks"],
            **{k: round(source_values[k], 2) for k in METRICS},
            "records": [derived({"campaign": name, **{k: round(v, 2) for k, v in values.items()}})
                        for name, values in source_campaigns.items()],
        }))

    totals = {k: round(sum(m[k] for m in month_list), 2) for k in METRICS}
    return {
        "brand": "Tierra Films",
        "dashboard": "Gasto Publicitario",
        "moduleSubtitle": "Google Ads | Búsqueda",
        "schemaVersion": 4,
        "status": "ok",
        "granularity": "day" if day_list else ("week" if week_list else "month"),
        "currency": "PEN",
        "sourceFile": base["file"],
        "sourceFiles": [source["file"] for source in sources],
        "dayMetrics": sorted(series_metrics) if (series_days and not daily) else list(METRICS) if day_list else [],
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
    print(f"[tf-import] {len(data['months'])} meses, {len(data['weeks'])} semanas, {detail} "
          f"({data['period']['start']} a {data['period']['end']}): "
          f"S/ {t['cost']:.2f} | {t['clicks']:.0f} clics | {t['conversions']:.0f} conv. -> {args.output}")
    for m in data["months"]:
        print(f"   {m['label']}: {m['daysWithData']}/{m['daysInMonth']} dias | S/ {m['cost']:.2f} | "
              f"{m['conversions']:.1f} conv. | {m['source']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
