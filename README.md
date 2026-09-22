# Tierra Films | Dashboard Lima Retail 2026

Dashboard de Google Ads para Tierra Films, adaptado desde la arquitectura de los
paneles de Amador y Aquarius.

## Acceso

- Password del login: `TF2026`
- Entrada local: `index.html`
- Build publicado: `dist/index.html`

## Modulos

1. **Gasto Publicitario**: resultados semanales de Google Ads.
   - Filtro por mes: `Julio`, `Agosto`, `Setiembre` o `Todo el periodo`. Arranca
     en el ultimo mes con datos.
   - KPIs: coste, impresiones, CTR, clics (con CPC medio), conversiones y costo
     por conversion.
   - `Indicadores por dia`: lineas de gasto, conversiones, costo por conversion
     y CTR dia a dia del mes elegido. Con el export semanal solo, cada dia es la
     semana dividida entre sus dias y las lineas salen punteadas con `(est.)`;
     al importar el export diario pasan a ser la curva real.
   - `Evolucion semanal`: las mismas lineas para todo el periodo; las semanas del
     mes elegido quedan resaltadas.
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
   - Grafico acumulado de `Gasto`, `Conversiones` o `Costo x conversion`, con el
     tope de presupuesto, la tabla de cierre contra el mes anterior y las semanas
     que faltan.
   - `Simulador de cierre`: el nodo naranja del ultimo dia se arrastra (en las
     vistas de Gasto y Conversiones) para simular otro cierre. Las conversiones
     mandan y el gasto sale de `costo por conversion marginal`, editable: esa es
     la relacion entre conseguir mas leads y cuanto cuestan. El simulador
     devuelve gasto, conversiones, costo por conversion del mes y el presupuesto
     diario necesario, y marca en rojo cuando supera el presupuesto actual.
     La meta, el costo marginal y el escenario se guardan en el navegador.
3. **Calculadora de Mensajes**: modulo heredado, sin cambios.

## Semanas que cruzan de mes

Google Ads agrupa por semanas de lunes a domingo. Para los totales mensuales, una
semana que cruza de mes se reparte por dias (por ejemplo, 27 jul - 2 ago aporta
5/7 a julio y 2/7 a agosto). En la tabla de un mes esas semanas se muestran
completas con la etiqueta de cuantos dias caen en el mes, y la fila de total dice
`(prorrateado)`. La vista `Todo el periodo` no prorratea nada y cuadra exacto con
Google Ads.

## De donde sale cada total

Cada mes usa la mejor fuente disponible, y el dashboard lo dice debajo de la
tabla:

- **Informe mensual** (un CSV por mes, sin segmento): total exacto del mes.
- **Serie diaria** (`Gráfico_de_serie_temporal(...).csv`, columnas `Fecha` y
  `Coste`): total exacto de las metricas que traiga el archivo y curva real por
  dia.
- **Semanas prorrateadas**: sin nada de lo anterior, el mes suma las semanas que
  lo cruzan repartidas por dias. Es una aproximacion.

Hoy estan cargados los informes mensuales de junio, julio y setiembre (al 21) y
la serie diaria de coste de agosto. De agosto falta el informe mensual: sus
conversiones, clics e impresiones siguen estimados desde las semanas.

En el grafico por dia, cada indicador se dibuja con linea llena si es dato real y
punteada con `(est.)` si sale de repartir la semana. Cuando hay coste diario
real, el reparto de los demas indicadores usa ese coste como peso en vez de
dividir la semana en partes iguales.

Junio no tiene detalle semanal (el informe por semana arranca el 1 de julio), asi
que su mes muestra solo los KPIs.

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

1. En Google Ads: Campañas, Descargar > CSV. Conviene bajar:
   - un informe por mes, con el rango del mes y sin segmento (total exacto);
   - el informe del periodo completo con Segmento > Tiempo > Semana;
   - opcional: el grafico de serie temporal de un mes (curva diaria real).
   Para la curva diaria real, descarga el mismo informe otra vez con
   Segmento > Tiempo > **Día**.
2. Importar (reemplaza todo el JSON con el nuevo rango y guarda los CSV en
   `data/csv-backups/`). Acepta uno o los dos archivos:

```bash
python scripts/import-google-ads-weekly.py "Mensual junio.csv" "Informe semanal.csv" "Serie diaria agosto.csv"
```

Con el export diario, los totales de cada mes salen exactos (sin prorratear las
semanas que cruzan de mes) y los graficos muestran el detalle dia a dia.

3. Regenerar el build:

```bash
npm.cmd run build
```

El build incrusta los assets en `dist/index.html`. Si Windows bloquea `dist/data`, el script mantiene actualizado el HTML y muestra una advertencia.
