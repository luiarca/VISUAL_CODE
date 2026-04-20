const API_URL = 'http://localhost:3000/productos';

// Cargar productos al iniciar
document.addEventListener('DOMContentLoaded', loadProducts);

// Manejar el formulario de agregar producto
document.getElementById('productForm').addEventListener('submit', addProduct);

// Función para cargar productos
async function loadProducts() {
    try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error('Server error');
        const products = await response.json();
        displayProducts(products);
    } catch (error) {
        console.error('Error cargando productos:', error);
        alert('Error conectando al servidor. Verifique que esté corriendo.');
    }
}

// Función para mostrar productos en la tabla
function displayProducts(products) {
    const tbody = document.getElementById('productsBody');
    tbody.innerHTML = '';

    products.forEach(product => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${product.id}</td>
            <td><span class="product-name">${product.nombre}</span></td>
            <td><span class="product-price">$${parseFloat(product.precio).toFixed(2)}</span></td>
            <td><span class="product-quantity">${product.cantidad}</span></td>
            <td>
                <button class="edit-btn" onclick="editProduct(${product.id})">Editar</button>
                <button class="delete-btn" onclick="deleteProduct(${product.id})">Eliminar</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Función para agregar producto
async function addProduct(event) {
    event.preventDefault();
    
    const nombre = document.getElementById('nombre').value.trim();
    const precio = parseFloat(document.getElementById('precio').value);
    const cantidad = parseInt(document.getElementById('cantidad').value);

    if (!nombre || precio <= 0 || cantidad < 0 || nombre.length < 2) {
        alert('Datos inválidos: nombre (mín 2 chars), precio y cantidad > 0');
        return;
    }

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ nombre, precio, cantidad })
        });

        if (response.ok) {
            document.getElementById('productForm').reset();
            loadProducts();
            alert('Producto agregado exitosamente');
        } else {
            const err = await response.json();
            alert('Error: ' + (err.error || 'No se pudo agregar'));
        }
    } catch (error) {
        alert('Error de conexión');
        console.error('Error:', error);
    }
}

// Función para editar producto (robust, no global event)
function editProduct(id) {
    const row = event.target.closest('tr');
    const nameCell = row.cells[1];
    const priceCell = row.cells[2];
    const quantityCell = row.cells[3];
    const actionsCell = row.cells[4];

    // Guardar originales
    row.dataset.originalName = nameCell.textContent.trim();
    row.dataset.originalPrice = priceCell.textContent.replace('$', '').trim();
    row.dataset.originalQuantity = quantityCell.textContent.trim();

    // Modo edit
    nameCell.innerHTML = `<input type="text" value="${row.dataset.originalName}" class="edit-input">`;
    priceCell.innerHTML = `<input type="number" step="0.01" value="${row.dataset.originalPrice}" class="edit-input">`;
    quantityCell.innerHTML = `<input type="number" value="${row.dataset.originalQuantity}" class="edit-input">`;
    actionsCell.innerHTML = `
        <button class="save-btn" onclick="saveProduct(${id})">Guardar</button>
        <button class="cancel-btn" onclick="cancelEdit(this.closest('tr'))">Cancelar</button>
    `;
}

// Función para guardar cambios
async function saveProduct(id) {
    const row = event.target.closest('tr');
    const nameInput = row.cells[1].querySelector('input');
    const priceInput = row.cells[2].querySelector('input');
    const quantityInput = row.cells[3].querySelector('input');

    const nombre = nameInput.value.trim();
    const precio = parseFloat(priceInput.value);
    const cantidad = parseInt(quantityInput.value);

    if (!nombre || precio <= 0 || cantidad < 0) {
        alert('Datos inválidos');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, precio, cantidad })
        });

        if (response.ok) {
            alert('Actualizado');
            loadProducts();
        } else {
            const err = await response.json();
            alert('Error: ' + err.error);
        }
    } catch (error) {
        alert('Error de conexión');
    }
}

// Cancelar edición
function cancelEdit(row) {
    loadProducts();
}

// Eliminar
async function deleteProduct(id) {
    if (confirm('¿Eliminar este producto?')) {
        try {
            const response = await fetch(`${API_URL}/${id}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                loadProducts();
                alert('Eliminado');
            } else {
                const err = await response.json();
                alert('Error: ' + err.error);
            }
        } catch (error) {
            alert('Error de conexión');
        }
    }
}

