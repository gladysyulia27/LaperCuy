/* LaperCuy Premium Logic & Interactivity */

// ============================================================
// API INTEGRATION LAYER
// ============================================================
const API_BASE = '/api';

// ── Auth Guard: redirect ke login jika belum login
const lc_token = localStorage.getItem('lc_token');
const lc_user  = JSON.parse(localStorage.getItem('lc_user') || 'null');

// Halaman-halaman yang tidak memerlukan autentikasi
const PUBLIC_PAGES = ['login.html', 'register.html'];
const currentPage  = window.location.pathname.split('/').pop() || 'index.html';

if (!lc_token && !PUBLIC_PAGES.includes(currentPage)) {
  window.location.href = 'login.html';
}

// ── API Helper: fetch dengan Authorization header
const apiFetch = async (endpoint, options = {}) => {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (lc_token) headers['Authorization'] = `Bearer ${lc_token}`;

  const response = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });

  if (response.status === 401) {
    // Token expired atau invalid — logout
    localStorage.removeItem('lc_token');
    localStorage.removeItem('lc_user');
    window.location.href = 'login.html';
    return null;
  }

  return response;
};

// ── Nama user dari API (atau fallback localStorage lama)
const currentUserName = lc_user ? lc_user.fullname : (localStorage.getItem('profileFullname') || 'Pengguna');

document.addEventListener('DOMContentLoaded', () => {

    // 1. Data Store: Menu Items (akan di-populate dari API)
    // Format disamakan dengan respons API (/api/foods)
    let menuItems = [
        // Fallback data hardcoded (digunakan saat API belum merespons)
        { id: 'nasi_jeruk',     food_id: 'nasi_jeruk',     name: 'Nasi Jeruk Special',  price: 15000, category: 'nasi',    sold_label: '1k+ kali',   img: 'assets/nasi_jeruk.png',  badge: 'Bestseller', tag: 'populer',  desc: 'Aromatic lime rice served with crispy fried chicken and sambal matah.',         is_available: true },
        { id: 'mie_rebus',      food_id: 'mie_rebus',      name: 'Mie Rebus Seafood',   price: 22000, category: 'mie',     sold_label: '800+ kali',  img: 'assets/mie_seafood.png', badge: '-10%',       tag: 'terbaru', desc: 'Authentic rich broth noodle with fresh shrimp, calamari, and vegetables.',      is_available: true },
        { id: 'nasi_ayam_bakar',food_id: 'nasi_ayam_bakar',name: 'Nasi Ayam Bakar',     price: 20000, category: 'nasi',    sold_label: '2k+ kali',   img: 'assets/ayam_bakar.png',  badge: '',           tag: 'populer',  desc: 'Grilled chicken marinated in sweet soy sauce, served with rice and fresh cucumber.',is_available: true },
        { id: 'brownies',       food_id: 'brownies',       name: 'Brownies Lumer',       price:  7000, category: 'sweets',  sold_label: '500+ kali',  img: 'assets/manisan.png',     badge: '',           tag: 'terdekat', desc: 'Double chocolate brownies with melted hot chocolate lava in the center.',       is_available: true },
        { id: 'nasi_kebuli',    food_id: 'nasi_kebuli',    name: 'Nasi Kebuli',          price: 25000, category: 'nasi',    sold_label: '300+ kali',  img: 'assets/nasi_kebuli.png', badge: '',           tag: 'populer',  desc: 'Richly spiced rice cooked in mutton broth, topped with tender mutton and raisins.',is_available: false },
        { id: 'dimsum',         food_id: 'dimsum',         name: 'Dimsum Suka',          price: 10500, category: 'snack',   sold_label: '1.2k+ kali', img: 'assets/dimsum.png',      badge: 'Rekomendasi',tag: 'terdekat', desc: 'Steamed chicken and shrimp dimsum served with special hot chili oil dip.',      is_available: true },
        { id: 'mie_goreng_cumi',food_id: 'mie_goreng_cumi',name: 'Mie Goreng Cumi',     price: 21000, category: 'mie',     sold_label: '400+ kali',  img: 'assets/miecumi.jpg',     badge: '',           tag: 'terbaru', desc: 'Savory stir-fried noodles with fresh squid, bean sprouts, and aromatic spices.',  is_available: true },
        { id: 'kentang_goreng', food_id: 'kentang_goreng', name: 'Kentang Crispy',       price: 10000, category: 'snack',   sold_label: '900+ kali',  img: 'assets/cemilan.png',     badge: '',           tag: 'terdekat', desc: 'Golden crispy french fries seasoned with special salted egg savory powder.',    is_available: true },
        { id: 'iced_lemon_tea', food_id: 'iced_lemon_tea', name: 'Iced Lemon Tea',       price:  8000, category: 'minuman', sold_label: '1.5k+ kali', img: 'assets/minuman.png',     badge: '',           tag: 'populer',  desc: 'Refreshing iced black tea brewed with fresh lemon juice and fresh mint.',       is_available: true },
        { id: 'matcha_latte',   food_id: 'matcha_latte',   name: 'Matcha Latte Creamy',  price: 15000, category: 'minuman', sold_label: '250+ kali',  img: 'assets/Matchalatte.jpg', badge: 'Baru',       tag: 'terbaru', desc: 'Creamy premium Uji matcha whisked with fresh whole milk and sweetener.',        is_available: true },
    ];

    // Normalisasi: pastikan setiap item punya field 'id', 'sold', 'available' (kompatibilitas)
    const normalizeFoods = (foods) => foods.map(f => ({
        ...f,
        id:        f.food_id || f.id,
        sold:      f.sold_label || f.sold || '0',
        desc:      f.description || f.desc || '',
        available: f.is_available !== undefined ? !!f.is_available : (f.available !== false),
    }));

    menuItems = normalizeFoods(menuItems);

    // Load menu dari API (async, update UI setelah dapat data)
    const loadMenuFromAPI = async () => {
        try {
            const res = await fetch(`${API_BASE}/foods`);
            if (!res.ok) return;
            const data = await res.json();
            if (data.success && data.foods && data.foods.length > 0) {
                menuItems = normalizeFoods(data.foods);
                renderFoodCards();
                renderFrequentCarousel();
                setupExplorePage();
            }
        } catch (e) {
            console.log('[LaperCuy] Menggunakan data fallback (API tidak tersedia):', e.message);
        }
    };

    // ── Cart state: gunakan server-side cart jika login, localStorage sebagai cache
    // Struktur shoppingCart: { [food_id]: { item, qty, note, cartItemId } }
    // cartItemId = ID dari tabel cart_items di database
    const syncCartFromAPI = async () => {
        if (!lc_token) return;
        try {
            const res = await apiFetch('/cart');
            if (!res || !res.ok) return;
            const data = await res.json();
            if (!data.success) return;

            // Convert API cart ke format shoppingCart
            const newCart = {};
            data.cart.items.forEach(item => {
                const food = {
                    id:       item.food_id,
                    food_id:  item.food_id,
                    name:     item.name,
                    price:    item.price,
                    img:      item.img,
                    is_available: !!item.is_available,
                    available: !!item.is_available,
                };
                newCart[item.food_id] = {
                    item:       food,
                    qty:        item.quantity,
                    note:       item.note || '',
                    cartItemId: item.id,  // ID row di cart_items
                };
            });

            shoppingCart = newCart;
            localStorage.setItem('shoppingCart', JSON.stringify(shoppingCart));
            updateHeaderCartBadge();
            updateCartDrawerUI();
        } catch (e) {
            console.log('[LaperCuy] Gagal sinkronisasi cart dari API:', e.message);
        }
    };

    // 2. Application State Variables
    let shoppingCart = JSON.parse(localStorage.getItem('shoppingCart')) || {};
    let currentCategoryFilter = 'all';
    let currentTabFilter = 'populer';
    let currentPriceFilter = null;
    let currentRatingFilter = 0;

    // Promo discounts state
    let activeDiscounts = JSON.parse(localStorage.getItem('activeDiscounts')) || {
        freeClaimed: false, // Gratis 5 Menu voucher (Rp 10k off)
        codeApplied: false, // 20% off
    };

    // Queue tracking
    let currentQueueTicket = localStorage.getItem('currentQueueTicket') || 'A025';
    let remainingQueue = parseInt(localStorage.getItem('remainingQueue')) || 10;

    // Virtual Wallet — ambil dari user API atau localStorage
    let saldoCuyBalance = lc_user ? (lc_user.saldo || 5000) : (parseInt(localStorage.getItem('saldoCuyBalance')) || 5000);

    let selectedNoteTargetItemId = null; // tracking note addition

    // 3. UI Elements Cache
    const cartToggleBtn = document.getElementById('cart-toggle-btn');
    const cartOverlay = document.getElementById('cart-overlay');
    const cartCloseBtn = document.getElementById('cart-close-btn');
    const cartItemsContainer = document.getElementById('cart-items-container');
    const headerCartBadge = document.getElementById('header-cart-badge');

    const cartSubtotalPrice = document.getElementById('cart-subtotal-price');
    const cartDiscountRow = document.getElementById('cart-discount-row');
    const cartDiscountPrice = document.getElementById('cart-discount-price');
    const cartGrandTotal = document.getElementById('cart-grand-total');
    const cartCheckoutBtn = document.getElementById('cart-checkout-btn');
    const preorderCheckbox = document.getElementById('preorder-checkbox');
    const preorderTimeBox = document.getElementById('preorder-time-box');
    const preorderTimeSelect = document.getElementById('preorder-time');

    const toastBox = document.getElementById('toast-box');
    const toastMsg = document.getElementById('toast-msg');

    const chatToggleBtn = document.getElementById('chat-toggle-btn');
    const chatWidget = document.getElementById('chat-widget');
    const chatCloseBtnBox = document.getElementById('chat-close-btn-box');
    const chatUserInput = document.getElementById('chat-user-input');
    const chatSendBtn = document.getElementById('chat-send-btn');
    const chatMessagesContainer = document.getElementById('chat-messages-container');

    const btnViewQueueModal = document.getElementById('btn-view-queue-modal');
    const queueModalOverlay = document.getElementById('queue-modal-overlay');
    const queueModalClose = document.getElementById('queue-modal-close');
    const queueModalOk = document.getElementById('queue-modal-ok');
    const stepperFill = document.getElementById('stepper-fill');

    const noteModalOverlay = document.getElementById('note-modal-overlay');
    const noteModalClose = document.getElementById('note-modal-close');
    const noteModalCancel = document.getElementById('note-modal-cancel');
    const noteModalSave = document.getElementById('note-modal-save');
    const noteTextArea = document.getElementById('note-text-area');

    const categoryPills = document.querySelectorAll('.category-pill');
    const tabBtns = document.querySelectorAll('.tab-btn');
    const menuItemsGrid = document.getElementById('menu-items-grid');

    // 4. Cart Engine & Business Logic
    const updateHeaderCartBadge = () => {
        let totalQty = 0;
        for (const id in shoppingCart) {
            totalQty += shoppingCart[id].qty;
        }
        headerCartBadge.textContent = totalQty;

        // Bounce animation on change
        headerCartBadge.classList.add('bounce');
        setTimeout(() => {
            headerCartBadge.classList.remove('bounce');
        }, 300);
    };

    const getCartSubtotal = () => {
        let subtotal = 0;
        for (const id in shoppingCart) {
            subtotal += shoppingCart[id].item.price * shoppingCart[id].qty;
        }
        return subtotal;
    };

    const getCartDiscount = (subtotal) => {
        let discount = 0;
        if (activeDiscounts.freeClaimed) {
            discount += 10000; // Rp 10.000 flat discount
        }
        if (activeDiscounts.codeApplied) {
            discount += subtotal * 0.20; // 20% discount
        }
        return Math.min(discount, subtotal); // Discount cannot exceed subtotal
    };

    const addToCart = async (itemId) => {
        const itemObj = menuItems.find(item => item.id === itemId || item.food_id === itemId);
        if (!itemObj) return;
        if (itemObj.available === false || itemObj.is_available === false) {
            showToast('Maaf, menu ini sedang habis!');
            return;
        }

        // Optimistic UI update
        if (shoppingCart[itemId]) {
            shoppingCart[itemId].qty += 1;
        } else {
            shoppingCart[itemId] = { item: itemObj, qty: 1, note: '' };
        }
        showToast(`${itemObj.name} berhasil ditambahkan!`);
        localStorage.setItem('shoppingCart', JSON.stringify(shoppingCart));
        updateHeaderCartBadge();
        updateCartDrawerUI();

        // Update explore categories menu cards quantity instantly if grid exists
        if (document.getElementById('explore-menu-grid')) {
            const activePill = document.querySelector('.explore-cat-pill.active');
            const currentCat = activePill ? activePill.getAttribute('data-cat') : 'nasi';
            renderExploreMenu(currentCat);
        }

        // Sync ke API (background)
        if (lc_token) {
            try {
                const res = await apiFetch('/cart/add', {
                    method: 'POST',
                    body: JSON.stringify({ food_id: itemId, quantity: 1 }),
                });
                if (res && res.ok) {
                    const data = await res.json();
                    if (data.success) {
                        // Update cartItemId dari response
                        data.cart.items.forEach(serverItem => {
                            if (serverItem.food_id === itemId && shoppingCart[itemId]) {
                                shoppingCart[itemId].cartItemId = serverItem.id;
                            }
                        });
                        localStorage.setItem('shoppingCart', JSON.stringify(shoppingCart));
                    }
                }
            } catch (e) { /* Gagal sync, item tetap ada di localStorage */ }
        }
    };

    const subtractFromCart = async (itemId) => {
        if (!shoppingCart[itemId]) return;

        const cartItemId = shoppingCart[itemId].cartItemId;
        shoppingCart[itemId].qty -= 1;
        const newQty = shoppingCart[itemId].qty;

        if (newQty <= 0) {
            delete shoppingCart[itemId];
        }

        localStorage.setItem('shoppingCart', JSON.stringify(shoppingCart));
        updateHeaderCartBadge();
        updateCartDrawerUI();

        // Update explore categories menu cards quantity instantly if grid exists
        if (document.getElementById('explore-menu-grid')) {
            const activePill = document.querySelector('.explore-cat-pill.active');
            const currentCat = activePill ? activePill.getAttribute('data-cat') : 'nasi';
            renderExploreMenu(currentCat);
        }

        // Sync ke API (background)
        if (lc_token && cartItemId) {
            try {
                if (newQty <= 0) {
                    await apiFetch(`/cart/item/${cartItemId}`, { method: 'DELETE' });
                } else {
                    await apiFetch(`/cart/item/${cartItemId}`, {
                        method: 'PUT',
                        body: JSON.stringify({ quantity: newQty }),
                    });
                }
            } catch (e) { /* Gagal sync */ }
        }
    };

    const updateCartDrawerUI = () => {
        if (!cartItemsContainer) return;

        const keys = Object.keys(shoppingCart);

        if (keys.length === 0) {
            cartItemsContainer.innerHTML = `
                <div class="cart-empty-state">
                    <i data-lucide="shopping-cart" class="cart-empty-icon" style="width: 48px; height: 48px;"></i>
                    <p>Keranjang belanjamu kosong.</p>
                </div>
            `;
            cartSubtotalPrice.textContent = 'Rp 0';
            cartDiscountRow.style.display = 'none';
            cartGrandTotal.textContent = 'Rp 0';

            if (window.lucide) window.lucide.createIcons();
            return;
        }

        cartItemsContainer.innerHTML = '';
        keys.forEach(id => {
            const entry = shoppingCart[id];
            const food = entry.item;

            const card = document.createElement('div');
            card.classList.add('cart-item-card');
            card.innerHTML = `
                <div class="cart-item-details">
                    <img src="${food.img}" class="cart-item-img" alt="${food.name}">
                    <div class="cart-item-info">
                        <span class="cart-item-name">${food.name}</span>
                        <span class="cart-item-price">Rp ${food.price.toLocaleString('id-ID')}</span>
                        <span class="cart-item-note-lbl" id="note-lbl-${id}">${entry.note ? `✓ Catatan: "${entry.note}"` : ''}</span>
                        <a href="#" class="btn-add-item-note" data-id="${id}" style="font-size: 11px; color: var(--clr-brand); text-decoration: underline; margin-top: 4px;">
                            ${entry.note ? 'Ubah Catatan' : '+ Tambah Catatan'}
                        </a>
                    </div>
                </div>
                <div class="cart-qty-adjuster">
                    <button class="cart-qty-btn btn-cart-minus" data-id="${id}"><i data-lucide="minus" width="12" height="12"></i></button>
                    <span class="cart-qty-val">${entry.qty}</span>
                    <button class="cart-qty-btn btn-cart-plus" data-id="${id}"><i data-lucide="plus" width="12" height="12"></i></button>
                </div>
            `;

            cartItemsContainer.appendChild(card);
        });

        // Calculate Pricing
        const subtotal = getCartSubtotal();
        const discount = getCartDiscount(subtotal);
        const total = subtotal - discount;

        cartSubtotalPrice.textContent = `Rp ${subtotal.toLocaleString('id-ID')}`;
        if (discount > 0) {
            cartDiscountRow.style.display = 'flex';
            cartDiscountPrice.textContent = `-Rp ${discount.toLocaleString('id-ID')}`;
        } else {
            cartDiscountRow.style.display = 'none';
        }
        cartGrandTotal.textContent = `Rp ${total.toLocaleString('id-ID')}`;

        // Bind inner event listeners
        bindCartItemActionListeners();

        if (window.lucide) {
            window.lucide.createIcons();
        }
    };

    const bindCartItemActionListeners = () => {
        // Qty Pluses
        document.querySelectorAll('.btn-cart-plus').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                addToCart(id);
            });
        });

        // Qty Minuses
        document.querySelectorAll('.btn-cart-minus').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                subtractFromCart(id);
            });
        });

        // Note editor triggers
        document.querySelectorAll('.btn-add-item-note').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                selectedNoteTargetItemId = btn.getAttribute('data-id');
                const existingNote = shoppingCart[selectedNoteTargetItemId].note || '';
                noteTextArea.value = existingNote;
                noteModalOverlay.classList.add('active');
            });
        });
    };

    // 5. Category Filtering & Food Rendering Engine
    const renderFoodCards = () => {
        if (!menuItemsGrid) return;

        // Filter menu items by active category & active sorting tab
        let filtered = menuItems;
        if (currentCategoryFilter !== 'all') {
            filtered = filtered.filter(item => item.category === currentCategoryFilter);
        }

        if (currentTabFilter === 'populer') {
            filtered = filtered.filter(item => item.tag === 'populer' || item.tag === 'terdekat');
        } else if (currentTabFilter === 'terdekat') {
            filtered = filtered.filter(item => item.tag === 'terdekat');
        } else if (currentTabFilter === 'terbaru') {
            filtered = filtered.filter(item => item.tag === 'terbaru');
        }

        // Filter by price limit
        if (currentPriceFilter !== null) {
            filtered = filtered.filter(item => item.price <= currentPriceFilter);
        }

        // // Filter by rating minimum
        // if (currentRatingFilter > 0) {
        //     filtered = filtered.filter(item => (item.rating || 0) >= currentRatingFilter);
        // }

    if (filtered.length === 0) {
        menuItemsGrid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--clr-text-muted);">
                    <i data-lucide="ban" width="32" height="32" style="margin-bottom: 12px; opacity: 0.5;"></i>
                    <p style="font-size: 14px; font-weight: 500;">Tidak ada menu yang sesuai saringan saat ini.</p>
                </div>
            `;
        if (window.lucide) window.lucide.createIcons();
        return;
    }

    menuItemsGrid.innerHTML = '';
    filtered.forEach(food => {
        const card = document.createElement('div');
        card.classList.add('food-card');
        card.style.opacity = '0';
        card.style.transform = 'translateY(10px)';
        card.style.transition = 'opacity 0.3s ease, transform 0.3s ease';

        let badgeMarkup = '';
        if (food.badge) {
            const badgeClass = food.badge.includes('%') ? 'badge-discount' : 'badge-bestseller';
            badgeMarkup = `<span class="food-badge ${badgeClass}">${food.badge}</span>`;
        }

        card.innerHTML = `
                <div class="food-img-wrapper">
                    <img src="${food.img}" class="food-card-img" alt="${food.name}">
                    ${badgeMarkup}
                </div>
                <div class="food-card-body">
                    <h4 class="food-name">${food.name}</h4>
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                        <span class="food-sold-count" style="margin: 0;">Dipesan ${food.sold || '200+'}</span>
                    </div>
                    <div class="food-footer">
                        <span class="food-price">Rp ${food.price.toLocaleString('id-ID')}</span>
                        <button class="food-cart-btn btn-add-cart-direct" data-food-id="${food.id}" title="Tambah ke Keranjang">
                            <i data-lucide="plus" width="16" height="16"></i>
                        </button>
                    </div>
                </div>
            `;

        menuItemsGrid.appendChild(card);

        // Trigger reflow & slide-in animation
        setTimeout(() => {
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, 50);
    });

    // Bind event listeners to newly generated card buttons
    document.querySelectorAll('.btn-add-cart-direct').forEach(btn => {
        btn.addEventListener('click', () => {
            const foodId = btn.getAttribute('data-food-id');
            addToCart(foodId);
        });
    });

    if (window.lucide) {
        window.lucide.createIcons();
    }
};

// 6. Asisten Chat Logic
const appendChatMessage = (sender, text) => {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('chat-msg', sender === 'bot' ? 'chat-msg-bot' : 'chat-msg-user');
    msgDiv.textContent = text;
    chatMessagesContainer.appendChild(msgDiv);

    // Smooth scroll to bottom
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
};

const handleChatBotReply = (userQuery) => {
    const query = userQuery.toLowerCase().trim();
    let botReply = '';
    const currentName = localStorage.getItem('profileFullname') || "Niken Sitohang";
    const firstName = currentName.split(' ')[0] || "Niken";

    if (query.includes('promo') || query.includes('diskon') || query.includes('voucher') || query.includes('gratis')) {
        botReply = "LaperCuy punya promo Diskon 20% khusus Seafood & Nasi Kebuli, serta voucher Gratis 5 Menu untuk pengguna pertama hari ini! Klaim sekarang dengan mengklik tombol voucher di halaman utama! 🎁";
    } else if (query.includes('antrean') || query.includes('antri') || query.includes('nomor') || query.includes('ticket')) {
        botReply = `Nomor antrean Anda saat ini adalah ${currentQueueTicket}. Tersisa sekitar ${remainingQueue} antrean di depan Anda yang sedang disiapkan. Anda dapat memantau status pesanan kapan saja! ⏳`;
    } else if (query.includes('menu') || query.includes('makan') || query.includes('rekomendasi') || query.includes('kebuli')) {
        botReply = "Rekomendasi terlaris hari ini adalah Nasi Jeruk Special (Rp 15.000) dan Mie Rebus Seafood (Rp 22.000)! Klik tombol plus (+) pada menu tersebut untuk memesannya sekarang! 🍛";
    } else if (query.includes('lokasi') || query.includes('alamat') || query.includes('toko') || query.includes('di mana')) {
        botReply = "LaperCuy berlokasi di Kantin Interaksi IMK lantai 1. Sangat dekat dari kelas Anda, sehingga Anda tinggal mengambil pesanan tanpa perlu mengantre! 📍";
    } else if (query.includes('halo') || query.includes('hai') || query.includes('selamat')) {
        botReply = `Halo ${firstName}! Ada yang bisa LaperCuy bantu hari ini? Tanyakan tentang pesanan, promo terhangat, atau menu favoritmu! 🍕`;
    } else {
        botReply = "Terima kasih! Saya adalah asisten virtual LaperCuy. Gunakan kata kunci seperti 'promo', 'antrean', atau 'menu rekomendasi' agar saya bisa memberikan jawaban terbaik untukmu! 🍔";
    }

    // Simulate typing delay
    setTimeout(() => {
        appendChatMessage('bot', botReply);
    }, 600);
};

const sendChatMessage = () => {
    const userText = chatUserInput.value.trim();
    if (!userText) return;

    appendChatMessage('user', userText);
    chatUserInput.value = '';

    handleChatBotReply(userText);
};

// 7. Event Handlers & Core Bindings
// Cart Drawer Toggle
cartToggleBtn.addEventListener('click', () => {
    cartOverlay.classList.add('active');
    updateCartDrawerUI();
});

cartCloseBtn.addEventListener('click', () => {
    cartOverlay.classList.remove('active');
});

cartOverlay.addEventListener('click', (e) => {
    if (e.target === cartOverlay) {
        cartOverlay.classList.remove('active');
    }
});

// Chat Toggle
chatToggleBtn.addEventListener('click', () => {
    chatWidget.classList.toggle('active');
});

chatCloseBtnBox.addEventListener('click', () => {
    chatWidget.classList.remove('active');
});

chatSendBtn.addEventListener('click', sendChatMessage); chatUserInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendChatMessage();
});

// Category Filter Pills Clicks
categoryPills.forEach(pill => {
    pill.addEventListener('click', () => {
        categoryPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');

        currentCategoryFilter = pill.getAttribute('data-category');
        renderFoodCards();
    });
});

// Category view all
const btnCatViewAll = document.getElementById('btn-cat-view-all');
if (btnCatViewAll) {
    btnCatViewAll.addEventListener('click', (e) => {
        e.preventDefault();
        categoryPills.forEach(p => p.classList.remove('active'));
        document.querySelector('[data-category="all"]').classList.add('active');
        currentCategoryFilter = 'all';
        renderFoodCards();
    });
}

// explore popular tabs
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        currentTabFilter = btn.getAttribute('data-tab');
        renderFoodCards();
    });
});

// Preorder checkbox display toggle
if (preorderCheckbox) {
    preorderCheckbox.addEventListener('change', () => {
        if (preorderCheckbox.checked) {
            preorderTimeBox.style.display = 'block';
        } else {
            preorderTimeBox.style.display = 'none';
        }
    });
}

// MULTI-PAGE ROUTER: switchPage(pageId) Implementation
const switchPage = (pageId) => {
    if (pageId === 'page-browse') window.location.href = 'index.html';
    else if (pageId === 'page-menu') window.location.href = 'menu.html';
    else if (pageId === 'page-offers') window.location.href = 'offers.html';
    else if (pageId === 'page-orders') window.location.href = 'orders.html';
    else if (pageId === 'page-profile') window.location.href = 'profile.html';
    else if (pageId === 'page-checkout') window.location.href = 'checkout.html';
};

// Auto highlight active nav items on page load
const highlightActiveNav = () => {
    const path = window.location.pathname;
    const pageName = path.substring(path.lastIndexOf('/') + 1) || 'index.html';

    // Update Desktop Header Links active highlight
    const desktopLinks = document.querySelectorAll('.nav-menu .nav-link');
    desktopLinks.forEach(link => {
        link.classList.remove('active');
        const href = link.getAttribute('href');
        if (href === pageName) {
            link.classList.add('active');
        } else if (pageName === 'index.html' && href === 'index.html') {
            link.classList.add('active');
        }
    });

    // Update Mobile Footer Nav active highlight
    document.querySelectorAll('.mobile-nav-item').forEach(item => {
        item.classList.remove('active');
    });
    if (pageName === 'index.html' || pageName === 'menu.html' || pageName === 'offers.html' || pageName === 'checkout.html') {
        const homeBtn = document.getElementById('mobile-home-btn');
        if (homeBtn) homeBtn.classList.add('active');
    } else if (pageName === 'orders.html') {
        const queueBtn = document.getElementById('mobile-aktivitas-btn');
        if (queueBtn) queueBtn.classList.add('active');
    } else if (pageName === 'profile.html') {
        const profileBtn = document.getElementById('mobile-profile-btn');
        if (profileBtn) profileBtn.classList.add('active');
    }
}; highlightActiveNav();

// Bind Desktop Navigation menu clicks
const desktopLinks = document.querySelectorAll('.nav-menu .nav-link'); desktopLinks.forEach(link => {
    const text = link.textContent.trim().toLowerCase();
    if (text === 'browse') {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            switchPage('page-browse');
        });
    } else if (text === 'menu') {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            switchPage('page-menu');
        });
    } else if (text === 'offers') {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            switchPage('page-offers');
        });
    } else if (text === 'orders') {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            switchPage('page-orders');
        });
    } else if (text === 'help') {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            chatWidget.classList.add('active');
            const currentName = localStorage.getItem('profileFullname') || "Niken Sitohang";
            const firstName = currentName.split(' ')[0] || "Niken";
            appendChatMessage('bot', `Halo ${firstName}! Ada yang bisa LaperCuy bantu? Anda dapat menanyakan tentang status pesanan, promo, atau menu rekomendasi! 😊`);
        });
    }
});

// Profile button in header triggers profile page routing
const profileHeaderBtn = document.getElementById('profile-btn');
if (profileHeaderBtn) {
    profileHeaderBtn.addEventListener('click', () => {
        switchPage('page-profile');
    });
}

// OFFERS CLAIMS LOGIC
document.querySelectorAll('.btn-claim-offer').forEach(btn => {
    btn.addEventListener('click', () => {
        const promoType = btn.getAttribute('data-promo');
        if (promoType === 'free') {
            if (activeDiscounts.freeClaimed) {
                showToast("Voucher Gratis 5 Menu sudah Anda klaim!");
                return;
            }
            activeDiscounts.freeClaimed = true;
            localStorage.setItem('activeDiscounts', JSON.stringify(activeDiscounts));
            showToast("✓ Voucher Gratis 5 Menu berhasil diklaim! (Potongan Rp 10.000)");
        } else if (promoType === 'discount20') {
            if (activeDiscounts.codeApplied) {
                showToast("Kode promo diskon 20% sudah diterapkan!");
                return;
            }
            activeDiscounts.codeApplied = true;
            localStorage.setItem('activeDiscounts', JSON.stringify(activeDiscounts));
            showToast("✓ Kode promo diskon 20% berhasil diterapkan pada keranjang!");
        } else if (promoType === 'delivery') {
            showToast("✓ Voucher Gratis Ongkir berhasil diklaim!");
        }
        updateCartDrawerUI();
    });
});

// Browse Page Claims Buttons
const btnClaimFree = document.getElementById('btn-claim-free-voucher');
if (btnClaimFree) {
    btnClaimFree.addEventListener('click', () => {
        if (activeDiscounts.freeClaimed) {
            showToast("Voucher Gratis 5 Menu sudah Anda klaim!");
            return;
        }
        activeDiscounts.freeClaimed = true;
        localStorage.setItem('activeDiscounts', JSON.stringify(activeDiscounts));
        showToast("✓ Voucher Gratis 5 Menu berhasil diklaim! (Potongan Rp 10.000)");
        updateCartDrawerUI();
    });
}

const btnApplyCode = document.getElementById('btn-apply-promo-code');
if (btnApplyCode) {
    btnApplyCode.addEventListener('click', () => {
        if (activeDiscounts.codeApplied) {
            showToast("Kode promo diskon 20% sudah diterapkan!");
            return;
        }
        activeDiscounts.codeApplied = true;
        localStorage.setItem('activeDiscounts', JSON.stringify(activeDiscounts));
        showToast("✓ Kode promo diskon 20% berhasil diterapkan pada keranjang!");
        updateCartDrawerUI();
    });
}

// Hero buttons triggers scroll
const heroBtnMenu = document.getElementById('hero-btn-menu');
if (heroBtnMenu) {
    heroBtnMenu.addEventListener('click', () => {
        const menuGrid = document.getElementById('menu-items-grid');
        if (menuGrid) {
            menuGrid.scrollIntoView({
                behavior: 'smooth'
            });
            showToast("Menampilkan menu terlaris!");
        } else {
            switchPage('page-browse');
        }
    });
}

const heroBtnPromo = document.getElementById('hero-btn-promo');
if (heroBtnPromo) {
    heroBtnPromo.addEventListener('click', () => {
        switchPage('page-offers');
    });
}

// Modal queue status controls
if (btnViewQueueModal) {
    btnViewQueueModal.addEventListener('click', () => {
        if (queueModalOverlay) {
            queueModalOverlay.classList.add('active');
            if (stepperFill) stepperFill.style.width = '0%';
            setTimeout(() => {
                if (stepperFill) stepperFill.style.width = '50%'; // active index node 2
            }, 150);
        } else {
            switchPage('page-orders');
        }
    });
}

const closeQueueModal = () => {
    if (queueModalOverlay) {
        queueModalOverlay.classList.remove('active');
    }
};

if (queueModalClose) queueModalClose.addEventListener('click', closeQueueModal);
if (queueModalOk) queueModalOk.addEventListener('click', closeQueueModal);
if (queueModalOverlay) {
    queueModalOverlay.addEventListener('click', (e) => {
        if (e.target === queueModalOverlay) closeQueueModal();
    });
}

// Note Modal Controls
const closeNoteModal = () => {
    noteModalOverlay.classList.remove('active');
    selectedNoteTargetItemId = null;
};

if (noteModalClose) noteModalClose.addEventListener('click', closeNoteModal);
if (noteModalCancel) noteModalCancel.addEventListener('click', closeNoteModal);
if (noteModalSave) {
    noteModalSave.addEventListener('click', () => {
        if (selectedNoteTargetItemId && shoppingCart[selectedNoteTargetItemId]) {
            const noteText = noteTextArea.value.trim();
            shoppingCart[selectedNoteTargetItemId].note = noteText;
            localStorage.setItem('shoppingCart', JSON.stringify(shoppingCart));
            showToast("Catatan berhasil disimpan!");
            updateCartDrawerUI();
        }
        closeNoteModal();
    });
}

// PROFILE PAGE & WALLET INTERACTION
    const updateSaldoUI = () => {
        const lbl = document.getElementById('profile-lbl-saldo');
        if (lbl) {
            lbl.textContent = `Rp ${saldoCuyBalance.toLocaleString('id-ID')}`;
        }
    };

    const btnTopup = document.getElementById('btn-topup-saldo');
    if (btnTopup) {
        btnTopup.addEventListener('click', async () => {
            if (lc_token) {
                try {
                    const res = await apiFetch('/auth/topup', {
                        method: 'POST',
                        body: JSON.stringify({ amount: 50000 }),
                    });
                    if (res && res.ok) {
                        const data = await res.json();
                        if (data.success) {
                            saldoCuyBalance = data.saldo;
                            // Update lc_user di localStorage
                            const user = JSON.parse(localStorage.getItem('lc_user') || '{}');
                            user.saldo = saldoCuyBalance;
                            localStorage.setItem('lc_user', JSON.stringify(user));
                        }
                    }
                } catch (e) { /* fallback */ saldoCuyBalance += 50000; }
            } else {
                saldoCuyBalance += 50000;
                localStorage.setItem('saldoCuyBalance', saldoCuyBalance.toString());
            }
            updateSaldoUI();
            showToast('✓ Berhasil Top Up SaldoCuy Rp 50.000!');
        });
    }

// Sync profile name to all UI elements
const syncProfileNameUI = (fullName) => {
    const firstName = fullName.split(' ')[0] || "Niken";

    // Update hero welcome title in index.html
    const heroTitle = document.querySelector('.hero-title');
    if (heroTitle) {
        heroTitle.innerHTML = `<span class="hero-title-greeting">Hai ${firstName},</span> <span class="hero-title-welcome">Selamat datang!</span>`;
    }

    // Update modal titles
    document.querySelectorAll('.modal-title').forEach(el => {
        if (el.textContent.includes("Pesanan Niken") || el.textContent.includes("Pesanan ")) {
            el.textContent = `Status Detail Pesanan ${firstName}`;
        }
    });

    // Update profile-btn titles (tooltips)
    const profileBtn = document.getElementById('profile-btn');
    if (profileBtn) {
        profileBtn.setAttribute('title', `Profil ${firstName}`);
    }

    // Update chatbot initial message in widget
    const chatEmptyBotMsg = document.querySelector('.chat-msg-bot');
    if (chatEmptyBotMsg && (chatEmptyBotMsg.textContent.includes("Halo Niken!") || chatEmptyBotMsg.textContent.includes("Halo "))) {
        chatEmptyBotMsg.textContent = `Halo ${firstName}! Ada yang bisa LaperCuy bantu hari ini? Anda bisa menanyakan info promo, lokasi toko, atau pesanan antrean Anda! 🍔`;
    }
};

    // Persist and load profile name dynamically
    const savedProfileName = lc_user ? lc_user.fullname : (localStorage.getItem('profileFullname') || 'Pengguna');
    const savedProfileEmail = lc_user ? lc_user.email : (localStorage.getItem('profileEmail') || 'pengguna@mail.com');
    const savedProfilePhone = lc_user ? lc_user.phone : (localStorage.getItem('profilePhone') || '');
    const savedProfileGender = lc_user ? lc_user.gender : (localStorage.getItem('profileGender') || 'Wanita');

    const lblProfileName = document.getElementById('profile-lbl-fullname');
    if (lblProfileName) lblProfileName.textContent = savedProfileName;
    const inputProfileName = document.getElementById('prof-fullname');
    if (inputProfileName) inputProfileName.value = savedProfileName;

    const lblProfileUsername = document.getElementById('profile-lbl-username') || document.getElementById('pvisual-username');
    const inputProfileEmail = document.getElementById('prof-email');
    if (inputProfileEmail) inputProfileEmail.value = savedProfileEmail;

    const syncProfileEmailUI = (email) => {
        if (lblProfileUsername) {
            lblProfileUsername.textContent = email || "pengguna@mail.com";
        }
    };

    // Initial sync of email
    syncProfileEmailUI(savedProfileEmail);

    const inputProfilePhone = document.getElementById('prof-phone');
    if (inputProfilePhone) inputProfilePhone.value = savedProfilePhone;

    const inputProfileGender = document.getElementById('prof-gender');
    if (inputProfileGender) inputProfileGender.value = savedProfileGender;

    // Real-time synchronization as typing in the email field
    if (inputProfileEmail) {
        inputProfileEmail.addEventListener('input', (e) => {
            syncProfileEmailUI(e.target.value.trim());
        });
    }

    // Initial sync of name
    syncProfileNameUI(savedProfileName);

    const btnSaveProfile = document.getElementById('btn-save-profile-desktop');
    if (btnSaveProfile) {
        btnSaveProfile.addEventListener('click', async (e) => {
            e.preventDefault();
            const nameInput   = document.getElementById('prof-fullname');
            const emailInput  = document.getElementById('prof-email');
            const phoneInput  = document.getElementById('prof-phone');
            const genderInput = document.getElementById('prof-gender');

            const newName   = nameInput ? nameInput.value.trim() : savedProfileName;
            const newEmail  = emailInput ? emailInput.value.trim() : savedProfileEmail;
            const newPhone  = phoneInput ? phoneInput.value.trim() : '';
            const newGender = genderInput ? genderInput.value : '';

            if (!newName) return;

            // Update via API
            if (lc_token) {
                try {
                    const res = await apiFetch('/auth/profile', {
                        method: 'PUT',
                        body: JSON.stringify({ fullname: newName, phone: newPhone, gender: newGender }),
                    });
                    if (res && res.ok) {
                        const data = await res.json();
                        if (data.success) {
                            localStorage.setItem('lc_user', JSON.stringify(data.user));
                        }
                    }
                } catch (e) { /* fallback ke localStorage */ }
            }

            localStorage.setItem('profileFullname', newName);
            localStorage.setItem('profileEmail', newEmail);
            localStorage.setItem('profilePhone', newPhone);
            localStorage.setItem('profileGender', newGender);

            if (lblProfileName) lblProfileName.textContent = newName;
            syncProfileNameUI(newName);
            syncProfileEmailUI(newEmail);
            showToast('✓ Profil Anda berhasil diperbarui!');
        });
    }

// PEMBAYARAN & CHECKOUT LOGIC
let checkoutItems = [];
let checkoutSubtotal = 0;
let checkoutDiscount = 0;
let checkoutGrandTotal = 0;

const populateCheckoutDetails = () => {
    const keys = Object.keys(shoppingCart);
    checkoutItems = [];
    checkoutSubtotal = 0;

    const container = document.getElementById('checkout-receipt-items-container');
    if (!container) return;
    container.innerHTML = '';

    keys.forEach(id => {
        const entry = shoppingCart[id];
        const price = entry.item.price * entry.qty;
        checkoutSubtotal += price;

        checkoutItems.push({
            id: id,
            name: entry.item.name,
            qty: entry.qty,
            price: entry.item.price,
            note: entry.note
        });

        const itemRow = document.createElement('div');
        itemRow.style.display = 'flex';
        itemRow.style.justifyContent = 'space-between';
        itemRow.style.fontSize = '13px';
        itemRow.style.color = 'var(--clr-text-main)';
        itemRow.style.marginBottom = '8px';

        const noteStr = entry.note ? ` <span style="font-size: 11px; color: var(--clr-warning); font-style: italic;">(Note: ${entry.note})</span>` : '';
        itemRow.innerHTML = `
                <span>${entry.qty}x ${entry.item.name}${noteStr}</span>
                <strong>Rp ${price.toLocaleString('id-ID')}</strong>
            `;
        container.appendChild(itemRow);
    });

    checkoutDiscount = getCartDiscount(checkoutSubtotal);
    checkoutGrandTotal = checkoutSubtotal - checkoutDiscount;

    document.getElementById('chk-subtotal-price').textContent = `Rp ${checkoutSubtotal.toLocaleString('id-ID')}`;
    const discountRow = document.getElementById('chk-discount-row');
    if (checkoutDiscount > 0) {
        discountRow.style.display = 'flex';
        document.getElementById('chk-discount-price').textContent = `-Rp ${checkoutDiscount.toLocaleString('id-ID')}`;
    } else {
        discountRow.style.display = 'none';
    }
    document.getElementById('chk-grand-total').textContent = `Rp ${checkoutGrandTotal.toLocaleString('id-ID')}`;
};

// Run checkout items populator on checkout page load
const path = window.location.pathname;
const pageName = path.substring(path.lastIndexOf('/') + 1) || 'index.html';
if (pageName === 'checkout.html') {
    populateCheckoutDetails();
}

// Preorder checkbox inside checkout
const chkPreorderCheckbox = document.getElementById('chk-preorder-checkbox');
const chkPreorderTimeBox = document.getElementById('chk-preorder-time-box');
if (chkPreorderCheckbox && chkPreorderTimeBox) {
    chkPreorderCheckbox.addEventListener('change', () => {
        chkPreorderTimeBox.style.display = chkPreorderCheckbox.checked ? 'block' : 'none';
    });
}

// Premium Payment Methods Menu Toggler & Logic
const payGroupBank = document.getElementById('pay-group-bank');
const bankHeaderBtn = document.getElementById('bank-header-btn');
const paySubItems = document.querySelectorAll('.pay-sub-item');
const payDirectItems = document.querySelectorAll('.pay-group-item-direct');
const qrisMockBox = document.getElementById('chk-qris-visual-mock');

// 1. Toggle bank list expansion
if (bankHeaderBtn && payGroupBank) {
    bankHeaderBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        payGroupBank.classList.toggle('expanded');
        // Toggle chevron icon and max-height manually for smooth animation
        const bankSubList = document.getElementById('bank-sub-list');
        if (bankSubList) {
            if (payGroupBank.classList.contains('expanded')) {
                bankSubList.style.maxHeight = '200px';
            } else {
                bankSubList.style.maxHeight = '0px';
            }
        }
    });
}

// Function to clear direct items active states
const clearDirectActiveStates = () => {
    payDirectItems.forEach(item => {
        item.classList.remove('active');
        const radio = item.querySelector('input[type="radio"]');
        if (radio) radio.checked = false;
    });
};

// Function to clear bank active states
const clearBankActiveStates = () => {
    paySubItems.forEach(sub => {
        sub.classList.remove('active');
        const radio = sub.querySelector('input[type="radio"]');
        if (radio) radio.checked = false;
    });

    // Remove parent active check badge class
    if (payGroupBank) {
        payGroupBank.classList.remove('has-active-bank');
    }
};

// 2. Sub-Bank click handler
paySubItems.forEach(subItem => {
    subItem.addEventListener('click', (e) => {
        e.stopPropagation();

        // Clear other payment states first
        clearDirectActiveStates();

        // Reset other bank items
        paySubItems.forEach(s => s.classList.remove('active'));

        // Set current clicked bank sub item active
        subItem.classList.add('active');
        const radio = subItem.querySelector('input[type="radio"]');
        if (radio) {
            radio.checked = true;
            // Since user clicked a bank, set the main group header to selected badge state
            if (payGroupBank) {
                payGroupBank.classList.add('has-active-bank');
            }
        }

        // Hide QRIS mockup
        if (qrisMockBox) qrisMockBox.classList.add('hidden');
    });
});

// 3. Direct Items (QRIS, Bayar Tunai) click handler
payDirectItems.forEach(directItem => {
    directItem.addEventListener('click', (e) => {
        // Clear other states
        clearDirectActiveStates();
        clearBankActiveStates();

        // Set active
        directItem.classList.add('active');
        const radio = directItem.querySelector('input[type="radio"]');
        if (radio) {
            radio.checked = true;
            if (radio.value === 'qris') {
                if (qrisMockBox) qrisMockBox.classList.remove('hidden');
            } else {
                if (qrisMockBox) qrisMockBox.classList.add('hidden');
            }
        }
    });
});

// Cart drawer checkout click redirect
cartCheckoutBtn.addEventListener('click', () => {
    const keys = Object.keys(shoppingCart);
    if (keys.length === 0) {
        showToast("Pilih makanan favoritmu dulu ya!");
        return;
    }

    // Close drawer and navigate to checkout section
    cartOverlay.classList.remove('active');
    switchPage('page-checkout');
});

// Final checkout payment confirmation
    const chkBtnConfirmPay = document.getElementById('chk-btn-confirm-pay');
    if (chkBtnConfirmPay) {
        chkBtnConfirmPay.addEventListener('click', async () => {
            if (checkoutItems.length === 0) {
                showToast('Keranjang Anda kosong! Silakan pilih makanan.');
                switchPage('page-browse');
                return;
            }

            // Detect payment method
            const selectedMethodRadio = document.querySelector('input[name="chk-payment-group"]:checked');
            const methodVal = selectedMethodRadio ? selectedMethodRadio.value : 'cash';
            const preorderTime = chkPreorderCheckbox && chkPreorderCheckbox.checked
                ? document.getElementById('chk-preorder-time-select').value
                : null;

            // Disable button saat proses
            chkBtnConfirmPay.disabled = true;
            chkBtnConfirmPay.textContent = 'Memproses...';

            try {
                let orderCode = 'A001';

                if (lc_token) {
                    // Kirim ke API
                    const res = await apiFetch('/orders', {
                        method: 'POST',
                        body: JSON.stringify({
                            payment_method: methodVal,
                            preorder_time: preorderTime,
                            discount_flags: activeDiscounts,
                        }),
                    });

                    if (res && res.ok) {
                        const data = await res.json();
                        if (data.success && data.order) {
                            orderCode = data.order.order_code;
                            // Simpan detail order ke localStorage untuk ditampilkan di halaman orders
                            localStorage.setItem('activeOrderData', JSON.stringify({
                                id: orderCode,
                                items: checkoutItems,
                                total: checkoutGrandTotal,
                                preorderTime,
                                method: methodVal,
                                status: data.order.status,
                            }));
                        }
                    } else {
                        const errData = res ? await res.json() : {};
                        showToast(errData.message || 'Gagal membuat pesanan.');
                        chkBtnConfirmPay.disabled = false;
                        chkBtnConfirmPay.textContent = 'Bayar Sekarang';
                        return;
                    }
                } else {
                    // Fallback: simpan ke localStorage saja
                    localStorage.setItem('activeOrderData', JSON.stringify({
                        id: orderCode, items: checkoutItems, total: checkoutGrandTotal, preorderTime, method: methodVal,
                    }));
                }

                // Toast sukses
                let methodMsg = preorderTime ? ` (Pre-order ${preorderTime})` : '';
                if (methodVal === 'qris') {
                    showToast(`✓ Pembayaran QRIS Berhasil!${methodMsg}`);
                } else if (methodVal.startsWith('bank')) {
                    const bankName = methodVal === 'bank-mandiri' ? 'Bank Mandiri' : methodVal === 'bank-bni' ? 'Bank BNI' : 'Bank';
                    showToast(`✓ Pembayaran Transfer ${bankName} Sukses!${methodMsg}`);
                } else {
                    showToast(`✓ Pesanan terkonfirmasi! Bayar di kasir.${methodMsg}`);
                }

                // Reset cart lokal
                shoppingCart = {};
                localStorage.setItem('shoppingCart', JSON.stringify(shoppingCart));
                checkoutItems = []; checkoutSubtotal = 0; checkoutDiscount = 0; checkoutGrandTotal = 0;
                updateHeaderCartBadge();

                setTimeout(() => { switchPage('page-orders'); }, 1000);

            } catch (err) {
                console.error('[checkout]', err);
                showToast('Terjadi kesalahan. Coba lagi.');
                chkBtnConfirmPay.disabled = false;
                chkBtnConfirmPay.textContent = 'Bayar Sekarang';
            }
        });
    }

// Populate dynamic orders details on orders page load
    if (pageName === 'orders.html') {
        // Coba load dari API dulu, fallback ke localStorage
        const loadActiveOrder = async () => {
            let activeOrder = null;

            if (lc_token) {
                try {
                    const res = await apiFetch('/orders/active');
                    if (res && res.ok) {
                        const data = await res.json();
                        if (data.success && data.order) {
                            activeOrder = {
                                id:    data.order.order_code,
                                items: data.order.items.map(i => ({
                                    name:  i.food_name,
                                    price: i.food_price,
                                    qty:   i.quantity,
                                    note:  i.note || '',
                                })),
                                total: data.order.grand_total,
                                status: data.order.status,
                            };
                        }
                    }
                } catch (e) { /* fallback */ }
            }

            // Fallback ke localStorage
            if (!activeOrder) {
                activeOrder = JSON.parse(localStorage.getItem('activeOrderData'));
            }

            if (activeOrder) {
                const idLbl = document.getElementById('active-order-id-lbl');
                if (idLbl) idLbl.textContent = activeOrder.id;

                const activeOrderTotal = document.getElementById('activity-order-total-price');
                if (activeOrderTotal) {
                    activeOrderTotal.textContent = `Rp ${activeOrder.total.toLocaleString('id-ID')}`;
                }

                const activeOrderItemsList = document.getElementById('activity-order-items-list');
                if (activeOrderItemsList) {
                    activeOrderItemsList.innerHTML = '';
                    activeOrder.items.forEach(item => {
                        const row = document.createElement('div');
                        row.classList.add('details-box-row');
                        const noteStr = item.note ? ` <span style="font-size: 11px; color: var(--clr-warning); font-style: italic;">(${item.note})</span>` : '';
                        const itemName = item.name || item.food_name || '-';
                        const itemQty  = item.qty  || item.quantity  || 1;
                        const itemPrice = item.price || item.food_price || 0;
                        row.innerHTML = `
                            <span>${itemQty}x ${itemName}${noteStr}</span>
                            <span>Rp ${(itemPrice * itemQty).toLocaleString('id-ID')}</span>
                        `;
                        activeOrderItemsList.appendChild(row);
                    });
                }
            }
        };

        loadActiveOrder();

        // Stepper animation
        const activityStepperFill = document.getElementById('activity-stepper-fill');
        if (activityStepperFill) {
            activityStepperFill.style.width = '0%';
            setTimeout(() => { activityStepperFill.style.width = '50%'; }, 300);
        }
    }

// Add directly from Price recommendation lists
document.querySelectorAll('.btn-add-cart-direct').forEach(btn => {
    btn.addEventListener('click', () => {
        const foodId = btn.getAttribute('data-food-id');
        addToCart(foodId);
    });
});

// Reorder buttons click listener (opens drawer automatically after adding item)
document.querySelectorAll('.hcard-reorder-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        setTimeout(() => {
            cartOverlay.classList.add('active');
            updateCartDrawerUI();
        }, 150);
    });
});

// Price Filter Pills Clicks
const pricePills = document.querySelectorAll('.price-pill'); pricePills.forEach(pill => {
    pill.addEventListener('click', () => {
        pricePills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');

        const maxPriceStr = pill.getAttribute('data-price-max');
        if (maxPriceStr) {
            currentPriceFilter = parseInt(maxPriceStr);
        } else {
            currentPriceFilter = null; // "Semua Harga" or reset
        }
        renderFoodCards();
    });
});

// Category Multi-Filter Pills (independent from category tabs)
const categoryFilterPills = document.querySelectorAll('.category-filter-pill'); categoryFilterPills.forEach(pill => {
    pill.addEventListener('click', () => {
        categoryFilterPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');

        currentCategoryFilter = pill.getAttribute('data-category');
        renderFoodCards();
    });
});

// Rating Filter Pills
const ratingFilterPills = document.querySelectorAll('.rating-filter-pill'); ratingFilterPills.forEach(pill => {
    pill.addEventListener('click', () => {
        ratingFilterPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');

        const minRatingStr = pill.getAttribute('data-rating-min');
        currentRatingFilter = parseFloat(minRatingStr) || 0;
        renderFoodCards();
    });
});

// Global Reset Button: reset ALL filters simultaneously
const btnPriceReset = document.getElementById('btn-price-filter-reset');
if (btnPriceReset) {
    btnPriceReset.addEventListener('click', () => {
        // Reset price filter
        pricePills.forEach(p => p.classList.remove('active'));
        const allPriceBtn = document.getElementById('btn-price-all');
        if (allPriceBtn) allPriceBtn.classList.add('active');
        currentPriceFilter = null;

        // Reset category filter
        categoryFilterPills.forEach(p => p.classList.remove('active'));
        const allCatPill = document.querySelector('.category-filter-pill[data-category="all"]');
        if (allCatPill) allCatPill.classList.add('active');
        currentCategoryFilter = 'all';

        // Reset rating filter
        ratingFilterPills.forEach(p => p.classList.remove('active'));
        const allRatingPill = document.querySelector('.rating-filter-pill[data-rating-min="0"]');
        if (allRatingPill) allRatingPill.classList.add('active');
        currentRatingFilter = 0;

        renderFoodCards();
        showToast('✓ Semua saringan telah direset!');
    });
}

    // 5b. Render Frequent Carousel Dynamically sorted by popularity (sold)
    const renderFrequentCarousel = () => {
        const carousel = document.getElementById('frequent-carousel');
        if (!carousel) return;

        // Parse sold count helper
        const parseSoldCount = (soldStr) => {
            if (!soldStr) return 0;
            const cleanStr = soldStr.toLowerCase().replace('kali', '').replace('+', '').trim();
            if (cleanStr.includes('k')) {
                return parseFloat(cleanStr.replace('k', '')) * 1000;
            }
            return parseFloat(cleanStr) || 0;
        };

        // Sort items by popularity (highest sold first)
        const sortedItems = [...menuItems].sort((a, b) => {
            return parseSoldCount(b.sold) - parseSoldCount(a.sold);
        });

        // Take top sold items (e.g. top 5 items)
        const topItems = sortedItems.slice(0, 5);

        carousel.innerHTML = '';
        topItems.forEach(food => {
            const triedText = food.sold.replace(' kali', '');
            const card = document.createElement('div');
            card.classList.add('frequent-card');
            
            // Format price without "Rp" prefix, using thousands separator
            const formattedPrice = food.price.toLocaleString('id-ID');

            card.innerHTML = `
                <img src="${food.img}" class="frequent-img" alt="${food.name}">
                <div class="frequent-info">
                    <span class="frequent-name">${food.name}</span>
                    <span class="frequent-tried">sudah dicoba ${triedText}</span>
                    <div class="frequent-price-row">
                        <span class="frequent-price">${formattedPrice}</span>
                        <button class="btn-coba" data-food-id="${food.id}">Coba</button>
                    </div>
                </div>
            `;
            carousel.appendChild(card);
        });

        // Bind Coba buttons in frequent carousel
        carousel.querySelectorAll('.btn-coba').forEach(btn => {
            btn.addEventListener('click', () => {
                const foodId = btn.getAttribute('data-food-id');
                addToCart(foodId);
                // Open cart drawer automatically
                setTimeout(() => {
                    cartOverlay.classList.add('active');
                    updateCartDrawerUI();
                }, 200);
            });
        });
    };

// Loyalty Perk Banner Claim Award
if (localStorage.getItem('loyaltyClaimed') === 'true') {
    const btn = document.getElementById('btn-claim-loyalty');
    if (btn) {
        btn.disabled = true;
        btn.textContent = "CLAIMED";
        btn.style.opacity = '0.6';
        btn.style.cursor = 'default';
    }
}

const btnClaimLoyalty = document.getElementById('btn-claim-loyalty');
if (btnClaimLoyalty && localStorage.getItem('loyaltyClaimed') !== 'true') {
    btnClaimLoyalty.addEventListener('click', () => {
        saldoCuyBalance += 5000;
        localStorage.setItem('saldoCuyBalance', saldoCuyBalance.toString());
        localStorage.setItem('loyaltyClaimed', 'true');
        updateSaldoUI();
        showToast("✓ Cashback Rp 5.000 berhasil ditambahkan ke SaldoCuy!");
        btnClaimLoyalty.disabled = true;
        btnClaimLoyalty.textContent = "CLAIMED";
        btnClaimLoyalty.style.opacity = '0.6';
        btnClaimLoyalty.style.cursor = 'default';
    });
}

// Persistent Bottom Nav Handlers (Mobile/Tablet)
const mobileHomeBtn = document.getElementById('mobile-home-btn');
const mobileCartBtn = document.getElementById('mobile-cart-btn');
const mobileQueueBtn = document.getElementById('mobile-queue-btn');
const mobileProfileBtn = document.getElementById('mobile-profile-btn');

if (mobileHomeBtn) {
    mobileHomeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        switchPage('page-browse');
    });
}

if (mobileCartBtn) {
    mobileCartBtn.addEventListener('click', (e) => {
        e.preventDefault();
        cartOverlay.classList.add('active');
        updateCartDrawerUI();
    });
}

if (mobileQueueBtn) {
    mobileQueueBtn.addEventListener('click', (e) => {
        e.preventDefault();
        switchPage('page-orders');
    });
}

if (mobileProfileBtn) {
    mobileProfileBtn.addEventListener('click', (e) => {
        e.preventDefault();
        switchPage('page-profile');
    });
}

// 8. Helper Toast Notifications
let toastTimer = null;
const showToast = (message) => {
    if (toastTimer) clearTimeout(toastTimer);

    toastMsg.textContent = message;
    toastBox.classList.add('active');

    toastTimer = setTimeout(() => {
        toastBox.classList.remove('active');
    }, 2500);
};

// EXPLORE CATEGORIES MENU ENGINE (menu.html)
const exploreMenuGrid = document.getElementById('explore-menu-grid');
const exploreCatTitle = document.getElementById('explore-cat-title');
const exploreCatDesc = document.getElementById('explore-cat-desc');
const exploreCatPills = document.querySelectorAll('.explore-cat-pill');

const categoryTaglines = {
    nasi: 'Best comfort food choices',
    mie: 'Rich aromatic noodle experiences',
    sweets: 'Indulgent sweet delights',
    snack: 'Crispy and savory light bites',
    minuman: 'Refreshing ice cold beverages'
};

const renderExploreMenu = (cat) => {
    if (!exploreMenuGrid) return;

    // Filter menu items by category
    const filtered = menuItems.filter(item => item.category === cat);

    if (filtered.length === 0) {
        exploreMenuGrid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--clr-text-muted);">
                    <i data-lucide="ban" width="32" height="32" style="margin-bottom: 12px; opacity: 0.5;"></i>
                    <p style="font-size: 14px; font-weight: 500;">Tidak ada menu untuk kategori ini.</p>
                </div>
            `;
        if (window.lucide) window.lucide.createIcons();
        return;
    }

    exploreMenuGrid.innerHTML = '';
    filtered.forEach(food => {
        const card = document.createElement('div');
        card.classList.add('explore-food-card');
        card.style.opacity = '0';
        card.style.transform = 'translateY(10px)';
        card.style.transition = 'opacity 0.3s ease, transform 0.3s ease';

        const isAvailable = food.available !== false;
        if (!isAvailable) {
            card.classList.add('out-of-stock');
            card.style.filter = 'grayscale(0.35)';
            card.style.opacity = '0.85';
        }

        let badgeMarkup = '';
        if (food.badge) {
            badgeMarkup = `<span class="explore-food-badge">${food.badge}</span>`;
        } else if (food.id === 'nasi_jeruk') {
            badgeMarkup = `<span class="explore-food-badge">Best Seller</span>`;
        }

        // Get current item quantity from shoppingCart
        const cartEntry = shoppingCart[food.id];
        const currentQty = cartEntry ? cartEntry.qty : 0;

        card.innerHTML = `
                <div class="explore-food-img-wrapper">
                    <img src="${food.img}" class="explore-food-img" alt="${food.name}">
                    ${badgeMarkup}
                </div>
                <div class="explore-food-body">
                    <h4 class="explore-food-name">${food.name}</h4>
                    <div class="explore-food-status" style="margin-bottom: 8px; display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
                        <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: ${isAvailable ? '#4CAF50' : '#F44336'};"></span>
                        <span style="color: ${isAvailable ? '#4CAF50' : '#F44336'};">${isAvailable ? 'Tersedia' : 'Habis'}</span>
                    </div>
                    <p class="explore-food-desc">${food.desc || 'No description available.'}</p>
                    <div class="explore-food-footer">
                        <span class="explore-food-price">Rp ${food.price.toLocaleString('id-ID')}</span>
                        
                        <div class="explore-qty-selector" style="display: flex; align-items: center; border: 1.5px solid var(--clr-brand); border-radius: 50px; padding: 4px 10px; background-color: #FFFFFF; gap: 14px;">
                            <button class="explore-qty-btn btn-explore-minus" data-food-id="${food.id}" style="background: none; border: 1.5px solid var(--clr-brand); border-radius: 50%; width: 26px; height: 26px; display: flex; justify-content: center; align-items: center; cursor: ${isAvailable ? 'pointer' : 'not-allowed'}; color: ${isAvailable ? 'var(--clr-brand)' : '#CCCCCC'};" ${isAvailable ? '' : 'disabled'}>
                                <i data-lucide="minus" width="12" height="12"></i>
                            </button>
                            <span class="explore-qty-val" style="font-family: var(--font-heading); font-size: 14px; font-weight: 700; color: ${isAvailable ? 'var(--clr-text-main)' : '#CCCCCC'}; min-width: 12px; text-align: center;">${currentQty}</span>
                            <button class="explore-qty-btn btn-explore-plus" data-food-id="${food.id}" style="background: none; border: 1.5px solid var(--clr-brand); border-radius: 50%; width: 26px; height: 26px; display: flex; justify-content: center; align-items: center; cursor: ${isAvailable ? 'pointer' : 'not-allowed'}; color: ${isAvailable ? 'var(--clr-brand)' : '#CCCCCC'};" ${isAvailable ? '' : 'disabled'}>
                                <i data-lucide="plus" width="12" height="12"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;

        exploreMenuGrid.appendChild(card);

        // Animate card entrance
        setTimeout(() => {
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, 50);
    });

    // Add event listeners to the plus/minus buttons inside the dynamic capsule
    document.querySelectorAll('.btn-explore-plus').forEach(btn => {
        btn.addEventListener('click', () => {
            const foodId = btn.getAttribute('data-food-id');
            addToCart(foodId);
        });
    });

    document.querySelectorAll('.btn-explore-minus').forEach(btn => {
        btn.addEventListener('click', () => {
            const foodId = btn.getAttribute('data-food-id');
            subtractFromCart(foodId);
        });
    });

    if (window.lucide) {
        window.lucide.createIcons();
    }
};

const setupExplorePage = () => {
    if (!exploreMenuGrid) return;

    // Parse query params to select active category
    const urlParams = new URLSearchParams(window.location.search);
    let selectedCategory = urlParams.get('category') || 'nasi';

    // Check if selectedCategory is valid
    const validCategories = ['nasi', 'mie', 'sweets', 'snack', 'minuman'];
    if (!validCategories.includes(selectedCategory)) {
        selectedCategory = 'nasi';
    }

    // Highlight the pill and set tags
    exploreCatPills.forEach(pill => {
        const cat = pill.getAttribute('data-cat');
        if (cat === selectedCategory) {
            pill.classList.add('active');
        } else {
            pill.classList.remove('active');
        }

        // Click listener
        pill.addEventListener('click', () => {
            exploreCatPills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');

            const newCat = pill.getAttribute('data-cat');

            // Update header title & tagline
            exploreCatTitle.textContent = pill.textContent;
            exploreCatDesc.textContent = categoryTaglines[newCat] || 'Delicious choices';

            // Re-render
            renderExploreMenu(newCat);
        });
    });

    // Set initial header title and tagline
    const activePill = document.querySelector(`.explore-cat-pill[data-cat="${selectedCategory}"]`);
    if (activePill) {
        exploreCatTitle.textContent = activePill.textContent;
    }
    exploreCatDesc.textContent = categoryTaglines[selectedCategory] || 'Delicious choices';

    // Initial render
    renderExploreMenu(selectedCategory);
};

// Initialize explore page setup
setupExplorePage();

// ==========================================================================
// 8. PROFILE AVATAR CUSTOMIZATION & UPLOAD SYSTEM
// ==========================================================================

// Global function to sync the active avatar picture across all instances
const syncProfileAvatar = () => {
    const avatarData = localStorage.getItem('profileAvatarData');

    // Sync desktop & mobile header profile buttons (#profile-btn)
    const profileBtns = document.querySelectorAll('#profile-btn');
    profileBtns.forEach(btn => {
        let img = btn.querySelector('#header-profile-img');
        let icon = btn.querySelector('i') || btn.querySelector('svg');

        if (avatarData) {
            if (icon) icon.style.display = 'none';
            if (!img) {
                img = document.createElement('img');
                img.id = 'header-profile-img';
                btn.appendChild(img);
            }
            img.src = avatarData;
            img.style.display = 'block';
            btn.classList.add('profile-avatar');
        } else {
            if (icon) icon.style.display = 'block';
            if (img) img.style.display = 'none';
        }
    });

    // Sync mobile footer navigation profile item
    const mobileProfileBtn = document.getElementById('mobile-profile-btn');
    if (mobileProfileBtn) {
        const icon = mobileProfileBtn.querySelector('i') || mobileProfileBtn.querySelector('svg');
        let img = mobileProfileBtn.querySelector('.mobile-profile-img');

        if (avatarData) {
            if (icon) icon.style.display = 'none';
            if (!img) {
                img = document.createElement('img');
                img.className = 'mobile-profile-img';
                img.style.width = '20px';
                img.style.height = '20px';
                img.style.borderRadius = '50%';
                img.style.objectFit = 'cover';
                mobileProfileBtn.insertBefore(img, mobileProfileBtn.firstChild);
            }
            img.src = avatarData;
            img.style.display = 'inline-block';
        } else {
            if (icon) icon.style.display = 'inline-block';
            if (img) img.style.display = 'none';
        }
    }

    // Sync large profile avatar on profile.html
    const profilePageImg = document.getElementById('profile-avatar-img');
    const profilePagePlaceholder = document.getElementById('profile-avatar-placeholder');
    const btnDeleteOpt = document.getElementById('btn-opt-delete');

    if (profilePageImg && profilePagePlaceholder) {
        if (avatarData) {
            profilePagePlaceholder.style.display = 'none';
            profilePageImg.src = avatarData;
            profilePageImg.style.display = 'block';
            if (btnDeleteOpt) btnDeleteOpt.style.display = 'flex';
        } else {
            profilePagePlaceholder.style.display = 'block';
            profilePageImg.src = '';
            profilePageImg.style.display = 'none';
            if (btnDeleteOpt) btnDeleteOpt.style.display = 'none';
        }
    }
};

// Setup interactive events on the Profile Page
const setupProfileAvatarChanger = () => {
    const avatarCircle = document.getElementById('profile-avatar-circle');
    if (!avatarCircle) return; // Only execute if on profile page

    const fileInput = document.getElementById('avatar-file-input');

    // Modals
    const avatarModal = document.getElementById('avatar-modal-overlay');
    const driveModal = document.getElementById('drive-modal-overlay');
    const cameraModal = document.getElementById('camera-modal-overlay');

    // Close Buttons
    const closeAvatarModal = document.getElementById('avatar-modal-close');
    const closeDriveModal = document.getElementById('drive-modal-close');
    const closeCameraModal = document.getElementById('camera-modal-close');

    // Selection options
    const optGallery = document.getElementById('btn-opt-gallery');
    const optDrive = document.getElementById('btn-opt-drive');
    const optCamera = document.getElementById('btn-opt-camera');
    const optDelete = document.getElementById('btn-opt-delete');

    // Modal Helpers
    const openModal = (modal) => {
        if (modal) modal.classList.add('active');
    };
    const closeModal = (modal) => {
        if (modal) modal.classList.remove('active');
    };

    // Open options selector click
    avatarCircle.addEventListener('click', () => {
        openModal(avatarModal);
    });

    // Close options selector click
    closeAvatarModal.addEventListener('click', () => closeModal(avatarModal));

    // Close modals clicking outside boxes
    [avatarModal, driveModal, cameraModal].forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal(modal);
                if (modal === cameraModal) stopCameraStream();
            }
        });
    });

    // 1. SELECT FROM DEVICE GALLERY
    optGallery.addEventListener('click', () => {
        closeModal(avatarModal);
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const base64 = event.target.result;
            localStorage.setItem('profileAvatarData', base64);
            syncProfileAvatar();
            showToast("✓ Foto profil berhasil diperbarui dari Galeri!");
        };
        reader.readAsDataURL(file);
        fileInput.value = ''; // Reset uploader input
    });

    // 2. GOOGLE DRIVE DIRECTORY EXPLORER SIMULATION
    const driveConnectingBox = document.getElementById('drive-connecting-box');
    const driveExplorerBox = document.getElementById('drive-explorer-box');
    const driveLoaderTitle = document.getElementById('drive-loader-title');
    const driveLoaderDesc = document.getElementById('drive-loader-desc');

    optDrive.addEventListener('click', () => {
        closeModal(avatarModal);
        openModal(driveModal);

        driveConnectingBox.style.display = 'flex';
        driveExplorerBox.style.display = 'none';

        driveLoaderTitle.textContent = "Menghubungkan ke Google Drive...";
        driveLoaderDesc.textContent = "Harap tunggu sebentar, sedang mengamankan sambungan...";

        setTimeout(() => {
            driveLoaderTitle.textContent = "Membuka folder Drive...";
            driveLoaderDesc.textContent = "Membaca berkas di Drive Saya > Foto > LaperCuy_Profile...";
        }, 800);

        setTimeout(() => {
            driveConnectingBox.style.display = 'none';
            driveExplorerBox.style.display = 'flex';
        }, 1600);
    });

    closeDriveModal.addEventListener('click', () => closeModal(driveModal));

    // Click file item download simulator
    const driveFileCards = document.querySelectorAll('.drive-file-card');
    driveFileCards.forEach(card => {
        card.addEventListener('click', () => {
            const unsplashUrl = card.getAttribute('data-url');
            const fileName = card.querySelector('.drive-file-name').textContent;

            driveExplorerBox.style.display = 'none';
            driveConnectingBox.style.display = 'flex';
            driveLoaderTitle.textContent = `Mengunduh ${fileName}...`;
            driveLoaderDesc.textContent = "Menyinkronkan gambar profil Anda dengan Google Drive...";

            setTimeout(() => {
                localStorage.setItem('profileAvatarData', unsplashUrl);
                syncProfileAvatar();
                closeModal(driveModal);
                showToast(`✓ Foto profil berhasil diimpor dari Google Drive!`);
            }, 1300);
        });
    });

    // 3. CAMERA LIVE PREVIEW & countdown fallback
    const video = document.getElementById('camera-video');
    const cameraSimPreview = document.getElementById('camera-simulated-preview');
    const cameraStatusOverlay = document.getElementById('camera-status-overlay');
    const cameraTitleLabel = document.getElementById('camera-title-label');
    const cameraRecordDot = document.getElementById('camera-record-dot');
    const cameraCountdown = document.getElementById('camera-countdown');
    const cameraFlash = document.getElementById('camera-screen-flash');
    const btnCapture = document.getElementById('btn-camera-capture');
    const timerStamp = document.getElementById('camera-timer-stamp');

    let streamInstance = null;
    let cameraActive = false;
    let timerInterval = null;

    const stopCameraStream = () => {
        if (streamInstance) {
            streamInstance.getTracks().forEach(track => track.stop());
            streamInstance = null;
        }
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
        video.srcObject = null;
        cameraActive = false;
    };

    closeCameraModal.addEventListener('click', () => {
        closeModal(cameraModal);
        stopCameraStream();
    });

    // Synthesize Shutter audio trigger cleanly using Web Audio (mirrors mechanical mirror slaps!)
    const playShutterSound = () => {
        try {
            const audioCtx = new(window.AudioContext || window.webkitAudioContext)();

            // High-pitched transient click
            const clickOsc = audioCtx.createOscillator();
            const clickGain = audioCtx.createGain();
            clickOsc.connect(clickGain);
            clickGain.connect(audioCtx.destination);
            clickOsc.type = 'triangle';
            clickOsc.frequency.setValueAtTime(1100, audioCtx.currentTime);
            clickOsc.frequency.exponentialRampToValueAtTime(150, audioCtx.currentTime + 0.07);
            clickGain.gain.setValueAtTime(0.2, audioCtx.currentTime);
            clickGain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.07);

            clickOsc.start();
            clickOsc.stop(audioCtx.currentTime + 0.07);

            // Lower frequency mechanical slapper
            const slapOsc = audioCtx.createOscillator();
            const slapGain = audioCtx.createGain();
            slapOsc.connect(slapGain);
            slapGain.connect(audioCtx.destination);
            slapOsc.type = 'sawtooth';
            slapOsc.frequency.setValueAtTime(75, audioCtx.currentTime);
            slapOsc.frequency.linearRampToValueAtTime(10, audioCtx.currentTime + 0.16);
            slapGain.gain.setValueAtTime(0.3, audioCtx.currentTime);
            slapGain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.16);

            slapOsc.start();
            slapOsc.stop(audioCtx.currentTime + 0.16);
        } catch (err) {
            console.warn("Shutter audio synthesis not loaded:", err);
        }
    };

    optCamera.addEventListener('click', () => {
        closeModal(avatarModal);
        openModal(cameraModal);

        cameraCountdown.style.display = 'none';
        cameraFlash.classList.remove('flash-active');
        cameraStatusOverlay.style.display = 'flex';
        video.style.display = 'none';
        cameraSimPreview.style.display = 'none';
        cameraTitleLabel.textContent = "MENGAKTIFKAN KAMERA...";
        cameraRecordDot.style.background = "#FFEB3B";
        timerStamp.textContent = "REC 00:00:00";

        let seconds = 0;
        const startTimer = () => {
            if (timerInterval) clearInterval(timerInterval);
            timerInterval = setInterval(() => {
                seconds++;
                const pad = (val) => String(val).padStart(2, '0');
                timerStamp.textContent = `REC 00:00:${pad(seconds)}`;
            }, 1000);
        };

        // Attempt genuine webcam context
        navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'user'
                }
            })
            .then(stream => {
                streamInstance = stream;
                video.srcObject = stream;
                video.style.display = 'block';
                cameraStatusOverlay.style.display = 'none';
                cameraTitleLabel.textContent = "KAMERA AKTIF (LIVE)";
                cameraRecordDot.style.background = "#F44336";
                cameraActive = true;
                startTimer();
            })
            .catch(err => {
                console.log("Device webcam blocked, invoking simulation backdrop.", err);

                // Fallback to high-res Simulated viewfinder backdrop
                setTimeout(() => {
                    cameraStatusOverlay.style.display = 'none';
                    const mockPortrait = "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=600&auto=format&fit=crop";
                    cameraSimPreview.style.backgroundImage = `url('${mockPortrait}')`;
                    cameraSimPreview.style.display = 'block';
                    cameraTitleLabel.textContent = "KAMERA (SIMULASI AUTOFOKUS)";
                    cameraRecordDot.style.background = "#FF9800";
                    cameraActive = false;
                    startTimer();
                }, 1000);
            });
    });

    // Trigger shutter countdown capture
    btnCapture.addEventListener('click', () => {
        btnCapture.disabled = true;
        cameraCountdown.style.display = 'block';
        cameraCountdown.classList.remove('pulse');
        void cameraCountdown.offsetWidth; // Reflow reset animation

        let counter = 3;
        cameraCountdown.textContent = counter;
        cameraCountdown.classList.add('pulse');

        const countdownInterval = setInterval(() => {
            counter--;
            if (counter > 0) {
                cameraCountdown.textContent = counter;
                cameraCountdown.classList.remove('pulse');
                void cameraCountdown.offsetWidth; // Reflow
                cameraCountdown.classList.add('pulse');
            } else {
                clearInterval(countdownInterval);
                cameraCountdown.style.display = 'none';

                // Trigger Shutter Flash & Audio Synthesis
                playShutterSound();
                cameraFlash.classList.add('flash-active');

                setTimeout(() => {
                    if (cameraActive && streamInstance) {
                        // High-quality canvas render crop
                        const canvas = document.createElement('canvas');
                        canvas.width = video.videoWidth || 640;
                        canvas.height = video.videoHeight || 480;
                        const ctx = canvas.getContext('2d');
                        // Horizontally flip captured picture to represent natural mirrors
                        ctx.translate(canvas.width, 0);
                        ctx.scale(-1, 1);
                        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                        const selfieBase64 = canvas.toDataURL('image/jpeg', 0.9);
                        localStorage.setItem('profileAvatarData', selfieBase64);
                    } else {
                        // Captured simulated photoportrait
                        const simulatedUnsplash = "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=400&auto=format&fit=crop";
                        localStorage.setItem('profileAvatarData', simulatedUnsplash);
                    }

                    syncProfileAvatar();
                    stopCameraStream();
                    closeModal(cameraModal);
                    showToast("✓ Foto profil berhasil dipotret & disimpan!");
                    btnCapture.disabled = false;
                }, 400);
            }
        }, 1000);
    });

    // 4. RESET TO DEFAULT SILHOUETTE
    optDelete.addEventListener('click', () => {
        localStorage.removeItem('profileAvatarData');
        syncProfileAvatar();
        closeModal(avatarModal);
        showToast("✓ Foto profil telah dihapus.");
    });
};

// Initialize custom avatar settings
setupProfileAvatarChanger(); syncProfileAvatar();

// ── Logout handler
    const setupLogoutButton = () => {
        const logoutBtn = document.getElementById('btn-logout');
        if (!logoutBtn) return;
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('lc_token');
            localStorage.removeItem('lc_user');
            localStorage.removeItem('shoppingCart');
            localStorage.removeItem('activeOrderData');
            localStorage.removeItem('activeDiscounts');
            window.location.href = 'login.html';
        });
    };
    setupLogoutButton();

    // ── Update nama user di header/hero dari data login
    if (lc_user && lc_user.fullname) {
        syncProfileNameUI(lc_user.fullname);
    }

// 9. Initial Page Setup
    renderFoodCards(); updateHeaderCartBadge(); updateSaldoUI(); renderFrequentCarousel();
    if (window.lucide) {
        window.lucide.createIcons();
    }

    // Load data dari API setelah halaman siap
    loadMenuFromAPI();
    if (lc_token) {
        syncCartFromAPI();
    }

});


// --- KODE UNTUK SIDEBAR MOBILE ---
document.addEventListener('DOMContentLoaded', function() {
    const hamburgerBtn = document.getElementById('hamburger-menu');
    const closeBtn = document.getElementById('close-sidebar');
    const sidebar = document.getElementById('mobile-sidebar');

    if (hamburgerBtn && sidebar) {
        hamburgerBtn.addEventListener('click', function() {
            sidebar.classList.add('active');
            // Mencegah scroll pada body saat menu terbuka
            document.body.style.overflow = 'hidden'; 
        });
    }

    if (closeBtn && sidebar) {
        closeBtn.addEventListener('click', function() {
            sidebar.classList.remove('active');
            document.body.style.overflow = ''; 
        });
    }

    // Menutup sidebar jika mengklik area hitam (overlay)
    if (sidebar) {
        sidebar.addEventListener('click', function(e) {
            if (e.target === sidebar) {
                sidebar.classList.remove('active');
                document.body.style.overflow = '';
            }
        });
    }
    // --- LOGIKA UNTUK MENGATUR SIDEBAR ACTIVE SECARA OTOMATIS ---
const currentPath = window.location.pathname.split("/").pop(); // Mendapatkan nama file (misal: menu.html)
const sidebarLinks = document.querySelectorAll('.sidebar-item');

sidebarLinks.forEach(link => {
    // Ambil atribut href dari link
    const linkHref = link.getAttribute('href');
    
    // Hapus dulu class active yang ada
    link.classList.remove('active');
    
    // Jika href link sama dengan halaman saat ini, tambahkan class active
    if (currentPath === linkHref) {
        link.classList.add('active');
    } 
    // Kondisi khusus untuk halaman utama jika path kosong atau index.html
    else if ((currentPath === "" || currentPath === "index.html") && linkHref === "index.html") {
        link.classList.add('active');
    }

// ============================================================
// LIVE SEARCH BAR — Real-time search dari API /api/foods?q=
// ============================================================
const initSearchBar = (inputEl) => {
    if (!inputEl) return;

    const wrapper = inputEl.closest('.header-search') || inputEl.closest('.mobile-search-bar') || inputEl.parentElement;
    wrapper.style.position = 'relative';

    const dropdown = document.createElement('div');
    dropdown.className = 'search-dropdown';
    wrapper.appendChild(dropdown);

    let debounceTimer = null;
    let currentQuery  = '';
    let highlightedIndex = -1;

    const highlightText = (text, query) => {
        if (!query) return text;
        const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return text.replace(new RegExp(`(${escaped})`, 'gi'), '<mark class="search-highlight">$1</mark>');
    };

    const getResultItems = () => dropdown.querySelectorAll('.search-result-item');

    const showDropdown = (foods, query) => {
        dropdown.innerHTML = '';
        highlightedIndex = -1;

        if (!foods.length) {
            dropdown.innerHTML = `<div class="search-empty"><i data-lucide="search-x" width="18" height="18"></i><span>Tidak ada hasil untuk "<strong>${query}</strong>"</span></div>`;
            if (window.lucide) window.lucide.createIcons();
            dropdown.classList.add('active');
            return;
        }

        foods.slice(0, 8).forEach(food => {
            const item = document.createElement('div');
            item.className = 'search-result-item';
            item.setAttribute('data-food-id', food.food_id || food.id);

            const habis = food.is_available === false ? '<span class="search-result-badge-habis">Habis</span>' : '';
            item.innerHTML = `
                <img src="${food.img || 'assets/default.png'}" class="search-result-img" alt="${food.name}" onerror="this.src='assets/default.png'">
                <div class="search-result-info">
                    <span class="search-result-name">${highlightText(food.name, query)}</span>
                    <span class="search-result-cat">${food.category || ''} ${habis}</span>
                </div>
                <span class="search-result-price">Rp ${Number(food.price).toLocaleString('id-ID')}</span>`;

            item.addEventListener('mousedown', e => { e.preventDefault(); goToResult(food.name); });
            dropdown.appendChild(item);
        });

        const footer = document.createElement('div');
        footer.className = 'search-dropdown-footer';
        footer.innerHTML = `<i data-lucide="search" width="13" height="13"></i> Tekan <kbd>Enter</kbd> untuk semua hasil`;
        dropdown.appendChild(footer);

        if (window.lucide) window.lucide.createIcons();
        dropdown.classList.add('active');
    };

    const hideDropdown = () => { dropdown.classList.remove('active'); highlightedIndex = -1; };

    const goToResult = (name) => {
        hideDropdown();
        inputEl.value = '';
        window.location.href = `menu.html?q=${encodeURIComponent(name)}`;
    };

    const doSearch = async (query) => {
        currentQuery = query;
        if (!query || query.trim().length < 2) { hideDropdown(); return; }

        dropdown.innerHTML = '<div class="search-loading"><span class="search-spinner"></span>Mencari...</div>';
        dropdown.classList.add('active');

        try {
            const res = await fetch(`${API_BASE}/foods?q=${encodeURIComponent(query.trim())}`);
            const data = await res.json();
            if (currentQuery !== query) return;
            showDropdown(data.foods || [], query.trim());
        } catch {
            const local = menuItems.filter(f =>
                f.name.toLowerCase().includes(query.toLowerCase()) ||
                (f.desc || f.description || '').toLowerCase().includes(query.toLowerCase())
            );
            if (currentQuery !== query) return;
            showDropdown(local, query.trim());
        }
    };

    inputEl.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        const q = inputEl.value.trim();
        if (q.length < 2) { hideDropdown(); return; }
        debounceTimer = setTimeout(() => doSearch(q), 300);
    });

    inputEl.addEventListener('keydown', e => {
        const items = getResultItems();
        if (e.key === 'ArrowDown') { e.preventDefault(); if (!items.length) return; items[highlightedIndex]?.classList.remove('highlighted'); highlightedIndex = (highlightedIndex + 1) % items.length; items[highlightedIndex].classList.add('highlighted'); items[highlightedIndex].scrollIntoView({ block: 'nearest' }); return; }
        if (e.key === 'ArrowUp')   { e.preventDefault(); if (!items.length) return; items[highlightedIndex]?.classList.remove('highlighted'); highlightedIndex = (highlightedIndex - 1 + items.length) % items.length; items[highlightedIndex].classList.add('highlighted'); items[highlightedIndex].scrollIntoView({ block: 'nearest' }); return; }
        if (e.key === 'Escape')    { hideDropdown(); inputEl.blur(); return; }
        if (e.key === 'Enter') {
            e.preventDefault();
            if (highlightedIndex >= 0 && items[highlightedIndex]) { goToResult(items[highlightedIndex].querySelector('.search-result-name')?.textContent || inputEl.value); return; }
            const q = inputEl.value.trim();
            if (q) { hideDropdown(); window.location.href = `menu.html?q=${encodeURIComponent(q)}`; }
        }
    });

    inputEl.addEventListener('focus', () => { const q = inputEl.value.trim(); if (q.length >= 2) doSearch(q); });
    document.addEventListener('click', e => { if (!wrapper.contains(e.target)) hideDropdown(); });
};

// Inisialisasi kedua search bar (desktop + mobile)
initSearchBar(document.getElementById('search-input'));
initSearchBar(document.getElementById('mobile-search-input'));

// ── Jika halaman menu.html dengan ?q= di URL: filter grid dengan hasil pencarian
const _urlQ = new URLSearchParams(window.location.search).get('q');
if (_urlQ && document.getElementById('explore-menu-grid')) {
    const si  = document.getElementById('search-input');
    const msi = document.getElementById('mobile-search-input');
    if (si)  si.value  = _urlQ;
    if (msi) msi.value = _urlQ;

    const titleEl = document.getElementById('explore-cat-title');
    const descEl  = document.getElementById('explore-cat-desc');
    if (titleEl) titleEl.textContent = `Hasil: "${_urlQ}"`;
    if (descEl)  descEl.textContent  = 'Menu yang cocok dengan pencarianmu';
    document.querySelectorAll('.explore-cat-pill').forEach(p => p.classList.remove('active'));

    const renderSearchGrid = async (q) => {
        const grid = document.getElementById('explore-menu-grid');
        if (!grid) return;

        try {
            const res  = await fetch(`${API_BASE}/foods?q=${encodeURIComponent(q)}`);
            const data = await res.json();
            const results = normalizeFoods(data.foods || []);

            if (!results.length) {
                grid.innerHTML = `
                    <div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--clr-text-muted);">
                        <i data-lucide="search-x" width="42" height="42" style="opacity:.35;margin-bottom:14px;display:block;margin-inline:auto;"></i>
                        <p style="font-size:16px;font-weight:600;margin-bottom:8px;">Tidak ada menu untuk "<strong>${q}</strong>"</p>
                        <a href="menu.html" style="color:var(--clr-brand);font-size:13px;text-decoration:underline;">← Lihat semua menu</a>
                    </div>`;
                if (window.lucide) window.lucide.createIcons();
                return;
            }

            grid.innerHTML = '';
            results.forEach(food => {
                const inCart   = shoppingCart[food.id];
                const qty      = inCart ? inCart.qty : 0;
                const isUnavail = food.available === false;

                const card = document.createElement('div');
                card.className = `explore-menu-card${isUnavail ? ' unavailable' : ''}`;
                card.innerHTML = `
                    <div class="explore-card-img-wrapper">
                        <img src="${food.img}" class="explore-card-img" alt="${food.name}" onerror="this.src='assets/default.png'">
                        ${food.badge ? `<span class="food-badge ${food.badge.includes('%') ? 'badge-discount' : 'badge-bestseller'}">${food.badge}</span>` : ''}
                        ${isUnavail ? '<div class="explore-card-unavailable-overlay"><span>Habis</span></div>' : ''}
                    </div>
                    <div class="explore-card-body">
                        <h4 class="explore-card-name">${food.name}</h4>
                        <p class="explore-card-desc">${food.desc || food.description || ''}</p>
                        <div class="explore-card-footer">
                            <span class="explore-card-price">Rp ${food.price.toLocaleString('id-ID')}</span>
                            ${isUnavail
                                ? '<span style="font-size:11px;color:#E85D04;font-weight:600;">Habis</span>'
                                : qty > 0
                                    ? `<div class="explore-qty-control">
                                        <button class="explore-qty-btn explore-qty-minus" data-food-id="${food.id}"><i data-lucide="minus" width="12" height="12"></i></button>
                                        <span class="explore-qty-val">${qty}</span>
                                        <button class="explore-qty-btn explore-qty-plus"  data-food-id="${food.id}"><i data-lucide="plus"  width="12" height="12"></i></button>
                                       </div>`
                                    : `<button class="explore-add-btn" data-food-id="${food.id}"><i data-lucide="plus" width="14" height="14"></i></button>`}
                        </div>
                    </div>`;
                grid.appendChild(card);
            });

            grid.querySelectorAll('.explore-add-btn, .explore-qty-plus').forEach(btn => btn.addEventListener('click', () => addToCart(btn.getAttribute('data-food-id'))));
            grid.querySelectorAll('.explore-qty-minus').forEach(btn => btn.addEventListener('click', () => subtractFromCart(btn.getAttribute('data-food-id'))));

            if (window.lucide) window.lucide.createIcons();
        } catch (e) {
            console.error('[Search URL] Error:', e);
        }
    };

    setTimeout(() => renderSearchGrid(_urlQ), 250);
}
});
});