# Tierra Films | Dashboard Lima Retail 2026

Dashboard de Google Ads para Tierra Films, adaptado desde la arquitectura de los
paneles de Amador y Aquarius.

## Acceso

- Password del login: `TF2026`
- Entrada local: `index.html`
- Publicado: https://tierrafilms.limaretail.com (GitHub Pages desde `main`; el dominio sale del archivo `CNAME`)
- Build: `dist/index.html`

## Modulos

1. **Gasto Publicitario**: resultados de Google Ads por campaña, mes a mes y en el
   acumulado del año.
   - **Sincronización** (barra superior): la píldora dice hasta qué día llegan los
     datos y de dónde salen (`auto 10:00`, `leído 15:37`, `copia 6 oct` o
     `no se pudo leer`) y abre el detalle (datos, meses cargados, último y
     próximo barrido, palabras clave, carpetas de Drive y lo que falta subir).
     Al lado, el botón `Sincronizar`. Un error o un barrido de más de 30 horas
     pone la píldora en ámbar. Ver [Sincronizacion con Drive](#sincronizacion-con-drive).
   - **Pestañas** Enero a Diciembre y **Anual**. Mes sin informe, deshabilitado;
     punto en el último mes con datos. El mes elegido se guarda en
     `tierra_films_selected_month` (`anual` para Anual; el viejo `all` de "Todo el
     periodo" se migra a Anual). Un mes sin informe entre el primero y el último
     se avisa arriba.
   - **Periodo** con 8 KPIs: inversión, impresiones, clics, CTR, CPC prom.,
     conversiones, costo por conversión y tasa de conversión (conversiones /
     clics). Los cocientes salen de las sumas. Un mes cerrado se compara con el
     mes anterior completo. El mes en curso compara la **inversión con el mismo
     tramo del mes anterior** cuando hay costo diario real de esos días, y el
     resto contra el mes anterior **prorrateado** a los mismos días (CTR, CPC,
     costo y tasa son los del mes anterior); la bajada lo dice. El primer mes no
     tiene comparación. Anual muestra el promedio mensual de los meses cerrados.
     Un mes cuyas impresiones, clics o conversiones salen de repartir semanas
     (Agosto) las marca `(est.)`. El mes empieza el día 1 salvo el primero con
     datos.
   - **Distribución de inversión por campaña** (estado y presupuesto vigentes en
     el último informe) y, debajo, **un cuadro por campaña**: KPIs con variación,
     gráfico con `Acumulado del mes`, `Por día`, `Por semana` y `Por mes` y chips
     de indicadores (varios = paneles apilados, cada uno con su escala; uno solo
     en vista diaria = contra el mes anterior en el mismo día). Lo repartido desde
     semanas va punteado con `(est.)`. Las vistas diarias necesitan la serie por
     día del mes (hoy: costo real del 1-jun al 20-set y el resto repartido de las
     semanas; octubre solo tiene Por mes). Dentro del cuadro: `Conversiones por
     acción` (WhatsApp Plugin, Formulario, WhatsApp Clic) del informe por acción
     de conversión, `Resultados semanales` (% Δ contra la semana anterior; en CPC
     y costo por conversión, bajar es mejor) y `Palabras clave del periodo`.
     Minimizar, indicadores y vista se recuerdan en
     `tierra_films_gasto_campaign_charts`.
   - **Palabras clave**: cada mes usa un solo informe. Si la carpeta Keywords tiene
     el del mes (por acción de conversión), solo conversiones: Google deja
     impresiones, clics y costo en 0 y esas columnas no se muestran. Si no, el
     informe semanal del repo, con todas las métricas; las semanas que cruzan de
     mes se reparten por días `(est.)`. Se compara con el mes anterior solo si los
     dos usan el mismo informe y cubren el mes completo o los mismos días. En
     Anual, con meses de los dos informes, no se calcula el costo por conversión.
   - **Ranking de palabras clave del periodo**: cabecera fija, Campaña y Palabra
     clave ancladas, estrella en la líder, filtro por campaña, `Compacto`
     (`tierra_films_gasto_kw_compact`) y `Pantalla completa` (las pestañas de mes
     entran al panel; `Esc` sale). `Ver análisis completo` abre Palabras Clave.
   - Campañas, palabras y semanas sin inversión, impresiones ni clics no aparecen.
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
   - `Desde Google Drive` (al final): palabras clave que convierten, leidas de
     la carpeta Keywords; ver
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
4. **Segmentacion**: informes de la carpeta Google Ads TF Segmentacion, para
   decidir a que intencion de busqueda y a que zona apuntar la cuenta
   (`js/segmentation.js`).
   - KPIs de la semana y `Que dice la data para segmentar`: hallazgos
     calculados (peso de las busquedas sin clasificar, segmento mas rentable,
     impresiones en competidores, agencias, demanda que crece y zonas).
   - `Segmentos de intencion`: las categorias de Google Ads agrupadas por
     intencion (marca, productoras, formatos de video, publicidad generica,
     agencias, competidores e IA, sin clasificar) con su participacion en
     impresiones, clics y conversiones y una decision por segmento. Las reglas
     de agrupacion estan en `SEGMENTS`; clic en un segmento filtra la tabla.
   - `Categorias y accion sugerida`: cada categoria con su accion (Priorizar,
     Ampliar, Revisar intencion, Revisar anuncio, Negativa candidata, Vigilar,
     Poca data), filtrable; el motivo sale al pasar el mouse.
   - `Demanda del mercado`: volumen de busquedas de cada categoria y su cambio
     contra la semana anterior, junto a nuestras impresiones.
   - `Segmentacion geografica`: conversiones por ubicacion y accion, gasto con
     ubicacion identificada y lo que queda sin ubicacion.
5. **Generacion de Reporte**: el Reporte de Publicidad de una semana de lunes a
   domingo con el diseño del modelo de Tierra Films y descarga en PDF
   (ver [Generacion de Reporte](#generacion-de-reporte)).

## Generacion de Reporte

Pestana que arma el "Reporte de Publicidad" de una semana de lunes a domingo con
el diseño del modelo de Tierra Films (`Modelo Reporte Tierra Films`): laminas
16:9 con fondo claro, tarjetas blancas de borde fino y acentos en azul.

El selector lista las semanas con datos, de la mas reciente a la mas antigua
("Semana 12 – 18 oct 2026"), y abre en la ultima semana cerrada. Si la serie por
dia llega a mitad de semana, esa semana aparece "(en curso)" y se compara con
los mismos dias de la semana anterior.

| Pagina | Contenido |
| --- | --- |
| Portada | Logo de Lima Retail, "Reporte de Publicidad", cliente, periodo ("Semana 12 – 18 de octubre 2026 \| Google Ads · Search"), una linea de la semana y fecha de emision. |
| Contenido | Resumen de la semana, Palabras clave y Conclusiones, con su numero de pagina. |
| Resumen de la semana | Inversion, conversiones, costo por conversion, clics, impresiones, CPC medio y CTR, con su variacion contra la semana anterior; clics y conversiones de lunes a domingo. |
| Palabras clave que convierten | Hasta 6 terminos ordenados por conversiones (coste, clics, conv., costo/conv. y CTR, o tasa de conversion si la semana no tiene impresiones), recuadro "Clave" y tarjeta "Analisis". |
| Conclusiones del periodo | Tres tarjetas (el termino estrella, el costo por conversion y los terminos a depurar) y, en una semana en curso, la nota de que las metricas se consolidan al cierre. |
| Cierre | Logo y firma de Lima Retail. |

- **De donde salen los numeros:** de la serie por dia de Gasto Publicitario
  (`window.TierraFilmsDays`, real donde el informe por dia de Drive la trae).
  Si en esa semana los clics, las conversiones o las impresiones no vienen por
  dia, se toma el total de la misma semana del informe semanal de campana o del
  de palabras clave, solo si su costo cuadra con el costo diario (hay semanas que
  esos informes traen incompletas). Si no hay de donde, el dato no se muestra: el
  informe por dia de Drive no trae impresiones, asi que esas semanas van sin
  Impresiones ni CTR y el grafico lo aclara. Las conversiones por accion
  (WhatsApp y formularios) vienen por mes, asi que el reporte semanal no las
  separa. No hay una fuente nueva: cada sincronizacion con Drive lo actualiza
  solo.
- **Palabras clave:** del informe por dia de la carpeta Campanas
  (`data.keywordDays`: costo, clics y conversiones por termino y dia) cuando
  cubre los siete dias; si no, del informe semanal de palabras clave de esa
  semana. El pie de la tabla dice cual. La misma palabra con dos concordancias
  va en una sola fila.
- **Grafico por dia:** clics y conversiones de lunes a domingo, de la serie
  diaria del modulo Gasto Publicitario. Donde Google Ads los entrega por semana,
  por dia se reparten con el coste de cada dia como peso, y el grafico lo aclara.
  Si la semana no tiene clics por dia (junio solo trae el costo diario), el
  grafico avisa que falta el informe de campana por dia.
- **Textos:** la linea del grafico, el recuadro "Clave", el analisis y las
  conclusiones vienen propuestos con lo que dicen los numeros. Se editan con un
  clic sobre la lamina (`**texto**` va en negrita) y quedan guardados por semana
  en el navegador (`tierra_films_report_notes_v2`); no se publican con el tablero.
  "Restablecer textos" vuelve a los propuestos, sin dialogo de confirmacion.
- **Descargar PDF** abre el dialogo de impresion con las laminas solas, una por
  hoja de 13.33 x 7.5 in (el tamaño del modelo), y el nombre del archivo ya
  armado. Activar "Graficos de fondo" si el navegador no lo hace solo.

El modulo es `js/report-week.js` y su template es propio de Tierra Films: cada
tablero de marca tiene el suyo, adaptado por la marca. Sus estilos y los de
impresion estan al final de `css/dashboard.css`.

## Semanas que cruzan de mes

Google Ads agrupa por semanas de lunes a domingo. Para los totales mensuales, una
semana que cruza de mes se reparte por dias (por ejemplo, 27 jul - 2 ago aporta
5/7 a julio y 2/7 a agosto). En la tabla de un mes esas semanas se muestran
completas con la etiqueta de cuantos dias caen en el mes, y la fila de total dice
`(prorrateado)`. La pestaña `Anual` suma los totales de cada mes (los de su
informe mensual), así que no reparte semanas.

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

El boton **Sincronizar** de la barra superior lee las carpetas "Google Ads TF"
de Google Drive del cliente y pone lo que encuentre encima de la data del repo.
Tambien sincroniza solo al abrir el tablero; cada visita lee las carpetas en vivo.

| Carpeta en Drive | ID | Modulo |
| --- | --- | --- |
| Google Ads TF Campañas | `1Zz5WjNFy0H37n0trSjhVx90NgPmqkyrO` | Gasto Publicitario y Proyecciones |
| Google Ads TF Segmentacion | `1Ehko4amk1IjGW6H-HB4WtkF98aaNeB7U` | Segmentacion |
| Google Ads TF Keywords | `1WSk4gc4UNeprLTWFzLtTUaSqOSWZ25yL` | Palabras Clave (seccion `Desde Google Drive`) |

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

- **Informe de palabras clave de busqueda** (`Palabra clave`), uno por mes
  (`Tierra Films KW setiembre - 2026`, ...): tabla `Palabras clave que
  convierten`, con un selector de mes, y las conversiones de cada palabra, su % del
  total y una columna por accion. Si el informe viene separado por accion de
  conversion (como hoy), Google Ads deja en 0 impresiones, clics y costo por
  palabra, y la tabla muestra solo conversiones; sin ese segmento suma tambien
  impresiones, clics, gasto y costo por conversion. Las palabras sin conversiones
  se ven con un boton.

Segmentacion (tambien el informe mas reciente de cada tipo):

- **Estadisticas de los terminos de busqueda** (`Categoría de búsqueda`):
  categorias con impresiones, clics, CTR, conversiones, tasa de conversion y
  volumen de busquedas, con el % de cambio contra el periodo de comparacion.
  `∞` de Google Ads sale como `nuevo`. Alimenta segmentos, acciones y demanda.
- **Informe de ubicaciones** (`Ubicación`): conversiones por ubicacion y por
  accion. Si viene separado por accion de conversion solo trae conversiones por
  ubicacion; el gasto con ubicacion sale de las filas de total.

### Copia local

`data/drive-snapshot.json` guarda una copia de lo que devolvieron las carpetas
(se arma con `scripts/drive-snapshot.py`). El tablero la usa al abrir y la
reemplaza en cuanto Drive responde; si Drive falla o todavia no esta conectado,
se queda con la copia y el boton dice `Copia <fecha>`. Para renovarla con CSV
descargados de las carpetas:

```bash
python scripts/drive-snapshot.py campanas="Accion de conversion setiembre 2026.csv" segmentacion="Terminos de busqueda 22-28 set 2026.csv" segmentacion="Ubicaciones setiembre 2026.csv" keywords="Palabras clave conversiones setiembre 2026.csv"
```

Por cada mes manda el informe que llega mas lejos. Si Drive trae menos dias que
el repo, se queda el del repo. `Anual`, los KPIs, la píldora `Datos al ...` y
Proyecciones se recalculan con lo nuevo; las vistas por día del cuadro de campaña
y la tabla semanal siguen con el detalle del repo hasta volver a importarlo.

Estados del boton: `Drive hh:mm` (verde, leido), `Reintentar` (rojo, fallo;
el tablero sigue con lo que tenia) y `Sincronizar` en amarillo (falta la
conexion).

### Barrido automatico a las 10:00

El Apps Script tiene un disparador que lee las tres carpetas **todos los dias a
las 10:00 (hora de Lima)** y guarda el resultado en un archivo de Drive
(`Tierra Films - barrido del tablero.json`, en el Drive de quien instala el
script). Al abrir, el tablero trae ese ultimo barrido, asi carga rapido; el
boton **Sincronizar** pide un barrido en el momento (`?fresh=1`). Si alguien lo
aprieta varias veces seguidas, el script reusa el barrido del ultimo minuto.

La píldora de la barra superior dice de donde salio la data:

| Etiqueta | Significa |
| --- | --- |
| `auto 10:00` | barrido automatico de hoy (con fecha si es de otro dia) |
| `leido 15:37` | barrido pedido con el boton (o el primero tras instalar) |
| `copia 6 oct` | la copia del repo (`data/drive-snapshot.json`): Drive aun no esta conectado |
| `no se pudo leer` | fallo la lectura; el tablero sigue con lo que tenia |

Al abrir la píldora sale el detalle: hora exacta del último barrido, el próximo
(10:00 de Lima), las carpetas y lo que falta subir. Si el último barrido tiene
más de 30 horas o la lectura falló, la píldora se pone ámbar.

### Conectar la carpeta (una sola vez)

El tablero es una pagina fija en GitHub Pages y no puede entrar a Drive por su
cuenta; el puente es un Apps Script que corre con tu cuenta de Google. Es el
mismo esquema que el tablero de Terminal Pesquero.

1. Entra a <https://script.google.com> con la cuenta duena de las carpetas >
   **Nuevo proyecto**. Borra lo que trae y pega `apps-script/drive-sync.gs`.
2. En el selector de funciones elige **installSweepTriggers** y dale **Ejecutar**.
   Autoriza los permisos de Drive y Hojas de calculo. Esto crea el disparador
   de las 10:00 y hace el primer barrido (el registro muestra cada hoja leida).
3. **Implementar > Nueva implementacion** > tipo **Aplicacion web**.
   - Ejecutar como: **Yo**.
   - Quien tiene acceso: **Cualquier persona**.
4. Copia la URL que termina en `/exec` y pegala en `DRIVE_SYNC_URL`, al inicio
   de `js/drive-sync.js`. Sube el cambio a `main`.

Si luego cambias el script, usa **Implementar > Gestionar implementaciones >
Editar > Nueva version** para que la URL siga siendo la misma. Si cambias
`SWEEP_HOUR`, vuelve a ejecutar `installSweepTriggers` (borra el disparador
anterior y crea el nuevo). `probarBarrido` hace un barrido de prueba sin tocar
el disparador.

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
