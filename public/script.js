document.addEventListener('DOMContentLoaded', () => {
const productIdInput = document.getElementById('productId');
const productNameInput = document.getElementById('productName');
    const productPriceInput = document.getElementById('productPrice');
    const productStockInput = document.getElementById('productStock');
    const productHistoricalDataTextarea = document.getElementById('productHistoricalData');
    const saveProductButton = document.getElementById('saveProductButton');
    const cancelEditButton = document.getElementById('cancelEditButton');
    const productsContainer = document.getElementById('productsContainer');

    const productDetailModal = document.getElementById('productDetailModal');
    const closeModalButton = document.querySelector('.close-button');
    const modalProductName = document.getElementById('modalProductName');
    const modalProductPrice = document.getElementById('modalProductPrice');
    const modalProductStock = document.getElementById('modalProductStock');
    const modalHistoricalData = document.getElementById('modalHistoricalData');
    const modalLatestPriceChangeDate = document.getElementById('modalLatestPriceChangeDate');

    // Función para cargar los productos
    async function fetchProductos() {
        try {
            const response = await fetch('/api/productos');
            const productos = await response.json();
            renderProductos(productos);
        } catch (error) {
            console.error('Error al obtener los productos:', error);
            alert('No se pudieron cargar los productos.');
        }
    }

    // Función para renderizar los productos en la UI
    function renderProductos(productos) {
        productsContainer.innerHTML = '';
        productos.forEach(product => {
            const li = document.createElement('li');
            li.setAttribute('data-id', product.id);

            li.innerHTML = `
                <span><strong>${product.nombre}</strong> - $${product.precio.toFixed(2)} (${product.stock} en stock)</span>
                <div class="actions">
                    <button class="view-button" data-id="${product.id}">Ver Detalles</button>
                    <button class="edit-button" data-id="${product.id}">Editar</button>
                    <button class="delete-button" data-id="${product.id}">Eliminar</button>
                </div>
            `;
            productsContainer.appendChild(li);
        });

        // Adjuntar event listeners a los botones recién creados
        document.querySelectorAll('.view-button').forEach(button => {
            button.addEventListener('click', (event) => viewProductDetails(event.target.dataset.id));
        });
        document.querySelectorAll('.edit-button').forEach(button => {
            button.addEventListener('click', (event) => editProduct(event.target.dataset.id));
        });
        document.querySelectorAll('.delete-button').forEach(button => {
            button.addEventListener('click', (event) => deleteProduct(event.target.dataset.id));
        });
    }

    // Función para guardar (añadir o actualizar) un producto
    saveProductButton.addEventListener('click', async () => {
        const id = productIdInput.value;
        const nombre = productNameInput.value.trim();
        const precio = parseFloat(productPriceInput.value);
        const stock = parseInt(productStockInput.value);
        const historicalData = productHistoricalDataTextarea.value.trim();

        if (!nombre || isNaN(precio) || isNaN(stock)) {
            alert('Por favor, completa todos los campos (Nombre, Precio, Stock).');
            return;
        }

        const productData = {
            nombre,
            precio,
            stock,
            historical_data: historicalData || null
        };

        try {
            let response;
            if (id) { // Es una actualización
                response = await fetch(`/api/productos/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(productData)
                });
            } else { // Es un nuevo producto
                response = await fetch('/api/productos', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(productData)
                });
            }

            if (response.ok) {
                alert(`Producto ${id ? 'actualizado' : 'añadido'} con éxito.`);
                clearForm();
                fetchProductos(); // Recargar la lista - CORREGIDO
            } else {
                const errorData = await response.json();
                alert(`Error al guardar producto: ${errorData.error}`);
            }
        } catch (error) {
            console.error('Error al guardar el producto:', error);
            alert('Ocurrió un error al guardar el producto.');
        }
    });

    // Función para editar un producto
    async function editProduct(id) {
        try {
            const response = await fetch(`/api/productos/${id}`);
            const product = await response.json();
            if (response.ok) {
                productIdInput.value = product.id;
                productNameInput.value = product.nombre;
                productPriceInput.value = product.precio;
                productStockInput.value = product.stock;
                productHistoricalDataTextarea.value = product.historical_data || '';

                saveProductButton.textContent = 'Actualizar Producto';
                cancelEditButton.style.display = 'inline-block';
            } else {
                alert(`Error al cargar producto para editar: ${product.error}`);
            }
        } catch (error) {
            console.error('Error al cargar producto para editar:', error);
            alert('Ocurrió un error al cargar el producto para edición.');
        }
    }

    // Función para cancelar la edición
    cancelEditButton.addEventListener('click', clearForm);

    function clearForm() {
        productIdInput.value = '';
        productNameInput.value = '';
        productPriceInput.value = '';
        productStockInput.value = '';
        productHistoricalDataTextarea.value = '';
        saveProductButton.textContent = 'Guardar Producto';
        cancelEditButton.style.display = 'none';
    }

    // Función para eliminar un producto
    async function deleteProduct(id) {
        if (confirm('¿Estás seguro de que quieres eliminar este producto?')) {
            try {
                const response = await fetch(`/api/productos/${id}`, {
                    method: 'DELETE'
                });
                if (response.status === 204) {
                    alert('Producto eliminado con éxito.');
                    fetchProductos(); // Recargar la lista - CORREGIDO
                } else if (response.status === 404) {
                    alert('Producto no encontrado.');
                } else {
                    const errorData = await response.json();
                    alert(`Error al eliminar producto: ${errorData.error}`);
                }
            } catch (error) {
                console.error('Error al eliminar el producto:', error);
                alert('Ocurrió un error al eliminar el producto.');
            }
        }
    }

    // Función para ver los detalles del producto en el modal
    async function viewProductDetails(id) {
        try {
            const response = await fetch(`/api/productos/${id}`);
            const product = await response.json();

            if (response.ok) {
                modalProductName.textContent = product.nombre;
                modalProductPrice.textContent = product.precio.toFixed(2);
                modalProductStock.textContent = product.stock;

                // CORREGIDO: usar historical_data_parser en lugar de historical_data_parsed
                if (product.historical_data_parser && Object.keys(product.historical_data_parser).length > 0) {
                    modalHistoricalData.textContent = JSON.stringify(product.historical_data_parser, null, 2);
                } else {
                    modalHistoricalData.textContent = 'No hay datos históricos disponibles o el XML es inválido.';
                }

                if (product.latest_price_change_date_xpath) {
                    modalLatestPriceChangeDate.textContent = product.latest_price_change_date_xpath;
                } else {
                    modalLatestPriceChangeDate.textContent = 'No se encontró la fecha del último cambio de precio con XPath.';
                }
                productDetailModal.style.display = 'flex'; // Mostrar el modal
            } else {
                alert(`Error al cargar los detalles del producto: ${product.error}`);
            }
        } catch (error) {
            console.error('Error al cargar los detalles del producto:', error);
            alert('Ocurrió un error al cargar los detalles del producto.');
        }
    }

    // Cerrar el modal
    closeModalButton.addEventListener('click', () => {
        productDetailModal.style.display = 'none';
    });

    // Cerrar el modal al hacer clic fuera de él
    window.addEventListener('click', (event) => {
        if (event.target === productDetailModal) {
            productDetailModal.style.display = 'none';
        }
    });

    // Cargar los productos al iniciar la aplicación - CORREGIDO
    fetchProductos();
});