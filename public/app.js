// Configuración de la API
const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:3000/api' 
    : '/api';

// Estado global
const state = {
    rows: [],
    filtered: [],
    charts: {},
    mapping: {},
    headers: [],
    isLoading: false,
    dataLoaded: false
};

// Meses
const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

// Funciones de utilidad
function normalizeString(str) {
    return String(str || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function formatMoney(value) {
    return 'S/ ' + Number(value).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatNumber(value) {
    return Number(value).toLocaleString('es-PE');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Funciones para el DOM
function setElement(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
}

function showError(message, details = '') {
    const errorDiv = document.getElementById('errorMessage');
    if (errorDiv) {
        errorDiv.textContent = message + (details ? ': ' + details : '');
        errorDiv.style.display = 'block';
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 8000);
    } else {
        alert(message + (details ? '\n' + details : ''));
    }
}

function showLoading(show) {
    state.isLoading = show;
    const loader = document.getElementById('loadingIndicator');
    if (loader) {
        loader.style.display = show ? 'flex' : 'none';
    }
}

// Funciones de API
async function uploadCSV(file) {
    showLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        const response = await fetch(`${API_URL}/upload`, {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            let errorMessage = result.error || 'Error al procesar el archivo';
            if (result.missingColumns) {
                errorMessage += `\nColumnas faltantes: ${result.missingColumns.join(', ')}`;
                errorMessage += `\nColumnas encontradas: ${result.availableHeaders.join(', ')}`;
            }
            showError(errorMessage);
            showLoading(false);
            return false;
        }
        
        if (result.success) {
            document.getElementById('fileStatus').textContent = `✅ ${file.name} - ${result.summary.totalRecords} registros`;
            state.dataLoaded = true;
            
            // Cargar datos y filtros
            await loadFilters();
            await loadData();
            await updateDashboard();
            
            showLoading(false);
            return true;
        }
    } catch (error) {
        console.error('Error upload:', error);
        showError('Error de conexión con el servidor', error.message);
        showLoading(false);
        return false;
    }
}

async function loadFilters() {
    try {
        const response = await fetch(`${API_URL}/filters`);
        const result = await response.json();
        
        if (result.success) {
            const yearSelect = document.getElementById('yearFilter');
            const locationSelect = document.getElementById('locationFilter');
            
            // Años
            yearSelect.innerHTML = '<option value="all">Todos</option>';
            result.years.forEach(year => {
                yearSelect.innerHTML += `<option value="${year}">${year}</option>`;
            });
            
            // Ubicaciones
            locationSelect.innerHTML = '<option value="all">Todos</option>';
            result.locations.forEach(loc => {
                locationSelect.innerHTML += `<option value="${escapeHtml(loc)}">${escapeHtml(loc)}</option>`;
            });
        }
    } catch (error) {
        console.error('Error loading filters:', error);
        showError('Error al cargar los filtros');
    }
}

async function loadData() {
    const year = document.getElementById('yearFilter').value;
    const month = document.getElementById('monthFilter').value;
    const location = document.getElementById('locationFilter').value;
    
    try {
        const params = new URLSearchParams({ year, month, location });
        const response = await fetch(`${API_URL}/data?${params}`);
        const result = await response.json();
        
        if (result.success) {
            state.rows = result.data;
            state.filtered = result.data;
            return result.data;
        }
    } catch (error) {
        console.error('Error loading data:', error);
        showError('Error al cargar los datos');
        return [];
    }
}

async function loadAnalytics() {
    const year = document.getElementById('yearFilter').value;
    const month = document.getElementById('monthFilter').value;
    const location = document.getElementById('locationFilter').value;
    
    try {
        const params = new URLSearchParams({ year, month, location });
        const response = await fetch(`${API_URL}/analytics?${params}`);
        const result = await response.json();
        
        if (result.success) {
            return result.data;
        } else {
            if (result.message) {
                showError(result.message);
            }
            return null;
        }
    } catch (error) {
        console.error('Error loading analytics:', error);
        showError('Error al cargar las analíticas');
        return null;
    }
}

// Funciones de gráficos
function destroyCharts() {
    Object.values(state.charts).forEach(chart => {
        if (chart && typeof chart.destroy === 'function') {
            chart.destroy();
        }
    });
    state.charts = {};
}

function createChart(canvasId, type, labels, data, label, options = {}) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    
    const ctx = canvas.getContext('2d');
    
    // Configuración de colores
    const colors = ['#1769ff', '#6c4cff', '#19a974', '#f59e0b', '#8b95a8', '#e65f8a', '#00a8cc', '#ff6b6b', '#20c997', '#6f42c1'];
    
    const defaultOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: type === 'doughnut' || type === 'pie',
                position: 'bottom'
            },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        let label = context.dataset.label || '';
                        let value = context.parsed.y !== undefined ? context.parsed.y : context.parsed;
                        if (typeof value === 'number') {
                            if (label.toLowerCase().includes('venta') || label.includes('S/')) {
                                value = formatMoney(value);
                            } else {
                                value = formatNumber(value);
                            }
                        }
                        return label + ': ' + value;
                    }
                }
            }
        },
        scales: type === 'doughnut' || type === 'pie' ? {} : {
            y: {
                beginAtZero: true,
                ticks: {
                    callback: function(value) {
                        if (typeof value === 'number') {
                            if (value > 1000) {
                                return 'S/ ' + formatNumber(value);
                            }
                            return value;
                        }
                        return value;
                    }
                }
            }
        }
    };
    
    const chart = new Chart(ctx, {
        type: type,
        data: {
            labels: labels,
            datasets: [{
                label: label,
                data: data,
                borderWidth: 2,
                fill: type === 'line' || type === 'radar',
                tension: 0.3,
                backgroundColor: type === 'doughnut' || type === 'pie' 
                    ? colors.slice(0, data.length)
                    : colors[0] + '33',
                borderColor: colors[0],
                pointBackgroundColor: colors[0],
                pointBorderColor: '#fff',
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            ...defaultOptions,
            ...options
        }
    });
    
    state.charts[canvasId] = chart;
    return chart;
}

// Funciones de renderizado
function renderKPIs(analytics) {
    if (!analytics) return;
    
    const totalSales = analytics.totalSales || 0;
    const totalQuantity = analytics.totalQuantity || 0;
    const transactions = analytics.transactions || 0;
    const topProduct = analytics.topProduct || '—';
    const topLocation = analytics.topLocation || '—';
    
    setElement('totalSales', formatMoney(totalSales));
    setElement('transactions', formatNumber(transactions));
    setElement('productsSold', formatNumber(Math.round(totalQuantity)));
    setElement('topProduct', topProduct);
    setElement('topLocation', topLocation);
    
    // Calcular porcentajes
    if (analytics.products && analytics.products.length > 0) {
        const topProductData = analytics.products[0];
        const share = totalQuantity > 0 ? (topProductData.value / totalQuantity) * 100 : 0;
        setElement('topProductShare', share.toFixed(1) + '% de unidades');
    }
    
    if (analytics.locations && analytics.locations.length > 0) {
        const topLocationData = analytics.locations[0];
        const share = totalSales > 0 ? (topLocationData.value / totalSales) * 100 : 0;
        setElement('topLocationShare', share.toFixed(1) + '% de ventas');
    }
}

function renderCharts(analytics) {
    if (!analytics) return;
    
    destroyCharts();
    
    // Ventas mensuales
    if (analytics.monthly && analytics.monthly.length > 0) {
        createChart('monthlyChart', 'line', 
            analytics.monthly.map(m => m.label),
            analytics.monthly.map(m => m.value),
            'Ventas (S/)',
            { plugins: { legend: { display: false } } }
        );
    }
    
    // Ventas por categoría
    if (analytics.categories && analytics.categories.length > 0) {
        createChart('categoryChart', 'bar',
            analytics.categories.map(c => c.label),
            analytics.categories.map(c => c.value),
            'Ventas (S/)',
            { plugins: { legend: { display: false } } }
        );
    }
    
    // Top productos
    if (analytics.products && analytics.products.length > 0) {
        const topProducts = analytics.products.slice(0, 10);
        createChart('topProductsChart', 'bar',
            topProducts.map(p => p.label),
            topProducts.map(p => p.value),
            'Unidades',
            { 
                indexAxis: 'y',
                plugins: { legend: { display: false } }
            }
        );
        
        // Bottom productos
        const bottomProducts = [...analytics.products].reverse().slice(0, 10);
        createChart('bottomProductsChart', 'bar',
            bottomProducts.map(p => p.label),
            bottomProducts.map(p => p.value),
            'Unidades',
            { 
                indexAxis: 'y',
                plugins: { legend: { display: false } }
            }
        );
    }
    
    // Ventas por sede
    if (analytics.locations && analytics.locations.length > 0) {
        createChart('locationChart', 'bar',
            analytics.locations.map(l => l.label),
            analytics.locations.map(l => l.value),
            'Ventas (S/)',
            { plugins: { legend: { display: false } } }
        );
        
        createChart('locationCompareChart', 'bar',
            analytics.locations.map(l => l.label),
            analytics.locations.map(l => l.value),
            'Ventas (S/)',
            { plugins: { legend: { display: false } } }
        );
    }
    
    // Distribución por categoría (doughnut)
    if (analytics.categories && analytics.categories.length > 0) {
        createChart('categoryQuantityChart', 'doughnut',
            analytics.categories.map(c => c.label),
            analytics.categories.map(c => c.value),
            'Ventas'
        );
    }
    
    // Evolución mensual
    if (analytics.monthly && analytics.monthly.length > 0) {
        createChart('evolutionChart', 'line',
            analytics.monthly.map(m => m.label),
            analytics.monthly.map(m => m.value),
            'Ventas (S/)',
            { 
                plugins: { legend: { display: false } },
                fill: true
            }
        );
    }
}

function renderTables(analytics) {
    if (!analytics) return;
    
    // Tabla de resumen
    const summaryData = [
        ['Total de ventas', formatMoney(analytics.totalSales || 0)],
        ['Transacciones', formatNumber(analytics.transactions || 0)],
        ['Productos vendidos', formatNumber(Math.round(analytics.totalQuantity || 0))],
        ['Promedio de venta', formatMoney(analytics.averageSale || 0)]
    ];
    document.getElementById('summaryTable').innerHTML = createTable(['Indicador', 'Resultado'], summaryData);
    
    // Top 5 productos
    if (analytics.products && analytics.products.length > 0) {
        const top5 = analytics.products.slice(0, 5);
        const totalQty = analytics.totalQuantity || 1;
        const top5Data = top5.map(p => [
            escapeHtml(p.label),
            formatNumber(p.value),
            ((p.value / totalQty) * 100).toFixed(1) + '%'
        ]);
        document.getElementById('topFiveTable').innerHTML = createTable(['Producto', 'Unidades', '%'], top5Data);
    }
    
    // Ventas por período
    if (analytics.monthly && analytics.monthly.length > 0) {
        const periodData = analytics.monthly.map(m => [m.label, formatMoney(m.value)]);
        document.getElementById('periodTable').innerHTML = createTable(['Mes', 'Ventas'], periodData);
    }
    
    // Ventas por categoría
    if (analytics.categories && analytics.categories.length > 0) {
        const categoryData = analytics.categories.map(c => [escapeHtml(c.label), formatMoney(c.value)]);
        document.getElementById('categoryTable').innerHTML = createTable(['Categoría', 'Ventas'], categoryData);
    }
    
    // Top productos (detallado)
    if (analytics.products && analytics.products.length > 0) {
        const topProductsData = analytics.products.slice(0, 15).map(p => [escapeHtml(p.label), formatNumber(p.value)]);
        document.getElementById('productsTopTable').innerHTML = createTable(['Producto', 'Unidades'], topProductsData);
        
        const bottomProductsData = [...analytics.products].reverse().slice(0, 15).map(p => [escapeHtml(p.label), formatNumber(p.value)]);
        document.getElementById('productsBottomTable').innerHTML = createTable(['Producto', 'Unidades'], bottomProductsData);
    }
    
    // Ventas por sede
    if (analytics.locations && analytics.locations.length > 0) {
        const locationData = analytics.locations.map(l => [escapeHtml(l.label), formatMoney(l.value)]);
        document.getElementById('locationsTable').innerHTML = createTable(['Sede / Ciudad', 'Ventas'], locationData);
    }
}

function createTable(headers, rows) {
    if (!rows || rows.length === 0) {
        return '<div class="empty">No hay datos disponibles</div>';
    }
    
    return `
        <div class="table-wrap">
            <table class="data-table">
                <thead>
                    <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
                </thead>
                <tbody>
                    ${rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function renderAnalysis(analytics) {
    if (!analytics) return;
    
    const totalSales = analytics.totalSales || 0;
    const topProduct = analytics.products?.[0];
    const topCategory = analytics.categories?.[0];
    const topLocation = analytics.locations?.[0];
    const bestMonth = analytics.monthly?.reduce((best, current) => 
        current.value > best.value ? current : best, 
        { value: 0, label: 'N/A' }
    );
    
    const cards = [
        {
            title: 'Producto con mayor demanda',
            result: `${topProduct?.label || 'N/D'} concentra la mayor cantidad de unidades vendidas.`,
            interpretation: 'Es el producto con mayor demanda y presenta riesgo de desabastecimiento si no se controla su inventario.',
            decision: 'Se recomienda revisar su stock y mantener seguimiento de la demanda.'
        },
        {
            title: 'Categoría líder',
            result: `${topCategory?.label || 'N/D'} registra las mayores ventas monetarias (${formatMoney(topCategory?.value || 0)}).`,
            interpretation: 'La categoría concentra el mayor valor comercial y tiene un impacto importante en los ingresos.',
            decision: 'Conviene priorizar inventario y acciones comerciales para esta categoría.'
        },
        {
            title: 'Período de mayor venta',
            result: `${bestMonth?.label || 'N/D'} presenta el mayor nivel de ventas dentro de los datos filtrados.`,
            interpretation: 'El comportamiento observado permite anticipar períodos de alta demanda.',
            decision: 'La empresa puede preparar inventario y campañas antes de los períodos de alta demanda.'
        },
        {
            title: 'Sede líder',
            result: `${topLocation?.label || 'N/D'} concentra la mayor facturación (${formatMoney(topLocation?.value || 0)}).`,
            interpretation: 'La sede puede servir como referencia para comparar prácticas comerciales y operativas.',
            decision: 'Analizar sus buenas prácticas y compararlas con sedes de menor rendimiento.'
        },
        {
            title: 'Resultado general',
            result: `El conjunto analizado representa ${formatMoney(totalSales)} en ventas.`,
            interpretation: 'Este valor resume el rendimiento del período seleccionado y permite establecer una línea base.',
            decision: 'Utilizar este resultado como línea base para comparar períodos futuros.'
        }
    ];
    
    document.getElementById('analysisCards').innerHTML = cards.map((card, index) => `
        <article class="insight">
            <h3>Análisis ${index + 1}: ${card.title}</h3>
            <p><b>Resultado:</b> ${card.result}</p>
            <p><b>Interpretación:</b> ${card.interpretation}</p>
            <p><b>Decisión propuesta:</b> ${card.decision}</p>
        </article>
    `).join('');
}

// Función principal de actualización
async function updateDashboard() {
    showLoading(true);
    
    try {
        const analytics = await loadAnalytics();
        
        if (!analytics) {
            showLoading(false);
            return;
        }
        
        // Verificar si hay datos
        if (state.rows.length === 0) {
            document.getElementById('fileStatus').textContent = '⚠️ No hay datos para mostrar';
            showLoading(false);
            return;
        }
        
        // Renderizar todo
        renderKPIs(analytics);
        renderCharts(analytics);
        renderTables(analytics);
        renderAnalysis(analytics);
        
        document.getElementById('fileStatus').textContent = `✅ ${state.rows.length} registros cargados`;
        
    } catch (error) {
        console.error('Error updating dashboard:', error);
        showError('Error al actualizar el dashboard');
    }
    
    showLoading(false);
}

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    // Subida de archivos
    document.getElementById('csvFile').addEventListener('change', async function(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        // Validar extensión
        if (!file.name.toLowerCase().endsWith('.csv')) {
            showError('El archivo debe ser CSV');
            this.value = '';
            return;
        }
        
        const success = await uploadCSV(file);
        if (!success) {
            this.value = '';
        }
    });
    
    // Botón de aplicar filtros
    document.getElementById('applyFilters').addEventListener('click', async function() {
        if (!state.dataLoaded) {
            showError('Primero debes cargar un archivo CSV');
            return;
        }
        await loadData();
        await updateDashboard();
    });
    
    // Navegación
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.nav-item').forEach(x => x.classList.remove('active'));
            document.querySelectorAll('.section').forEach(x => x.classList.remove('active-section'));
            this.classList.add('active');
            document.getElementById(this.dataset.section).classList.add('active-section');
        });
    });
    
    // Descarga de reporte
    document.getElementById('downloadReport').addEventListener('click', function() {
        if (!state.dataLoaded || state.rows.length === 0) {
            showError('Primero debes cargar datos');
            return;
        }
        
        const headers = ['Fecha', 'Producto', 'Categoría', 'Cantidad', 'Ventas', 'Sede'];
        const rows = state.rows.map(r => [
            r.date.toISOString().slice(0, 10),
            r.product,
            r.category,
            r.quantity,
            r.amount,
            r.location
        ]);
        
        let csv = headers.join(',') + '\n';
        rows.forEach(row => {
            csv += row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',') + '\n';
        });
        
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reporte_datastore_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    });
});

// Exponer funciones para debugging
window.debug = {
    state,
    uploadCSV,
    loadData,
    loadAnalytics,
    updateDashboard
};