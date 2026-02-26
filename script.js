// Configuration
const TELEGRAM_USERNAME = '@vizkazz';
// Пароль хранится в виде SHA-256 хеша для безопасности
// Текущий пароль: cqqshop200226
// Чтобы создать свой хеш пароля:
// 1. Откройте консоль браузера (F12)
// 2. Введите: await hashPassword('ваш_пароль')
// 3. Скопируйте результат и замените PASSWORD_HASH ниже
const PASSWORD_HASH = '0d7ab7b3b544fe72bda40b160d686bb5f72ff96215a283bab235728d610ecfb3'; // cqqshop200226
const STORAGE_KEY = 'cqqshop_items';

// Функция хеширования пароля
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hash = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hash));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}

// Global state
let items = [];
let currentFilter = 'all';
let isAdminAuthenticated = false;
let currentImages = [];
let editingItemId = null;
let currentModalItem = null;
let currentImageIndex = 0;
let previewTimers = {};

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    loadItems();
    renderItems();
    setupEventListeners();
    
    // Add form submit handler
    document.getElementById('addItemForm').addEventListener('submit', handleAddItem);
});

// Setup event listeners
function setupEventListeners() {
    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentFilter = this.dataset.category;
            renderItems();
        });
    });

    // Secret admin panel shortcut: Alt+Shift+A (to avoid conflicts with browser shortcuts)
    document.addEventListener('keydown', function(e) {
        if (e.altKey && e.shiftKey && e.key === 'A') {
            e.preventDefault();
            toggleAdminPanel();
        }
    });

    // Close modal on background click
    document.getElementById('itemModal').addEventListener('click', function(e) {
        if (e.target === this) {
            closeModal();
        }
    });

    // Close login overlay on background click
    document.getElementById('loginOverlay').addEventListener('click', function(e) {
        if (e.target === this) {
            this.classList.remove('active');
        }
    });

    // Admin password enter key
    document.getElementById('adminPassword').addEventListener('keypress', async function(e) {
        if (e.key === 'Enter') {
            await login();
        }
    });
}

// Load items from localStorage
function loadItems() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        items = JSON.parse(stored);
    } else {
        // Demo data
        items = [
            {
                id: Date.now() + 1,
                name: 'Винтажная кожаная куртка',
                price: 8500,
                description: 'Классическая кожаная куртка в отличном состоянии. Натуральная кожа, мягкая текстура. Идеально подходит для создания стильного образа.',
                category: 'Верхняя одежда',
                images: [
                    'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=800',
                    'https://images.unsplash.com/photo-1520975916090-3105956dac38?w=800',
                    'https://images.unsplash.com/photo-1521223890158-f9f7c3d5d504?w=800'
                ],
                sizes: [
                    { size: 'M', quantity: 1 },
                    { size: 'L', quantity: 0 }
                ],
                status: 'available'
            },
            {
                id: Date.now() + 2,
                name: 'Джинсы Levis 501',
                price: 4500,
                description: 'Легендарные джинсы Levis 501. Классический крой, винтажная стирка. Состояние отличное.',
                category: 'Джинсы',
                images: [
                    'https://images.unsplash.com/photo-1542272604-787c3835535d?w=800',
                    'https://images.unsplash.com/photo-1541840031508-326b77c9a17e?w=800'
                ],
                sizes: [
                    { size: '30', quantity: 1 },
                    { size: '32', quantity: 1 }
                ],
                status: 'available'
            },
            {
                id: Date.now() + 3,
                name: 'Oversize толстовка',
                price: 3200,
                description: 'Стильная oversize толстовка нейтрального цвета. Отлично сочетается с любым гардеробом.',
                category: 'Верх',
                images: [
                    'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=800'
                ],
                sizes: [
                    { size: 'L', quantity: 1 }
                ],
                status: 'sold'
            }
        ];
        saveItems();
    }
}

// Save items to localStorage
function saveItems() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

// Render items grid
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

// Image preview on hover
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
            
            // Update dots
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
        
        // Reset to first image
        const item = items.find(i => i.id === itemId);
        if (item) {
            const imgElement = document.getElementById(`item-img-${itemId}`);
            if (imgElement) {
                imgElement.src = item.images[0];
            }
            
            // Reset dots
            document.querySelectorAll(`.preview-dot[data-item="${itemId}"]`).forEach((dot, i) => {
                dot.classList.toggle('active', i === 0);
            });
        }
    }
}

// Open item modal
function openModal(itemId) {
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    currentModalItem = item;
    currentImageIndex = 0;

    // Set content
    document.getElementById('modalItemName').textContent = item.name;
    document.getElementById('modalItemPrice').textContent = `${item.price.toLocaleString('ru-RU')} ₽`;
    document.getElementById('modalItemDescription').textContent = item.description;

    // Set main image
    document.getElementById('modalMainImage').src = item.images[0];

    // Render thumbnails
    const thumbnailsContainer = document.getElementById('modalThumbnails');
    thumbnailsContainer.innerHTML = item.images.map((img, index) => `
        <img src="${img}" 
             class="modal-thumbnail ${index === 0 ? 'active' : ''}" 
             onclick="changeModalImage(${index})">
    `).join('');

    // Render sizes
    renderSizeOptions(item);

    // Show modal
    document.getElementById('itemModal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

// Close modal
function closeModal() {
    document.getElementById('itemModal').classList.remove('active');
    document.body.style.overflow = '';
    currentModalItem = null;
}

// Change modal image
function changeModalImage(index) {
    if (!currentModalItem) return;

    currentImageIndex = index;
    document.getElementById('modalMainImage').src = currentModalItem.images[index];

    // Update thumbnails
    document.querySelectorAll('.modal-thumbnail').forEach((thumb, i) => {
        thumb.classList.toggle('active', i === index);
    });
}

// Render size options
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

    // Add click handlers
    container.querySelectorAll('.size-option:not(:disabled)').forEach(btn => {
        btn.addEventListener('click', function() {
            container.querySelectorAll('.size-option').forEach(b => b.classList.remove('selected'));
            this.classList.add('selected');
        });
    });
}

// Contact seller
function contactSeller() {
    if (!currentModalItem) return;

    const selectedSize = document.querySelector('.size-option.selected');
    const sizeText = selectedSize ? selectedSize.textContent.split(' ')[0] : '';
    
    const message = `Здравствуйте! Интересует товар "${currentModalItem.name}"${sizeText ? ` (размер ${sizeText})` : ''} за ${currentModalItem.price.toLocaleString('ru-RU')} ₽`;
    const url = `https://t.me/${TELEGRAM_USERNAME.replace('@', '')}?text=${encodeURIComponent(message)}`;
    
    window.open(url, '_blank');
}

// Admin panel functions
function toggleAdminPanel() {
    if (!isAdminAuthenticated) {
        document.getElementById('loginOverlay').classList.add('active');
        return;
    }

    const panel = document.getElementById('adminPanel');
    panel.classList.toggle('active');
    
    if (panel.classList.contains('active')) {
        renderAdminItems();
    }
}

async function login() {
    const password = document.getElementById('adminPassword').value;
    const inputHash = await hashPassword(password);
    
    if (inputHash === PASSWORD_HASH) {
        isAdminAuthenticated = true;
        document.getElementById('loginOverlay').classList.remove('active');
        document.getElementById('adminPassword').value = '';
        document.getElementById('adminPanel').classList.add('active');
        renderAdminItems();
    } else {
        alert('Неверный пароль!');
    }
}

function switchAdminTab(tab) {
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.admin-content').forEach(c => c.classList.remove('active'));

    event.target.classList.add('active');
    
    if (tab === 'add') {
        document.getElementById('adminAddTab').classList.add('active');
    } else if (tab === 'manage') {
        document.getElementById('adminManageTab').classList.add('active');
        renderAdminItems();
    }
}

// Handle image upload
function handleImageUpload(event) {
    const files = Array.from(event.target.files);
    const maxImages = 10;

    if (currentImages.length + files.length > maxImages) {
        alert(`Максимум ${maxImages} фотографий!`);
        return;
    }

    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = function(e) {
            currentImages.push(e.target.result);
            renderImagePreviews();
        };
        reader.readAsDataURL(file);
    });
}

function renderImagePreviews() {
    const grid = document.getElementById('imagePreviewGrid');
    grid.innerHTML = currentImages.map((img, index) => `
        <div class="image-preview-item">
            <img src="${img}" alt="Preview ${index + 1}">
            <button class="image-preview-remove" onclick="removeImage(${index})">&times;</button>
        </div>
    `).join('');
}

function removeImage(index) {
    currentImages.splice(index, 1);
    renderImagePreviews();
}

// Add size input
function addSizeInput() {
    const container = document.getElementById('sizeInputs');
    const newInput = document.createElement('div');
    newInput.className = 'size-inputs';
    newInput.style.marginBottom = '1rem';
    newInput.innerHTML = `
        <input type="text" placeholder="Размер (S, M, L)" class="size-name">
        <input type="number" placeholder="Количество" class="size-quantity" min="0">
    `;
    container.appendChild(newInput);
}

// Handle add item form
function handleAddItem(e) {
    e.preventDefault();

    if (currentImages.length === 0) {
        alert('Добавьте хотя бы одну фотографию!');
        return;
    }

    // Collect sizes
    const sizeInputs = document.querySelectorAll('#sizeInputs .size-inputs');
    const sizes = Array.from(sizeInputs)
        .map(container => ({
            size: container.querySelector('.size-name').value.trim(),
            quantity: parseInt(container.querySelector('.size-quantity').value) || 0
        }))
        .filter(s => s.size);

    if (sizes.length === 0) {
        alert('Добавьте хотя бы один размер!');
        return;
    }

    const newItem = {
        id: editingItemId || Date.now(),
        name: document.getElementById('itemName').value,
        price: parseFloat(document.getElementById('itemPrice').value),
        description: document.getElementById('itemDescription').value,
        category: document.getElementById('itemCategory').value || 'Разное',
        images: [...currentImages],
        sizes: sizes,
        status: 'available'
    };

    if (editingItemId) {
        // Update existing item
        const index = items.findIndex(i => i.id === editingItemId);
        items[index] = newItem;
        editingItemId = null;
    } else {
        // Add new item
        items.unshift(newItem);
    }

    saveItems();
    renderItems();
    renderAdminItems();
    resetForm();
    
    alert(editingItemId ? 'Товар обновлен!' : 'Товар добавлен!');
}

function resetForm() {
    document.getElementById('addItemForm').reset();
    currentImages = [];
    renderImagePreviews();
    
    // Reset size inputs to one
    const container = document.getElementById('sizeInputs');
    container.innerHTML = `
        <div class="size-inputs" style="margin-bottom: 1rem;">
            <input type="text" placeholder="Размер (S, M, L)" class="size-name">
            <input type="number" placeholder="Количество" class="size-quantity" min="0">
        </div>
    `;
}

// Render admin items list
function renderAdminItems() {
    const container = document.getElementById('adminItemList');
    
    if (items.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">Товары отсутствуют</p>';
        return;
    }

    container.innerHTML = items.map(item => `
        <div class="admin-item">
            <img src="${item.images[0]}" alt="${item.name}">
            <div class="admin-item-info">
                <strong>${item.name}</strong>
                <div style="color: var(--text-secondary); font-size: 0.9rem;">
                    ${item.price.toLocaleString('ru-RU')} ₽ • ${item.status === 'sold' ? 'Продано' : 'В наличии'}
                </div>
            </div>
            <div class="admin-item-actions">
                <button onclick="editItem(${item.id})">✏️</button>
                <button onclick="toggleItemStatus(${item.id})">
                    ${item.status === 'sold' ? '↩️' : '✓'}
                </button>
                <button onclick="deleteItem(${item.id})" style="color: red;">🗑️</button>
            </div>
        </div>
    `).join('');
}

// Edit item
function editItem(itemId) {
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    editingItemId = itemId;
    currentImages = [...item.images];

    // Fill form
    document.getElementById('itemName').value = item.name;
    document.getElementById('itemPrice').value = item.price;
    document.getElementById('itemDescription').value = item.description;
    document.getElementById('itemCategory').value = item.category;

    // Fill sizes
    const container = document.getElementById('sizeInputs');
    container.innerHTML = item.sizes.map(s => `
        <div class="size-inputs" style="margin-bottom: 1rem;">
            <input type="text" placeholder="Размер (S, M, L)" class="size-name" value="${s.size}">
            <input type="number" placeholder="Количество" class="size-quantity" min="0" value="${s.quantity}">
        </div>
    `).join('');

    renderImagePreviews();

    // Switch to add tab
    switchAdminTab('add');
    document.querySelector('.admin-tab').click();

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Toggle item status (sold/available)
function toggleItemStatus(itemId) {
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    item.status = item.status === 'sold' ? 'available' : 'sold';
    saveItems();
    renderItems();
    renderAdminItems();
}

// Delete item
function deleteItem(itemId) {
    if (!confirm('Удалить этот товар?')) return;

    items = items.filter(i => i.id !== itemId);
    saveItems();
    renderItems();
    renderAdminItems();
}
