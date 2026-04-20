const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Configuración de la base de datos
const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456789',
  database: process.env.DB_NAME || 'tienda_inventario',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Conectar a la base de datos
// Pool auto-connects, test on first query

// Rutas CRUD

// Obtener todos los productos
app.get('/productos', (req, res) => {
  db.execute('SELECT * FROM productos ORDER BY id DESC', (err, results) => {
    if (err) {
      console.error('Query error:', err);
      res.status(500).json({ error: 'Error fetching products' });
      return;
    }
    res.json(results);
  });
});

// Crear un nuevo producto
app.post('/productos', (req, res) => {
  const { nombre, precio, cantidad } = req.body;
  if (!nombre || precio <= 0 || cantidad < 0 || nombre.length < 2) {
    return res.status(400).json({ error: 'Invalid data: nombre (min 2 chars), precio/cantidad >0' });
  }
  db.execute('INSERT INTO productos (nombre, precio, cantidad) VALUES (?, ?, ?)', [nombre, precio, cantidad], (err, result) => {
    if (err) {
      console.error('Insert error:', err);
      res.status(500).json({ error: 'Database error' });
      return;
    }
    res.status(201).json({ id: result.insertId, nombre, precio, cantidad });
  });
});

// Actualizar un producto
app.put('/productos/:id', (req, res) => {
  const { id } = req.params;
  const { nombre, precio, cantidad } = req.body;
  if (!nombre || precio <= 0 || cantidad < 0 || nombre.length < 2 || isNaN(id)) {
    return res.status(400).json({ error: 'Invalid data or ID' });
  }
  db.execute('UPDATE productos SET nombre = ?, precio = ?, cantidad = ? WHERE id = ?', [nombre, precio, cantidad, id], (err, result) => {
    if (err) {
      console.error('Update error:', err);
      res.status(500).json({ error: 'Database error' });
      return;
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json({ message: 'Producto actualizado' });
  });
});

// Eliminar un producto
app.delete('/productos/:id', (req, res) => {
  const { id } = req.params;
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid ID' });
  }
  db.execute('DELETE FROM productos WHERE id = ?', [id], (err, result) => {
    if (err) {
      console.error('Delete error:', err);
      res.status(500).json({ error: 'Database error' });
      return;
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json({ message: 'Producto eliminado' });
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

const serverPort = process.env.PORT || 3000;
app.listen(serverPort, () => {
  console.log(`Servidor corriendo en http://localhost:${serverPort}`);
});
