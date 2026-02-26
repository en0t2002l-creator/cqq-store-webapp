// ====================================
// КОНФИГУРАЦИЯ GOOGLE SHEETS
// ====================================

// ИНСТРУКЦИЯ ПО НАСТРОЙКЕ:
// 1. Создайте Google таблицу (инструкция ниже в README)
// 2. Сделайте таблицу публичной для чтения
// 3. Скопируйте ID таблицы из URL и вставьте сюда:

const SHEET_ID = 'ВАШ_SHEET_ID_СЮДА'; // Замените на ID вашей таблицы
const SHEET_NAME = 'Товары'; // Название листа в таблице

// Telegram настройки
const TELEGRAM_USERNAME = '@vizkazz';

// Пароль админ-панели (хеш)
const PASSWORD_HASH = '0d7ab7b3b544fe72bda40b160d686bb5f72ff96215a283bab235728d610ecfb3'; // cqqshop200226

// ====================================
// ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
// ====================================

let items = [];
let currentFilter = 'all';
let isAdminAuthenticated = false;
let currentModalItem = null;
let currentImageIndex = 0;
let previewTimers = {};
let logoClickCount = 0;
let logoClickTimer = null;
let isLoading = true;

// ====================================
// ИНИЦИАЛИЗАЦИЯ
// ====================================

document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    loadItemsFromSheets();
    
    // Секретный вход: тройной клик по логотипу
    const logo = document.querySelector('.logo');
    if (logo) {
        logo.addEventListener('click', function(e) {
            e.preventDefault();
            logoClickCount++;
            
            if (logoClickTimer) {
                clearTimeout(logoClickTimer);
            }
            
            if (logoClickCount === 3) {
                showAdminInfo();
                logoClickCount = 0;
            }
            
            logoClickTimer = setTimeout(() => {
                logoClickCount = 0;
            }, 600);
        });
        
        logo.style.cursor = 'pointer';
        logo.title = 'CQQ SHOP';
    }
});

// ====================================
// ЗАГРУЗКА ДАННЫХ ИЗ GOOGLE SHEETS
// ====================================

async function loadItemsFromSheets() {
    const grid = document.getElementById('itemsGrid');
    
    // Показываем индикатор загрузки
    grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 4rem; color: var(--text-secondary);">Загрузка товаров...</div>';
    
    try {
        // Проверяем, настроен ли SHEET_ID
        if (SHEET_ID === 'ВАШ_SHEET_ID_СЮДА' || !SHEET_ID) {
            throw new Error('Не настроен SHEET_ID. Следуйте инструкции в SETUP.md');
        }
        
        // Формируем URL для Google Sheets API
        const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(SHEET_NAME)}`;
        
        const response = await fetch(url);
        const text = await response.text();
        
        // Google возвращает JSON с префиксом, убираем его
        const jsonString = text.substring(47).slice(0, -2);
        const data = JSON.parse(jsonString);
        
        // Парсим данные
        items = parseSheetData(data);
        
        isLoading = false;
        renderItems();
        
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
        
        grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 4rem;">
                <p style="color: var(--text-secondary); margin-bottom: 1rem;">
                    ⚠️ Не удалось загрузить товары
                </p>
                <p style="color: var(--text-secondary); font-size: 0.9rem;">
                    ${error.message}
                </p>
                <button onclick="loadItemsFromSheets()" class="filter-btn" style="margin-top: 2rem; cursor: pointer;">
                    🔄 Попробовать снова
                </button>
            </div>
        `;
        
        // Показываем демо-данные для примера
        loadDemoData();
    }
}

// Парсинг данных из Google Sheets
function parseSheetData(data) {
    const rows = data.table.rows;
    const parsedItems = [];
    
    // Пропускаем заголовок (первая строка)
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i].c;
        
        // Проверяем, что строка не пустая
        if (!row || !row[0] || !row[0].v) continue;
        
        const item = {
            id: Date.now() + i,
            name: row[0]?.v || '',
            price: parseFloat(row[1]?.v) || 0,
            description: row[2]?.v || '',
            category: row[3]?.v || 'Разное',
            images: parseImages(row[4]?.v),
            sizes: parseSizes(row[5]?.v),
            status: (row[6]?.v || 'available').toLowerCase()
        };
        
        parsedItems.push(item);
    }
    
    return parsedItems;
}

// Парсинг URL фотографий (через запятую или перенос строки)
function parseImages(imageString) {
    if (!imageString) return ['https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=800'];
    
    const images = imageString
        .split(/[,\n]/)
        .map(url => url.trim())
        .filter(url => url && url.startsWith('http'));
    
    return images.length > 0 ? images : ['https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=800'];
}

// Парсинг размеров (формат: S:2, M:3, L:1)
function parseSizes(sizeString) {
    if (!sizeString) return [{ size: 'ONE SIZE', quantity: 1 }];
    
    const sizes = [];
    const pairs = sizeString.split(',').map(s => s.trim());
    
    for (const pair of pairs) {
        const [size, qty] = pair.split(':').map(s => s.trim());
        if (size) {
            sizes.push({
                size: size,
                quantity: parseInt(qty) || 1
            });
        }
    }
    
    return sizes.length > 0 ? sizes : [{ size: 'ONE SIZE', quantity: 1 }];
}

// Демо-данные для примера (пока не настроен Google Sheets)
function loadDemoData() {
    items = [
        {
            id: 1,
            name: 'Винтажная кожаная куртка',
            price: 8500,
            description: 'Классическая кожаная куртка в отличном состоянии. Натуральная кожа, мягкая текстура.',
            category: 'Верхняя одежда',
            images: [
                'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=800',
                'https://images.unsplash.com/photo-1520975916090-3105956dac38?w=800',
                'https://images.unsplash.com/photo-1521223890158-f9f7c3d5d504?w=800'
            ],
            sizes: [{ size: 'M', quantity: 1 }, { size: 'L', quantity: 0 }],
            status: 'available'
        },
        {
            id: 2,
            name: 'Джинсы Levis 501',
            price: 4500,
            description: 'Легендарные джинсы Levis 501. Классический крой, винтажная стирка.',
            category: 'Джинсы',
            images: [
                'https://images.unsplash.com/photo-1542272604-787c3835535d?w=800',
                'https://images.unsplash.com/photo-1541840031508-326b77c9a17e?w=800'
            ],
            sizes: [{ size: '30', quantity: 1 }, { size: '32', quantity: 1 }],
            status: 'available'
        }
    ];
    
    renderItems();
}

// ====================================
// ОТОБРАЖЕНИЕ ТОВАРОВ
// ====================================

function setupEventListeners() {
    // Фильтры
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentFilter = this.dataset.category;
            renderItems();
        });
    });

    // Закрытие модального окна
    document.getElementById('itemModal').addEventListener('click', function(e) {
        if (e.target === this) {
            closeModal();
        }
    });
}

function renderItems() {
    const grid = document.getElementById('itemsGrid');
    const filteredItems = items.filter(item => {
        if (currentFilter === 'all') return true;
        if (currentFilter === 'available') return item.status === 'available';
        if (currentFilter === 'sold') return item.status === 'sold';
        return true;
    });

    if (filteredItems.length === 0) {
        grid.innerHTML = '<p style="text-align: center; color: var(--text-secondary); grid-column: 1/-1;">Товары не найдены</p>';
        return;
    }

    grid.innerHTML = filteredItems.map((item, index) => {
        const previewImages = item.images.slice(0, 3);
        const hasStock = item.sizes.some(s => s.quantity > 0);
        
        return `
            <div class="item-card" onclick="openModal(${item.id})" 
                 onmouseenter="startImagePreview(${item.id})" 
                 onmouseleave="stopImagePreview(${item.id})"
                 style="animation-delay: ${index * 0.1}s">
                <div class="item-image-container">
                    <img class="item-image" id="item-img-${item.id}" src="${item.images[0]}" alt="${item.name}">
                    ${previewImages.length > 1 ? `
                        <div class="item-preview-dots">
                            ${previewImages.map((_, i) => `
                                <div class="preview-dot ${i === 0 ? 'active' : ''}" data-item="${item.id}" data-index="${i}"></div>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
                <div class="item-info">
                    <h3 class="item-name">${item.name}</h3>
                    <div class="item-meta">
                        <span>${item.status === 'sold' ? 'Продано' : hasStock ? 'В наличии' : 'Нет в наличии'}</span>
                        <span class="item-price">${item.price.toLocaleString('ru-RU')} ₽</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Превью изображений при наведении
function startImagePreview(itemId) {
    const item = items.find(i => i.id === itemId);
    if (!item || item.images.length <= 1) return;

    const previewImages = item.images.slice(0, 3);
    let currentIndex = 0;

    previewTimers[itemId] = setInterval(() => {
        currentIndex = (currentIndex + 1) % previewImages.length;
        const imgElement = document.getElementById(`item-img-${itemId}`);
        if (imgElement) {
            imgElement.src = previewImages[currentIndex];
            
            document.querySelectorAll(`.preview-dot[data-item="${itemId}"]`).forEach((dot, i) => {
                dot.classList.toggle('active', i === currentIndex);
            });
        }
    }, 1500);
}

function stopImagePreview(itemId) {
    if (previewTimers[itemId]) {
        clearInterval(previewTimers[itemId]);
        delete previewTimers[itemId];
        
        const item = items.find(i => i.id === itemId);
        if (item) {
            const imgElement = document.getElementById(`item-img-${itemId}`);
            if (imgElement) {
                imgElement.src = item.images[0];
            }
            
            document.querySelectorAll(`.preview-dot[data-item="${itemId}"]`).forEach((dot, i) => {
                dot.classList.toggle('active', i === 0);
            });
        }
    }
}

// ====================================
// МОДАЛЬНОЕ ОКНО
// ====================================

function openModal(itemId) {
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    currentModalItem = item;
    currentImageIndex = 0;

    document.getElementById('modalItemName').textContent = item.name;
    document.getElementById('modalItemPrice').textContent = `${item.price.toLocaleString('ru-RU')} ₽`;
    document.getElementById('modalItemDescription').textContent = item.description;
    document.getElementById('modalMainImage').src = item.images[0];

    // Миниатюры
    const thumbnailsContainer = document.getElementById('modalThumbnails');
    thumbnailsContainer.innerHTML = item.images.map((img, index) => `
        <img src="${img}" 
             class="modal-thumbnail ${index === 0 ? 'active' : ''}" 
             onclick="changeModalImage(${index})">
    `).join('');

    renderSizeOptions(item);

    document.getElementById('itemModal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    document.getElementById('itemModal').classList.remove('active');
    document.body.style.overflow = '';
    currentModalItem = null;
}

function changeModalImage(index) {
    if (!currentModalItem) return;

    currentImageIndex = index;
    document.getElementById('modalMainImage').src = currentModalItem.images[index];

    document.querySelectorAll('.modal-thumbnail').forEach((thumb, i) => {
        thumb.classList.toggle('active', i === index);
    });
}

function renderSizeOptions(item) {
    const container = document.getElementById('sizeOptions');
    const hasStock = item.sizes.some(s => s.quantity > 0);
    
    if (item.status === 'sold' || !hasStock) {
        document.getElementById('sizeSelector').style.display = 'none';
        return;
    }

    document.getElementById('sizeSelector').style.display = 'block';
    container.innerHTML = item.sizes.map(sizeObj => `
        <button class="size-option" 
                ${sizeObj.quantity === 0 ? 'disabled' : ''}>
            ${sizeObj.size} ${sizeObj.quantity > 0 ? `(${sizeObj.quantity})` : '(нет в наличии)'}
        </button>
    `).join('');

    container.querySelectorAll('.size-option:not(:disabled)').forEach(btn => {
        btn.addEventListener('click', function() {
            container.querySelectorAll('.size-option').forEach(b => b.classList.remove('selected'));
            this.classList.add('selected');
        });
    });
}

function contactSeller() {
    if (!currentModalItem) return;

    const selectedSize = document.querySelector('.size-option.selected');
    const sizeText = selectedSize ? selectedSize.textContent.split(' ')[0] : '';
    
    const message = `Здравствуйте! Интересует товар "${currentModalItem.name}"${sizeText ? ` (размер ${sizeText})` : ''} за ${currentModalItem.price.toLocaleString('ru-RU')} ₽`;
    const url = `https://t.me/${TELEGRAM_USERNAME.replace('@', '')}?text=${encodeURIComponent(message)}`;
    
    window.open(url, '_blank');
}

// ====================================
// АДМИН ПАНЕЛЬ (ИНФОРМАЦИЯ)
// ====================================

function showAdminInfo() {
    const info = `
╔════════════════════════════════════════╗
║     АДМИН ПАНЕЛЬ - GOOGLE SHEETS       ║
╚════════════════════════════════════════╝

📊 Управление товарами через Google таблицу!

Для редактирования товаров:
1. Откройте вашу Google таблицу
2. Измените данные (название, цена, фото и т.д.)
3. Обновите страницу сайта - изменения появятся!

🔗 Ссылка на таблицу:
https://docs.google.com/spreadsheets/d/${SHEET_ID}

📝 Формат данных в таблице:
- Колонка A: Название товара
- Колонка B: Цена (только число)
- Колонка C: Описание
- Колонка D: Категория
- Колонка E: Фото (URL через запятую)
- Колонка F: Размеры (S:2, M:3, L:1)
- Колонка G: Статус (available или sold)

💡 Подробная инструкция в файле SETUP.md
    `;
    
    alert(info);
    
    // Открываем таблицу в новой вкладке
    if (SHEET_ID !== 'ВАШ_SHEET_ID_СЮДА') {
        window.open(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`, '_blank');
    }
}

// Функция хеширования пароля (для справки)
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hash = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hash));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}
