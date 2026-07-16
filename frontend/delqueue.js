const API = '/api';
const tokenKey = 'delqueue_student_token';

const money = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;
const token = () => sessionStorage.getItem(tokenKey);
const setToken = (value) => sessionStorage.setItem(tokenKey, value);

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token()) headers.Authorization = `Bearer ${token()}`;
  const response = await fetch(`${API}${path}`, { ...options, headers });
  if (response.status === 401 && !path.startsWith('/sessions')) {
    sessionStorage.removeItem(tokenKey);
    location.href = '/index.html';
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Request gagal.');
  return data;
}

function requireSession() {
  if (!token()) location.href = '/index.html';
}

function nav(active) {
  return `
    <header class="topbar">
      <div class="topbar-inner">
        <a href="/index.html" class="brand"><img src="/assets/lapercuylogo.png" alt="LaperCuy">DelQueue</a>
        <nav class="nav">
          <a class="${active === 'home' ? 'active' : ''}" href="/index.html">Beranda</a>
          <a class="${active === 'menu' ? 'active' : ''}" href="/menu.html">Menu</a>
          <a class="${active === 'orders' ? 'active' : ''}" href="/orders.html">Pesanan</a>
          <button id="logout-btn" type="button">Keluar</button>
        </nav>
      </div>
    </header>`;
}

function mountNav(active) {
  document.body.insertAdjacentHTML('afterbegin', nav(active));
  document.getElementById('logout-btn')?.addEventListener('click', () => {
    sessionStorage.removeItem(tokenKey);
    location.href = '/index.html';
  });
}

async function initHome() {
  mountNav('home');
  const form = document.getElementById('claim-form');
  const code = document.getElementById('code');
  const msg = document.getElementById('message');
  code.addEventListener('input', () => {
    let raw = code.value.toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 6);
    if (raw.length > 3) raw = `${raw.slice(0, 3)}-${raw.slice(3)}`;
    code.value = raw;
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    msg.textContent = 'Memeriksa kode...';
    try {
      const data = await api('/sessions/claim', { method: 'POST', body: JSON.stringify({ code: code.value }) });
      setToken(data.token);
      location.href = '/menu.html';
    } catch (error) {
      msg.textContent = error.message;
      msg.className = 'toast error';
    }
  });
  try {
    const q = await api('/queue/summary');
    document.getElementById('queue-summary').textContent = `${q.activeOrderCount} antrean aktif, perkiraan ${q.approximateWaitMin}-${q.approximateWaitMax} menit`;
  } catch {}
}

let foods = [];
async function loadFoods(category = 'all', q = '') {
  const params = new URLSearchParams();
  if (category !== 'all') params.set('category', category);
  if (q) params.set('q', q);
  const data = await api(`/foods?${params}`);
  foods = data.foods;
  renderFoods();
}

function renderFoods() {
  const grid = document.getElementById('foods');
  grid.innerHTML = foods.map((food) => `
    <article class="food-card">
      <img src="/${food.img}" alt="${food.name}">
      <div class="body">
        <div class="split"><h3>${food.name}</h3><span class="price">${money(food.price)}</span></div>
        <div class="muted">${food.description || ''}</div>
        <div class="split"><span>Stok ${food.stock} | ${food.prep_minutes} menit</span><span>${food.is_available ? 'Tersedia' : 'Habis'}</span></div>
        <button class="btn primary" ${food.is_available ? '' : 'disabled'} data-add="${food.food_id}">Tambah</button>
      </div>
    </article>`).join('');
  grid.querySelectorAll('[data-add]').forEach((button) => button.addEventListener('click', async () => {
    await api('/cart/items', { method: 'POST', body: JSON.stringify({ food_id: button.dataset.add, quantity: 1 }) });
    await loadCart();
  }));
}

async function loadCart() {
  const data = await api('/cart');
  const box = document.getElementById('cart');
  if (!data.cart.items.length) {
    box.innerHTML = '<div class="empty">Keranjang masih kosong.</div>';
  } else {
    box.innerHTML = data.cart.items.map((item) => `
      <div class="cart-item">
        <div class="split"><strong>${item.quantity}x ${item.name}</strong><span>${money(item.price * item.quantity)}</span></div>
        <input class="search" data-note="${item.id}" value="${item.note || ''}" placeholder="Catatan makanan">
        <div class="split">
          <button class="btn secondary" data-minus="${item.id}">Kurangi</button>
          <button class="btn ghost" data-remove="${item.id}">Hapus</button>
        </div>
      </div>`).join('');
  }
  document.getElementById('subtotal').textContent = money(data.cart.subtotal);
  const checkoutLink = document.getElementById('checkout-link');
  if (checkoutLink) checkoutLink.style.display = data.cart.items.length ? 'inline-flex' : 'none';
  box.querySelectorAll('[data-remove]').forEach((b) => b.addEventListener('click', async () => {
    await api(`/cart/items/${b.dataset.remove}`, { method: 'DELETE' });
    await loadCart();
  }));
  box.querySelectorAll('[data-minus]').forEach((b) => b.addEventListener('click', async () => {
    await api(`/cart/items/${b.dataset.minus}`, { method: 'PATCH', body: JSON.stringify({ quantity: 0 }) });
    await loadCart();
  }));
  box.querySelectorAll('[data-note]').forEach((input) => input.addEventListener('change', async () => {
    await api(`/cart/items/${input.dataset.note}`, { method: 'PATCH', body: JSON.stringify({ note: input.value }) });
  }));
}

async function initMenu() {
  requireSession();
  mountNav('menu');
  const chips = document.querySelectorAll('[data-cat]');
  const search = document.getElementById('search');
  let category = 'all';
  chips.forEach((chip) => chip.addEventListener('click', async () => {
    chips.forEach((c) => c.classList.remove('active'));
    chip.classList.add('active');
    category = chip.dataset.cat;
    await loadFoods(category, search.value);
  }));
  search.addEventListener('input', () => loadFoods(category, search.value));
  await loadFoods();
  await loadCart();
}

async function initCheckout() {
  requireSession();
  mountNav('menu');
  await loadCart();
  const msg = document.getElementById('confirm-msg');
  document.getElementById('confirm-order').addEventListener('click', async () => {
    msg.textContent = 'Mengirim pesanan...';
    try {
      await api('/orders', { method: 'POST', body: '{}' });
      location.href = '/orders.html';
    } catch (error) {
      msg.textContent = error.message;
      msg.className = 'toast error';
    }
  });
}

const statusOrder = ['QUEUED', 'ACCEPTED', 'PREPARING', 'READY', 'PICKED_UP'];
function renderOrder(order) {
  const box = document.getElementById('order');
  if (!order) {
    box.innerHTML = '<div class="empty">Belum ada pesanan aktif untuk kode ini.</div>';
    return;
  }
  const idx = statusOrder.indexOf(order.status);
  box.innerHTML = `
    <div class="order-card ${order.status === 'READY' ? 'ready' : ''}">
      <div class="split"><h2>Kode ${order.order_code}</h2><strong>${order.status}</strong></div>
      <p class="muted">Bayar di kantin saat mengambil pesanan. Perkiraan ${order.estimated_wait_minutes || 1} menit.</p>
      <div class="status-steps">
        ${statusOrder.map((s, i) => `<div class="step ${i <= idx ? 'done' : ''}">${s.replace('_', ' ')}</div>`).join('')}
      </div>
      <div>${(order.items || []).map((i) => `<div class="split"><span>${i.quantity}x ${i.food_name}${i.note ? ` (${i.note})` : ''}</span><span>${money(i.food_price * i.quantity)}</span></div>`).join('')}</div>
      <hr>
      <div class="split"><strong>Total</strong><strong>${money(order.grand_total)}</strong></div>
    </div>`;
  if (order.status === 'READY' && Notification.permission === 'granted') {
    new Notification('Pesanan siap diambil', { body: `Kode ${order.order_code} sudah READY.` });
  }
}

async function refreshOrder() {
  const data = await api('/orders/active');
  renderOrder(data.order);
}

async function initOrders() {
  requireSession();
  mountNav('orders');
  document.getElementById('notify-btn').addEventListener('click', () => Notification.requestPermission());
  await refreshOrder();
  const socketScript = document.createElement('script');
  socketScript.src = '/socket.io/socket.io.js';
  socketScript.onload = () => {
    const socket = io({ auth: { role: 'student', token: token() } });
    socket.on('order:status-changed', renderOrder);
    socket.on('order:ready', renderOrder);
  };
  document.body.appendChild(socketScript);
  setInterval(refreshOrder, 10000);
}
