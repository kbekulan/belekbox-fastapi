    <script>
        let adminToken = null;

        // Аутентификация
        async function login() {
            const password = document.getElementById('password').value;
            const errorElement = document.getElementById('loginError');
            
            try {
                const response = await fetch('/api/admin/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ password })
                });   
                
                const result = await response.json();
                
                if (result.success) {
                    adminToken = result.token;
                    localStorage.setItem('admin_token', adminToken);
                    document.getElementById('loginScreen').style.display = 'none';
                    document.getElementById('adminScreen').style.display = 'block';
                    loadProducts();
                    loadOrders();
                } else {
                    errorElement.style.display = 'block';
                }
            } catch (error) {
                console.error('Ошибка входа:', error);
                errorElement.style.display = 'block';
            }
        }

        function logout() {
            adminToken = null;
            localStorage.removeItem('admin_token');
            document.getElementById('loginScreen').style.display = 'block';
            document.getElementById('adminScreen').style.display = 'none';
            document.getElementById('password').value = '';
        }

        // Проверка авторизации при загрузке
        document.addEventListener('DOMContentLoaded', function() {
            const savedToken = localStorage.getItem('admin_token');
            if (savedToken) {
                adminToken = savedToken;
                document.getElementById('loginScreen').style.display = 'none';
                document.getElementById('adminScreen').style.display = 'block';
                loadProducts();
                loadOrders();
            }
        });

        // Заголовки для авторизованных запросов
        function getAuthHeaders() {
            return {
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
            };
        }

        // Вкладки
        function showTab(tabName) {
            // Скрыть все вкладки
            document.querySelectorAll('.section').forEach(section => {
                section.classList.remove('active');
            });
            document.querySelectorAll('.tab').forEach(tab => {
                tab.classList.remove('active');
            });
            
            // Показать выбранную
            document.getElementById(tabName + 'Section').classList.add('active');
            event.target.classList.add('active');
        }

        // Загрузка товаров
        async function loadProducts() {
            try {
                const response = await fetch('/api/admin/products', {
                    headers: getAuthHeaders()
                });
                
                if (response.status === 401) {
                    logout();
                    return;
                }
                
                const products = await response.json();
                renderProducts(products);
            } catch (error) {
                console.error('Ошибка загрузки товаров:', error);
            }
        }

        function renderProducts(products) {
            const tbody = document.querySelector('#productsTable tbody');
            tbody.innerHTML = '';
            
            products.forEach(product => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${product.id}</td>
                    <td>
                        ${product.image_url ? 
                            `<img src="${product.image_url}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;">` : 
                            'Нет фото'}
                    </td>
                    <td>${product.name}</td>
                    <td style="max-width: 300px;">${product.description}</td>
                    <td>${product.price} сом</td>
                    <td>
                        <span class="${product.is_available ? 'status-available' : 'status-unavailable'}">
                            ${product.is_available ? 'Доступен' : 'Скрыт'}
                        </span>
                    </td>
                    <td>${product.sort_order}</td>
                    <td>
                        <div class="actions">
                            <button class="action-btn edit-btn" onclick="editProduct(${product.id})">Ред.</button>
                            <button class="action-btn delete-btn" onclick="deleteProduct(${product.id})">Уд.</button>
                        </div>
                    </td>
                `;
                tbody.appendChild(row);
            });
        }

        // Загрузка заказов
        async function loadOrders() {
            try {
                const response = await fetch('/api/admin/orders', {
                    headers: getAuthHeaders()
                });
                
                if (response.status === 401) {
                    logout();
                    return;
                }
                
                const orders = await response.json();
                renderOrders(orders);
            } catch (error) {
                console.error('Ошибка загрузки заказов:', error);
            }
        }

        function renderOrders(orders) {
            const tbody = document.querySelector('#ordersTable tbody');
            tbody.innerHTML = '';
            
            orders.forEach(order => {
                const date = new Date(order.created_at);
                const formattedDate = date.toLocaleDateString('ru-RU') + ' ' + date.toLocaleTimeString('ru-RU');
                
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${order.order_number}</td>
                    <td>${formattedDate}</td>
                    <td>
                        <button class="btn" onclick="showOrderDetails(${order.id})">Показать</button>
                        <div id="orderDetails${order.id}" style="display: none;" class="order-details">
                            ${order.items.map((item, index) => `
                                <div class="order-item">
                                    <div>${index + 1}. ${item.name}</div>
                                    <div>${item.quantity} × ${item.price} = ${item.quantity * item.price} сом</div>
                                </div>
                            `).join('')}
                            <div class="order-total">Итого: ${order.total_amount} сом</div>
                        </div>
                    </td>
                    <td>${order.total_amount} сом</td>
                    <td>${order.client_phone || '-'}</td>
                    <td>${order.client_comment || '-'}</td>
                `;
                tbody.appendChild(row);
            });
        }

        function showOrderDetails(orderId) {
            const details = document.getElementById(`orderDetails${orderId}`);
            details.style.display = details.style.display === 'none' ? 'block' : 'none';
        }

        // Быстрые действия
        async function hideAllProducts() {
            if (!confirm('Вы уверены, что хотите скрыть ВСЕ товары?')) return;
            
            try {
                const response = await fetch('/api/admin/hide-all', {
                    method: 'POST',
                    headers: getAuthHeaders()
                });
                
                if (response.ok) {
                    alert('Все товары скрыты');
                    loadProducts();
                }
            } catch (error) {
                console.error('Ошибка:', error);
                alert('Ошибка при скрытии товаров');
            }
        }

        async function showAllProducts() {
            if (!confirm('Вы уверены, что хотите показать ВСЕ товары?')) return;
            
            try {
                const response = await fetch('/api/admin/show-all', {
                    method: 'POST',
                    headers: getAuthHeaders()
                });
                
                if (response.ok) {
                    alert('Все товары теперь видны');
                    loadProducts();
                }
            } catch (error) {
                console.error('Ошибка:', error);
                alert('Ошибка при показе товаров');
            }
        }

        // Модальное окно товара
        function showAddProductModal() {
            document.getElementById('modalTitle').textContent = 'Добавить товар';
            document.getElementById('productId').value = '';
            document.getElementById('productName').value = '';
            document.getElementById('productDescription').value = '';
            document.getElementById('productPrice').value = '';
            document.getElementById('productSortOrder').value = '0';
            document.getElementById('productAvailable').value = 'true';
            document.getElementById('productImage').value = '';
            document.getElementById('imagePreview').style.display = 'none';
            
            document.getElementById('productModal').style.display = 'flex';
        }

        async function editProduct(productId) {
            try {
                const response = await fetch('/api/admin/products', {
                    headers: getAuthHeaders()
                });
                const products = await response.json();
                const product = products.find(p => p.id === productId);
                
                if (!product) {
                    alert('Товар не найден');
                    return;
                }
                
                document.getElementById('modalTitle').textContent = 'Редактировать товар';
                document.getElementById('productId').value = product.id;
                document.getElementById('productName').value = product.name;
                document.getElementById('productDescription').value = product.description;
                document.getElementById('productPrice').value = product.price;
                document.getElementById('productSortOrder').value = product.sort_order;
                document.getElementById('productAvailable').value = product.is_available.toString();
                
                if (product.image_url) {
                    document.getElementById('imagePreview').src = product.image_url;
                    document.getElementById('imagePreview').style.display = 'block';
                } else {
                    document.getElementById('imagePreview').style.display = 'none';
                }
                
                document.getElementById('productModal').style.display = 'flex';
            } catch (error) {
                console.error('Ошибка загрузки товара:', error);
            }
        }

        function closeProductModal() {
            document.getElementById('productModal').style.display = 'none';
        }

        async function saveProduct(event) {
            event.preventDefault();
            
            const productId = document.getElementById('productId').value;
            const isEdit = !!productId;
            
            const formData = new FormData();
            formData.append('name', document.getElementById('productName').value);
            formData.append('description', document.getElementById('productDescription').value);
            formData.append('price', document.getElementById('productPrice').value);
            formData.append('sort_order', document.getElementById('productSortOrder').value);
            formData.append('is_available', document.getElementById('productAvailable').value);
            
            const imageInput = document.getElementById('productImage');
            if (imageInput.files[0]) {
                formData.append('image', imageInput.files[0]);
            }
            
            try {
                let response;
                if (isEdit) {
                    response = await fetch(`/api/admin/products/${productId}`, {
                        method: 'PUT',
                        headers: {
                            'Authorization': `Bearer ${adminToken}`
                        },
                        body: formData
                    });
                } else {
                    response = await fetch('/api/admin/products', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${adminToken}`
                        },
                        body: formData
                    });
                }
                
                const result = await response.json();
                
                if (result.success) {
                    alert(isEdit ? 'Товар обновлен' : 'Товар добавлен');
                    closeProductModal();
                    loadProducts();
                } else {
                    alert('Ошибка: ' + result.error);
                }
            } catch (error) {
                console.error('Ошибка сохранения:', error);
                alert('Ошибка сохранения товара');
            }
        }

        async function deleteProduct(productId) {
            if (!confirm('Удалить этот товар? Это действие нельзя отменить.')) return;
            
            try {
                const response = await fetch(`/api/admin/products/${productId}`, {
                    method: 'DELETE',
                    headers: getAuthHeaders()
                });
                
                const result = await response.json();
                
                if (result.success) {
                    alert('Товар удален');
                    loadProducts();
                } else {
                    alert('Ошибка: ' + result.error);
                }
            } catch (error) {
                console.error('Ошибка удаления:', error);
                alert('Ошибка удаления товара');
            }
        }

        // Превью изображения
        document.getElementById('productImage').addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    document.getElementById('imagePreview').src = e.target.result;
                    document.getElementById('imagePreview').style.display = 'block';
                };
                reader.readAsDataURL(file);
            }
        });

        // Закрытие модального окна при клике вне его
        document.getElementById('productModal').addEventListener('click', function(e) {
            if (e.target === this) {
                closeProductModal();
            }
        });
    </script>