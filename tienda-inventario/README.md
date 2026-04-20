# Gestión de Inventario - Tienda de Productos Electrónicos

## Descripción
Aplicación CRUD para gestionar el inventario de productos electrónicos utilizando Node.js, Express, MySQL y un frontend con HTML/CSS/JavaScript.

## Tecnologías Utilizadas
- **Backend**: Node.js con Express
- **Base de Datos**: MySQL
- **Frontend**: HTML, CSS, JavaScript (Fetch API)

## Instalación y Configuración

### Prerrequisitos
- Node.js instalado
- MySQL instalado y corriendo
- Git instalado

### Pasos de Instalación

1. **Clonar o descargar el proyecto**
   ```bash
   git clone <url-del-repositorio>
   cd tienda-inventario
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Configurar la base de datos**
   - Abrir MySQL Workbench o la línea de comandos de MySQL
   - Ejecutar el script `db.sql` para crear la base de datos y tabla

4. **Ejecutar la aplicación**
   ```bash
   npm start
   ```
   La aplicación estará disponible en `http://localhost:3000`

## Funcionalidades
- **Crear**: Agregar nuevos productos con nombre, precio y cantidad
- **Leer**: Ver todos los productos en una tabla
- **Actualizar**: Editar la información de productos existentes
- **Eliminar**: Remover productos del inventario

## Estructura del Proyecto
```
tienda-inventario/
├── server.js          # Servidor Express y API
├── db.sql             # Script de creación de base de datos
├── package.json       # Dependencias del proyecto
├── public/
│   ├── index.html     # Página principal
│   ├── styles.css     # Estilos CSS
│   └── app.js         # Lógica del frontend
└── README.md          # Este archivo
```

## API Endpoints
- `GET /productos` - Obtener todos los productos
- `POST /productos` - Crear un nuevo producto
- `PUT /productos/:id` - Actualizar un producto
- `DELETE /productos/:id` - Eliminar un producto

## Control de Versiones con Git/GitHub

### Instrucciones para Trabajo Colaborativo

1. **Inicializar repositorio Git**
   ```bash
   git init
   git add .
   git commit -m "Initial commit: CRUD application setup"
   ```

2. **Crear repositorio en GitHub**
   - Ir a GitHub.com y crear un nuevo repositorio
   - Conectar el repositorio local con GitHub
   ```bash
   git remote add origin <url-del-repositorio>
   git push -u origin main
   ```

3. **Flujo de trabajo colaborativo**
   - Crear una rama para nuevas funcionalidades
   ```bash
   git checkout -b feature/nueva-funcionalidad
   ```
   - Hacer commits de cambios
   ```bash
   git add .
   git commit -m "Descripción del cambio"
   ```
   - Push a la rama
   ```bash
   git push origin feature/nueva-funcionalidad
   ```
   - Crear Pull Request en GitHub
   - Revisar y merge

## Evaluación Académica

Esta tarea evalúa:
- Implementación correcta de operaciones CRUD
- Conexión y manejo de base de datos MySQL
- Desarrollo de API REST con Express
- Interfaz de usuario funcional con JavaScript
- Uso adecuado de control de versiones Git/GitHub
- Documentación del proyecto

## Autor
Estudiante del curso PIAD-527_FULLSTACK DEVELOPER SOFTWARE