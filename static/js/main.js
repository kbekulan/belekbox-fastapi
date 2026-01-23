// ============================================
// BelekBox.kg - Основной JavaScript файл
// Версия: 4.0.0 (Новый дизайн)
// Дата: 2024
// ============================================

// ===== КОНСТАНТЫ И КОНФИГУРАЦИЯ =====

const CONFIG = {
    CART_EXPIRY_DAYS: 7,
    PRODUCTS_CACHE_MINUTES: 5,
    PRODUCTS_CACHE_MAX_HOURS: 24,
    PHONE_PATTERNS: [
        /^\+996\d{9}$/,
        /^996\d{9}$/,
        /^0\d{9}$/,
        /^\d{9}$/
    ]
};

// ===== СОСТОЯНИЕ ПРИЛОЖЕНИЯ =====

let state = {
    cart: JSON.parse(localStorage.getItem('cart')) || [],
    cachedProducts: null,
    productsLastFetched: null,
    isCheckingOut: false,
    cartLastUpdated: localStorage.getItem('cart_last_updated'),
    currentSort: 'default',
    cartAnimationEnabled: true
};

// ===== УТИЛИТЫ =====

/**
 * Экранирует HTML-символы для безопасности
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Форматирует сумму с разделителями тысяч
 */
function formatAmount(amount) {
    return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/**
 * Показывает временное уведомление
 */
function showNotification(message, type = 'info') {
    // Удаляем старые уведомления
    document.querySelectorAll('.toast').forEach(toast => toast.remove());
    
    // Создаем новое уведомление
    const toast = document.createElement('div');
    toast.className = 'toast';
    
    const colors = {
        success: '#059669',
        error: '#DC2626',
        warning: '#D97706',
        info: '#2563EB'
    };
    
    toast.style.backgroundColor = colors[type] || colors.info;
    
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };
    
    toast.innerHTML = `
        <div class="toast-content">
            <span class="toast-icon">${icons[type] || icons.info}</span>
            <span>${escapeHtml(message)}</span>
        </div>
    `;
    
    document.body.appendChild(toast);
    
    // Автоматически удаляем через 3 секунды
    setTimeout(() => toast.remove(), 3000);
}

// ===== ВАЛИДАЦИЯ ТЕЛЕФОНА =====

function cleanPhoneNumber(phone) {
    return phone ? phone.replace(/[^\d+]/g, '') : '';
}

function validatePhoneNumber(phone) {
    if (!phone || phone.trim() === '') {
        return { isValid: true, error: null };
    }
    
    const cleanPhone = cleanPhoneNumber(phone);
    
    if (cleanPhone.length < 9) {
        return { 
            isValid: false, 
            error: 'Номер слишком короткий. Минимум 9 цифр.' 
        };
    }
    
    const isValid = CONFIG.PHONE_PATTERNS.some(pattern => pattern.test(cleanPhone));
    
    if (!isValid) {
        return { 
            isValid: false, 
            error: 'Неверный формат номера. Используйте формат Кыргызстана.' 
        };
    }
    
    return { isValid: true, error: null };
}

function formatPhoneNumber(event) {
    const input = event.target;
    let phone = cleanPhoneNumber(input.value);
    
    // Добавляем префикс при необходимости
    if (phone.startsWith('996') && !phone.startsWith('+996')) {
        phone = '+' + phone;
    } else if (phone.startsWith('0') && phone.length >= 10) {
        phone = '+996' + phone.substring(1);
    } else if (phone.length === 9 && !phone.startsWith('0')) {
        phone = '+996' + phone;
    }
    
    // Форматируем
    let formattedPhone = phone;
    if (phone.startsWith('+996') && phone.length > 4) {
        const rest = phone.substring(4);
        formattedPhone = `+996 ${rest.substring(0, 3)} ${rest.substring(3, 6)} ${rest.substring(6, 9)}`.trim();
    }
    
    if (input.value !== formattedPhone) {
        input.value = formattedPhone;
        
        // Визуальная обратная связь
        const validation = validatePhoneNumber(formattedPhone);
        input.style.borderColor = formattedPhone && !validation.isValid ? '#DC2626' : '#059669';
        
        if (validation.isValid) {
            setTimeout(() => {
                input.style.borderColor = '#E2E8F0';
            }, 1000);
        }
    }
}

// ===== ФУНКЦИИ ДЛЯ ТЕГОВ И АНИМАЦИЙ =====

// ===== ФУНКЦИИ ДЛЯ ТЕГОВ И АНИМАЦИЙ =====

/**
 * Генерирует теги для товаров
 */
function generateProductTags(product, index) {
    const tags = [];
    
    // "Новинка" - для первых 2 товаров
    if (index < 2) {
        tags.push({ text: 'Новинка', type: 'tag-new' });
    }
    
    // "Хит" - для товаров с определенными ID
    if ([1, 3, 5, 7].includes(product.id)) {
        tags.push({ text: 'Хит', type: 'tag-popular' });
    }
    
    // "Премиум" - для дорогих товаров (> 7000 сом)
    if (product.price > 7000) {
        tags.push({ text: 'Премиум', type: 'tag-special' });
    }
    
    // "Выбор покупателей" - для товаров средней цены
    if (product.price > 3000 && product.price <= 5000) {
        tags.push({ text: 'Выбор покупателей', type: 'tag-special' });
    }
    
    return tags;
}

/**
 * Создает летающий элемент при добавлении в корзину
 */
function createFlyingItem(startX, startY, endX, endY) {
    if (!state.cartAnimationEnabled) return;
    
    const item = document.createElement('div');
    item.className = 'flying-item';
    item.textContent = '🎁';
    
    // Позиционируем элемент
    item.style.left = startX + 'px';
    item.style.top = startY + 'px';
    
    // Вычисляем траекторию полета
    const x = endX - startX;
    const y = endY - startY;
    
    // Устанавливаем CSS переменные для анимации
    item.style.setProperty('--x', x + 'px');
    item.style.setProperty('--y', y + 'px');
    
    document.body.appendChild(item);
    
    // Удаляем элемент после анимации
    setTimeout(() => {
        if (item.parentNode) {
            item.parentNode.removeChild(item);
        }
    }, 800);
}

// ===== КОРЗИНА =====

function calculateTotal() {
    return state.cart.reduce((total, item) => {
        const price = Number(item.price) || 0;
        const quantity = Number(item.quantity) || 0;
        return total + (price * quantity);
    }, 0);
}

function updateCartCount() {
    try {
        const totalItems = state.cart.reduce((sum, item) => sum + item.quantity, 0);
        const cartCountElement = document.querySelector('.cart-count');
        
        if (cartCountElement) {
            cartCountElement.textContent = totalItems;
            
            // Анимация при изменении
            if (totalItems > 0) {
                cartCountElement.style.transform = 'scale(1.2)';
                setTimeout(() => {
                    cartCountElement.style.transform = 'scale(1)';
                }, 300);
            }
        }
    } catch (error) {
        console.error('Ошибка обновления счетчика корзины:', error);
    }
}

function saveCart() {
    try {
        localStorage.setItem('cart', JSON.stringify(state.cart));
        state.cartLastUpdated = new Date().toISOString();
        localStorage.setItem('cart_last_updated', state.cartLastUpdated);
        
        updateCartCount();
        renderCartItems();
    } catch (error) {
        console.error('Ошибка сохранения корзины:', error);
        showNotification('Ошибка сохранения корзины', 'error');
    }
}

/**
 * Добавление в корзину с анимацией
 */
function addToCartWithAnimation(product, button) {
    try {
        if (!product || !product.id || !product.name || product.price === undefined) {
            console.error('Неверный формат товара:', product);
            showNotification('Ошибка добавления товара', 'error');
            return;
        }
        
        // Позиция кнопки
        const buttonRect = button.getBoundingClientRect();
        const startX = buttonRect.left + buttonRect.width / 2;
        const startY = buttonRect.top + buttonRect.height / 2;
        
        // Позиция иконки корзины
        const cartIcon = document.querySelector('.cart-button');
        const cartRect = cartIcon.getBoundingClientRect();
        const endX = cartRect.left + cartRect.width / 2;
        const endY = cartRect.top + cartRect.height / 2;
        
        // Создаем летающий элемент
        createFlyingItem(startX, startY, endX, endY);
        
        // Анимация пульсации корзины
        if (cartIcon) {
            cartIcon.classList.add('cart-pulse');
            setTimeout(() => {
                cartIcon.classList.remove('cart-pulse');
            }, 500);
        }
        
        // Добавляем товар в корзину
        const existingItem = state.cart.find(item => item.id === product.id);
        
        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            state.cart.push({
                id: product.id,
                name: product.name,
                price: product.price,
                quantity: 1,
                addedAt: new Date().toISOString(),
                image_url: product.image_url
            });
        }
        
        saveCart();
        showNotification('🎁 Товар добавлен в корзину!', 'success');
        
        // Анимация кнопки
        button.style.transform = 'scale(0.95)';
        setTimeout(() => {
            button.style.transform = 'scale(1)';
        }, 200);
        
    } catch (error) {
        console.error('Ошибка добавления в корзину:', error);
        showNotification('Ошибка добавления товара', 'error');
    }
}

function removeFromCart(productId) {
    try {
        const initialLength = state.cart.length;
        state.cart = state.cart.filter(item => item.id !== productId);
        
        if (state.cart.length < initialLength) {
            saveCart();
            showNotification('Товар удален из корзины', 'info');
        }
    } catch (error) {
        console.error('Ошибка удаления из корзины:', error);
        showNotification('Ошибка удаления товара', 'error');
    }
}

function updateQuantity(productId, newQuantity) {
    try {
        if (newQuantity < 1) {
            removeFromCart(productId);
            return;
        }
        
        const maxQuantity = 99;
        if (newQuantity > maxQuantity) {
            showNotification(`Максимальное количество: ${maxQuantity}`, 'warning');
            newQuantity = maxQuantity;
        }
        
        const item = state.cart.find(item => item.id === productId);
        if (item) {
            item.quantity = newQuantity;
            saveCart();
        }
    } catch (error) {
        console.error('Ошибка обновления количества:', error);
        showNotification('Ошибка обновления количества', 'error');
    }
}

function clearCart() {
    if (state.cart.length === 0) return;
    
    if (confirm('Очистить всю корзину?')) {
        state.cart = [];
        saveCart();
        showNotification('Корзина очищена', 'info');
    }
}

function checkOldCart() {
    try {
        if (!state.cartLastUpdated || state.cart.length === 0) return;
        
        const lastDate = new Date(state.cartLastUpdated);
        const now = new Date();
        const diffDays = (now - lastDate) / (1000 * 60 * 60 * 24);
        
        if (diffDays > CONFIG.CART_EXPIRY_DAYS) {
            const message = `Ваша корзина хранится более ${CONFIG.CART_EXPIRY_DAYS} дней. Очистить?`;
            
            if (window.confirm(message)) {
                state.cart = [];
                saveCart();
                showNotification('Корзина очищена из-за истечения срока', 'info');
            }
        }
    } catch (error) {
        console.error('Ошибка проверки устаревшей корзины:', error);
    }
}

// ===== РЕНДЕР КОРЗИНЫ =====

function renderCartItems() {
    const container = document.getElementById('cartItems');
    const totalElement = document.getElementById('cartTotal');
    const checkoutBtn = document.getElementById('checkoutBtn');
    const clearCartBtn = document.getElementById('clearCartBtn');
    
    if (!container || !totalElement) return;
    
    try {
        if (state.cart.length === 0) {
            container.innerHTML = `
                <div class="empty-cart">
                    <div class="empty-icon">🛒</div>
                    <h3>Корзина пуста</h3>
                    <p>Добавьте товары из каталога</p>
                </div>
            `;
            totalElement.innerHTML = `
                <span>Итого:</span>
                <span class="total-amount">0 сом</span>
            `;
            
            if (checkoutBtn) checkoutBtn.disabled = true;
            if (clearCartBtn) clearCartBtn.style.display = 'none';
            return;
        }
        
        container.innerHTML = state.cart.map(item => `
            <div class="cart-item" data-item-id="${item.id}">
                <div class="cart-item-info">
                    <div class="cart-item-name">${escapeHtml(item.name)}</div>
                    <div class="cart-item-price">${formatAmount(item.price)} сом/шт</div>
                </div>
                <div class="cart-item-controls">
                    <button class="quantity-btn" onclick="updateQuantity(${item.id}, ${item.quantity - 1})" aria-label="Уменьшить количество">
                        −
                    </button>
                    <span class="cart-item-quantity">${item.quantity}</span>
                    <button class="quantity-btn" onclick="updateQuantity(${item.id}, ${item.quantity + 1})" aria-label="Увеличить количество">
                        +
                    </button>
                    <button class="remove-item" onclick="removeFromCart(${item.id})" aria-label="Удалить ${escapeHtml(item.name)}">
                        Удалить
                    </button>
                </div>
            </div>
        `).join('');
        
        // Показываем кнопку очистки
        if (clearCartBtn) {
            clearCartBtn.style.display = 'block';
        }
        
        const total = calculateTotal();
        totalElement.innerHTML = `
            <span>Итого:</span>
            <span class="total-amount">${formatAmount(total)} сом</span>
        `;
        
        if (checkoutBtn) checkoutBtn.disabled = false;
        
    } catch (error) {
        console.error('Ошибка отображения корзины:', error);
        container.innerHTML = `
            <div class="error" style="color: #DC2626; padding: 20px; text-align: center;">
                Ошибка загрузки корзины
            </div>
        `;
    }
}

// ===== ТОВАРЫ =====

async function loadProducts() {
    const grid = document.getElementById('productsGrid');
    if (!grid) return;
    
    // Показываем skeleton loading
    grid.innerHTML = `
        <div class="skeleton-grid">
            <div class="product-card skeleton">
                <div class="skeleton-image"></div>
                <div class="skeleton-content">
                    <div class="skeleton-text"></div>
                    <div class="skeleton-text short"></div>
                    <div class="skeleton-price"></div>
                    <div class="skeleton-button"></div>
                </div>
            </div>
            <div class="product-card skeleton">
                <div class="skeleton-image"></div>
                <div class="skeleton-content">
                    <div class="skeleton-text"></div>
                    <div class="skeleton-text short"></div>
                    <div class="skeleton-price"></div>
                    <div class="skeleton-button"></div>
                </div>
            </div>
            <div class="product-card skeleton">
                <div class="skeleton-image"></div>
                <div class="skeleton-content">
                    <div class="skeleton-text"></div>
                    <div class="skeleton-text short"></div>
                    <div class="skeleton-price"></div>
                    <div class="skeleton-button"></div>
                </div>
            </div>
        </div>
    `;
    
    try {
        // Проверяем кэш
        const now = new Date();
        if (state.cachedProducts && state.productsLastFetched) {
            const diffMinutes = (now - new Date(state.productsLastFetched)) / (1000 * 60);
            if (diffMinutes < CONFIG.PRODUCTS_CACHE_MINUTES) {
                renderProducts(state.cachedProducts);
                return;
            }
        }
        
        // Загружаем с сервера
        const response = await fetch('/api/products', {
            headers: { 'Cache-Control': 'no-cache' }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const products = await response.json();
        
        // Сохраняем в кэш
        state.cachedProducts = products;
        state.productsLastFetched = now.toISOString();
        
        try {
            localStorage.setItem('products_cache', JSON.stringify(products));
            localStorage.setItem('products_cache_time', state.productsLastFetched);
        } catch (storageError) {
            console.warn('Не удалось сохранить в localStorage:', storageError);
        }
        
        renderProducts(products);
        
    } catch (error) {
        console.error('Ошибка загрузки товаров:', error);
        
        // Пробуем загрузить из кэша
        try {
            const cached = localStorage.getItem('products_cache');
            const cachedTime = localStorage.getItem('products_cache_time');
            
            if (cached && cachedTime) {
                const cacheDate = new Date(cachedTime);
                const now = new Date();
                const diffHours = (now - cacheDate) / (1000 * 60 * 60);
                
                if (diffHours < CONFIG.PRODUCTS_CACHE_MAX_HOURS) {
                    state.cachedProducts = JSON.parse(cached);
                    state.productsLastFetched = cachedTime;
                    renderProducts(state.cachedProducts);
                    showNotification('Загружены сохраненные товары', 'info');
                    return;
                }
            }
        } catch (cacheError) {
            console.error('Ошибка загрузки из кэша:', cacheError);
        }
        
        // Показываем ошибку
        grid.innerHTML = `
            <div class="error-message" style="grid-column: 1 / -1; text-align: center; padding: 48px 20px;">
                <div style="font-size: 48px; margin-bottom: 20px;">😕</div>
                <h3 style="color: #DC2626; margin-bottom: 10px;">Не удалось загрузить товары</h3>
                <p style="color: #64748B; margin-bottom: 20px;">${error.message || 'Проверьте подключение к интернету'}</p>
                <button onclick="loadProducts()" class="btn btn-primary" style="margin-top: 20px;">
                    Попробовать снова
                </button>
            </div>
        `;
    }
}

/**
 * Отрисовка товаров с тегами
 */
function renderProducts(products) {
    const grid = document.getElementById('productsGrid');
    if (!grid) return;
    
    try {
        if (!products || products.length === 0) {
            grid.innerHTML = `
                <div class="no-products" style="grid-column: 1 / -1; text-align: center; padding: 48px 20px;">
                    <div style="font-size: 48px; margin-bottom: 20px;">📦</div>
                    <h3 style="color: #64748B; margin-bottom: 10px;">Товаров пока нет</h3>
                    <p style="color: #94A3B8;">Загляните позже или свяжитесь с нами для индивидуального заказа</p>
                </div>
            `;
            return;
        }
        
        // Сортируем
        let sortedProducts = [...products];
        switch (state.currentSort) {
            case 'price_asc':
                sortedProducts.sort((a, b) => a.price - b.price);
                break;
            case 'price_desc':
                sortedProducts.sort((a, b) => b.price - a.price);
                break;
            case 'new':
                // Если есть дата создания, сортируем по ней
                sortedProducts.sort((a, b) => {
                    const dateA = a.created_at ? new Date(a.created_at) : new Date(0);
                    const dateB = b.created_at ? new Date(b.created_at) : new Date(0);
                    return dateB - dateA;
                });
                break;
        }
        
        grid.innerHTML = sortedProducts.map((product, index) => {
            const tags = generateProductTags(product, index);
            const hasImage = product.image_url && product.image_url !== 'null' && product.image_url !== 'undefined';
            
            return `
                <div class="product-card" data-product-id="${product.id}">
                    <div class="product-image-container">
                        ${tags.length > 0 ? `
                            <div class="product-tags">
                                ${tags.map(tag => `
                                    <span class="product-tag ${tag.type}">${tag.text}</span>
                                `).join('')}
                            </div>
                        ` : ''}
                        
                        <img src="${hasImage ? product.image_url : 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=400&fit=crop&crop=center'}" 
                             alt="${escapeHtml(product.name)}" 
                             class="product-image"
                             onclick="openImageModal('${hasImage ? product.image_url : ''}')"
                             onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=400&fit=crop&crop=center'"
                             loading="lazy">
                        
                        <button class="quick-view-btn" 
                                onclick="quickViewProduct(${product.id})"
                                aria-label="Быстрый просмотр ${escapeHtml(product.name)}">
                            👁
                        </button>
                    </div>
                    <div class="product-content">
                        <h3 class="product-name">${escapeHtml(product.name)}</h3>
                        <p class="product-description">${escapeHtml(product.description)}</p>
                        
                        <div class="product-price-container">
                            <div class="product-price">
                                ${formatAmount(product.price)} <span class="currency">сом</span>
                            </div>
                        </div>
                        
                        <button class="add-to-cart-btn" 
                                onclick="addToCartWithAnimation(${JSON.stringify(product).replace(/"/g, '&quot;')}, this)"
                                aria-label="Добавить ${escapeHtml(product.name)} в корзину">
                            Добавить в корзину
                        </button>
                        
                        <div class="social-proof">
                            <span class="icon">🎯</span>
                            <span>Более 100 покупок</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Ошибка отображения товаров:', error);
        grid.innerHTML = `
            <div class="error-message" style="grid-column: 1 / -1; text-align: center; padding: 48px 20px;">
                <p style="color: #DC2626; margin-bottom: 10px;">Ошибка загрузки товаров</p>
                <button onclick="loadProducts()" class="btn btn-primary" style="margin-top: 20px;">
                    Попробовать снова
                </button>
            </div>
        `;
    }
}

/**
 * Быстрый просмотр товара
 */
function quickViewProduct(productId) {
    // Здесь можно добавить модальное окно с быстрым просмотром
    showNotification('Функция быстрого просмотра скоро появится! ✨', 'info');
}

function sortProducts(sortBy) {
    state.currentSort = sortBy;
    renderProducts(state.cachedProducts || []);
}

// ===== FAQ =====

function toggleFAQ(button) {
    const item = button.parentElement;
    const answer = item.querySelector('.faq-answer');
    const icon = button.querySelector('.faq-icon');
    
    item.classList.toggle('active');
    
    if (item.classList.contains('active')) {
        answer.style.maxHeight = answer.scrollHeight + 'px';
        if (icon) icon.textContent = '−';
    } else {
        answer.style.maxHeight = '0';
        if (icon) icon.textContent = '+';
    }
}

function setupFAQ() {
    document.querySelectorAll('.faq-question').forEach(question => {
        question.addEventListener('click', function() {
            toggleFAQ(this);
        });
    });
    
    // Закрываем все FAQ по умолчанию
    document.querySelectorAll('.faq-item').forEach(item => {
        const answer = item.querySelector('.faq-answer');
        if (answer) {
            answer.style.maxHeight = '0';
        }
    });
}

// ===== МОДАЛЬНЫЕ ОКНА =====

function openCartModal() {
    const cartModal = document.getElementById('cartModal');
    if (cartModal) {
        cartModal.style.display = 'flex';
        renderCartItems();
        
        setTimeout(() => {
            cartModal.style.opacity = '1';
        }, 10);
        
        document.body.style.overflow = 'hidden';
        
        const phoneInput = document.getElementById('clientPhone');
        if (phoneInput) {
            setTimeout(() => phoneInput.focus(), 100);
        }
    }
}

function closeCartModal() {
    const cartModal = document.getElementById('cartModal');
    if (cartModal) {
        cartModal.style.opacity = '0';
        setTimeout(() => {
            cartModal.style.display = 'none';
            document.body.style.overflow = '';
        }, 300);
    }
}

function openImageModal(imageUrl) {
    if (!imageUrl || imageUrl === 'null' || imageUrl === 'undefined') return;
    
    const fullSizeImage = document.getElementById('fullSizeImage');
    const imageModal = document.getElementById('imageModal');
    
    if (fullSizeImage && imageModal) {
        fullSizeImage.style.opacity = '0';
        fullSizeImage.src = '';
        
        imageModal.style.display = 'flex';
        
        const img = new Image();
        img.onload = () => {
            fullSizeImage.src = imageUrl;
            fullSizeImage.style.opacity = '1';
        };
        img.onerror = () => {
            fullSizeImage.src = 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&h=600&fit=crop&crop=center';
            fullSizeImage.style.opacity = '1';
        };
        img.src = imageUrl;
        
        document.body.style.overflow = 'hidden';
    }
}

function closeImageModal() {
    const imageModal = document.getElementById('imageModal');
    if (imageModal) {
        imageModal.style.display = 'none';
        document.body.style.overflow = '';
    }
}

// ===== ОФОРМЛЕНИЕ ЗАКАЗА =====

async function checkout() {
    if (state.isCheckingOut) return;
    
    if (state.cart.length === 0) {
        showNotification('Добавьте товары в корзину', 'warning');
        return;
    }
    
    const clientPhone = document.getElementById('clientPhone')?.value || '';
    const clientComment = document.getElementById('clientComment')?.value || '';
    const checkoutBtn = document.getElementById('checkoutBtn');
    
    // Валидация телефона
    const phoneValidation = validatePhoneNumber(clientPhone);
    if (clientPhone && !phoneValidation.isValid) {
        showNotification(phoneValidation.error, 'warning');
        return;
    }
    
    // Блокируем кнопку
    state.isCheckingOut = true;
    if (checkoutBtn) {
        checkoutBtn.disabled = true;
        checkoutBtn.innerHTML = `
            <span style="display: inline-flex; align-items: center; gap: 8px;">
                <span class="spinner"></span>
                Обработка...
            </span>
        `;
    }
    
    try {
        const totalAmount = calculateTotal();
        
        const orderData = {
            items: JSON.stringify(state.cart),
            total_amount: totalAmount,
            client_phone: clientPhone,
            client_comment: clientComment
        };
        
        const response = await fetch('/api/orders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams(orderData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('Заказ оформлен! Открываем WhatsApp...', 'success');
            
            setTimeout(() => {
                state.cart = [];
                saveCart();
                closeCartModal();
                
                if (result.whatsapp_url) {
                    window.open(result.whatsapp_url, '_blank');
                }
            }, 1500);
            
        } else {
            showNotification(`Ошибка: ${result.error || 'Неизвестная ошибка'}`, 'error');
        }
        
    } catch (error) {
        console.error('Ошибка оформления заказа:', error);
        showNotification('Ошибка соединения с сервером', 'error');
    } finally {
        state.isCheckingOut = false;
        const checkoutBtn = document.getElementById('checkoutBtn');
        if (checkoutBtn) {
            checkoutBtn.disabled = false;
            checkoutBtn.textContent = 'Заказать в WhatsApp';
        }
    }
}

// ===== ИНИЦИАЛИЗАЦИЯ =====

function setupEventListeners() {
    // Модальные окна
    const cartModal = document.getElementById('cartModal');
    if (cartModal) {
        cartModal.addEventListener('click', function(e) {
            if (e.target === this) {
                closeCartModal();
            }
        });
    }
    
    const imageModal = document.getElementById('imageModal');
    if (imageModal) {
        imageModal.addEventListener('click', function(e) {
            if (e.target === this || e.target.classList.contains('modal')) {
                closeImageModal();
            }
        });
    }
    
    // Закрытие по ESC
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeImageModal();
            closeCartModal();
        }
    });
    
    // Кнопки
    const cartButton = document.getElementById('cartButton');
    if (cartButton) {
        cartButton.addEventListener('click', openCartModal);
    }
    
    const closeCartBtn = document.getElementById('closeCartModal');
    if (closeCartBtn) {
        closeCartBtn.addEventListener('click', closeCartModal);
    }
    
    const closeImageBtn = document.getElementById('closeImageModal');
    if (closeImageBtn) {
        closeImageBtn.addEventListener('click', closeImageModal);
    }
    
    const clearCartBtn = document.getElementById('clearCartBtn');
    if (clearCartBtn) {
        clearCartBtn.addEventListener('click', clearCart);
    }
    
    const checkoutBtn = document.getElementById('checkoutBtn');
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', checkout);
    }
    
    // Форматирование телефона
    const phoneInput = document.getElementById('clientPhone');
    if (phoneInput) {
        phoneInput.addEventListener('input', formatPhoneNumber);
    }
    
    // Сортировка
    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) {
        sortSelect.addEventListener('change', function(e) {
            sortProducts(e.target.value);
        });
    }
}

function checkUrlParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    
    if (urlParams.has('cart') && urlParams.get('cart') === 'open') {
        setTimeout(openCartModal, 500);
    }
}

function checkProductsAvailability() {
    setInterval(() => {
        if (document.visibilityState === 'visible') {
            console.log('🔄 Проверка обновлений товаров...');
            loadProducts();
        }
    }, 5 * 60 * 1000);
}

function initializeApp() {
    console.log('🚀 BelekBox.kg инициализация...');
    
    try {
        // Загружаем состояние
        updateCartCount();
        
        // Настраиваем обработчики
        setupEventListeners();
        setupFAQ();
        
        // Проверяем корзину
        checkOldCart();
        
        // Загружаем товары
        loadProducts();
        
        // Проверяем URL параметры
        checkUrlParameters();
        
        // Запускаем анимацию иконки бренда
        const brandIcon = document.querySelector('.brand-icon');
        if (brandIcon) {
            setInterval(() => {
                brandIcon.style.animation = 'none';
                setTimeout(() => {
                    brandIcon.style.animation = 'float 3s ease-in-out infinite';
                }, 10);
            }, 3000);
        }
        
        console.log('✅ BelekBox.kg успешно инициализирован');
        
    } catch (error) {
        console.error('❌ Ошибка инициализации приложения:', error);
        showNotification('Ошибка загрузки приложения', 'error');
    }
}

// ===== ГЛОБАЛЬНЫЙ ЭКСПОРТ =====

window.addToCartWithAnimation = addToCartWithAnimation;
window.removeFromCart = removeFromCart;
window.updateQuantity = updateQuantity;
window.openCartModal = openCartModal;
window.closeCartModal = closeCartModal;
window.openImageModal = openImageModal;
window.closeImageModal = closeImageModal;
window.checkout = checkout;
window.clearCart = clearCart;
window.toggleFAQ = toggleFAQ;
window.sortProducts = sortProducts;
window.quickViewProduct = quickViewProduct;

// ===== ЗАПУСК ПРИЛОЖЕНИЯ =====

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

// Периодическая проверка обновлений
setTimeout(checkProductsAvailability, 60000);

// Глобальный обработчик ошибок
window.addEventListener('error', function(event) {
    console.error('Глобальная ошибка:', event.error);
    showNotification('Произошла ошибка в приложении', 'error');
});

// Обработчик видимости страницы
document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible') {
        const lastUpdate = localStorage.getItem('products_cache_time');
        if (lastUpdate) {
            const now = new Date();
            const lastUpdateDate = new Date(lastUpdate);
            const diffMinutes = (now - lastUpdateDate) / (1000 * 60);
            
            if (diffMinutes > 10) {
                loadProducts();
            }
        }
    }
});