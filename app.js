// =====================================================
// FENDYX - LÓGICA COMPLETA v3 (SPA TOTAL)
// =====================================================
const SUPABASE_URL = 'https://jsrarddyrjmuinwlyten.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzcmFyZGR5cmptdWlud2x5dGVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3MjIxNDQsImV4cCI6MjEwNDI5ODE0NH0.4BBl7Cu0mJFL014dbWGN49AYJVZLxeYbWnegn9-S41M';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = null, currentProfile = null, roleDetails = null;
let map = null, mapMarkers = [], myLocation = null, watchId = null, sharing = false;
let cart = { restId: null, restName: '', items: [] };
let currentConvId = null, viewedUserId = null, convCache = [];
let jitsiApi = null, callInterval = null, callSeconds = 0, callCostTotal = 0, currentCallId = null, iAmClient = false, currentCallRate = 0;
let clubLat = null, clubLng = null, currentClubId = null, radarInterval = null;
let liveChannel = null;

const ROLE_LABELS = { user:'Usuario', restaurant:'Restaurante', delivery:'Domiciliario', nightclub:'Discoteca', remote_worker:'Trabajador Remoto', admin:'Administrador' };
const STATUS_LABELS = { single:'Soltero/a', married:'Casado/a', looking:'Buscando conocer', unavailable:'No disponible' };
const ORDER_LABELS = { pending:'Pendiente', preparing:'Preparando', ready:'Listo para recoger', delivering:'En camino', delivered:'Entregado', cancelled:'Cancelado' };

// ===== INICIO =====
document.addEventListener('DOMContentLoaded', async () => {
  await loadBranding();
  const { data: { session } } = await db.auth.getSession();
  if (session) { currentUser = session.user; await enterApp(); }
});

async function enterApp() {
  await loadProfile();
  if (!currentProfile) { await handleLogout(); return; }
  if (currentProfile.is_banned) {
    await db.auth.signOut(); currentUser = null; currentProfile = null;
    document.getElementById('screen-app').classList.remove('active');
    document.getElementById('screen-auth').classList.add('active');
    showAuthMessage('🚫 Cuenta suspendida por el administrador', 'error');
    return;
  }
  await ensureRoleDetails();
  document.getElementById('screen-auth').classList.remove('active');
  document.getElementById('screen-app').classList.add('active');
  updateHeader(); loadModules(); showSection('dashboard'); startRealtime();
}

// ===== BRANDING =====
async function loadBranding() {
  const { data } = await db.from('app_branding').select('*').eq('id', 1).single();
  if (!data) return;
  const setLogo = (imgId, fallId) => {
    const img = document.getElementById(imgId), fall = document.getElementById(fallId);
    if (!img || !fall) return;
    if (data.logo_url) { img.src = data.logo_url; img.style.display = 'inline-block'; fall.style.display = 'none'; }
    else { img.style.display = 'none'; fall.style.display = 'block'; }
  };
  setLogo('authLogo', 'authLogoFallback'); setLogo('headerLogo', 'headerLogoFallback'); setLogo('adminLogoPreview', 'adminLogoFallback');
  const name = data.app_name || 'FENDYX';
  ['authAppName','headerAppName'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = name; });
  const an = document.getElementById('adminAppName'); if (an && !an.value) an.value = name;
}

// ===== AUTH =====
function switchAuthTab(tab) {
  document.getElementById('tabLogin').classList.toggle('active', tab === 'login');
  document.getElementById('tabRegister').classList.toggle('active', tab === 'register');
  document.getElementById('form-login').classList.toggle('active', tab === 'login');
  document.getElementById('form-register').classList.toggle('active', tab === 'register');
}
function togglePassword(id, btn) {
  const i = document.getElementById(id);
  i.type = i.type === 'password' ? 'text' : 'password';
  btn.textContent = i.type === 'password' ? '👁' : '🙈';
}
function showRoleFields() {
  const role = document.getElementById('regRole').value, c = document.getElementById('roleFields');
  const f = {
    restaurant: [['regRIF','RIF del negocio'],['regBusinessName','Nombre del local'],['regAddress','Dirección del local']],
    delivery: [['regLicense','Número de licencia'],['regPlate','Placa del vehículo']],
    nightclub: [['regClubName','Nombre del bar / discoteca'],['regClubAddress','Dirección del local']],
    remote_worker: [['regSpecialty','Especialidad'],['regRate','Tarifa por minuto (tokens)']]
  }[role] || [];
  c.innerHTML = f.map(x => `<div class="input-group"><input type="text" id="${x[0]}" placeholder="${x[1]}"></div>`).join('');
}
function showAuthMessage(msg, type) {
  const el = document.getElementById('authMessage');
  el.textContent = msg; el.className = 'auth-message ' + type;
}
async function handleLogin(e) {
  e.preventDefault();
  const { data, error } = await db.auth.signInWithPassword({
    email: document.getElementById('loginEmail').value.trim(),
    password: document.getElementById('loginPassword').value
  });
  if (error) { showAuthMessage('❌ ' + error.message, 'error'); return; }
  currentUser = data.user;
  await enterApp();
}
async function handleRegister(e) {
  e.preventDefault();
  const age = parseInt(document.getElementById('regAge').value);
  const role = document.getElementById('regRole').value;
  if (age < 18) { showAuthMessage('Debes ser mayor de 18 años', 'error'); return; }
  const meta = {
    full_name: document.getElementById('regName').value.trim(),
    age: age, role: role,
    rif: document.getElementById('regRIF')?.value || '',
    business_name: document.getElementById('regBusinessName')?.value || '',
    address: document.getElementById('regAddress')?.value || '',
    license: document.getElementById('regLicense')?.value || '',
    plate: document.getElementById('regPlate')?.value || '',
    club_name: document.getElementById('regClubName')?.value || '',
    club_address: document.getElementById('regClubAddress')?.value || '',
    specialty: document.getElementById('regSpecialty')?.value || '',
    rate: document.getElementById('regRate')?.value || ''
  };
  const { data, error } = await db.auth.signUp({
    email: document.getElementById('regEmail').value.trim(),
    password: document.getElementById('regPassword').value,
    options: { data: meta }
  });
  if (error) { showAuthMessage('❌ ' + error.message, 'error'); return; }
  if (data.session) {
    currentUser = data.user;
    localStorage.setItem('fendyx_pending_meta', JSON.stringify(meta));
    await enterApp();
  } else {
    localStorage.setItem('fendyx_pending_meta', JSON.stringify(meta));
    showAuthMessage('✅ Cuenta creada. Revisa tu correo e inicia sesión.', 'success');
    setTimeout(() => switchAuthTab('login'), 2200);
  }
}
async function resetPassword() {
  const email = prompt('Ingresa tu correo electrónico:');
  if (!email) return;
  const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo: location.origin });
  showToast(error ? '❌ ' + error.message : '📧 Correo de recuperación enviado');
}
async function handleLogout() {
  if (watchId) navigator.geolocation.clearWatch(watchId);
  if (radarInterval) clearInterval(radarInterval);
  if (liveChannel) db.removeChannel(liveChannel);
  await db.auth.signOut();
  location.reload();
}
async function ensureRoleDetails() {
  const { data } = await db.from('role_details').select('*').eq('user_id', currentUser.id).single();
  if (data) { roleDetails = data; return; }
  const meta = JSON.parse(localStorage.getItem('fendyx_pending_meta') || 'null') || {};
  const payload = {
    user_id: currentUser.id, role_type: currentProfile.role,
    rif: meta.rif || null, business_name: meta.business_name || null, address: meta.address || null,
    license_number: meta.license || null, vehicle_plate: meta.plate || null,
    specialty: meta.specialty || null,
    rate_per_minute: meta.rate ? parseFloat(meta.rate) : null
  };
  const { data: created } = await db.from('role_details').insert(payload).select().single();
  roleDetails = created;
  localStorage.removeItem('fendyx_pending_meta');
}

// ===== HEADER / NAV =====
function updateHeader() {
  if (!currentProfile) return;
  document.getElementById('userTokens').textContent = parseFloat(currentProfile.tokens_balance || 0).toFixed(2);
  document.getElementById('userAvatar').textContent = (currentProfile.full_name || 'U').charAt(0).toUpperCase();
  document.getElementById('welcomeName').textContent = (currentProfile.full_name || 'Usuario').split(' ')[0];
  document.getElementById('welcomeRole').textContent = 'Rol: ' + (ROLE_LABELS[currentProfile.role] || 'Usuario');
  document.querySelector('.admin-only').classList.toggle('hidden', currentProfile.role !== 'admin');
}
function toggleUserMenu() { document.getElementById('userMenu').classList.toggle('hidden'); }
document.addEventListener('click', e => {
  if (!e.target.closest('.user-avatar') && !e.target.closest('.user-menu')) document.getElementById('userMenu')?.classList.add('hidden');
});
function loadModules() {
  const mods = [
    { id:'map', icon:'📍', n:'Mapa Social' }, { id:'radar', icon:'🌙', n:'Radar Nocturno' },
    { id:'restaurants', icon:'🍽️', n:'Restaurantes' }, { id:'orders', icon:'📦', n:'Pedidos' },
    { id:'remote', icon:'💼', n:'Trabajo Remoto' }, { id:'marketplace', icon:'🛒', n:'Marketplace' },
    { id:'chat', icon:'💬', n:'Chat' }, { id:'tokens', icon:'◈', n:'Tokens' }, { id:'profile', icon:'👤', n:'Mi Perfil' }
  ];
  if (currentProfile.role === 'admin') mods.unshift({ id:'admin', icon:'🛡️', n:'Panel Admin' });
  document.getElementById('modulesGrid').innerHTML = mods.map(m =>
    `<div class="module-card" onclick="showSection('${m.id}')"><span class="icon">${m.icon}</span><h3>${m.n}</h3></div>`).join('');
}
function showSection(name) {
  document.querySelectorAll('.app-section').forEach(s => s.classList.remove('active'));
  document.getElementById('section-' + name)?.classList.add('active');
  document.getElementById('userMenu')?.classList.add('hidden');
  const navMap = { dashboard:0, map:1, radar:2, chat:3, tokens:4 };
  document.querySelectorAll('.bottom-nav .nav-item').forEach((n, i) => n.classList.toggle('active', i === navMap[name]));
  const loaders = {
    map: () => { initMap(); loadMapUsers(); },
    radar: loadRadar, restaurants: loadRestaurants, orders: loadOrders,
    remote: loadWorkers, marketplace: loadMarketplace, chat: loadConversations,
    tokens: loadTransactions, profile: loadProfileSection, admin: loadAdmin
  };
  loaders[name]?.();
}

// ===== MAPA SOCIAL =====
function initMap() {
  if (map) return;
  map = L.map('mapBox', { zoomControl: true }).setView([10.4806, -66.9036], 13);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { attribution: '© OpenStreetMap © CARTO' }).addTo(map);
  setTimeout(() => map.invalidateSize(), 300);
}
function toggleShareLocation() {
  if (sharing) {
    sharing = false;
    if (watchId) navigator.geolocation.clearWatch(watchId);
    db.from('user_locations').update({ is_sharing: false }).eq('user_id', currentUser.id).then(() => {});
    document.getElementById('btnShareLocation').textContent = '📡 Compartir mi ubicación';
    showToast('📴 Dejaste de compartir ubicación');
    return;
  }
  if (!navigator.geolocation) { showToast('❌ Tu dispositivo no soporta GPS'); return; }
  watchId = navigator.geolocation.watchPosition(async pos => {
    sharing = true;
    myLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    await db.from('user_locations').upsert({ user_id: currentUser.id, latitude: myLocation.lat, longitude: myLocation.lng, is_sharing: true }, { onConflict: 'user_id' });
    document.getElementById('btnShareLocation').textContent = '🔴 Compartiendo ubicación (tocar para parar)';
    if (map) map.setView([myLocation.lat, myLocation.lng], 15);
    loadMapUsers();
  }, err => showToast('❌ Permiso de ubicación denegado'), { enableHighAccuracy: true });
  showToast('📡 Compartiendo ubicación en vivo');
}
async function loadMapUsers() {
  if (!map) return;
  const { data } = await db.from('user_locations').select('*, profiles(id, full_name, role, avatar_url)').eq('is_sharing', true);
  mapMarkers.forEach(m => map.removeMarker(m)); mapMarkers = [];
  const list = document.getElementById('nearbyList');
  const rows = (data || []).filter(r => r.profiles);
  list.innerHTML = rows.length ? rows.map(r => {
    const d = myLocation ? Math.round(haversine(myLocation.lat, myLocation.lng, r.latitude, r.longitude)) + ' m' : '📍';
    return `<span class="chip" onclick="viewUserProfile('${r.profiles.id}')">🟢 ${r.profiles.full_name} · ${d}</span>`;
  }).join('') : '<p class="empty-state">Nadie comparte ubicación ahora</p>';
  rows.forEach(r => {
    const m = L.circleMarker([r.latitude, r.longitude], { radius: 9, color: '#00d9ff', fillColor: '#00d9ff', fillOpacity: 0.55 })
      .addTo(map)
      .bindPopup(`<div class="map-pop"><b>${r.profiles.full_name}</b><br>${ROLE_LABELS[r.profiles.role] || ''}<div class="pop-btns"><button class="btn-small" onclick="viewUserProfile('${r.profiles.id}')">Ver perfil</button><button class="btn-small success" onclick="startChatWith('${r.profiles.id}')">Mensaje</button></div></div>`);
    mapMarkers.push(m);
  });
}
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000, toR = x => x * Math.PI / 180;
  const dLat = toR(lat2 - lat1), dLon = toR(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toR(lat1)) * Math.cos(toR(lat2)) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ===== RADAR NOCTURNO =====
async function loadRadar() {
  document.getElementById('nightclubOwnerPanel').classList.toggle('hidden', currentProfile.role !== 'nightclub');
  const { data: clubs } = await db.from('nightclubs').select('*').eq('is_active', true);
  const txt = document.getElementById('radarStatusText');
  if (!clubs || !clubs.length) { txt.textContent = 'Aún no hay discotecas registradas en Fendyx'; currentClubId = null; document.getElementById('radarUsers').innerHTML = ''; return; }
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(async pos => {
      myLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      const inside = clubs.map(c => ({ c, d: haversine(myLocation.lat, myLocation.lng, c.latitude, c.longitude) }))
        .filter(x => x.d <= (x.c.geofence_radius || 20)).sort((a, b) => a.d - b.d)[0];
      if (inside) {
        currentClubId = inside.c.id;
        txt.innerHTML = `🎯 Estás dentro de <b>${inside.c.name}</b> (${Math.round(inside.d)} m del centro)`;
        await db.from('radar_presences').upsert({ user_id: currentUser.id, nightclub_id: currentClubId, status: document.getElementById('radarStatusSelect').value }, { onConflict: 'user_id,nightclub_id' });
        loadRadarUsers();
        if (!radarInterval) radarInterval = setInterval(loadRadar, 30000);
      } else {
        currentClubId = null;
        const near = clubs.map(c => ({ c, d: haversine(myLocation.lat, myLocation.lng, c.latitude, c.longitude) })).sort((a, b) => a.d - b.d)[0];
        txt.textContent = `😴 Fuera de geocerca. La más cercana: ${near.c.name} a ${Math.round(near.d)} m`;
        await db.from('radar_presences').delete().eq('user_id', currentUser.id);
        document.getElementById('radarUsers').innerHTML = '<p class="empty-state">Entra a una discoteca para aparecer en el radar</p>';
      }
    }, () => { txt.textContent = '⚠️ Activa el GPS para usar el Radar Nocturno'; });
  }
}
async function loadRadarUsers() {
  const { data } = await db.from('radar_presences').select('*, profiles(id, full_name, avatar_url)').eq('nightclub_id', currentClubId);
  document.getElementById('radarUsers').innerHTML = (data || []).map(p =>
    `<div class="radar-user-card" onclick="viewUserProfile('${p.profiles.id}')">
      <div class="conv-avatar" style="margin:0 auto">${(p.profiles.full_name || 'U').charAt(0).toUpperCase()}</div>
      <h4>${p.profiles.full_name}</h4>
      <p><span class="status-dot status-${p.status}"></span>${STATUS_LABELS[p.status] || p.status}</p>
    </div>`).join('') || '<p class="empty-state">Eres el primero en el radar 🎉</p>';
}
async function updateRadarStatus() {
  if (!currentClubId) { showToast('Primero entra a la geocerca de una discoteca'); return; }
  await db.from('radar_presences').update({ status: document.getElementById('radarStatusSelect').value })
    .eq('user_id', currentUser.id).eq('nightclub_id', currentClubId);
  showToast('✅ Estado actualizado: ' + STATUS_LABELS[document.getElementById('radarStatusSelect').value]);
  loadRadarUsers();
}
function setClubLocation() {
  navigator.geolocation.getCurrentPosition(pos => {
    clubLat = pos.coords.latitude; clubLng = pos.coords.longitude;
    document.getElementById('clubCoords').textContent = `📍 Ubicado: ${clubLat.toFixed(6)}, ${clubLng.toFixed(6)}`;
  }, () => showToast('❌ Permiso de GPS denegado'));
}
async function saveNightclub(e) {
  e.preventDefault();
  if (clubLat === null) { showToast('Primero pulsa "Usar mi ubicación actual"'); return; }
  await db.from('nightclubs').upsert({
    owner_id: currentUser.id, name: document.getElementById('clubName').value,
    address: document.getElementById('clubAddress').value,
    latitude: clubLat, longitude: clubLng,
    geofence_radius: parseInt(document.getElementById('clubRadius').value) || 300
  }, { onConflict: 'owner_id' });
  showToast('✅ Discoteca registrada con geocerca activa');
  loadRadar();
}

// ===== RESTAURANTES + CARRITO =====
async function loadRestaurants() {
  const { data } = await db.from('restaurants').select('*').order('created_at', { ascending: false });
  const isOwner = currentProfile.role === 'restaurant';
  document.getElementById('restaurantOwnerPanel').classList.toggle('hidden', !isOwner);
  if (isOwner) loadOwnerRestaurant();
  document.getElementById('restaurantsList').innerHTML = (data || []).map(r =>
    `<div class="card-item">
      <div class="card-title">${r.name}</div>
      <div class="card-desc">${r.description || 'Sin descripción'}</div>
      <div class="card-meta">📍 ${r.address || '—'}</div>
      <span class="status-pill ${r.is_open ? 'open' : 'closed'}">${r.is_open ? 'ABIERTO' : 'CERRADO'}</span><br>
      <button class="btn-small" onclick="viewMenu('${r.id}')">🍽️ Ver menú y pedir</button>
    </div>`).join('') || '<p class="empty-state">Aún no hay restaurantes. ¡Registra el tuyo!</p>';
}
async function loadOwnerRestaurant() {
  const { data } = await db.from('restaurants').select('*').eq('owner_id', currentUser.id).single();
  if (data) {
    document.getElementById('restName').value = data.name || '';
    document.getElementById('restAddress').value = data.address || '';
    document.getElementById('restDesc').value = data.description || '';
    document.getElementById('restOpen').checked = !!data.is_open;
  }
  loadMyMenu();
}
async function saveRestaurant(e) {
  e.preventDefault();
  await db.from('restaurants').upsert({
    owner_id: currentUser.id, name: document.getElementById('restName').value,
    address: document.getElementById('restAddress').value,
    description: document.getElementById('restDesc').value,
    is_open: document.getElementById('restOpen').checked
  }, { onConflict: 'owner_id' });
  showToast('✅ Restaurante guardado');
  loadRestaurants();
}
async function loadMyMenu() {
  const { data: rest } = await db.from('restaurants').select('id').eq('owner_id', currentUser.id).single();
  if (!rest) return;
  const { data } = await db.from('menu_items').select('*').eq('restaurant_id', rest.id);
  document.getElementById('myMenuList').innerHTML = (data || []).map(i =>
    `<div class="row-item"><div class="row-main"><b>${i.name}</b><small>◈ ${i.price} · ${i.is_available ? 'Disponible' : 'Agotado'}</small></div>
     <div class="row-actions">
       <button class="btn-small warn" onclick="toggleMenuItem('${i.id}', ${!i.is_available})">${i.is_available ? 'Agotar' : 'Activar'}</button>
       <button class="btn-small danger" onclick="deleteMenuItem('${i.id}')"></button>
     </div></div>`).join('') || '<p class="empty-state">Sin platos aún</p>';
}
async function addMenuItem(e) {
  e.preventDefault();
  const { data: rest } = await db.from('restaurants').select('id').eq('owner_id', currentUser.id).single();
  if (!rest) { showToast('Primero guarda tu restaurante'); return; }
  await db.from('menu_items').insert({
    restaurant_id: rest.id, name: document.getElementById('menuItemName').value,
    price: parseFloat(document.getElementById('menuItemPrice').value),
    description: document.getElementById('menuItemDesc').value
  });
  showToast('✅ Plato agregado'); e.target.reset(); loadMyMenu();
}
async function toggleMenuItem(id, avail) { await db.from('menu_items').update({ is_available: avail }).eq('id', id); loadMyMenu(); }
async function deleteMenuItem(id) { if (!confirm('¿Eliminar plato?')) return; await db.from('menu_items').delete().eq('id', id); loadMyMenu(); }
async function viewMenu(restId) {
  const { data: rest } = await db.from('restaurants').select('*').eq('id', restId).single();
  const { data } = await db.from('menu_items').select('*').eq('restaurant_id', restId).eq('is_available', true);
  document.getElementById('restModalTitle').textContent = '🍽️ ' + rest.name;
  document.getElementById('restModalMenu').innerHTML = (data || []).map(i =>
    `<div class="row-item"><div class="row-main"><b>${i.name}</b><small>${i.description || ''}</small></div>
     <div class="row-actions"><span class="price-tag">◈ ${i.price}</span>
     ${rest.is_open ? `<button class="btn-small success" onclick="addToCart('${i.id}','${i.name.replace(/'/g, '')}',${i.price})">+ Agregar</button>` : ''}</div></div>`).join('')
    || `<p class="empty-state">${rest.is_open ? 'Menú vacío' : '🔒 Restaurante cerrado'}</p>`;
  openModal('modal-restaurant');
}
function addToCart(id, name, price) {
  if (cart.restId && cart.restId !== currentMenuRestId()) { cart = { restId: null, restName: '', items: [] }; }
  cart.restId = currentMenuRestId();
  const existing = cart.items.find(i => i.id === id);
  if (existing) existing.qty++; else cart.items.push({ id, name, price, qty: 1 });
  updateCartFab(); showToast('🛒 ' + name + ' agregado');
}
function currentMenuRestId() {
  return document.getElementById('restModalTitle').dataset.restId || window._lastMenuRest;
}
async function openCartFromMenu(restId) { window._lastMenuRest = restId; }
function updateCartFab() {
  const count = cart.items.reduce((s, i) => s + i.qty, 0);
  document.getElementById('cartFab').classList.toggle('hidden', count === 0);
  document.getElementById('cartCount').textContent = count;
}
function changeQty(id, delta) {
  const item = cart.items.find(i => i.id === id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) cart.items = cart.items.filter(i => i.id !== id);
  updateCartFab(); openCart();
}
function openCart() {
  if (!cart.items.length) { closeModal('modal-cart'); updateCartFab(); return; }
  document.getElementById('cartItems').innerHTML = cart.items.map(i =>
    `<div class="row-item"><div class="row-main"><b>${i.name}</b><small>◈ ${i.price} c/u</small></div>
     <div class="row-actions"><button class="btn-small" onclick="changeQty('${i.id}',-1)">−</button>
     <span style="padding:0 8px;font-weight:800">${i.qty}</span>
     <button class="btn-small" onclick="changeQty('${i.id}',1)">+</button></div></div>`).join('');
  document.getElementById('cartTotal').textContent = cartTotal().toFixed(2);
  openModal('modal-cart');
}
function cartTotal() { return cart.items.reduce((s, i) => s + i.price * i.qty, 0); }
async function checkout() {
  const address = document.getElementById('cartAddress').value.trim();
  if (!address) { showToast('Escribe la dirección de entrega'); return; }
  const total = cartTotal();
  if (parseFloat(currentProfile.tokens_balance) < total) { showToast('❌ Saldo insuficiente. Recarga tokens.'); return; }
  const { data: order } = await db.from('orders').insert({
    customer_id: currentUser.id, restaurant_id: cart.restId,
    status: 'pending', total: total, delivery_address: address
  }).select().single();
  await db.from('order_items').insert(cart.items.map(i => ({ order_id: order.id, item_name: i.name, quantity: i.qty, unit_price: i.price })));
  await deductTokens(total, 'Pedido en restaurante');
  cart = { restId: null, restName: '', items: [] }; updateCartFab();
  closeModal('modal-cart'); closeModal('modal-restaurant');
  showToast('✅ Pedido realizado. ¡Buen provecho!');
  showSection('orders');
}

// ===== PEDIDOS =====
async function loadOrders() {
  const { data: mine } = await db.from('orders').select('*, restaurants(name), order_items(*)').eq('customer_id', currentUser.id).order('created_at', { ascending: false });
  document.getElementById('ordersList').innerHTML = (mine || []).map(o =>
    `<div class="row-item"><div class="row-main"><b>${o.restaurants?.name || 'Restaurante'}</b>
     <small>${(o.order_items || []).map(i => i.quantity + 'x ' + i.item_name).join(', ')}</small>
     <small>📍 ${o.delivery_address} · ◈ ${o.total}</small></div>
     <span class="order-status st-${o.status}">${ORDER_LABELS[o.status]}</span></div>`).join('')
    || '<p class="empty-state">Aún no has pedido nada</p>';

  const isOwner = currentProfile.role === 'restaurant';
  document.getElementById('ownerOrdersWrap').classList.toggle('hidden', !isOwner);
  if (isOwner) {
    const { data: rest } = await db.from('restaurants').select('id').eq('owner_id', currentUser.id).single();
    if (rest) {
      const { data: inc } = await db.from('orders').select('*, profiles(full_name), order_items(*)').eq('restaurant_id', rest.id).neq('status', 'delivered').order('created_at', { ascending: false });
      document.getElementById('ownerOrdersList').innerHTML = (inc || []).map(o => {
        let btn = '';
        if (o.status === 'pending') btn = `<button class="btn-small" onclick="advanceOrder('${o.id}','preparing')">👨🍳 Preparar</button>`;
        if (o.status === 'preparing') btn = `<button class="btn-small success" onclick="advanceOrder('${o.id}','ready')">✅ Listo</button>`;
        if (o.status === 'ready') btn = '<small>Esperando domiciliario…</small>';
        if (o.status === 'delivering') btn = '<small>🛵 En camino</small>';
        return `<div class="row-item"><div class="row-main"><b>${o.profiles?.full_name || 'Cliente'}</b>
          <small>${(o.order_items || []).map(i => i.quantity + 'x ' + i.item_name).join(', ')}</small>
          <small>📍 ${o.delivery_address} · ◈ ${o.total}</small></div>
          <div class="row-actions"><span class="order-status st-${o.status}">${ORDER_LABELS[o.status]}</span>${btn}</div></div>`;
      }).join('') || '<p class="empty-state">Sin pedidos activos</p>';
    }
  }
  const isDriver = currentProfile.role === 'delivery';
  document.getElementById('driverOrdersWrap').classList.toggle('hidden', !isDriver);
  if (isDriver) {
    const { data: avail } = await db.from('orders').select('*, restaurants(name), order_items(*)').eq('status', 'ready').is('driver_id', null);
    const { data: mineDrv } = await db.from('orders').select('*, restaurants(name)').eq('driver_id', currentUser.id).eq('status', 'delivering');
    document.getElementById('driverOrdersList').innerHTML =
      (avail || []).map(o => `<div class="row-item"><div class="row-main"><b>${o.restaurants?.name}</b><small>📍 ${o.delivery_address} · ◈ ${o.total}</small></div>
        <button class="btn-small success" onclick="acceptOrder('${o.id}')">🛵 Aceptar</button></div>`).join('') +
      (mineDrv || []).map(o => `<div class="row-item"><div class="row-main"><b>${o.restaurants?.name}</b><small>📍 ${o.delivery_address} · ◈ ${o.total}</small></div>
        <button class="btn-small success" onclick="advanceOrder('${o.id}','delivered')">📦 Entregado</button></div>`).join('')
      || '<p class="empty-state">No hay pedidos disponibles ahora</p>';
  }
}
async function advanceOrder(id, status) { await db.from('orders').update({ status }).eq('id', id); showToast('✅ Estado: ' + ORDER_LABELS[status]); loadOrders(); }
async function acceptOrder(id) { await db.from('orders').update({ driver_id: currentUser.id, status: 'delivering' }).eq('id', id); showToast('🛵 Pedido aceptado'); loadOrders(); }

// ===== TRABAJO REMOTO + JITSI =====
async function loadWorkers() {
  const isWorker = currentProfile.role === 'remote_worker';
  document.getElementById('workerPanel').classList.toggle('hidden', !isWorker);
  if (isWorker) {
    document.getElementById('workerSpecialty').value = roleDetails?.specialty || '';
    document.getElementById('workerRate').value = roleDetails?.rate_per_minute || '';
    document.getElementById('workerBio').value = currentProfile.bio || '';
    document.getElementById('workerOnline').checked = !!currentProfile.is_online;
    loadMyCalls();
  }
  const { data } = await db.from('profiles').select('*, role_details(*)').eq('role', 'remote_worker').neq('id', currentUser.id);
  document.getElementById('workersGrid').innerHTML = (data || []).map(w => {
    const rd = w.role_details?.[0];
    return `<div class="card-item">
      <div class="card-title">${w.full_name}</div>
      <span class="status-pill ${w.is_online ? 'online' : 'offline'}">${w.is_online ? 'EN LÍNEA' : 'DESCONECTADO'}</span>
      <div class="card-desc">${rd?.specialty || 'Sin especialidad'}</div>
      <div class="card-meta">${rd?.bio || ''}</div>
      <div class="price-tag">◈ ${rd?.rate_per_minute || 1}/min</div><br>
      <button class="btn-small success" onclick="startCall('${w.id}', ${rd?.rate_per_minute || 1})" ${w.is_online ? '' : 'disabled'}>📹 Llamar</button>
    </div>`;
  }).join('') || '<p class="empty-state">No hay trabajadores remotos aún</p>';
}
async function saveWorkerProfile(e) {
  e.preventDefault();
  await db.from('role_details').upsert({
    user_id: currentUser.id, role_type: 'remote_worker',
    specialty: document.getElementById('workerSpecialty').value,
    rate_per_minute: parseFloat(document.getElementById('workerRate').value),
    bio: document.getElementById('workerBio').value
  }, { onConflict: 'user_id' });
  await db.from('profiles').update({ bio: document.getElementById('workerBio').value, is_online: document.getElementById('workerOnline').checked }).eq('id', currentUser.id);
  showToast('✅ Perfil profesional guardado');
  await loadProfile(); loadWorkers();
}
async function loadMyCalls() {
  const { data } = await db.from('video_calls').select('*, profiles!video_calls_client_id_fkey(full_name)').eq('worker_id', currentUser.id).eq('status', 'active');
  document.getElementById('myCallsList').innerHTML = (data || []).map(c =>
    `<div class="row-item"><div class="row-main"><b>📞 ${c.profiles?.full_name || 'Cliente'}</b><small>◈ ${c.rate_per_minute}/min</small></div>
     <button class="btn-small success" onclick="joinCall('${c.id}','${c.room_id}',${c.rate_per_minute})">Contestar</button></div>`).join('')
    || '<p class="empty-state">Sin llamadas entrantes</p>';
}
async function startCall(workerId, rate) {
  if (parseFloat(currentProfile.tokens_balance) < rate) { showToast('❌ Saldo insuficiente para 1 minuto'); return; }
  const roomId = 'FENDYX' + Date.now();
  const { data: call } = await db.from('video_calls').insert({
    worker_id: workerId, client_id: currentUser.id, room_id: roomId,
    rate_per_minute: rate, status: 'active', started_at: new Date().toISOString()
  }).select().single();
  iAmClient = true; currentCallRate = rate;
  openCallUI(call.id, roomId);
}
async function joinCall(callId, roomId, rate) {
  iAmClient = false; currentCallRate = rate;
  openCallUI(callId, roomId);
}
function openCallUI(callId, roomId) {
  currentCallId = callId; callSeconds = 0; callCostTotal = 0;
  document.getElementById('callTimer').textContent = '00:00';
  document.getElementById('callCost').textContent = '◈ 0.00';
  openModal('modal-call');
  jitsiApi = new JitsiMeetExternalAPI('meet.jit.si', {
    roomName: roomId, width: '100%', height: '100%',
    parentNode: document.getElementById('jitsiContainer'),
    userInfo: { displayName: currentProfile.full_name },
    configOverwrite: { prejoinPageEnabled: false },
    interfaceConfigOverwrite: { SHOW_JITSI_WATERMARK: false }
  });
  callInterval = setInterval(async () => {
    callSeconds++;
    const m = String(Math.floor(callSeconds / 60)).padStart(2, '0'), s = String(callSeconds % 60).padStart(2, '0');
    document.getElementById('callTimer').textContent = m + ':' + s;
    if (iAmClient && callSeconds % 60 === 0) {
      callCostTotal += currentCallRate;
      document.getElementById('callCost').textContent = '◈ ' + callCostTotal.toFixed(2);
      const newBal = parseFloat(currentProfile.tokens_balance) - currentCallRate;
      await db.from('profiles').update({ tokens_balance: newBal }).eq('id', currentUser.id);
      await db.from('token_transactions').insert({ user_id: currentUser.id, amount: -currentCallRate, type: 'consumption', description: 'Videollamada minuto ' + (callSeconds / 60) });
      currentProfile.tokens_balance = newBal; updateHeader();
      if (newBal <= 0) { showToast('❌ Saldo agotado. Llamada finalizada.'); endCall(); }
    }
  }, 1000);
}
async function endCall() {
  if (jitsiApi) { jitsiApi.dispose(); jitsiApi = null; }
  if (callInterval) { clearInterval(callInterval); callInterval = null; }
  if (currentCallId) {
    await db.from('video_calls').update({ status: 'ended', ended_at: new Date().toISOString(), total_cost: callCostTotal }).eq('id', currentCallId);
  }
  currentCallId = null;
  closeModal('modal-call');
  showToast('📞 Llamada finalizada · Costo: ◈ ' + callCostTotal.toFixed(2));
}

// ===== MARKETPLACE =====
async function loadMarketplace() {
  const { data } = await db.from('marketplace_items').select('*, profiles(id, full_name)').eq('is_active', true).order('created_at', { ascending: false });
  document.getElementById('marketplaceGrid').innerHTML = (data || []).map(i =>
    `<div class="card-item">
      ${i.image_url ? `<img src="${i.image_url}" alt="">` : ''}
      <div class="card-title">${i.title}</div>
      <div class="card-desc">${i.description || ''}</div>
      <div class="card-meta">Vende: ${i.profiles?.full_name || '—'}</div>
      <div class="price-tag">◈ ${i.price}</div><br>
      ${i.seller_id !== currentUser.id ?
        `<button class="btn-small success" onclick="buyItem('${i.id}',${i.price},'${i.seller_id}')">Comprar</button>
         <button class="btn-small" onclick="startChatWith('${i.seller_id}')">💬</button>` : ''}
    </div>`).join('') || '<p class="empty-state">Marketplace vacío. ¡Publica el primero!</p>';
  const { data: mine } = await db.from('marketplace_items').select('*').eq('seller_id', currentUser.id);
  document.getElementById('myListings').innerHTML = (mine || []).map(i =>
    `<div class="row-item"><div class="row-main"><b>${i.title}</b><small>◈ ${i.price} · ${i.is_active ? 'Activo' : 'Vendido/Inactivo'}</small></div>
     <div class="row-actions">
       <button class="btn-small warn" onclick="toggleListing('${i.id}',${!i.is_active})">${i.is_active ? 'Pausar' : 'Activar'}</button>
       <button class="btn-small danger" onclick="deleteListing('${i.id}')">🗑</button>
     </div></div>`).join('') || '<p class="empty-state">Sin publicaciones propias</p>';
}
async function publishItem(e) {
  e.preventDefault();
  let imgUrl = null;
  const file = document.getElementById('itemImage').files[0];
  if (file) {
    const path = 'market/' + Date.now() + '_' + file.name.replace(/[^a-zA-Z0-9.]/g, '_');
    const { error } = await db.storage.from('fendyx-assets').upload(path, file);
    if (!error) imgUrl = db.storage.from('fendyx-assets').getPublicUrl(path).data.publicUrl;
  }
  await db.from('marketplace_items').insert({
    seller_id: currentUser.id, title: document.getElementById('itemTitle').value,
    description: document.getElementById('itemDesc').value,
    price: parseFloat(document.getElementById('itemPrice').value), image_url: imgUrl
  });
  showToast('✅ Producto publicado'); e.target.reset();
  document.getElementById('sellForm').classList.add('hidden');
  loadMarketplace();
}
async function toggleListing(id, active) { await db.from('marketplace_items').update({ is_active: active }).eq('id', id); loadMarketplace(); }
async function deleteListing(id) { if (!confirm('¿Eliminar publicación?')) return; await db.from('marketplace_items').delete().eq('id', id); loadMarketplace(); }
async function buyItem(id, price, sellerId) {
  if (!confirm('¿Comprar por ◈ ' + price + '?')) return;
  if (parseFloat(currentProfile.tokens_balance) < price) { showToast('❌ Saldo insuficiente'); return; }
  const { data: seller } = await db.from('profiles').select('tokens_balance').eq('id', sellerId).single();
  await db.from('profiles').update({ tokens_balance: parseFloat(currentProfile.tokens_balance) - price }).eq('id', currentUser.id);
  await db.from('profiles').update({ tokens_balance: parseFloat(seller.tokens_balance) + price }).eq('id', sellerId);
  await db.from('token_transactions').insert([
    { user_id: currentUser.id, amount: -price, type: 'consumption', description: 'Compra en marketplace' },
    { user_id: sellerId, amount: price, type: 'transfer', description: 'Venta en marketplace' }
  ]);
  await db.from('marketplace_items').update({ is_active: false }).eq('id', id);
  await loadProfile(); updateHeader(); loadMarketplace();
  showToast('✅ ¡Compra exitosa!');
}

// ===== CHAT =====
async function loadConversations() {
  const { data } = await db.from('conversations').select('*').or(`user_a.eq.${currentUser.id},user_b.eq.${currentUser.id}`);
  convCache = data || [];
  if (!convCache.length) {
    document.getElementById('chatList').innerHTML = '<p class="empty-state">Inicia un chat desde el Mapa, Radar o Marketplace</p>';
    return;
  }
  const otherIds = convCache.map(c => c.user_a === currentUser.id ? c.user_b : c.user_a);
  const { data: profs } = await db.from('profiles').select('id, full_name').in('id', otherIds);
  const pMap = {}; (profs || []).forEach(p => pMap[p.id] = p.full_name);
  const convIds = convCache.map(c => c.id);
  const { data: msgs } = await db.from('messages').select('*').in('conversation_id', convIds).order('created_at', { ascending: false }).limit(300);
  const lastByConv = {}, unreadByConv = {};
  (msgs || []).forEach(m => {
    if (!lastByConv[m.conversation_id]) lastByConv[m.conversation_id] = m.content;
    if (m.sender_id !== currentUser.id && !m.is_read) unreadByConv[m.conversation_id] = (unreadByConv[m.conversation_id] || 0) + 1;
  });
  document.getElementById('chatList').innerHTML = convCache.map(c => {
    const other = c.user_a === currentUser.id ? c.user_b : c.user_a;
    const un = unreadByConv[c.id] || 0;
    return `<div class="conv-item ${c.id === currentConvId ? 'active' : ''}" onclick="openConversation('${c.id}')">
      <div class="conv-avatar">${(pMap[other] || 'U').charAt(0).toUpperCase()}</div>
      <div class="conv-info"><div class="conv-name">${pMap[other] || 'Usuario'}</div>
      <div class="conv-last">${lastByConv[c.id] || 'Sin mensajes'}</div></div>
      ${un ? `<span class="unread-badge">${un}</span>` : ''}
    </div>`;
  }).join('');
}
async function openConversation(id) {
  currentConvId = id;
  const conv = convCache.find(c => c.id === id);
  const other = conv.user_a === currentUser.id ? conv.user_b : conv.user_a;
  const { data: p } = await db.from('profiles').select('full_name').eq('id', other).single();
  document.getElementById('chatTitle').textContent = '💬 ' + (p?.full_name || 'Chat');
  const { data: msgs } = await db.from('messages').select('*').eq('conversation_id', id).order('created_at', { ascending: true });
  renderMessages(msgs || []);
  await db.from('messages').update({ is_read: true }).eq('conversation_id', id).neq('sender_id', currentUser.id);
  loadConversations();
}
function renderMessages(msgs) {
  document.getElementById('chatMessages').innerHTML = msgs.map(m =>
    `<div class="message ${m.sender_id === currentUser.id ? 'sent' : 'received'}">${m.content}
     <small>${new Date(m.created_at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</small></div>`).join('')
    || '<p class="empty-state">💬 Escribe el primer mensaje</p>';
  const box = document.getElementById('chatMessages'); box.scrollTop = box.scrollHeight;
}
async function sendMessage() {
  const input = document.getElementById('messageInput');
  const text = input.value.trim();
  if (!text || !currentConvId) return;
  input.value = '';
  await db.from('messages').insert({ conversation_id: currentConvId, sender_id: currentUser.id, content: text });
  const { data: msgs } = await db.from('messages').select('*').eq('conversation_id', currentConvId).order('created_at', { ascending: true });
  renderMessages(msgs || []);
}
async function startChatWith(userId) {
  if (userId === currentUser.id) { showToast('No puedes escribirte a ti mismo 😅'); return; }
  closeModal('modal-profile');
  let conv = convCache.find(c => (c.user_a === currentUser.id && c.user_b === userId) || (c.user_b === currentUser.id && c.user_a === userId));
  if (!conv) {
    const { data } = await db.from('conversations').insert({ user_a: currentUser.id, user_b: userId }).select().single();
    conv = data;
  }
  showSection('chat');
  await loadConversations();
  openConversation(conv.id);
}

// ===== TOKENS =====
async function loadTransactions() {
  document.getElementById('tokenBalance').textContent = parseFloat(currentProfile.tokens_balance || 0).toFixed(2);
  document.getElementById('tokenUSD').textContent = parseFloat(currentProfile.tokens_balance || 0).toFixed(2);
  const { data } = await db.from('token_transactions').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false }).limit(30);
  const icons = { recharge: '💳', consumption: '🛍️', transfer: '⇄', welcome: '🎁', refund: '↩️' };
  document.getElementById('transactionsList').innerHTML = (data || []).map(t =>
    `<div class="tx-item"><div><b>${icons[t.type] || '◈'} ${t.description || t.type}</b>
     <small>${new Date(t.created_at).toLocaleString('es')}</small></div>
     <span class="tx-amount ${t.amount >= 0 ? 'positive' : 'negative'}">${t.amount >= 0 ? '+' : ''}${t.amount}</span></div>`).join('')
    || '<p class="empty-state">Sin movimientos aún</p>';
}
function processRecharge(amount) {
  amount = parseFloat(amount);
  if (!amount || amount <= 0) { showToast('Cantidad inválida'); return; }
  closeModal('modal-recharge');
  showToast('💳 Procesando pago seguro…');
  setTimeout(async () => {
    const newBal = parseFloat(currentProfile.tokens_balance) + amount;
    await db.from('profiles').update({ tokens_balance: newBal }).eq('id', currentUser.id);
    await db.from('token_transactions').insert({ user_id: currentUser.id, amount, type: 'recharge', description: 'Recarga de tokens' });
    currentProfile.tokens_balance = newBal; updateHeader(); loadTransactions();
    showToast('✅ +' + amount + ' tokens acreditados');
  }, 1200);
}
async function transferTokens() {
  const email = document.getElementById('transferEmail').value.trim();
  const amount = parseFloat(document.getElementById('transferAmount').value);
  if (!email || !amount || amount <= 0) { showToast('Datos inválidos'); return; }
  const { data: dest } = await db.from('profiles').select('*').eq('email', email).single();
  if (!dest) { showToast('❌ Usuario no encontrado'); return; }
  if (dest.id === currentUser.id) { showToast('No puedes transferirte a ti mismo'); return; }
  if (parseFloat(currentProfile.tokens_balance) < amount) { showToast('❌ Saldo insuficiente'); return; }
  await db.from('profiles').update({ tokens_balance: parseFloat(currentProfile.tokens_balance) - amount }).eq('id', currentUser.id);
  await db.from('profiles').update({ tokens_balance: parseFloat(dest.tokens_balance) + amount }).eq('id', dest.id);
  await db.from('token_transactions').insert([
    { user_id: currentUser.id, amount: -amount, type: 'transfer', description: 'Enviado a ' + email },
    { user_id: dest.id, amount, type: 'transfer', description: 'Recibido de ' + currentProfile.email }
  ]);
  await loadProfile(); updateHeader(); loadTransactions();
  document.getElementById('transferEmail').value = ''; document.getElementById('transferAmount').value = '';
  showToast('✅ Transferencia completada');
}
async function deductTokens(amount, desc) {
  const newBal = parseFloat(currentProfile.tokens_balance) - amount;
  await db.from('profiles').update({ tokens_balance: newBal }).eq('id', currentUser.id);
  await db.from('token_transactions').insert({ user_id: currentUser.id, amount: -amount, type: 'consumption', description: desc });
  currentProfile.tokens_balance = newBal; updateHeader();
}

// ===== PERFIL =====
async function loadProfileSection() {
  const p = currentProfile;
  document.getElementById('profileName').textContent = p.full_name || 'Usuario';
  document.getElementById('profileEmail').textContent = p.email;
  document.getElementById('profileRole').textContent = ROLE_LABELS[p.role] || p.role;
  document.getElementById('statTokens').textContent = parseFloat(p.tokens_balance || 0).toFixed(2);
  document.getElementById('statVerified').textContent = p.is_verified ? 'Sí ✅' : 'No';
  document.getElementById('statStatus').textContent = STATUS_LABELS[roleDetails?.relationship_status] || '—';
  document.getElementById('profileAvatar').textContent = (p.full_name || 'U').charAt(0).toUpperCase();
  const img = document.getElementById('profileAvatarImg');
  if (p.avatar_url) { img.src = p.avatar_url; img.style.display = 'block'; document.getElementById('profileAvatar').style.display = 'none'; }
  document.getElementById('editName').value = p.full_name || '';
  if (roleDetails?.relationship_status) document.getElementById('editStatus').value = roleDetails.relationship_status;
}
async function saveProfile(e) {
  e.preventDefault();
  const updates = { full_name: document.getElementById('editName').value || currentProfile.full_name };
  const file = document.getElementById('editAvatar').files[0];
  if (file) {
    const path = 'avatars/' + currentUser.id + '_' + Date.now() + '.png';
    const { error } = await db.storage.from('fendyx-assets').upload(path, file);
    if (!error) updates.avatar_url = db.storage.from('fendyx-assets').getPublicUrl(path).data.publicUrl;
  }
  await db.from('profiles').update(updates).eq('id', currentUser.id);
  await db.from('role_details').upsert({ user_id: currentUser.id, role_type: currentProfile.role, relationship_status: document.getElementById('editStatus').value }, { onConflict: 'user_id' });
  await loadProfile(); updateHeader(); loadProfileSection();
  showToast('✅ Perfil actualizado');
}
async function loadProfile() {
  const { data } = await db.from('profiles').select('*').eq('id', currentUser.id).single();
  currentProfile = data;
  const { data: rd } = await db.from('role_details').select('*').eq('user_id', currentUser.id).single();
  roleDetails = rd;
}
function viewUserProfile(userId) {
  db.from('profiles').select('*, role_details(*)').eq('id', userId).single().then(({ data }) => {
    if (!data) return;
    viewedUserId = userId;
    document.getElementById('viewProfileAvatar').textContent = (data.full_name || 'U').charAt(0).toUpperCase();
    document.getElementById('viewProfileName').textContent = data.full_name || 'Usuario';
    document.getElementById('viewProfileRole').textContent = ROLE_LABELS[data.role] || data.role;
    document.getElementById('viewProfileBio').textContent = data.bio || data.role_details?.[0]?.bio || 'Sin descripción';
    openModal('modal-profile');
  });
}
function messageFromProfile() { if (viewedUserId) startChatWith(viewedUserId); }

// ===== PANEL ADMIN =====
async function loadAdmin() {
  if (currentProfile.role !== 'admin') { showSection('dashboard'); showToast('🚫 Acceso denegado'); return; }
  loadAdminOverview();
}
function switchAdminTab(tab, btn) {
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('admin-' + tab).classList.add('active');
  const loaders = { overview: loadAdminOverview, branding: () => {}, users: loadAdminUsers, tokens: loadAdminTransactions, content: loadAdminContent };
  loaders[tab]?.();
}
async function loadAdminOverview() {
  const [u, t, o, c, tx] = await Promise.all([
    db.from('profiles').select('tokens_balance', { count: 'exact', head: false }),
    db.from('orders').select('*', { count: 'exact', head: true }),
    db.from('video_calls').select('*', { count: 'exact', head: true }),
    db.from('token_transactions').select('*, profiles(email)').order('created_at', { ascending: false }).limit(8)
  ]);
  const users = u.data || [];
  document.getElementById('kpiUsers').textContent = users.length;
  document.getElementById('kpiTokens').textContent = users.reduce((s, p) => s + parseFloat(p.tokens_balance || 0), 0).toFixed(0);
  document.getElementById('kpiOrders').textContent = t.count || 0;
  document.getElementById('kpiCalls').textContent = c.count || 0;
  document.getElementById('activityFeed').innerHTML = (tx.data || []).map(x =>
    `<div class="tx-item"><div><b>${x.profiles?.email || '—'}</b><small>${x.description || x.type}</small></div>
     <span class="tx-amount ${x.amount >= 0 ? 'positive' : 'negative'}">${x.amount >= 0 ? '+' : ''}${x.amount}</span></div>`).join('')
    || '<p class="empty-state">Sin actividad</p>';
}
async function uploadLogo(e) {
  const file = e.target.files[0];
  if (!file) return;
  const path = 'logo/logo_' + Date.now() + '.' + file.name.split('.').pop();
  const { error } = await db.storage.from('fendyx-assets').upload(path, file);
  if (error) { showToast('❌ ' + error.message); return; }
  const url = db.storage.from('fendyx-assets').getPublicUrl(path).data.publicUrl;
  await db.from('app_branding').update({ logo_url: url, updated_at: new Date().toISOString() }).eq('id', 1);
  await loadBranding();
  showToast('✅ Logo actualizado en toda la plataforma');
}
async function saveAppName() {
  const name = document.getElementById('adminAppName').value.trim() || 'FENDYX';
  await db.from('app_branding').update({ app_name: name, updated_at: new Date().toISOString() }).eq('id', 1);
  await loadBranding();
  showToast('✅ Nombre actualizado: ' + name);
}
let adminUsersCache = [];
async function loadAdminUsers() {
  const { data } = await db.from('profiles').select('*').order('created_at', { ascending: false });
  adminUsersCache = data || [];
  renderAdminUsers();
}
function renderAdminUsers() {
  const q = (document.getElementById('adminUsersSearch').value || '').toLowerCase();
  const rows = adminUsersCache.filter(u => !q || (u.email || '').toLowerCase().includes(q) || (u.full_name || '').toLowerCase().includes(q));
  document.getElementById('adminUsersTable').innerHTML = rows.map(u =>
    `<tr><td><b>${u.full_name || '—'}</b><br><small class="dim">${u.email}</small></td>
     <td>${ROLE_LABELS[u.role] || u.role}</td><td>◈ ${u.tokens_balance}</td>
     <td>${u.is_banned ? '🚫 Baneado' : u.is_verified ? '✅ Verificado' : '⏳ Pendiente'}</td>
     <td>
       ${!u.is_verified ? `<button class="btn-small success" onclick="verifyUser('${u.id}')">Verificar</button>` : ''}
       ${u.role !== 'admin' ? (u.is_banned
         ? `<button class="btn-small success" onclick="toggleBan('${u.id}',false)">Desbanear</button>`
         : `<button class="btn-small danger" onclick="toggleBan('${u.id}',true)">Banear</button>`) : ''}
     </td></tr>`).join('');
}
async function verifyUser(id) { await db.from('profiles').update({ is_verified: true }).eq('id', id); showToast('✅ Usuario verificado'); loadAdminUsers(); }
async function toggleBan(id, ban) {
  if (!confirm(ban ? '¿Banear usuario?' : '¿Desbanear usuario?')) return;
  await db.from('profiles').update({ is_banned: ban }).eq('id', id);
  showToast(ban ? '🚫 Usuario baneado' : '✅ Usuario desbaneado');
  loadAdminUsers();
}
async function adminAdjustTokens() {
  const email = document.getElementById('adminTokenEmail').value.trim();
  const amount = parseFloat(document.getElementById('adminTokenAmount').value);
  if (!email || !amount) { showToast('Completa email y cantidad'); return; }
  const { data: u } = await db.from('profiles').select('*').eq('email', email).single();
  if (!u) { showToast('❌ Usuario no encontrado'); return; }
  await db.from('profiles').update({ tokens_balance: parseFloat(u.tokens_balance) + amount }).eq('id', u.id);
  await db.from('token_transactions').insert({ user_id: u.id, amount, type: amount >= 0 ? 'recharge' : 'consumption', description: 'Ajuste manual del administrador' });
  showToast('✅ Ajuste aplicado a ' + email);
  loadAdminTransactions(); loadAdminOverview();
}
async function loadAdminTransactions() {
  const { data } = await db.from('token_transactions').select('*, profiles(email)').order('created_at', { ascending: false }).limit(50);
  document.getElementById('adminTransactions').innerHTML = (data || []).map(t =>
    `<div class="tx-item"><div><b>${t.profiles?.email || '—'}</b><small>${t.description || t.type} · ${new Date(t.created_at).toLocaleDateString()}</small></div>
     <span class="tx-amount ${t.amount >= 0 ? 'positive' : 'negative'}">${t.amount >= 0 ? '+' : ''}${t.amount}</span></div>`).join('')
    || '<p class="empty-state">Sin transacciones</p>';
}
async function loadAdminContent() {
  const [r, n, m] = await Promise.all([
    db.from('restaurants').select('id, name'),
    db.from('nightclubs').select('id, name'),
    db.from('marketplace_items').select('id, title')
  ]);
  document.getElementById('adminRestaurants').innerHTML = (r.data || []).map(x => `<div class="row-item"><div class="row-main"><b>${x.name}</b></div><button class="btn-small danger" onclick="deleteContent('restaurants','${x.id}')">🗑</button></div>`).join('') || '<p class="empty-state">Vacío</p>';
  document.getElementById('adminNightclubs').innerHTML = (n.data || []).map(x => `<div class="row-item"><div class="row-main"><b>${x.name}</b></div><button class="btn-small danger" onclick="deleteContent('nightclubs','${x.id}')">🗑</button></div>`).join('') || '<p class="empty-state">Vacío</p>';
  document.getElementById('adminMarket').innerHTML = (m.data || []).map(x => `<div class="row-item"><div class="row-main"><b>${x.title}</b></div><button class="btn-small danger" onclick="deleteContent('marketplace_items','${x.id}')">🗑</button></div>`).join('') || '<p class="empty-state">Vacío</p>';
}
async function deleteContent(table, id) {
  if (!confirm('¿Eliminar definitivamente?')) return;
  await db.from(table).delete().eq('id', id);
  showToast('🗑 Contenido eliminado');
  loadAdminContent();
}

// ===== TIEMPO REAL =====
function startRealtime() {
  if (liveChannel) return;
  liveChannel = db.channel('fendyx-live')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async payload => {
      if (payload.new.conversation_id === currentConvId) {
        const { data: msgs } = await db.from('messages').select('*').eq('conversation_id', currentConvId).order('created_at', { ascending: true });
        renderMessages(msgs || []);
        db.from('messages').update({ is_read: true }).eq('conversation_id', currentConvId).neq('sender_id', currentUser.id);
      }
      if (document.getElementById('section-chat').classList.contains('active')) loadConversations();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
      if (document.getElementById('section-orders').classList.contains('active')) loadOrders();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'radar_presences' }, () => {
      if (currentClubId && document.getElementById('section-radar').classList.contains('active')) loadRadarUsers();
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'app_branding' }, () => loadBranding())
    .subscribe();
}

// ===== UTILIDADES =====
function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => t.classList.add('hidden'), 2800);
}
