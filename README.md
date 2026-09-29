# Tierra Films | Dashboard Lima Retail 2026

Dashboard de Google Ads para Tierra Films, adaptado desde la arquitectura de los
paneles de Amador y Aquarius.

## Acceso

- Password del login: `TF2026`
- Entrada local: `index.html`
- Build publicado: `dist/index.html`

## Modulos

1. **Gasto Publicitario**: resultados semanales de Google Ads.
   - Boton `Sincronizar` (barra superior): lee la carpeta de Google Drive del
     cliente; ver [Sincronizacion con Drive](#sincronizacion-con-drive).
   - Filtro por mes: `Julio`, `Agosto`, `Setiembre` o `Todo el periodo`. Arranca
     en el ultimo mes con datos.
   - `Conversiones por accion` (al costado del titulo): cuantas conversiones
     trajo cada accion (WhatsApp Plugin, Formulario, WhatsApp Clic) en el mes
     elegido, con su propio rango de fechas. Sale del informe de campaña
     segmentado por accion de conversion; en `Todo el periodo` muestra el mas
     reciente y en un mes sin ese informe no aparece.
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
   - Los dias que faltan se proyectan con el ritmo del mes (acumulado del mes /
     dias con datos).
   - Grafico acumulado filtrable por `Gasto`, `Conversiones` o
     `Costo x conversion`, con el
     tope de presupuesto, la tabla de cierre contra el mes anterior y las semanas
     que faltan.
   - `Simulador de cierre`: el nodo naranja del ultimo dia se arrastra (en las
     vistas de Gasto y Conversiones) para simular otro cierre. Las conversiones
     mandan y el gasto sale de `costo por conversion marginal`, editable: esa es
     la relacion entre conseguir mas leads y cuanto cuestan. El simulador
     devuelve gasto, conversiones, costo por conversion del mes y el presupuesto
     diario necesario, y marca en rojo cuando supera el presupuesto actual.
     La meta, el costo marginal y el escenario se guardan en el navegador.
3. **Palabras Clave**: informe semanal de palabras clave de busqueda.
   - `Desde Google Drive` (al final): categorias de busqueda y ubicaciones,
     leidas de la carpeta de Drive; ver
     [Sincronizacion con Drive](#sincronizacion-con-drive).
   - Filtro por mes y KPIs: impresiones, clics, cuota de impresiones, perdido
     por ranking, nivel de calidad y CPC.
   - `Por que se movieron las impresiones y los clics`: diagnostico automatico.
     Separa la caida en dos partes con la identidad
     `impresiones = subastas elegibles x cuota de impresiones`, la contrasta con
     el gasto diario real y revisa ranking, calidad, CPC y cobertura. Se recalcula
     solo al importar datos nuevos.
   - `Evolucion semanal`: impresiones y clics contra cuota, perdido por ranking
     y CPC.
   - Tabla por palabra clave con % Δ contra el mes anterior; el nivel de calidad
     4 o menos sale en rojo, y las columnas `Relevancia anuncio` y
     `Pagina destino` muestran los componentes del nivel de calidad.
   - Se pueden importar varios informes de palabras clave: uno largo sin las
     columnas de calidad y otro corto con ellas se fusionan por semana y palabra.

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
la serie diaria de coste de todo el periodo (1 jun - 20 set). De agosto falta el
informe mensual: sus conversiones, clics e impresiones siguen estimados desde las
semanas. El detalle semanal existe desde el 1 de julio, asi que junio solo tiene
la curva de gasto diario y su total mensual.

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

## Sincronizacion con Drive

El boton **Sincronizar** de la barra superior lee dos carpetas de Google Drive
del cliente y pone lo que encuentre encima de la data del repo. Tambien
sincroniza solo al abrir el tablero; cada visita lee las carpetas en vivo.

| Carpeta | ID | Modulo |
| --- | --- | --- |
| Gasto | `1Zz5WjNFy0H37n0trSjhVx90NgPmqkyrO` | Gasto Publicitario y Proyecciones |
| Palabras | `1Ehko4amk1IjGW6H-HB4WtkF98aaNeB7U` | Palabras Clave (seccion `Desde Google Drive`) |

El tablero reconoce cada informe por su fila de encabezados, no por la carpeta
ni por el nombre del archivo (una pestaña o CSV por informe, con el rango de
fechas en la cabecera, igual que el export de Google Ads). Lee numeros en
formato es-PE (`2461,69`) o en ingles (`1,124`), segun venga cada hoja.

Gasto Publicitario:

- **Informe de campaña del mes** sin segmentar (`Estado de la campaña` en la
  primera columna): su fila `Total: Cuenta` reemplaza los totales del mes.
- **Informe por accion de conversion** (`Acción de conversión` en la primera
  columna): da el desglose por accion y, con su fila `Total: Cuenta` sin
  accion, tambien los totales del mes.
- Un informe que cubre varios meses o viene segmentado por Dia/Semana se salta;
  el motivo sale al pasar el mouse por el boton.

Palabras Clave (se muestra el informe mas reciente de cada tipo, con su propio
rango; el filtro de mes del modulo no lo cambia):

- **Estadisticas de los terminos de busqueda** (`Categoría de búsqueda`):
  tabla de categorias con impresiones, clics, CTR, conversiones, tasa de
  conversion y volumen de busquedas, con el % de cambio contra el periodo de
  comparacion. `∞` de Google Ads sale como `nuevo`. Muestra las 12 categorias
  con mas impresiones y un boton para ver todas; `Sin clasificar` va aparte.
- **Informe de ubicaciones** (`Ubicación`): conversiones por ubicacion y por
  accion. Si viene separado por accion de conversion solo trae conversiones por
  ubicacion; las impresiones y el costo con ubicacion salen en la nota.

### Copia local

`data/drive-snapshot.json` guarda una copia de lo que devolvieron las carpetas
(se arma con `scripts/drive-snapshot.py`). El tablero la usa al abrir y la
reemplaza en cuanto Drive responde; si Drive falla o todavia no esta conectado,
se queda con la copia y el boton dice `Copia <fecha>`. Para renovarla con CSV
descargados de las carpetas:

```bash
python scripts/drive-snapshot.py gasto="Accion de conversion setiembre 2026.csv" palabras="Terminos de busqueda 22-28 set 2026.csv" palabras="Ubicaciones setiembre 2026.csv"
```

Por cada mes manda el informe que llega mas lejos. Si Drive trae menos dias que
el repo, se queda el del repo. `Todo el periodo`, los KPIs, `Datos al ...` y
Proyecciones se recalculan con lo nuevo; los graficos por dia y la tabla
semanal siguen con el detalle del repo hasta volver a importarlo.

Estados del boton: `Drive hh:mm` (verde, leido), `Reintentar` (rojo, fallo;
el tablero sigue con lo que tenia) y `Sincronizar` en amarillo (falta la
conexion).

### Conectar la carpeta (una sola vez)

El tablero es una pagina fija en GitHub Pages y no puede entrar a Drive por su
cuenta; el puente es un Apps Script que corre con tu cuenta de Google.

1. Entra a <https://script.google.com> con la cuenta duena de las carpetas >
   **Nuevo proyecto**. Borra lo que trae y pega `apps-script/drive-sync.gs`.
2. **Implementar > Nueva implementacion** > tipo **Aplicacion web**.
   - Ejecutar como: **Yo**.
   - Quien tiene acceso: **Cualquier persona**.
3. Autoriza los permisos de Drive y Hojas de calculo que pide Google.
4. Copia la URL que termina en `/exec` y pegala en `DRIVE_SYNC_URL`, al inicio
   de `js/drive-sync.js`. Sube el cambio a `main`.

Si luego cambias el script, usa **Implementar > Gestionar implementaciones >
Editar > Nueva version** para que la URL siga siendo la misma.

Para sumar otra carpeta, agregala en `FOLDERS` (Apps Script) y en
`FOLDER_URLS` (`js/drive-sync.js`) y publica una nueva version del script.

Ojo: cualquiera con esa URL puede leer los informes de las carpetas. Como el repo
es publico, la URL queda visible en `js/drive-sync.js`.

## Actualizar la data

1. En Google Ads: Campañas, Descargar > CSV. Conviene bajar:
   - un informe por mes, con el rango del mes y sin segmento (total exacto);
   - el informe del periodo completo con Segmento > Tiempo > Semana;
   - opcional: el grafico de serie temporal de un mes (curva diaria real);
   - para el modulo Palabras Clave: Informes > Palabras clave de busqueda, con
     Segmento > Tiempo > Semana y las columnas de cuota de impresiones, cuota
     perdida por ranking, nivel de calidad y sus componentes (rendimiento
     esperado del anuncio, relevancia del anuncio y experiencia en la pagina de
     destino).
   - para el desglose de conversiones: el informe de campaña del mes con
     Segmento > Conversiones > **Accion de conversion** (hoy viene de la hoja
     `Campaña - Accion de conversion` en la carpeta de Drive del cliente,
     descargada como CSV).
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
