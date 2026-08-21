const express = require('express');
const cors = require('cors');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Configuración de multer para subida de archivos
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, `ventas_${Date.now()}.csv`);
    }
});

const upload = multer({ 
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten archivos CSV'));
        }
    },
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// Almacenamiento en memoria de los datos procesados
let salesData = [];
let columnMapping = {};

// Aliases para detección de columnas
const COLUMN_ALIASES = {
    date: ['fecha', 'date', 'fecha venta', 'fecha_venta', 'datetime', 'fecha de venta'],
    product: ['producto', 'product', 'nombre producto', 'nombre_producto', 'articulo', 'artículo', 'product name'],
    category: ['categoria', 'categoría', 'category', 'tipo', 'linea', 'línea', 'familia', 'categoría de producto'],
    quantity: ['cantidad', 'quantity', 'unidades', 'units', 'cantidad vendida', 'cantidad_vendida', 'qty', 'cantidad de unidades'],
    amount: ['venta', 'ventas', 'importe', 'monto', 'total', 'precio total', 'precio_total', 'amount', 'sales', 'valor venta', 'valor_venta', 'precio', 'price', 'total venta'],
    location: ['ciudad', 'city', 'sede', 'sede ciudad', 'sede_ciudad', 'local', 'ubicacion', 'ubicación', 'location', 'ciudad/sede']
};

// Funciones de utilidad
function normalizeString(str) {
    return String(str || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

function parseNumber(value) {
    if (value === null || value === undefined || value === '') return 0;
    if (typeof value === 'number') return value;
    
    let str = String(value).trim().replace(/S\/|S\\|\$|\s/g, '');
    
    // Manejo de formatos de números
    if (str.includes(',') && str.includes('.')) {
        if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
            str = str.replace(/\./g, '').replace(',', '.');
        } else {
            str = str.replace(/,/g, '');
        }
    } else if (str.includes(',')) {
        const parts = str.split(',');
        if (parts[parts.length - 1].length <= 2) {
            str = parts.slice(0, -1).join('') + '.' + parts[parts.length - 1];
        } else {
            str = str.replace(/,/g, '');
        }
    }
    
    const num = Number(str);
    return isNaN(num) ? 0 : num;
}

function parseDate(value) {
    const str = String(value || '').trim();
    if (!str) return null;
    
    // Intentar parsear como fecha ISO
    let date = new Date(str);
    if (!isNaN(date)) return date;
    
    // Intentar formatos comunes
    const patterns = [
        /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/,
        /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/
    ];
    
    for (const pattern of patterns) {
        const match = str.match(pattern);
        if (match) {
            if (pattern === patterns[0]) {
                return new Date(+match[3], +match[2] - 1, +match[1]);
            } else {
                return new Date(+match[1], +match[2] - 1, +match[3]);
            }
        }
    }
    
    return null;
}

function detectColumn(headers, key) {
    const normalizedHeaders = headers.map(h => ({ raw: h, normalized: normalizeString(h) }));
    const aliases = COLUMN_ALIASES[key] || [];
    
    // Búsqueda exacta
    for (const alias of aliases) {
        const normalizedAlias = normalizeString(alias);
        const found = normalizedHeaders.find(h => h.normalized === normalizedAlias);
        if (found) return found.raw;
    }
    
    // Búsqueda parcial
    for (const alias of aliases) {
        const normalizedAlias = normalizeString(alias);
        const found = normalizedHeaders.find(h => 
            h.normalized.includes(normalizedAlias) || 
            normalizedAlias.includes(h.normalized)
        );
        if (found) return found.raw;
    }
    
    return null;
}

// Endpoints
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.post('/api/upload', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No se recibió ningún archivo' });
        }

        const results = [];
        const filePath = req.file.path;
        const headers = [];

        fs.createReadStream(filePath)
            .pipe(csv())
            .on('headers', (headerList) => {
                headers.push(...headerList);
            })
            .on('data', (data) => {
                results.push(data);
            })
            .on('end', () => {
                // Detectar columnas
                const mapping = {};
                const requiredColumns = ['date', 'product', 'category', 'quantity', 'amount', 'location'];
                const missingColumns = [];
                
                for (const key of requiredColumns) {
                    const detected = detectColumn(headers, key);
                    mapping[key] = detected;
                    if (!detected) {
                        missingColumns.push(key);
                    }
                }
                
                if (missingColumns.length > 0) {
                    // Limpiar archivo temporal
                    fs.unlinkSync(filePath);
                    return res.status(400).json({
                        error: 'Columnas no encontradas',
                        missingColumns,
                        availableHeaders: headers,
                        message: `No se pudieron detectar las siguientes columnas: ${missingColumns.join(', ')}`
                    });
                }
                
                // Procesar datos
                const processedData = results.map(row => {
                    const date = parseDate(row[mapping.date]);
                    const quantity = parseNumber(row[mapping.quantity]);
                    const amount = parseNumber(row[mapping.amount]);
                    
                    return {
                        date: date,
                        product: String(row[mapping.product] || 'Sin producto'),
                        category: String(row[mapping.category] || 'Sin categoría'),
                        quantity: quantity,
                        amount: amount,
                        location: String(row[mapping.location] || 'Sin sede')
                    };
                }).filter(row => row.date && !isNaN(row.date));
                
                if (processedData.length === 0) {
                    return res.status(400).json({
                        error: 'No se pudieron procesar datos válidos',
                        message: 'El archivo no contiene datos válidos para el análisis'
                    });
                }
                
                // Guardar en memoria
                salesData = processedData;
                columnMapping = mapping;
                
                // Limpiar archivo temporal
                fs.unlinkSync(filePath);
                
                // Resumen de datos
                const summary = {
                    totalRecords: processedData.length,
                    totalSales: processedData.reduce((sum, row) => sum + row.amount, 0),
                    totalQuantity: processedData.reduce((sum, row) => sum + row.quantity, 0),
                    uniqueProducts: new Set(processedData.map(row => row.product)).size,
                    uniqueLocations: new Set(processedData.map(row => row.location)).size,
                    uniqueCategories: new Set(processedData.map(row => row.category)).size,
                    dateRange: {
                        start: processedData[0]?.date,
                        end: processedData[processedData.length - 1]?.date
                    },
                    columnMapping: mapping
                };
                
                res.json({
                    success: true,
                    summary,
                    message: `Se procesaron ${processedData.length} registros correctamente`
                });
            })
            .on('error', (error) => {
                fs.unlinkSync(filePath);
                res.status(500).json({ error: 'Error procesando CSV', details: error.message });
            });
            
    } catch (error) {
        res.status(500).json({ error: 'Error en el servidor', details: error.message });
    }
});

app.get('/api/data', (req, res) => {
    try {
        const { year, month, location } = req.query;
        let filteredData = [...salesData];
        
        // Aplicar filtros
        if (year && year !== 'all') {
            filteredData = filteredData.filter(row => row.date.getFullYear() === parseInt(year));
        }
        
        if (month && month !== 'all') {
            filteredData = filteredData.filter(row => row.date.getMonth() + 1 === parseInt(month));
        }
        
        if (location && location !== 'all') {
            filteredData = filteredData.filter(row => row.location === location);
        }
        
        res.json({
            success: true,
            data: filteredData,
            totalRecords: filteredData.length,
            filters: { year, month, location }
        });
    } catch (error) {
        res.status(500).json({ error: 'Error obteniendo datos', details: error.message });
    }
});

app.get('/api/analytics', (req, res) => {
    try {
        const { year, month, location } = req.query;
        let filteredData = [...salesData];
        
        // Aplicar filtros
        if (year && year !== 'all') {
            filteredData = filteredData.filter(row => row.date.getFullYear() === parseInt(year));
        }
        
        if (month && month !== 'all') {
            filteredData = filteredData.filter(row => row.date.getMonth() + 1 === parseInt(month));
        }
        
        if (location && location !== 'all') {
            filteredData = filteredData.filter(row => row.location === location);
        }
        
        if (filteredData.length === 0) {
            return res.json({ success: true, data: [], message: 'No hay datos para los filtros seleccionados' });
        }
        
        // Agrupar por categoría
        const categoryMap = new Map();
        const productMap = new Map();
        const locationMap = new Map();
        const monthlyMap = new Map();
        
        for (const row of filteredData) {
            // Categorías
            categoryMap.set(row.category, (categoryMap.get(row.category) || 0) + row.amount);
            
            // Productos
            productMap.set(row.product, (productMap.get(row.product) || 0) + row.quantity);
            
            // Sedes
            locationMap.set(row.location, (locationMap.get(row.location) || 0) + row.amount);
            
            // Mensual
            const monthKey = row.date.getMonth();
            monthlyMap.set(monthKey, (monthlyMap.get(monthKey) || 0) + row.amount);
        }
        
        const analytics = {
            totalSales: filteredData.reduce((sum, row) => sum + row.amount, 0),
            totalQuantity: filteredData.reduce((sum, row) => sum + row.quantity, 0),
            transactions: filteredData.length,
            averageSale: filteredData.reduce((sum, row) => sum + row.amount, 0) / filteredData.length,
            
            categories: Array.from(categoryMap.entries())
                .map(([label, value]) => ({ label, value }))
                .sort((a, b) => b.value - a.value),
            
            products: Array.from(productMap.entries())
                .map(([label, value]) => ({ label, value }))
                .sort((a, b) => b.value - a.value),
            
            locations: Array.from(locationMap.entries())
                .map(([label, value]) => ({ label, value }))
                .sort((a, b) => b.value - a.value),
            
            monthly: Array.from({ length: 12 }, (_, i) => ({
                label: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'][i],
                value: monthlyMap.get(i) || 0
            })),
            
            topProduct: Array.from(productMap.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 1)[0]?.[0] || 'N/A',
            
            topLocation: Array.from(locationMap.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 1)[0]?.[0] || 'N/A'
        };
        
        res.json({ success: true, data: analytics });
    } catch (error) {
        res.status(500).json({ error: 'Error generando analíticas', details: error.message });
    }
});

app.get('/api/filters', (req, res) => {
    try {
        if (salesData.length === 0) {
            return res.json({ 
                success: true, 
                years: [], 
                locations: [],
                message: 'No hay datos cargados'
            });
        }
        
        const years = [...new Set(salesData.map(row => row.date.getFullYear()))].sort();
        const locations = [...new Set(salesData.map(row => row.location))].sort();
        
        res.json({ success: true, years, locations });
    } catch (error) {
        res.status(500).json({ error: 'Error obteniendo filtros', details: error.message });
    }
});

app.delete('/api/data', (req, res) => {
    try {
        salesData = [];
        columnMapping = {};
        res.json({ success: true, message: 'Datos eliminados correctamente' });
    } catch (error) {
        res.status(500).json({ error: 'Error eliminando datos', details: error.message });
    }
});

// Manejo de errores global
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Error interno del servidor' });
});

app.listen(PORT, () => {
    console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
    console.log('DATASTORE S.A.C. Dashboard API');
});