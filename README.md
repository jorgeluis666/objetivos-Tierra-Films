# Tierra Films | Dashboard Lima Retail 2026

Dashboard de Google Ads para Tierra Films, adaptado desde la arquitectura de los
paneles de Amador y Aquarius.

## Acceso

- URL publica: **https://tierrafilms.limaretail.com** (con clave, ver "Publicacion en tierrafilms.limaretail.com").
- La clave no esta en el codigo: es el secret `TF_PAGE_PASSWORD` de GitHub.
- Entrada local: `index.html` (sin clave)
- Build publicado: `dist/index.html`

## Modulos

1. **Gasto Publicitario**: resultados de Google Ads por campaña, mes a mes y en el
   acumulado del año.
   - **Sincronización** (barra superior, como Royal Baby): la píldora dice el estado
     (`Sincronizado · hace 2 h`, `Recargando…`, `Copia guardada · hace 3 d`,
     `Aún no sincronizado` o `No se pudo sincronizar`) y abre el detalle (lo de la
     vista abierta, datos, meses cargados, último y próximo barrido, palabras
     clave, carpetas de Drive y lo que falta subir). Al lado, el botón fantasma
     `Actualizar`. Ver [Barra superior](#barra-superior) y
     [Sincronizacion con Drive](#sincronizacion-con-drive).
   - **Pestañas** Enero a Diciembre y **Anual**. Mes sin informe, deshabilitado;
     punto en el último mes con datos. El mes elegido se guarda en
     `tierra_films_selected_month` (`anual` para Anual; el viejo `all` de "Todo el
     periodo" se migra a Anual). Un mes sin informe entre el primero y el último
     se avisa arriba.
   - **Periodo** con 8 KPIs: inversión, impresiones, clics, CTR, CPC prom.,
     conversiones, costo por conversión y tasa de conversión (conversiones /
     clics). Los cocientes salen de las sumas. Un mes cerrado se compara con el
     mes anterior completo. El mes en curso compara cada suma (inversión,
     impresiones, clics, conversiones) **con el mismo tramo del mes anterior**
     cuando hay dato diario real de esos días (el informe por día de la carpeta
     Campañas), y la que no lo tenga contra el mes anterior **prorrateado** a los
     mismos días. Un cociente sale del tramo si sus dos sumas son reales; si no,
     es el del mes anterior completo. La bajada lo dice. El primer mes no
     tiene comparación. Anual muestra el promedio mensual de los meses cerrados.
     Un mes cuyas impresiones, clics o conversiones salen de repartir semanas
     (Agosto) las marca `(est.)`. El mes empieza el día 1 salvo el primero con
     datos.
   - **Distribución de inversión por campaña** (estado y presupuesto vigentes en
     el último informe) y, debajo, **un cuadro por campaña**: KPIs con variación,
     gráfico con `Por día`, `Por semana` y `Por mes` (sin acumulado: siempre sube
     y exagera el crecimiento) y chips de indicadores: inversión, conversiones,
     clics, impresiones y costo por conversión (inversión / conversiones de cada
     día, semana o mes; un día sin conversiones queda como hueco). Cada punto
     lleva su valor (si dos etiquetas chocan, una baja bajo el punto o queda solo
     en el tooltip). Varios indicadores van en paneles apilados, cada uno con su
     escala, o con el botón `Un solo cuadro` todos juntos, un color por
     indicador y cada uno con su escala (sin eje: el valor va en el punto); uno
     solo en vista diaria va contra el mes anterior en el mismo día. Lo repartido desde
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
6. **Leads**: CRM de feedback del cliente, copia del modulo de Aquarius
   (ver [Leads](#leads-crm-de-feedback-del-cliente)).

Segmentacion esta oculto por ahora: su boton del panel lateral lleva `hidden`
(`index.html`) y el tablero no lo reabre aunque fuera la ultima vista. Para
volver a mostrarlo basta con quitar ese atributo.

## Leads (CRM de feedback del cliente)

Pestana **Leads** del panel lateral (`js/leads.js`). Una tabla por campana y mes: la inversion y los leads que
reporta Google Ads (sus conversiones) se cargan solos de Gasto Publicitario (`TierraFilmsGasto.months()`), y el
cliente completa en las columnas resaltadas lo que de verdad recibio: leads reales, calificados, ventas y monto
vendido. Con eso el tablero calcula coincidencia, costo por lead real, costo por calificado, costo por venta y
ROAS. Cada cociente usa solo las campanas y meses que tienen ese dato completo. En "Todo el ano" la tabla suma
los meses y queda de solo lectura.

- **Se habilita solo con campanas de leads o WhatsApp** (`detectObjective`): en Google Ads, Busqueda, Maximo
  rendimiento y Demand Gen (no Shopping, Display ni Video). En Tierra Films entra VIDEOS CORPORATIVOS (Busqueda).
- **Guardado**: sin la hoja privada, en este navegador (aviso "Modo de prueba"). La hoja se conecta con el Web
  App de `apps-script/crm-leads.gs` (instrucciones al inicio del archivo): en GitHub > Settings > Secrets and
  variables > Actions, crear `TF_CRM_URL` (la URL `/exec`) y `TF_CRM_TOKEN` (el token de `crearToken`). El
  siguiente deploy los incrusta como `window.TIERRA_FILMS_CRM` dentro del HTML cifrado con `TF_PAGE_PASSWORD`;
  nunca quedan en el repo. Lo que completa el cliente tampoco va al repo.

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

## Barra superior

Igual que la de Royal Baby: queda fija al hacer scroll (blanca translucida con blur,
70px de alto). A la izquierda, el boton para minimizar la barra lateral, el titulo
del modulo y debajo la misma descripcion que muestra la barra lateral. A la
derecha, la campanita de **Notificaciones** (ver [Notificaciones y alerta de Google
Ads](#notificaciones-y-alerta-de-google-ads)), la píldora de sincronizacion y el boton fantasma
**Actualizar**.

| Píldora | Color | Cuando |
| --- | --- | --- |
| `cargando…` | ámbar, punto latiendo | el tablero recien abre |
| `Recargando…` | ámbar, punto latiendo | leyendo Drive (al abrir o con Actualizar) |
| `Sincronizado · hace 2 h` | verde | el ultimo barrido se leyo bien |
| `Sincronizado · hace 2 d` | ámbar | barrido de mas de 30 horas, o las carpetas no tienen informes que el tablero reconozca |
| `Copia guardada · hace 3 d` | ámbar | Drive sin conectar: se ve `data/drive-snapshot.json` |
| `Aún no sincronizado` | ámbar | Drive sin conectar y sin copia |
| `No se pudo sincronizar` | rojo | fallo la lectura; el tablero sigue con lo que tenia |

El tiempo es relativo a la hora del barrido y avanza solo cada minuto. Al pasar
el mouse, la píldora dice hasta que dia llegan los datos y de donde salen
(`Datos al 21 de octubre · auto 10:00`, `leído 15:37`, `copia 6 oct`,
`sin conexión` o `no se pudo leer`). Al abrirla sale el detalle (tarjeta de
330px): lo de la vista abierta (`En esta vista`), datos, meses cargados, ultimo y
proximo barrido, palabras clave, `Fuentes en Google Drive` y lo que falta subir.

El boton **Actualizar** (`#drive-sync`) hace lo mismo que el viejo Sincronizar:
pide un barrido en el momento (`?fresh=1`). Mientras lee dice `Actualizando…`
con el icono girando y queda deshabilitado; si la lectura falla dice
`Reintentar` (misma funcion).

## Sincronizacion con Drive

El boton **Actualizar** de la barra superior lee las carpetas "Google Ads TF"
de Google Drive del cliente y pone lo que encuentre encima de la data del repo.
Tambien sincroniza solo al abrir el tablero; cada visita lee las carpetas en vivo.

| Carpeta en Drive | ID | Modulo |
| --- | --- | --- |
| Google Ads TF Campañas | `1Zz5WjNFy0H37n0trSjhVx90NgPmqkyrO` | Gasto Publicitario y Proyecciones |
| Google Ads TF Segmentacion | `1Ehko4amk1IjGW6H-HB4WtkF98aaNeB7U` | Segmentacion |
| Google Ads TF Keywords | `1WSk4gc4UNeprLTWFzLtTUaSqOSWZ25yL` | Palabras Clave (seccion `Desde Google Drive`) |
| 08 Reglas y Optimización | `1QBpVlptEoR8F-667W9FCmL4ZsD0WHvY9` | Notificaciones (el orden de los avisos) |

De la carpeta de reglas el Apps Script devuelve **solo cinco columnas** de la hoja
`Reglas_Nexus_Tierra Films` (`COLUMNAS_POR_CARPETA`): la «Instrucción Estratégica para la IA» esta
escrita para la agencia y no sale de LR Suite. El recorte se hace en el Apps Script, no en el
tablero, porque su Web App responde a cualquiera que tenga la URL.

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
- **Rendimiento de la campaña por dia** (`Día`, `Campaña`, `Clics`, `Impr.`,
  `Coste`, `Conversiones`), uno por mes (`Tierra Films - Octubre 2026`, ...): el
  formato recomendado. Da los totales del mes y la serie real por dia y por
  campaña de todas las metricas. Un dia del rango sin filas es un dia sin
  actividad (Google Ads no lista los dias en 0) y queda en 0. Con la columna
  `Palabra clave de la Búsqueda` (el "Informe - Plataforma") da tambien las
  palabras clave por dia; sin `Impr.`, las impresiones se aproximan.
- **Informe de campaña del mes por semana** (`Semana` en la primera columna): da
  los totales del mes y sus semanas de lunes a domingo (una semana que cruza de
  mes junta los dos tramos), sin detalle por dia.
- Un informe que cubre varios meses o viene segmentado de otra forma se salta;
  el motivo sale en el detalle de la píldora.
- **Campaña excluida**: `Website traffic-Search-5` la creo el hackeo de la
  cuenta en setiembre y no cuenta en ningun indicador (`EXCLUDED_CAMPAIGNS` en
  `js/drive-sync.js`). Con filas por campaña, el total del mes es la suma de las
  campañas que cuentan, aunque el informe venga filtrado.
- **Presupuesto**: el diario sale del informe mas reciente que lo traiga (o del
  repo: VIDEOS CORPORATIVOS paso de S/ 112 a S/ 250 el 21 de octubre). El del
  mes, si `monthlyBudgets` del JSON del repo lo fija (octubre: S/ 3,500); si
  no, el diario por los dias del mes. Lo usa Proyecciones.

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

`data/drive-snapshot.json` guarda una copia de lo que devolvieron las carpetas.
El tablero la usa al abrir y la reemplaza en cuanto Drive responde; si Drive
falla o todavia no esta conectado, se queda con la copia y la píldora dice
`Copia guardada · hace N d`. La copia viaja dentro del HTML cifrado
(`scripts/build.js`), asi que es lo que ve el cliente mientras Drive no contesta.

La renueva sola el barrido programado de abajo, tres veces al dia. Tambien se
puede armar a mano con `scripts/drive-snapshot.py` y CSV descargados de las
carpetas:

```bash
python scripts/drive-snapshot.py campanas="Accion de conversion setiembre 2026.csv" segmentacion="Terminos de busqueda 22-28 set 2026.csv" segmentacion="Ubicaciones setiembre 2026.csv" keywords="Palabras clave conversiones setiembre 2026.csv"
```

Por cada mes manda el informe que llega mas lejos. Si Drive trae menos dias que
el repo, se queda el del repo. `Anual`, los KPIs, el detalle de la píldora (`Datos al ...`) y
Proyecciones se recalculan con lo nuevo; las vistas por día del cuadro de campaña
y la tabla semanal siguen con el detalle del repo hasta volver a importarlo.

Estados (ver [Barra superior](#barra-superior)): `Sincronizado · hace …` en
verde (leido), `No se pudo sincronizar` en rojo con el boton en `Reintentar`
(fallo; el tablero sigue con lo que tenia) y `Copia guardada` o
`Aún no sincronizado` en ámbar (falta la conexion).

### Barrido automatico a las 10:00

El Apps Script tiene un disparador que lee las cuatro carpetas **todos los dias a
las 10:00 (hora de Lima)** y guarda el resultado en un archivo de Drive
(`Tierra Films - barrido del tablero.json`, en el Drive de quien instala el
script). Al abrir, el tablero trae ese ultimo barrido, asi carga rapido; el
boton **Actualizar** pide un barrido en el momento (`?fresh=1`). Si alguien lo
aprieta varias veces seguidas, el script reusa el barrido del ultimo minuto.

Al pasar el mouse por la píldora de la barra superior se ve de donde salio la
data (la píldora dice el estado y el tiempo relativo del barrido):

| Etiqueta | Significa |
| --- | --- |
| `auto 10:00` | barrido automatico de hoy (con fecha si es de otro dia) |
| `leido 15:37` | barrido pedido con el boton (o el primero tras instalar) |
| `copia 6 oct` | la copia del repo (`data/drive-snapshot.json`): Drive aun no esta conectado |
| `no se pudo leer` | fallo la lectura; el tablero sigue con lo que tenia |

Al abrir la píldora sale el detalle: hora exacta del último barrido, el próximo
(10:00 de Lima), las carpetas y lo que falta subir. Si el último barrido tiene
más de 30 horas, la píldora se pone ámbar; si la lectura falló, roja.

### Barrido programado y publicacion (06:30, 13:30 y 18:30)

Nexus escribe los informes de Google Ads en las carpetas a las **06:00, 13:00 y
18:00 de Lima**. Media hora despues, `.github/workflows/sync-drive.yml` pide un
barrido en el momento (`?fresh=1`), guarda la respuesta en
`data/drive-snapshot.json` con `scripts/sync-drive.py` y, si cambio algo, vuelve
a publicar el tablero. Sin esto la copia del repo se renovaba a mano y el cliente
veia el mes anterior cada vez que Drive no contestaba.

La hora la pone Google Apps Script, no un cron de GitHub (que atrasa varias
horas): `apps-script/sincronizar-tierra-films.gs` lanza el workflow por la API de
GitHub. Va en un **proyecto aparte** del de `drive-sync.gs`, con una sola
propiedad del script (`GITHUB_TOKEN`, token de grano fino con Actions: lectura y
escritura solo para este repositorio); los pasos estan en la cabecera del
archivo. Sin ese proyecto el workflow sigue andando a mano, desde
`Actions > Sincronizar Drive > Run workflow`.

El barrido del workflow tambien renueva el archivo de Drive que guarda el Web
App, asi que el disparador propio de `drive-sync.gs` (10:00) solo queda como
respaldo para quien abra el tablero sin que haya corrido ninguno. La píldora
sigue anunciando esas 10:00 como proximo barrido.

El script no escribe si las hojas no cambiaron, para no dejar un commit igual al
anterior en cada corrida. El commit lo hace `tierra-films-sync[bot]` con el
`GITHUB_TOKEN` de Actions, y esos push **no disparan otros workflows**: la
publicacion se pide a mano en el mismo workflow y la alerta semanal no sale por
datos nuevos, solo en su horario de los lunes o a pedido.

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
   de `js/drive-sync.js`. Sube el cambio a `main`. El navegador llama a esa URL
   directamente (`script.google.com`), asi que la sincronizacion sigue igual
   detras de la pantalla de clave.

Si luego cambias el script, usa **Implementar > Gestionar implementaciones >
Editar > Nueva version** para que la URL siga siendo la misma. Si cambias
`SWEEP_HOUR`, vuelve a ejecutar `installSweepTriggers` (borra el disparador
anterior y crea el nuevo). `probarBarrido` hace un barrido de prueba sin tocar
el disparador.

Para sumar otra carpeta, agregala en `FOLDERS` (Apps Script) y en
`FOLDER_URLS` (`js/drive-sync.js`) y publica una nueva version del script. Si de esa carpeta no
debe salir todo, nombra sus columnas en `COLUMNAS_POR_CARPETA` (Apps Script), como la de reglas.

Ojo: cualquiera con esa URL puede leer los informes de las carpetas. En el sitio
publicado queda dentro del HTML cifrado, pero como el repo es publico sigue
visible en `js/drive-sync.js`.

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

El resultado se genera en `dist/`: `index.html` (CSS, JS y datos incrustados), `assets/` y `CNAME`.
Nada mas: `data/` (incluido `data/csv-backups`), `scripts/` y `apps-script/` no se publican.

Con `TF_PAGE_PASSWORD=<clave> npm run build` el `index.html` sale cifrado, como en GitHub Pages
(en PowerShell: `$env:TF_PAGE_PASSWORD='<clave>'; npm.cmd run build`). Para probarlo, servir `dist/` (por
ejemplo `npx live-server dist`) y abrirlo: pide la clave. Usar una clave de prueba, no la real.

## Notificaciones y alerta de Google Ads

El mismo sistema de alertas de Royal Baby, con los numeros de Google Ads. Tiene dos caras y las dos
salen del mismo calculo (`js/alertas-core.js`): el ultimo mes con inversion, su ritmo diario y el
cierre proyectado (ritmo x dias del mes, igual que Proyecciones), frente a dos referencias: el
**presupuesto del mes** (`monthlyBudgets` de la data) y el **mes anterior**, llevado a mes completo
cuando su informe quedo a medias.

**La campanita de la barra superior** (`js/notificaciones.js`, a la izquierda de la píldora de
sincronizacion) muestra los avisos del mes y, con un clic, abre el modulo donde se ve ese numero:

| Aviso | Cuando aparece |
| --- | --- |
| Cierre del gasto vs presupuesto | hay presupuesto del mes; rojo si el cierre pasa el 115 %, ámbar sobre 105 % o por debajo del 80 % |
| Conversiones al cierre vs mes anterior | rojo bajo el 80 %, ámbar bajo el 95 % |
| Costo por conversion vs mes anterior | ámbar si sube mas de 10 %, rojo sobre 30 % |
| Campañas que gastan sin conversiones | alguna campaña del mes gasto y no convirtio |
| La campaña que sostiene el mes | informativo: cuanta conversion concentra y a que costo |

**El Ciclo Mensual de Analisis y Optimizacion** (`data/reglas.json`) decide en que orden se leen
esos avisos. Las cuatro reglas dicen, por el dia del mes que cubre el informe, en que semana del
ciclo vamos; con eso el panel encabeza con una linea de contexto («Semana 3 del mes») y sube
primero el aviso que toca mirar esa semana:

| Semana | Acción | Qué sube primero |
| --- | --- | --- |
| 1 | `alerta_pacing` | el cierre del gasto frente al presupuesto |
| 2 | `pausar_fatigados` | las campañas que gastan sin resultado |
| 3 | `alerta_overlap` | la campaña que concentra el resultado |
| 4 | `escalar_presupuesto` | el presupuesto que va a quedar sin usar |

Ningun aviso se esconde: el que no toca esa semana baja de puesto, nada mas. La hoja
`Reglas_Nexus_Tierra Films` de la carpeta «08 Reglas y Optimizacion» del Drive de la marca es la
raiz editable de estas reglas, y el **barrido de las 10:00** la trae junto con las otras carpetas:
lo que el equipo cambie ahi se ve en el tablero sin pasar por el repositorio. Si Drive no responde
—o el tablero abrio sin conexion— manda `data/reglas.json`, que es tambien lo que lee el correo
semanal; sin ninguna de las dos, los avisos salen como siempre, sin ordenar y sin la linea de
contexto. La **instruccion estrategica** de esa hoja no llega hasta aqui: la recorta el Apps Script
antes de responder y se queda en LR Suite.

La ruedita del panel abre la lista de **correos de la alerta** (nombre opcional y correo, hasta 25).
La lista vive en el Web App de `apps-script/alertas-destinatarios.gs` (propiedades del script, no en
el repo): el tablero publicado la edita con la URL y la clave que el build deja dentro del HTML
cifrado, y la alerta la lee antes de cada envio. Mientras nadie guardo una lista, o si el Web App no
responde, se usan los destinatarios de `data/alertas-config.json`; una lista guardada vacia no envia
nada.

**El correo** (`scripts/alertas.js`, con la estetica del tablero) sale por
`.github/workflows/alertas-semanales.yml`:

- **Lunes a las 6:00 p. m. de Lima**, una vez por semana.
- **Cuando entran datos nuevos**: push a `main` que toque
  `data/tierra-films-lima-retail-2026.json` o `data/drive-snapshot.json`, y solo si cambiaron las
  cifras del mes desde el ultimo envio (se compara una huella guardada en `data/alertas-envios.json`).
- A mano: `Actions > Alerta semanal de Google Ads > Run workflow`, con «Simulación» para no enviar y
  «Reenviar» para mandarla aunque ya haya salido esa semana.
- En local, sin enviar nada: `node scripts/alertas.js --preview correo.html` escribe el correo en un
  archivo y `node scripts/alertas.js --dry-run` muestra a quien iria.

El correo lee la data del repo y, si existe, le mezcla `data/drive-snapshot.json` con el mismo
`merge()` del tablero (`js/drive-sync.js`), asi que muestra los mismos numeros que la pagina.

**Puesta en marcha** (una vez): ejecutar `instalar()` en el Web App de
`apps-script/alertas-destinatarios.gs`, implementarlo como aplicacion web con acceso «Cualquier
persona» y crear los secrets:

| Secret | Para que |
| --- | --- |
| `TF_ALERTAS_URL`, `TF_ALERTAS_TOKEN` | la lista de correos que se edita en el tablero (build y alerta) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | cuenta alertas@limaretail.com del hosting, que tambien es el remitente |
| `RESEND_API_KEY` | alternativa si no hay SMTP |
| variable `DASHBOARD_URL` | opcional, si el enlace del correo debe ser otro que el de `data/alertas-config.json` |

## Publicacion en tierrafilms.limaretail.com (GitHub Pages)

URL publica: **https://tierrafilms.limaretail.com**. Cada push a `main` la actualiza sola
(`.github/workflows/deploy-pages.yml`, Actions > Publicar en GitHub Pages); no hay que tocar el DNS.

- Pages publica con Actions (sube `dist/`): en **Settings > Pages > Build and deployment > Source** tiene que
  decir **GitHub Actions**, no "Deploy from a branch". Con Actions el dominio propio se configura en
  **Settings > Pages > Custom domain** y queda guardado en el repo; ademas `CNAME` (raiz) lleva el dominio y
  `build.js` lo copia a `dist/`, igual que en los demas tableros de la agencia.
- **Clave:** Pages no tiene Basic Auth, asi que `scripts/build.js` cifra el tablero completo (datos y JS) con
  AES-256-GCM y una llave PBKDF2-SHA256 (600 000 iteraciones) derivada del secret **`TF_PAGE_PASSWORD`**
  (Settings > Secrets and variables > Actions). `deploy/pages-gate.html` pide la clave y lo descifra en el
  navegador; sin ella el HTML publicado no revela nada. Si falta el secret, o si `dist/index.html` sale sin
  cifrar, el workflow falla en vez de publicar. Es el mismo esquema y diseno que Aquarius y Hers.
- Es una sola clave compartida. Como el HTML cifrado es publico, se puede atacar sin limite de intentos: usar
  una clave larga y aleatoria (16+ caracteres). Para cambiarla: editar el secret `TF_PAGE_PASSWORD` y volver a
  ejecutar el workflow (Actions > Publicar en GitHub Pages > Run workflow).
- Tras entrar, la llave (no la clave) queda en `sessionStorage` de esa pestana; con "Recordar en este equipo"
  tambien en `localStorage`. La sal es fija por marca, asi que sirve entre deploys hasta que cambie la clave.
- El repo es publico: lo que esta en `data/`, `js/drive-sync.js` y el historial de git (que incluye la clave
  vieja del login) sigue visible en GitHub aunque el sitio vaya con clave.
