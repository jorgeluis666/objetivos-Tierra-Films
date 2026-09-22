# Tierra Films | Dashboard Lima Retail 2026

Dashboard de Google Ads para Tierra Films, adaptado desde la arquitectura de los
paneles de Amador y Aquarius.

## Acceso

- Password del login: `TF2026`
- Entrada local: `index.html`
- Build publicado: `dist/index.html`

## Modulos

1. **Gasto Publicitario**: resultados semanales de Google Ads.
   - Filtro `Periodo`: todo el periodo o un mes.
   - KPIs: coste, impresiones, CTR, clics (con CPC medio), conversiones y costo
     por conversion.
   - `Resultados por semana`: barras de inversion, conversiones y costo por
     conversion de cada semana del periodo.
   - `Evolucion semanal`: tendencia de todas las semanas; con un mes elegido se
     resaltan sus semanas.
   - `Resultados semanales`: tabla con % Δ contra la semana anterior y fila de
     total. En CPC y costo por conversion, bajar es mejor.
2. **Proyecciones**: cierre del mes en curso (el mes del ultimo dia con datos).
   - Cada semana de Google Ads se reparte en partes iguales entre sus dias para
     armar el acumulado diario real.
   - Tres escenarios para los dias que faltan:
     - `Ritmo del mes`: acumulado del mes / dias con datos.
     - `Ultimas 4 semanas`: promedio diario de los ultimos 28 dias.
     - `Presupuesto diario`: gasta el presupuesto completo cada dia, con la
       eficiencia (CTR, CPC, conversiones por sol) de las ultimas 4 semanas.
   - Grafico acumulado (inversion, conversiones o clics) con el tope de
     presupuesto, tabla de cierre contra el mes anterior y semanas que faltan.
   - `Meta de conversiones`: con una meta del mes calcula cuantas conversiones
     por dia y cuanta inversion hacen falta. La meta y el escenario se guardan en
     el navegador.
3. **Calculadora de Mensajes**: modulo heredado, sin cambios.

## Semanas que cruzan de mes

Google Ads agrupa por semanas de lunes a domingo. Para los totales mensuales, una
semana que cruza de mes se reparte por dias (por ejemplo, 27 jul - 2 ago aporta
5/7 a julio y 2/7 a agosto). En la tabla de un mes esas semanas se muestran
completas con la etiqueta de cuantos dias caen en el mes, y la fila de total dice
`(prorrateado)`. La vista `Todo el periodo` no prorratea nada y cuadra exacto con
Google Ads.

## Fuente de datos

`data/tierra-films-lima-retail-2026.json` (schema 3), generado a partir del
"Informe de campaña" de Google Ads segmentado por **Semana**:

```json
{
  "period": { "start": "2026-07-01", "end": "2026-09-20" },
  "campaigns": [ { "name": "VIDEOS CORPORATIVOS", "dailyBudget": 110 } ],
  "totals": { "cost": 8651.95, "impressions": 27011, "clicks": 2403, "conversions": 434 },
  "weeks": [ { "start": "2026-06-29", "dataStart": "2026-07-01", "days": 5, "daysByMonth": { "2026-07": 5 }, "cost": 569.18 } ],
  "months": [ { "id": "2026-09", "daysWithData": 20, "daysInMonth": 30, "cost": 1643.57 } ]
}
```

La primera semana (29 jun) solo trae datos desde el 1 de julio porque ese es el
inicio del rango del informe.

`accountTotal` guarda el total de la cuenta como referencia. En este informe es
S/ 124.88 mayor que el de la campaña (semana del 14 set), porque la cuenta
incluye gasto fuera de `VIDEOS CORPORATIVOS`. El dashboard usa las filas por
campaña.

## Actualizar la data

1. En Google Ads: Campañas, rango desde el 1 de julio hasta hoy, Segmento >
   Tiempo > Semana, Descargar > CSV.
2. Importar (reemplaza todo el JSON con el nuevo rango y guarda el CSV en
   `data/csv-backups/`):

```bash
python scripts/import-google-ads-weekly.py "ruta/Informe de campaña.csv"
```

3. Regenerar el build:

```bash
npm.cmd run build
```

El build incrusta los assets en `dist/index.html`. Si Windows bloquea `dist/data`, el script mantiene actualizado el HTML y muestra una advertencia.
