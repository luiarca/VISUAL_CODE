# DATASTORE S.A.C. - Página web

Esta versión es una **página web**, no necesita Python.

## Archivos

- `index.html` → estructura de la página.
- `style.css` → diseño y estilos.
- `app.js` → lógica, procesamiento del CSV, filtros, KPI, tablas y gráficos.

## Cómo usarla

1. Abre `index.html` en Google Chrome, Edge o Firefox.
2. En la barra izquierda pulsa **Cargar ventas.csv**.
3. Selecciona el CSV entregado por el docente.
4. El sistema detectará las columnas:
   - Fecha
   - Producto
   - Categoría
   - Cantidad
   - Venta/Importe
   - Ciudad/Sede
5. Usa los filtros y las secciones del menú.

## Librerías

La página usa:
- Chart.js para los gráficos.
- Papa Parse para leer el CSV.

Ambas se cargan desde CDN, por lo que se necesita Internet al abrir la página.

## Nota

Los nombres de columnas se detectan automáticamente usando varias alternativas. Si tu CSV utiliza nombres muy diferentes, hay que adaptar el objeto `aliases` del archivo `app.js`.
