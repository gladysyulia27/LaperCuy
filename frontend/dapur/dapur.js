const staffTokenKey = 'lapercuy_staff_token';
const moneyKitchen = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;

async function staffApi(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = sessionStorage.getItem(staffTokenKey);
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`/api${path}`, { ...options, headers });
  if (response.status === 401 && !path.startsWith('/staff/login')) location.href = '/dapur/login.html';
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Request gagal.');
  return data;
}

function initStaffLogin() {
  document.getElementById('staff-login').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    const msg = document.getElementById('message');
    msg.textContent = 'Memeriksa akun...';
    try {
      const data = await staffApi('/staff/login', {
        method: 'POST',
        body: JSON.stringify({ username: form.get('username'), password: form.get('password') }),
      });
      sessionStorage.setItem(staffTokenKey, data.token);
      location.href = '/dapur/index.html';
    } catch (error) {
      msg.textContent = error.message;
      msg.className = 'toast error';
    }
  });
}

function actions(order) {
  const map = {
    QUEUED: [['ACCEPTED', 'TERIMA'], ['REJECTED', 'TOLAK']],
    ACCEPTED: [['PREPARING', 'MULAI PROSES'], ['REJECTED', 'TOLAK']],
    PREPARING: [['READY', 'SIAP DIAMBIL']],
    READY: [['PICKED_UP', 'SUDAH DIAMBIL']],
  };
  return (map[order.status] || []).map(([status, label]) => `<button class="btn ${status === 'REJECTED' ? 'secondary' : 'primary'}" data-status="${status}" data-id="${order.id}">${label}</button>`).join('');
}

function card(order) {
  return `
    <article class="order-card">
      <div class="split"><strong>${order.order_code}</strong><span>${new Date(order.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span></div>
      <div class="muted">${order.queue_weight} menit kerja | ${moneyKitchen(order.grand_total)}</div>
      <ul>${(order.items || []).map((item) => `<li>${item.quantity}x ${item.food_name}${item.note ? ` - ${item.note}` : ''}</li>`).join('')}</ul>
      <div class="actions">${actions(order)}</div>
    </article>`;
}

async function loadKitchen() {
  const [orders, summary, foods, settings] = await Promise.all([
    staffApi('/staff/orders'),
    fetch('/api/queue/summary').then((r) => r.json()),
    staffApi('/foods').catch(() => fetch('/api/foods').then((r) => r.json())),
    staffApi('/staff/settings'),
  ]);
  ['QUEUED', 'ACCEPTED', 'PREPARING', 'READY'].forEach((status) => {
    document.getElementById(`col-${status}`).innerHTML = orders.orders.filter((o) => o.status === status).map(card).join('') || '<div class="empty">Kosong</div>';
  });
  document.getElementById('active-count').textContent = summary.activeOrderCount || 0;
  document.querySelectorAll('[data-status]').forEach((button) => button.addEventListener('click', updateStatus));
  renderFoods(foods.foods || []);
  const s = settings.settings;
  document.getElementById('orders-open').checked = !!s.orders_open;
  document.getElementById('max-active').value = s.maximum_active_orders;
  document.getElementById('parallelism').value = s.kitchen_parallelism;
  document.getElementById('announcement').value = s.public_announcement || '';
}

async function updateStatus(event) {
  const button = event.currentTarget;
  button.disabled = true;
  let reason = null;
  if (button.dataset.status === 'REJECTED') reason = prompt('Alasan penolakan:');
  try {
    await staffApi(`/staff/orders/${button.dataset.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: button.dataset.status, reason }),
    });
    await loadKitchen();
  } catch (error) {
    alert(error.message);
    button.disabled = false;
  }
}

function renderFoods(foods) {
  document.getElementById('foods').innerHTML = foods.map((food) => `
    <div class="cart-item split">
      <div><strong>${food.name}</strong><div class="muted">${food.category} | ${moneyKitchen(food.price)}</div></div>
      <label>Stok <input class="search" style="width:90px" type="number" min="0" value="${food.stock}" data-stock="${food.food_id}"></label>
      <label>Menit <input class="search" style="width:90px" type="number" min="1" value="${food.prep_minutes}" data-prep="${food.food_id}"></label>
      <label><input type="checkbox" ${food.is_available ? 'checked' : ''} data-avail="${food.food_id}"> Aktif</label>
    </div>`).join('');
  document.querySelectorAll('[data-stock],[data-prep],[data-avail]').forEach((input) => input.addEventListener('change', async () => {
    const id = input.dataset.stock || input.dataset.prep || input.dataset.avail;
    const row = input.closest('.cart-item');
    await staffApi(`/staff/foods/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        stock: Number(row.querySelector('[data-stock]').value),
        prep_minutes: Number(row.querySelector('[data-prep]').value),
        is_available: row.querySelector('[data-avail]').checked,
      }),
    });
  }));
}

function initKitchen() {
  if (!sessionStorage.getItem(staffTokenKey)) location.href = '/dapur/login.html';
  document.getElementById('logout').addEventListener('click', async () => {
    await staffApi('/staff/logout', { method: 'POST' }).catch(() => {});
    sessionStorage.removeItem(staffTokenKey);
    location.href = '/dapur/login.html';
  });
  document.getElementById('refresh').addEventListener('click', loadKitchen);
  document.getElementById('save-settings').addEventListener('click', async () => {
    await staffApi('/staff/settings', {
      method: 'PATCH',
      body: JSON.stringify({
        orders_open: document.getElementById('orders-open').checked,
        maximum_active_orders: Number(document.getElementById('max-active').value),
        kitchen_parallelism: Number(document.getElementById('parallelism').value),
        public_announcement: document.getElementById('announcement').value,
      }),
    });
    await loadKitchen();
  });
  const socket = io({ auth: { role: 'kitchen', token: sessionStorage.getItem(staffTokenKey) } });
  socket.on('connect', () => { document.getElementById('connection').textContent = 'Realtime tersambung'; });
  socket.on('disconnect', () => { document.getElementById('connection').textContent = 'Realtime terputus, polling aktif'; });
  ['order:created', 'order:status-changed', 'queue:updated', 'settings:updated'].forEach((event) => socket.on(event, loadKitchen));
  loadKitchen();
  setInterval(loadKitchen, 15000);
}
