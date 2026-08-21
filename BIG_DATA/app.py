from __future__ import annotations

from pathlib import Path

import pandas as pd
import plotly.express as px
import streamlit as st

DATA_PATH = Path(__file__).resolve().parent / "ventas.csv"


@st.cache_data
def load_data(uploaded_file=None):
    source = uploaded_file if uploaded_file is not None else DATA_PATH
    df = pd.read_csv(source, encoding="utf-8-sig")

    if "Fecha" in df.columns:
        df["Fecha"] = pd.to_datetime(df["Fecha"], format="%d/%m/%Y", errors="coerce")

    numeric_columns = ["Cantidad", "Precio"]
    for col in numeric_columns:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    df = df.dropna(subset=["Fecha", "Producto", "Categoría", "Cantidad", "Precio", "Ciudad"]).copy()
    df["Monto"] = df["Cantidad"] * df["Precio"]
    df["Mes"] = df["Fecha"].dt.to_period("M").astype(str)
    df["MesNombre"] = df["Fecha"].dt.strftime("%b %Y")
    return df


def calculate_summary(df: pd.DataFrame) -> dict:
    total_ventas = float(df["Monto"].sum())
    transacciones = int(len(df))
    productos_vendidos = int(df["Cantidad"].sum())
    promedio_venta = float(total_ventas / transacciones) if transacciones else 0

    producto_mas_vendido = (
        df.groupby("Producto", as_index=False)["Cantidad"].sum().sort_values("Cantidad", ascending=False).iloc[0]
    )
    producto_menos_vendido = (
        df.groupby("Producto", as_index=False)["Cantidad"].sum().sort_values("Cantidad", ascending=True).iloc[0]
    )
    categoria_mayor_venta = (
        df.groupby("Categoría", as_index=False)["Monto"].sum().sort_values("Monto", ascending=False).iloc[0]
    )
    mes_mayor_venta = (
        df.groupby("Mes", as_index=False)["Monto"].sum().sort_values("Monto", ascending=False).iloc[0]
    )
    sede_mas_productiva = (
        df.groupby("Ciudad", as_index=False)["Monto"].sum().sort_values("Monto", ascending=False).iloc[0]
    )

    return {
        "total_ventas": total_ventas,
        "transacciones": transacciones,
        "productos_vendidos": productos_vendidos,
        "promedio_venta": promedio_venta,
        "producto_mas_vendido": producto_mas_vendido,
        "producto_menos_vendido": producto_menos_vendido,
        "categoria_mayor_venta": categoria_mayor_venta,
        "mes_mayor_venta": mes_mayor_venta,
        "sede_mas_productiva": sede_mas_productiva,
    }


def build_kpis(summary: dict):
    st.markdown("### KPIs principales")
    col1, col2, col3, col4 = st.columns(4)
    col1.metric("Total de ventas", f"S/ {summary['total_ventas']:,.2f}")
    col2.metric("Transacciones", f"{summary['transacciones']:,}")
    col3.metric("Productos vendidos", f"{summary['productos_vendidos']:,}")
    col4.metric("Promedio de venta", f"S/ {summary['promedio_venta']:,.2f}")

    col5, col6, col7, col8 = st.columns(4)
    col5.metric("Producto más vendido", summary["producto_mas_vendido"]["Producto"])
    col6.metric("Producto menos vendido", summary["producto_menos_vendido"]["Producto"])
    col7.metric("Categoría mayor venta", summary["categoria_mayor_venta"]["Categoría"])
    col8.metric("Sede más productiva", summary["sede_mas_productiva"]["Ciudad"])


def show_business_questions(df: pd.DataFrame, summary: dict):
    top_product = summary["producto_mas_vendido"]
    top_category = summary["categoria_mayor_venta"]
    top_city = summary["sede_mas_productiva"]
    low_product = summary["producto_menos_vendido"]

    questions = [
        {
            "Pregunta": "¿Qué producto debería recibir mayor stock?",
            "Resultado": f"{top_product['Producto']} vendió {top_product['Cantidad']:,} unidades.",
            "Interpretación": "Es el producto con mayor demanda, por lo que representa la línea con mejor potencial de ventas y un mayor riesgo de desabastecimiento.",
            "Decisión": "Aumentar el stock y reforzar la disponibilidad del producto para sostener la demanda y evitar pérdidas de venta.",
        },
        {
            "Pregunta": "¿Qué categoría genera mayores ingresos?",
            "Resultado": f"{top_category['Categoría']} generó S/ {top_category['Monto']:,.2f}.",
            "Interpretación": "Esta categoría concentra mayor valor comercial y cada nueva promoción puede tener un impacto significativo en los ingresos.",
            "Decisión": "Asignar más inversión en marketing, exhibición y distribución para esta categoría.",
        },
        {
            "Pregunta": "¿Qué sede tiene mejor rendimiento?",
            "Resultado": f"{top_city['Ciudad']} registró ventas por S/ {top_city['Monto']:,.2f}.",
            "Interpretación": "La sede lidera la operación y puede ser usada como referencia para replicar prácticas exitosas en otras ciudades.",
            "Decisión": "Comparar estrategias de ventas, promociones y logística de esta sede para mejorar las demás ubicaciones.",
        },
        {
            "Pregunta": "¿Qué producto requiere una estrategia de promoción?",
            "Resultado": f"{low_product['Producto']} vendió {low_product['Cantidad']:,} unidades.",
            "Interpretación": "Aunque no es el producto de mayor demanda, puede requerir campañas especiales para recuperar interés del cliente.",
            "Decisión": "Aplicar descuentos, bundles o promociones para mejorar su rotación y reducir inventario ocioso.",
        },
    ]

    st.markdown("### Análisis empresarial: RESULTADO → INTERPRETACIÓN → DECISIÓN")
    for item in questions:
        st.markdown(f"**Pregunta:** {item['Pregunta']}")
        st.markdown(f"- **Resultado:** {item['Resultado']}")
        st.markdown(f"- **Interpretación:** {item['Interpretación']}")
        st.markdown(f"- **Decisión propuesta:** {item['Decisión']}")
        st.markdown("---")


def plot_sales_by_month(df: pd.DataFrame):
    monthly = df.groupby("Mes", as_index=False)["Monto"].sum().sort_values("Mes")
    monthly["MesLabel"] = pd.to_datetime(monthly["Mes"]).dt.strftime("%b %Y")
    fig = px.bar(monthly, x="MesLabel", y="Monto", title="Ventas por mes")
    fig.update_layout(xaxis_title="Mes", yaxis_title="Ventas (S/)")
    return fig


def plot_sales_by_category(df: pd.DataFrame):
    category = df.groupby("Categoría", as_index=False)["Monto"].sum().sort_values("Monto", ascending=False)
    fig = px.bar(category, x="Categoría", y="Monto", color="Categoría", title="Ventas por categoría")
    fig.update_layout(xaxis_title="Categoría", yaxis_title="Ventas (S/)")
    return fig


def plot_top_products(df: pd.DataFrame):
    products = df.groupby("Producto", as_index=False)["Cantidad"].sum().sort_values("Cantidad", ascending=False).head(10)
    fig = px.bar(products, x="Producto", y="Cantidad", title="Productos más vendidos")
    fig.update_layout(xaxis_title="Producto", yaxis_title="Unidades vendidas")
    return fig


def plot_lowest_products(df: pd.DataFrame):
    products = df.groupby("Producto", as_index=False)["Cantidad"].sum().sort_values("Cantidad", ascending=True).head(10)
    fig = px.bar(products, x="Producto", y="Cantidad", title="Productos menos vendidos")
    fig.update_layout(xaxis_title="Producto", yaxis_title="Unidades vendidas")
    return fig


def plot_city_sales(df: pd.DataFrame):
    cities = df.groupby("Ciudad", as_index=False)["Monto"].sum().sort_values("Monto", ascending=False)
    fig = px.bar(cities, x="Ciudad", y="Monto", color="Ciudad", title="Ventas por sede o ciudad")
    fig.update_layout(xaxis_title="Ciudad", yaxis_title="Ventas (S/)")
    return fig


def plot_evolution(df: pd.DataFrame):
    evolution = df.groupby("Fecha", as_index=False)["Monto"].sum().sort_values("Fecha")
    fig = px.line(evolution, x="Fecha", y="Monto", title="Evolución de las ventas")
    fig.update_layout(xaxis_title="Fecha", yaxis_title="Ventas (S/)")
    return fig


def plot_quantity_by_category(df: pd.DataFrame):
    category_qty = df.groupby("Categoría", as_index=False)["Cantidad"].sum().sort_values("Cantidad", ascending=False)
    fig = px.bar(category_qty, x="Categoría", y="Cantidad", color="Categoría", title="Cantidad de productos vendidos por categoría")
    fig.update_layout(xaxis_title="Categoría", yaxis_title="Unidades vendidas")
    return fig


def plot_city_comparison(df: pd.DataFrame):
    comparison = df.groupby("Ciudad", as_index=False)["Monto"].sum().sort_values("Monto", ascending=False)
    fig = px.pie(comparison, names="Ciudad", values="Monto", title="Participación de ventas por sede")
    return fig


def run_dashboard():
    st.set_page_config(page_title="Dashboard Big Data - DATASTORE", layout="wide")
    st.title("Dashboard empresarial de análisis de ventas")
    st.caption("DATASTORE S.A.C. - Análisis de Big Data para la toma de decisiones")

    uploaded_file = st.sidebar.file_uploader("Cargar archivo CSV de ventas", type=["csv"])
    df = load_data(uploaded_file)

    st.sidebar.markdown("### Fundamentos del Big Data")
    st.sidebar.markdown("- Volumen: cantidad masiva de registros")
    st.sidebar.markdown("- Velocidad: generación continua de ventas")
    st.sidebar.markdown("- Variedad: productos, ciudades, categorías y precios")
    st.sidebar.markdown("- Veracidad: validación de datos y limpieza")
    st.sidebar.markdown("- Valor: decisiones basadas en información")

    summary = calculate_summary(df)
    build_kpis(summary)

    with st.expander("Información del conjunto de datos", expanded=False):
        st.dataframe(df.head(10), use_container_width=True)

    st.markdown("### 5V del Big Data aplicado al caso")
    st.markdown(
        f"**Volumen:** {len(df):,} registros de ventas históricos.  \n"
        "**Velocidad:** las transacciones se procesan de manera continua desde el sistema de ventas.  \n"
        "**Variedad:** se combinan categorías, productos, precios, ciudades y fechas.  \n"
        "**Veracidad:** se validan fechas, cantidades y precios antes del análisis.  \n"
        "**Valor:** los datos permiten identificar tendencias, oportunidades y riesgos para la operación.",
        unsafe_allow_html=False,
    )

    st.markdown("### Visualización de resultados")
    charts = {
        "Ventas por mes": plot_sales_by_month(df),
        "Ventas por categoría": plot_sales_by_category(df),
        "Productos más vendidos": plot_top_products(df),
        "Productos menos vendidos": plot_lowest_products(df),
        "Ventas por ciudad o sede": plot_city_sales(df),
        "Evolución de las ventas": plot_evolution(df),
        "Cantidad de productos vendidos por categoría": plot_quantity_by_category(df),
        "Comparación de ventas entre sedes": plot_city_comparison(df),
    }

    for index, (title, fig) in enumerate(charts.items()):
        if index % 2 == 0:
            cols = st.columns(2)
            cols[0].plotly_chart(fig, use_container_width=True)
            if index + 1 < len(charts):
                _, next_fig = list(charts.items())[index + 1]
                cols[1].plotly_chart(next_fig, use_container_width=True)

    st.markdown("### Reporte de análisis")
    st.write(
        f"El total de ventas del periodo es S/ {summary['total_ventas']:,.2f}. "
        f"Se registraron {summary['transacciones']:,} transacciones y {summary['productos_vendidos']:,} unidades vendidas. "
        f"El producto con mayor demanda es {summary['producto_mas_vendido']['Producto']} con {summary['producto_mas_vendido']['Cantidad']:,} unidades. "
        f"La categoría más rentable es {summary['categoria_mayor_venta']['Categoría']} y la sede más productiva es {summary['sede_mas_productiva']['Ciudad']}."
    )

    show_business_questions(df, summary)


if __name__ == "__main__":
    run_dashboard()
