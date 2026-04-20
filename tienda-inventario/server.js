const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Configuración de MySQL
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '123456789',
    database: 'tienda_inventario'
});

// Conectar a MySQL
db.connect((err) => {
    if (err) {
        console.error('Error conectando a MySQL:', err);
        return;
    }
    console.log('Conectado a MySQL');
});

// Ruta para obtener todos los productos
app.get('/api/productos', (req, res) => {
    db.query('SELECT * FROM productos ORDER BY id DESC', (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: err.message });
        }
        res.json(results);
    });
});

// Crear un nuevo producto
app.post('/api/productos', (req, res) => {
    const { nombre, precio, stock, categoria, descripcion } = req.body;
    
    if (!nombre || nombre.length < 2) {
        return res.status(400).json({ error: 'Nombre es requerido (mínimo 2 caracteres)' });
    }
    
    const precioValido = precio && !isNaN(precio) ? parseFloat(precio) : 0;
    const stockValido = stock && !isNaN(stock) ? parseInt(stock) : 0;
    const categoriaValida = categoria || 'General';
    const descripcionValida = descripcion || '';
    
    const sql = 'INSERT INTO productos (nombre, precio, stock, categoria, descripcion) VALUES (?, ?, ?, ?, ?)';
    db.query(sql, [nombre, precioValido, stockValido, categoriaValida, descripcionValida], (err, result) => {
        if (err) {
            console.error('Insert error:', err);
            return res.status(500).json({ error: err.message });
        }
        res.status(201).json({ id: result.insertId, message: 'Producto creado' });
    });
});

// Actualizar un producto
app.put('/api/productos/:id', (req, res) => {
    const { nombre, precio, stock, categoria, descripcion } = req.body;
    const sql = 'UPDATE productos SET nombre=?, precio=?, stock=?, categoria=?, descripcion=? WHERE id=?';
    db.query(sql, [nombre, precio, stock, categoria, descripcion, req.params.id], (err) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: err.message });
        }
        res.json({ message: 'Producto actualizado' });
    });
});

// Eliminar un producto
app.delete('/api/productos/:id', (req, res) => {
    db.query('DELETE FROM productos WHERE id=?', [req.params.id], (err) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: err.message });
        }
        res.json({ message: 'Producto eliminado' });
    });
});

// ========== NUEVAS FUNCIONALIDADES ==========

// Buscar productos por nombre
app.get('/api/productos/buscar/:termino', (req, res) => {
    const termino = `%${req.params.termino}%`;
    db.query('SELECT * FROM productos WHERE nombre LIKE ? ORDER BY id DESC', [termino], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Error en la búsqueda' });
        }
        res.json(results);
    });
});

// Obtener estadísticas del inventario
app.get('/api/estadisticas', (req, res) => {
    db.query('SELECT COUNT(*) as total_productos, SUM(stock) as stock_total, AVG(precio) as precio_promedio, MAX(precio) as producto_mas_caro, MIN(precio) as producto_mas_barato FROM productos', (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Error al obtener estadísticas' });
        }
        res.json(results[0]);
    });
});

// Obtener productos agrupados por categoría
app.get('/api/productos/categorias', (req, res) => {
    db.query('SELECT categoria, COUNT(*) as cantidad, SUM(stock) as stock_total FROM productos GROUP BY categoria ORDER BY cantidad DESC', (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Error al obtener categorías' });
        }
        res.json(results);
    });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
