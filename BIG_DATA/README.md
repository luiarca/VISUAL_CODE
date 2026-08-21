# Dashboard de análisis de Big Data para DATASTORE S.A.C.

Este proyecto desarrolla una aplicación web con Python y Streamlit para procesar un conjunto de ventas históricas, calcular KPIs, generar gráficos estadísticos y apoyar la toma de decisiones empresariales.

## Objetivo

Aplicar los conceptos fundamentales de Big Data usando datos reales de ventas para transformar información en decisiones operativas y estratégicas.

## Fundamentos de Big Data

### 5V del Big Data

- Volumen: el sistema maneja miles de transacciones y registros históricos.
- Velocidad: los datos se generan y procesan de manera continua.
- Variedad: los datos incluyen productos, categorías, fechas, precios y ciudades.
- Veracidad: la validación y limpieza ayudan a garantizar la calidad de la información.
- Valor: el análisis permite identificar patrones, oportunidades y riesgos del negocio.

## Fuentes de datos

La fuente principal es un archivo CSV generado por un sistema empresarial de ventas. El dataset almacena registros con fecha, producto, categoría, cantidad, precio y ciudad.

## Cómo ejecutar la aplicación

1. Crear un entorno virtual.
2. Instalar dependencias.
3. Ejecutar Streamlit.

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
streamlit run app.py
```

## Estructura del proyecto

- `app.py`: lógica principal del dashboard y análisis estadístico.
- `ventas.csv`: archivo de ventas utilizado por la aplicación.
- `requirements.txt`: dependencias del proyecto.

## Decisiones que soporta la aplicación

- Aumentar el stock de los productos más demandados.
- Redireccionar inversión a categorías con mayor margen.
- Evaluar rendimiento por sede.
- Diseñar promociones para productos de baja rotación.

## Importancia del análisis de datos

La aplicación muestra que los datos por sí mismos no tienen valor; la verdadera utilidad está en la información que se obtiene al procesarlos, interpretarlos y convertirlos en decisiones. Esta lógica es central en el enfoque de Big Data aplicado a la empresa.
