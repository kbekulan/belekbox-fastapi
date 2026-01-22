// Конфигурация
const CONFIG = {
    whatsappNumber: '+996501053515',
    defaultTitle: 'Подарочные боксы на 23 февраля 🎁',
    api: {
        products: '/api/products',
        orders: '/api/orders'
    }
};

// State (состояние приложения)
let cart = JSON.parse(localStorage.getItem('cart')) || [];
let seasonTitle = localStorage.getItem('season_title') || CONFIG.defaultTitle;

// DOM элементы
const DOM = {
    productsGrid: document.getElementById('productsGrid'),
    cartCount: document.querySelector('.cart-count'),
    cartItems: document.getElementById('cartItems'),
    cartTotal: document.getElementById('cartTotal'),
    cartModal: document.getElementById('cartModal'),
    seasonTitle: document.getElementById('seasonTitle'),
    clientPhone: document.getElementById('clientPhone'),
    clientComment: document.getElementById('clientComment'),
    imageModal: document.getElementById('imageModal'),
    fullSizeImage: document.getElementById('fullSizeImage')
};

// Функции для работы с корзиной
function updateCartCount() {
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    DOM.cartCount.textContent = totalItems;
}

function saveCart() {
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartCount();
    renderCartItems();
}

function addToCart(product) {
    const existingItem = cart.find(item => item.id === product.id);
    
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({
            id: product.id,
            name: product.name,
            price: product.price,
            quantity: 1
        });
    }
    
    saveCart();
    showNotification('Товар добавлен в корзину!');
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    saveCart();
}

function updateQuantity(productId, newQuantity) {
    if (newQuantity < 1) {
        removeFromCart(productId);
        return;
    }
    
    const item = cart.find(item => item.id === productId);
    if (item) {
        item.quantity = newQuantity;
        saveCart();
    }
}

function calculateTotal() {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
}

// Рендер товаров
function renderProducts(products) {
    const grid = DOM.productsGrid;
    
    if (!products || products.length === 0) {
        grid.innerHTML = '<div class="no-products">Товаров пока нет. Загляните позже!</div>';
        return;
    }
    
    grid.innerHTML = products.map(product => `
        <div class="product-card">
            <img src="${product.image_url || 'https://via.placeholder.com/400x400/059669/FFFFFF?text=BelekBox'}" 
                 alt="${product.name}" 
                 class="product-image"
                 onclick="openImageModal('${product.image_url || ''}')"
                 onerror="this.src='https://via.placeholder.com/400x400/059669/FFFFFF?text=BelekBox'">
            <div class="product-info">
                <h3 class="product-name">${product.name}</h3>
                <p class="product-description">${product.description}</p>
                <div class="product-price">${product.price} сом</div>
                <button class="add-to-cart-btn" onclick="addToCart(${JSON.stringify(product).replace(/"/g, '&quot;')})">
                    Добавить в корзину
                </button>
            </div>
        </div>
    `).join('');
}

// Рендер корзины
function renderCartItems() {
    const container = DOM.cartItems;
    const totalElement = DOM.cartTotal;
    
    if (cart.length === 0) {
        container.innerHTML = '<div class="empty-cart">Корзина пуста</div>';
        totalElement.textContent = 'Итого: 0 сом';
        return;
    }
    
    container.innerHTML = cart.map(item => `
        <div class="cart-item">
            <div class="cart-item-info">
                <div class="cart-item-name">${item.name}</div>
                <div class="cart-item-price">${item.price} сом/шт</div>
            </div>
            <div class="cart-item-controls">
                <button class="quantity-btn" onclick="updateQuantity(${item.id}, ${item.quantity - 1})">-</button>
                <span class="cart-item-quantity">${item.quantity}</span>
                <button class="quantity-btn" onclick="updateQuantity(${item.id}, ${item.quantity + 1})">+</button>
                <button class="remove-item" onclick="removeFromCart(${item.id})">Удалить</button>
            </div>
        </div>
    `).join('');
    
    totalElement.textContent = `Итого: ${calculateTotal()} сом`;
}

// Модальное окно корзины
function openCartModal() {
    DOM.cartModal.style.display = 'flex';
    renderCartItems();
}

function closeCartModal() {
    DOM.cartModal.style.display = 'none';
}

// Модальное окно для фото
function openImageModal(imageUrl) {
    if (!imageUrl || imageUrl === 'null' || imageUrl === 'undefined') return;
    
    DOM.fullSizeImage.src = imageUrl;
    DOM.imageModal.style.display = 'flex';
}

function closeImageModal() {
    DOM.imageModal.style.display = 'none';
}

// Заказ через WhatsApp
async function checkout() {
    if (cart.length === 0) {
        showNotification('Добавьте товары в корзину');
        return;
    }
    
    const clientPhone = DOM.clientPhone.value;
    const clientComment = DOM.clientComment.value;
    const totalAmount = calculateTotal();
    
    try {
        const response = await fetch(CONFIG.api.orders, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                items: JSON.stringify(cart),
                total_amount: totalAmount,
                client_phone: clientPhone || '',
                client_comment: clientComment || ''
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Очищаем корзину
            cart = [];
            saveCart();
            closeCartModal();
            
            // Открываем WhatsApp
            window.open(result.whatsapp_url, '_blank');
            
            showNotification('Заказ оформлен! Откройте WhatsApp для отправки.');
        } else {
            showNotification('Ошибка при оформлении заказа');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        showNotification('Ошибка при оформлении заказа');
    }
}

// Toast уведомления
function showNotification(message) {
    // Удаляем старый toast если есть
    const oldToast = document.querySelector('.toast');
    if (oldToast) {
        oldToast.remove();
    }
    
    // Создаем новый toast
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    // Автоматически удаляем через 3 секунды
    setTimeout(() => {
        if (toast.parentNode) {
            toast.remove();
        }
    }, 3000);
}

// Загрузка товаров при загрузке страницы
async function loadProducts() {
    try {
        const response = await fetch(CONFIG.api.products);
        const products = await response.json();
        renderProducts(products);
    } catch (error) {
        console.error('Ошибка загрузки товаров:', error);
        DOM.productsGrid.innerHTML = '<div class="error">Не удалось загрузить товары</div>';
    }
}

// Загрузка сезонного заголовка
function loadSeasonTitle() {
    const savedTitle = localStorage.getItem('season_title');
    if (savedTitle) {
        seasonTitle = savedTitle;
    }
    DOM.seasonTitle.textContent = seasonTitle;
}

// Функция для изменения заголовка
function setSeasonTitle(newTitle) {
    seasonTitle = newTitle;
    DOM.seasonTitle.textContent = seasonTitle;
    localStorage.setItem('season_title', newTitle);
}

// Закрытие модальных окон при клике вне их
DOM.cartModal.addEventListener('click', function(e) {
    if (e.target === this) {
        closeCartModal();
    }
});

DOM.imageModal.addEventListener('click', function(e) {
    if (e.target === this || e.target.classList.contains('modal') || e.target.classList.contains('close-modal')) {
        closeImageModal();
    }
});

// Закрытие модального окна фото по клавише ESC
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeImageModal();
    }
});

// Инициализация
document.addEventListener('DOMContentLoaded', function() {
    updateCartCount();
    loadProducts();
    loadSeasonTitle();
});