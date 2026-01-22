// static/js/admin.js

// ===== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ =====
let adminToken = null;

// ===== АУТЕНТИФИКАЦИЯ =====

/**
 * Авторизует пользователя в админке
 */
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
            if (errorElement) {
                errorElement.style.display = 'block';
            }
        }
    } catch (error) {
        console.error('Ошибка входа:', error);
        if (errorElement) {
            errorElement.style.display = 'block';
        }
    }
}

/**
 * Выход из админки
 */
function logout() {
    adminToken = null;
    localStorage.removeItem('admin_token');
    document.getElementById('loginScreen').style.display = 'block';
    document.getElementById('adminScreen').style.display = 'none';
    const passwordInput = document.getElementById('password');
    if (passwordInput) {
        passwordInput.value = '';
    }
}

// ===== УТИЛИТЫ =====

/**
 * Возвращает заголовки для авторизованных запросов
 * @returns {Object} Заголовки с токеном авторизации
 */
function getAuthHeaders() {
    return {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
    };
}

// ===== ВКЛАДКИ =====

/**
 * Переключает между вкладками админки
 * @param {string} tabName - Имя вкладки (products, orders, settings)
 */
function showTab(tabName) {
    // Скрыть все вкладки
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Показать выбранную
    const section = document.getElementById(tabName + 'Section');
    const clickedTab = event.target;
    
    if (section) section.classList.add('active');
    if (clickedTab) clickedTab.classList.add('active');
}

// ===== ТОВАРЫ =====

/**
 * Загружает товары для админки
 */
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

/**
 * Отображает товары в таблице админки
 * @param {Array} products - Массив товаров
 */
function renderProducts(products) {
    const tbody = document.querySelector('#productsTable tbody');
    if (!tbody) return;
    
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

// ===== ЗАКАЗЫ =====

/**
 * Загружает заказы для админки
 */
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

/**
 * Отображает заказы в таблице админки
 * @param {Array} orders - Массив заказов
 */
function renderOrders(orders) {
    const tbody = document.querySelector('#ordersTable tbody');
    if (!tbody) return;
    
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

/**
 * Показывает/скрывает детали заказа
 * @param {number} orderId - ID заказа
 */
function showOrderDetails(orderId) {
    const details = document.getElementById(`orderDetails${orderId}`);
    if (details) {
        details.style.display = details.style.display === 'none' ? 'block' : 'none';
    }
}

// ===== БЫСТРЫЕ ДЕЙСТВИЯ =====

/**
 * Скрывает все товары (для смены сезона)
 */
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

/**
 * Показывает все товары
 */
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

// ===== МОДАЛЬНОЕ ОКНО ТОВАРА =====

/**
 * Показывает модальное окно для добавления товара
 */
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

/**
 * Загружает данные товара для редактирования
 * @param {number} productId - ID товара
 */
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
        
        const imagePreview = document.getElementById('imagePreview');
        if (product.image_url && imagePreview) {
            imagePreview.src = product.image_url;
            imagePreview.style.display = 'block';
        } else if (imagePreview) {
            imagePreview.style.display = 'none';
        }
        
        document.getElementById('productModal').style.display = 'flex';
    } catch (error) {
        console.error('Ошибка загрузки товара:', error);
    }
}

/**
 * Закрывает модальное окно товара
 */
function closeProductModal() {
    document.getElementById('productModal').style.display = 'none';
}

/**
 * Сохраняет товар (добавление или редактирование)
 * @param {Event} event - Событие отправки формы
 */
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
    if (imageInput && imageInput.files[0]) {
        formData.append('image', imageInput.files[0]);
    }
    
    try {
        let response;
        let url;
        
        if (isEdit) {
            url = `/api/admin/products/${productId}`;
            response = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${adminToken}`
                },
                body: formData
            });
        } else {
            url = '/api/admin/products';
            response = await fetch(url, {
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

/**
 * Удаляет товар
 * @param {number} productId - ID товара
 */
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

// ===== ИНИЦИАЛИЗАЦИЯ =====

/**
 * Проверяет авторизацию при загрузке страницы
 */
function checkAuthOnLoad() {
    const savedToken = localStorage.getItem('admin_token');
    if (savedToken) {
        adminToken = savedToken;
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('adminScreen').style.display = 'block';
        loadProducts();
        loadOrders();
    }
}

/**
 * Настраивает обработчик для превью изображения
 */
function setupImagePreview() {
    const imageInput = document.getElementById('productImage');
    if (imageInput) {
        imageInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            const imagePreview = document.getElementById('imagePreview');
            
            if (file && imagePreview) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    imagePreview.src = e.target.result;
                    imagePreview.style.display = 'block';
                };
                reader.readAsDataURL(file);
            }
        });
    }
}

/**
 * Настраивает обработчики событий для модальных окон
 */
function setupModalEventListeners() {
    const productModal = document.getElementById('productModal');
    if (productModal) {
        productModal.addEventListener('click', function(e) {
            if (e.target === this) {
                closeProductModal();
            }
        });
    }
}

// Экспортируем функции в глобальную область видимости
window.login = login;
window.logout = logout;
window.showTab = showTab;
window.showAddProductModal = showAddProductModal;
window.editProduct = editProduct;
window.closeProductModal = closeProductModal;
window.saveProduct = saveProduct;
window.deleteProduct = deleteProduct;
window.showOrderDetails = showOrderDetails;
window.hideAllProducts = hideAllProducts;
window.showAllProducts = showAllProducts;

// Запуск при загрузке DOM
document.addEventListener('DOMContentLoaded', function() {
    checkAuthOnLoad();
    setupImagePreview();
    setupModalEventListeners();
});