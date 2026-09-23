# Tierra Films | Dashboard Lima Retail 2026

Dashboard de Google Ads para Tierra Films, adaptado desde la arquitectura de los
paneles de Amador y Aquarius.

## Acceso

- Entrada local: `index.html`
- Build publicado: `dist/index.html`, en el hosting de Lima Retail (ver abajo).
- No hay contraseña en el HTML: el acceso lo controla el servidor con HTTP Basic Auth.

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

El resultado se genera en `dist/`: `index.html` (CSS, JS y datos incrustados), `assets/` y `.htaccess`.
Nada mas: `data/` (incluido `data/csv-backups`), `scripts/` y el resto del repo nunca se publican.

## Publicacion en el hosting de Lima Retail

El acceso lo controla Apache con HTTP Basic Auth (una cuenta por cliente). No hay contraseña en el HTML.
`dist/.htaccess` se genera desde `deploy/.htaccess` con la ruta del archivo de claves y una CSP con el hash de cada script.

Configuracion unica en cPanel:

1. **Dominios** > activar **Forzar redireccion HTTPS** para el dominio o subdominio del cliente.
2. **Privacidad de directorios** > carpeta del cliente > activar proteccion y crear el usuario del cliente
   con una contraseña larga y aleatoria. cPanel crea el archivo de claves en
   `/home/<usuario_cpanel>/.htpasswds/<ruta_de_la_carpeta>/passwd`.
3. En GitHub > Settings > Secrets and variables > Actions, crear:
   - `HTPASSWD_PATH`: la ruta absoluta del paso 2.
   - `FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD`: una cuenta FTP limitada a la carpeta del cliente.
   - `FTP_SERVER_DIR`: carpeta destino relativa a esa cuenta, terminada en `/` (por ejemplo `./`).
4. Desactivar GitHub Pages (Settings > Pages) y dejar el repositorio en privado: los datos del cliente no deben quedar publicos.

Cada push a `main` ejecuta `.github/workflows/deploy-hosting.yml`, que compila y sube `dist/` por FTPS.
Si falta `HTPASSWD_PATH` el build falla; si la ruta es incorrecta Apache responde 500 en vez de mostrar el tablero sin clave.
