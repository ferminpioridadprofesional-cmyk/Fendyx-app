// ===== FENDYX - APP.JS COMPLETO =====
const SUPABASE_URL = 'https://jsrarddyrjmuinwlyten.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzcmFyZGR5cmptdWlud2x5dGVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3MjIxNDQsImV4cCI6MjEwNDI5ODE0NH0.4BBl7Cu0mJFL014dbWGN49AYJVZLxeYbWnegn9-S41M';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = null;
let currentProfile = null;
let jitsiApi = null;
let callInterval = null;
let callSeconds = 0;

// ===== INICIALIZACIÓN =====
document.addEventListener('DOMContentLoaded', async () => {
    await loadBranding();
    const { data: { session } } = await db.auth.getSession();
    if (session) {
        currentUser = session.user;
        await loadProfile();
        showAppScreen();
    }
});

// ===== BRANDING DINÁMICO =====
async function loadBranding() {
    const { data } = await db.from('app_branding').select('*').eq('id', 1).single();
    if (data && data.logo_url) {
        document.getElementById('authLogo').src = data.logo_url;
        document.getElementById('authLogo').style.display = 'block';
        document.getElementById('authLogoFallback').style.display = 'none';
        document.getElementById('headerLogo').src = data.logo_url;
        document.getElementById('headerLogo').style.display = 'block';
        document.getElementById('headerLogoFallback').style.display = 'none';
    }
    if (data && data.app_name) {
        document.getElementById('authAppName').textContent = data.app_name;
        document.getElementById('headerAppName').textContent = data.app_name;
    }
}

// ===== AUTH =====
function switchAuthTab(tab) {
    document.querySelectorAll('.auth-tabs .tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    if (tab === 'login') {
        document.querySelectorAll('.auth-tabs .tab')[0].classList.add('active');
        document.getElementById('form-login').classList.add('active');
    } else {
        document.querySelectorAll('.auth-tabs .tab')[1].classList.add('active');
        document.getElementById('form-register').classList.add('active');
    }
}

function togglePassword(inputId, btn) {
    const input = document.getElementById(inputId);
    input.type = input.type === 'password' ? 'text' : 'password';
}

function showRoleFields() {
    const role = document.getElementById('regRole').value;
    const container = document.getElementById('roleFields');
    let html = '';
    
    if (role === 'restaurant') {
        html = `<div class="input-group"><input type="text" id="regRIF" placeholder="RIF del negocio"></div>
                <div class="input-group"><input type="text" id="regBusinessName" placeholder="Nombre del restaurante"></div>
                <div class="input-group"><input type="text" id="regAddress" placeholder="Dirección del local"></div>`;
    } else if (role === 'delivery') {
        html = `<div class="input-group"><input type="text" id="regLicense" placeholder="Número de licencia"></div>
                <div class="input-group"><input type="text" id="regPlate" placeholder="Placa del vehículo"></div>
                <div class="input-group"><select id="regVehicle"><option value="moto">🏍️ Moto</option><option value="bici">🚲 Bicicleta</option><option value="carro">🚗 Carro</option></select></div>`;
    } else if (role === 'nightclub') {
        html = `<div class="input-group"><input type="text" id="regClubName" placeholder="Nombre del bar/discoteca"></div>
                <div class="input-group"><input type="text" id="regClubAddress" placeholder="Dirección"></div>`;
    } else if (role === 'remote_worker') {
        html = `<div class="input-group"><input type="text" id="regSpecialty" placeholder="Especialidad (ej: Diseño, Programación)"></div>
                <div class="input-group"><input type="number" id="regRate" placeholder="Tarifa por minuto (tokens)" step="0.1"></div>`;
    }
    container.innerHTML = html;
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    const { data, error } = await db.auth.signInWithPassword({ email, password });
    if (error) { showAuthMessage(error.message, 'error'); return; }
    
    currentUser = data.user;
    await loadProfile();
    showAppScreen();
}

async function handleRegister(e) {
    e.preventDefault();
    const name = document.getElementById('regName').value;
    const email = document.getElementById('regEmail').value;
    const age = parseInt(document.getElementById('regAge').value);
    const password = document.getElementById('regPassword').value;
    const role = document.getElementById('regRole').value;
    
    if (age < 18) { showAuthMessage('Debes ser mayor de 18 años', 'error'); return; }
    if (!role) { showAuthMessage('Selecciona un tipo de cuenta', 'error'); return; }
    
    const metadata = { full_name: name, age, role };
    
    // Agregar datos específicos del rol
    if (role === 'restaurant') {
        metadata.rif = document.getElementById('regRIF')?.value || '';
        metadata.business_name = document.getElementById('regBusinessName')?.value || '';
        metadata.address = document.getElementById('regAddress')?.value || '';
    } else if (role === 'delivery') {
        metadata.license = document.getElementById('regLicense')?.value || '';
        metadata.plate = document.getElementById('regPlate')?.value || '';
        metadata.vehicle = document.getElementById('regVehicle')?.value || '';
    } else if (role === 'nightclub') {
        metadata.club_name = document.getElementById('regClubName')?.value || '';
        metadata.club_address = document.getElementById('regClubAddress')?.value || '';
    } else if (role === 'remote_worker') {
        metadata.specialty = document.getElementById('regSpecialty')?.value || '';
        metadata.rate = document.getElementById('regRate')?.value || 1;
    }
    
    const { data, error } = await db.auth.signUp({ email, password, options: { data: metadata } });
    if (error) { showAuthMessage(error.message, 'error'); return; }
    
    showAuthMessage('✅ ¡Cuenta creada! Ahora inicia sesión.', 'success');
    setTimeout(() => switchAuthTab('login'), 2000);
}

function showAuthMessage(msg, type) {
    const el = document.getElementById('authMessage');
    el.textContent = msg;
    el.className = 'auth-message ' + type;
}

async function resetPassword() {
    const email = prompt('Ingresa tu correo:');
    if (!email) return;
    await db.auth.resetPasswordForEmail(email);
    showToast('Correo de recuperación enviado');
}

async function handleLogout() {
    await db.auth.signOut();
    currentUser = null;
    currentProfile = null;
    location.reload();
}

// ===== PERFIL =====
async function loadProfile() {
    const { data } = await db.from('profiles').select('*').eq('id', currentUser.id).single();
    currentProfile = data;
    updateHeader();
}

function updateHeader() {
    if (!currentProfile) return;
    document.getElementById('userTokens').textContent = currentProfile.tokens_balance || 0;
    document.getElementById('userAvatar').textContent = currentProfile.full_name?.charAt(0) || 'U';
    document.getElementById('welcomeName').textContent = currentProfile.full_name || 'Usuario';
    
    if (currentProfile.role === 'admin') {
        document.querySelector('.admin-only').classList.remove('hidden');
    }
}

// ===== NAVEGACIÓN =====
function showAppScreen() {
    document.getElementById('screen-auth').classList.remove('active');
    document.getElementById('screen-app').classList.add('active');
    showSection('dashboard');
    loadModules();
}

function showSection(name) {
    document.querySelectorAll('.app-section').forEach(s => s.classList.remove('active'));
    document.getElementById('section-' + name)?.classList.add('active');
    
    document.querySelectorAll('.bottom-nav .nav-item').forEach(n => n.classList.remove('active'));
    
    document.querySelectorAll('.user-menu').forEach(m => m.classList.add('hidden'));
    
    // Cargar datos de la sección
    if (name === 'restaurants') loadRestaurants();
    if (name === 'remote') loadWorkers();
    if (name === 'marketplace') loadMarketplace();
    if (name === 'tokens') loadTransactions();
    if (name === 'profile') loadProfileSection();
    if (name === 'admin') loadAdminData();
    if (name === 'radar') loadRadar();
}

function toggleUserMenu() {
    document.getElementById('userMenu').classList.toggle('hidden');
}

function loadModules() {
    const grid = document.getElementById('modulesGrid');
    const role = currentProfile?.role || 'user';
    
    let modules = [
        { id: 'map', icon: '📍', name: 'Mapa Social' },
        { id: 'radar', icon: '🌙', name: 'Radar Nocturno' },
        { id: 'restaurants', icon: '🍽️', name: 'Restaurantes' },
        { id: 'orders', icon: '📦', name: 'Pedidos' },
        { id: 'remote', icon: '💼', name: 'Trabajo Remoto' },
        { id: 'marketplace', icon: '🛒', name: 'Marketplace' },
        { id: 'chat', icon: '💬', name: 'Chat' },
        { id: 'tokens', icon: '◈', name: 'Tokens' }
    ];
    
    if (role === 'admin') {
        modules.unshift({ id: 'admin', icon: '🛡️', name: 'Panel Admin' });
    }
    
    grid.innerHTML = modules.map(m => `
        <div class="module-card" onclick="showSection('${m.id}')">
            <div class="icon">${m.icon}</div>
            <h3>${m.name}</h3>
        </div>
    `).join('');
    
    // Mostrar paneles especiales según rol
    if (role === 'restaurant') {
        document.getElementById('restaurantOwnerPanel')?.classList.remove('hidden');
    }
    if (role === 'remote_worker') {
        document.getElementById('workerPanel')?.classList.remove('hidden');
    }
}

// ===== RESTAURANTES =====
async function loadRestaurants() {
    const { data } = await db.from('restaurants').select('*');
    const list = document.getElementById('restaurantsList');
    
    if (!data || data.length === 0) {
        list.innerHTML = '<p class="empty-state">No hay restaurantes registrados aún</p>';
        return;
    }
    
    list.innerHTML = data.map(r => `
        <div class="restaurant-card">
            <h3>${r.name}</h3>
            <p>${r.description || 'Sin descripción'}</p>
            <p>📍 ${r.address || 'Dirección no disponible'}</p>
            <span class="status ${r.is_open ? 'status-open' : 'status-closed'}">${r.is_open ? 'Abierto' : 'Cerrado'}</span>
            <button class="btn-primary" style="margin-top:15px" onclick="viewMenu('${r.id}')">Ver Menú</button>
        </div>
    `).join('');
}

async function saveRestaurant(e) {
    e.preventDefault();
    const name = document.getElementById('restName').value;
    const address = document.getElementById('restAddress').value;
    const desc = document.getElementById('restDesc').value;
    
    await db.from('restaurants').upsert({
        owner_id: currentUser.id,
        name, address, description: desc
    });
    
    showToast('✅ Restaurante guardado');
    loadRestaurants();
}

async function addMenuItem(e) {
    e.preventDefault();
    const name = document.getElementById('menuItemName').value;
    const price = parseFloat(document.getElementById('menuItemPrice').value);
    
    const { data: rest } = await db.from('restaurants').select('id').eq('owner_id', currentUser.id).single();
    if (!rest) { showToast('Primero guarda tu restaurante', 'error'); return; }
    
    await db.from('menu_items').insert({ restaurant_id: rest.id, name, price });
    showToast('✅ Plato agregado al menú');
    e.target.reset();
}

async function viewMenu(restaurantId) {
    const { data } = await db.from('menu_items').select('*').eq('restaurant_id', restaurantId);
    if (data && data.length > 0) {
        alert('Menú:\n' + data.map(i => `${i.name} - ${i.price} tokens`).join('\n'));
    } else {
        alert('Este restaurante aún no tiene menú');
    }
}

// ===== TRABAJO REMOTO =====
async function loadWorkers() {
    const { data } = await db.from('profiles').select('*, role_details(*)').eq('role', 'remote_worker');
    const grid = document.getElementById('workersGrid');
    
    if (!data || data.length === 0) {
        grid.innerHTML = '<p class="empty-state">No hay trabajadores remotos registrados</p>';
        return;
    }
    
    grid.innerHTML = data.map(w => `
        <div class="worker-card">
            <h3>${w.full_name}</h3>
            <p>${w.role_details?.[0]?.specialty || 'Sin especialidad'}</p>
            <p class="rate">◈ ${w.role_details?.[0]?.rate_per_minute || 1}/min</p>
            <button class="btn-primary" onclick="startCall('${w.id}', ${w.role_details?.[0]?.rate_per_minute || 1})">📹 Iniciar Videollamada</button>
        </div>
    `).join('');
}

async function saveWorkerProfile(e) {
    e.preventDefault();
    const specialty = document.getElementById('workerSpecialty').value;
    const rate = parseFloat(document.getElementById('workerRate').value);
    const bio = document.getElementById('workerBio').value;
    
    await db.from('role_details').upsert({
        user_id: currentUser.id,
        role_type: 'remote_worker',
        specialty, rate_per_minute: rate, bio
    });
    
    showToast('✅ Perfil de trabajador guardado');
}

// ===== VIDEO LLAMADA JITSI =====
async function startCall(workerId, rate) {
    if (currentProfile.tokens_balance < rate) {
        showToast('Saldo insuficiente para la llamada', 'error');
        return;
    }
    
    const roomId = 'FENDYX_' + Date.now();
    
    await db.from('video_calls').insert({
        worker_id: workerId,
        client_id: currentUser.id,
        room_id: roomId,
        rate_per_minute: rate,
        status: 'active',
        started_at: new Date().toISOString()
    });
    
    document.getElementById('videoCallArea').classList.remove('hidden');
    
    const domain = 'meet.jit.si';
    const options = {
        roomName: roomId,
        width: '100%',
        height: 400,
        parentNode: document.getElementById('jitsiContainer'),
        interfaceConfigOverwrite: {
            TOOLBAR_BUTTONS: ['microphone', 'camera', 'hangup', 'chat'],
            SHOW_JITSI_WATERMARK: false
        }
    };
    
    jitsiApi = new JitsiMeetExternalAPI(domain, options);
    
    // Timer y cobro por minuto
    callSeconds = 0;
    callInterval = setInterval(async () => {
        callSeconds++;
        const mins = Math.floor(callSeconds / 60);
        const secs = callSeconds % 60;
        document.getElementById('callTimer').textContent = `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
        
        if (callSeconds % 60 === 0 && callSeconds > 0) {
            const cost = rate * (callSeconds / 60);
            document.getElementById('callCost').textContent = `Costo: ${cost.toFixed(2)} tokens`;
            
            const newBalance = currentProfile.tokens_balance - rate;
            if (newBalance <= 0) {
                endCall();
                showToast('Saldo agotado. Llamada finalizada.', 'error');
                return;
            }
            
            await db.from('profiles').update({ tokens_balance: newBalance }).eq('id', currentUser.id);
            await db.from('token_transactions').insert({
                user_id: currentUser.id, amount: -rate, type: 'consumption',
                description: `Videollamada minuto ${callSeconds/60}`
            });
            currentProfile.tokens_balance = newBalance;
            updateHeader();
        }
    }, 1000);
}

async function endCall() {
    if (jitsiApi) { jitsiApi.dispose(); jitsiApi = null; }
    if (callInterval) { clearInterval(callInterval); callInterval = null; }
    document.getElementById('videoCallArea').classList.add('hidden');
    
    const totalCost = (callSeconds / 60) * 1;
    showToast(`Llamada finalizada. Costo total: ${totalCost.toFixed(2)} tokens`);
}

// ===== MARKETPLACE =====
async function loadMarketplace() {
    const { data } = await db.from('marketplace_items').select('*, profiles(full_name)').eq('is_active', true);
    const grid = document.getElementById('marketplaceGrid');
    
    if (!data || data.length === 0) {
        grid.innerHTML = '<p class="empty-state">No hay productos publicados</p>';
        return;
    }
    
    grid.innerHTML = data.map(item => `
        <div class="market-item">
            <h3>${item.title}</h3>
            <p>${item.description || ''}</p>
            <p class="price">◈ ${item.price}</p>
            <small>Vendedor: ${item.profiles?.full_name || 'Anónimo'}</small>
            <button class="btn-primary" style="margin-top:10px" onclick="buyItem('${item.id}', ${item.price})">Comprar</button>
        </div>
    `).join('');
}

function showSellForm() {
    document.getElementById('sellForm').classList.toggle('hidden');
}

async function publishItem(e) {
    e.preventDefault();
    await db.from('marketplace_items').insert({
        seller_id: currentUser.id,
        title: document.getElementById('itemTitle').value,
        description: document.getElementById('itemDesc').value,
        price: parseFloat(document.getElementById('itemPrice').value)
    });
    showToast('✅ Producto publicado');
    e.target.reset();
    document.getElementById('sellForm').classList.add('hidden');
    loadMarketplace();
}

async function buyItem(itemId, price) {
    if (currentProfile.tokens_balance < price) {
        showToast('Saldo insuficiente', 'error');
        return;
    }
    if (!confirm(`¿Comprar por ${price} tokens?`)) return;
    
    await db.from('profiles').update({ tokens_balance: currentProfile.tokens_balance - price }).eq('id', currentUser.id);
    await db.from('token_transactions').insert({
        user_id: currentUser.id, amount: -price, type: 'consumption', description: 'Compra en marketplace'
    });
    
    currentProfile.tokens_balance -= price;
    updateHeader();
    showToast('✅ ¡Compra exitosa!');
}

// ===== TOKENS =====
async function loadTransactions() {
    document.getElementById('tokenBalance').textContent = currentProfile.tokens_balance || 0;
    document.getElementById('tokenUSD').textContent = currentProfile.tokens_balance || 0;
    
    const { data } = await db.from('token_transactions').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false }).limit(20);
    
    const list = document.getElementById('transactionsList');
    if (!data || data.length === 0) {
        list.innerHTML = '<p class="empty-state">Sin transacciones</p>';
        return;
    }
    
    list.innerHTML = data.map(t => `
        <div class="transaction-item">
            <div>
                <strong>${t.description}</strong><br>
                <small>${new Date(t.created_at).toLocaleDateString()}</small>
            </div>
            <span class="amount ${t.amount >= 0 ? 'positive' : 'negative'}">${t.amount >= 0 ? '+' : ''}${t.amount}</span>
        </div>
    `).join('');
}

function showRechargeModal() {
    document.getElementById('modal-recharge').classList.remove('hidden');
}

function closeModal(id) {
    document.getElementById(id).classList.add('hidden');
}

async function processRecharge(amount) {
    amount = parseFloat(amount);
    if (!amount || amount <= 0) { showToast('Cantidad inválida', 'error'); return; }
    
    const newBalance = (currentProfile.tokens_balance || 0) + amount;
    await db.from('profiles').update({ tokens_balance: newBalance }).eq('id', currentUser.id);
    await db.from('token_transactions').insert({
        user_id: currentUser.id, amount: amount, type: 'recharge', description: 'Recarga de tokens'
    });
    
    currentProfile.tokens_balance = newBalance;
    updateHeader();
    closeModal('modal-recharge');
    showToast(`✅ +${amount} tokens recargados`);
    loadTransactions();
}

// ===== RADAR NOCTURNO =====
async function loadRadar() {
    const { data } = await db.from('nightclubs').select('*').eq('is_active', true);
    
    if (!data || data.length === 0) {
        document.getElementById('radarText').textContent = 'No hay discotecas registradas. ¡Registra la tuya!';
        return;
    }
    
    document.getElementById('radarText').textContent = `📍 ${data.length} discoteca(s) activa(s). Entrando en geocerca...`;
    
    // Simular entrada a la primera discoteca
    const club = data[0];
    await db.from('radar_presences').upsert({
        user_id: currentUser.id,
        nightclub_id: club.id,
        status: document.getElementById('radarStatusSelect').value
    });
    
    // Cargar usuarios en el radar
    const { data: presences } = await db.from('radar_presences').select('*, profiles(full_name, avatar_url)').eq('nightclub_id', club.id);
    
    const radarUsers = document.getElementById('radarUsers');
    if (presences && presences.length > 0) {
        radarUsers.innerHTML = presences.map(p => `
            <div class="radar-user-card">
                <div class="user-avatar" style="width:50px;height:50px;margin:0 auto 10px">${p.profiles?.full_name?.charAt(0) || 'U'}</div>
                <h4>${p.profiles?.full_name || 'Usuario'}</h4>
                <p><span class="status-dot status-${p.status}"></span>${getStatusLabel(p.status)}</p>
            </div>
        `).join('');
    } else {
        radarUsers.innerHTML = '<p class="empty-state">No hay nadie en el radar aún</p>';
    }
}

function getStatusLabel(status) {
    const labels = { single: 'Soltero/a', married: 'Casado/a', looking: 'Buscando conocer', unavailable: 'No disponible' };
    return labels[status] || status;
}

async function updateRadarStatus() {
    const status = document.getElementById('radarStatusSelect').value;
    await db.from('profiles').update({}).eq('id', currentUser.id); // Trigger para actualizar
    showToast('Estado actualizado: ' + getStatusLabel(status));
    loadRadar();
}

// ===== PERFIL =====
function loadProfileSection() {
    if (!currentProfile) return;
    document.getElementById('profileAvatar').textContent = currentProfile.full_name?.charAt(0) || 'U';
    document.getElementById('profileName').textContent = currentProfile.full_name || 'Usuario';
    document.getElementById('profileEmail').textContent = currentProfile.email;
    document.getElementById('profileRole').textContent = getRoleLabel(currentProfile.role);
    document.getElementById('statTokens').textContent = currentProfile.tokens_balance || 0;
    document.getElementById('statVerified').textContent = currentProfile.is_verified ? 'Sí' : 'No';
}

function getRoleLabel(role) {
    const labels = { user: 'Usuario', restaurant: 'Restaurante', delivery: 'Domiciliario', nightclub: 'Discoteca', remote_worker: 'Trabajador Remoto', admin: 'Administrador' };
    return labels[role] || role;
}

// ===== PANEL ADMIN =====
function switchAdminTab(tab) {
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
    event.target.classList.add('active');
    document.getElementById('admin-' + tab).classList.add('active');
    
    if (tab === 'users') loadAdminUsers();
    if (tab === 'tokens') loadAdminTransactions();
    if (tab === 'content') loadAdminContent();
}

async function loadAdminData() {
    if (currentProfile?.role !== 'admin') {
        showSection('dashboard');
        showToast('Acceso denegado', 'error');
        return;
    }
    loadAdminUsers();
}

async function uploadLogo(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const fileName = `logo_${Date.now()}_${file.name}`;
    const { error } = await db.storage.from('fendyx-assets').upload(fileName, file);
    
    if (error) { showToast('Error al subir: ' + error.message, 'error'); return; }
    
    const { data: { publicUrl } } = db.storage.from('fendyx-assets').getPublicUrl(fileName);
    
    await db.from('app_branding').update({ logo_url: publicUrl, updated_at: new Date().toISOString() }).eq('id', 1);
    
    showToast('✅ Logo actualizado en toda la plataforma');
    loadBranding();
    
    document.getElementById('adminLogoPreview').src = publicUrl;
    document.getElementById('adminLogoPreview').style.display = 'block';
    document.getElementById('adminLogoFallback').style.display = 'none';
}

async function loadAdminUsers() {
    const { data } = await db.from('profiles').select('*').order('created_at', { ascending: false });
    
    const table = document.getElementById('adminUsersTable');
    table.innerHTML = data.map(u => `
        <tr>
            <td>${u.email}</td>
            <td>${u.full_name || '-'}</td>
            <td>${getRoleLabel(u.role)}</td>
            <td>${u.tokens_balance}</td>
            <td>${u.is_banned ? '🚫 Baneado' : u.is_verified ? '✅ Verificado' : '⏳ Pendiente'}</td>
            <td>
                ${!u.is_verified ? `<button class="btn-small btn-verify" onclick="verifyUser('${u.id}')">Verificar</button>` : ''}
                ${!u.is_banned ? `<button class="btn-small btn-ban" onclick="banUser('${u.id}', true)">Banear</button>` : `<button class="btn-small btn-verify" onclick="banUser('${u.id}', false)">Desbanear</button>`}
            </td>
        </tr>
    `).join('');
}

async function verifyUser(userId) {
    await db.from('profiles').update({ is_verified: true }).eq('id', userId);
    showToast('✅ Usuario verificado');
    loadAdminUsers();
}

async function banUser(userId, ban) {
    await db.from('profiles').update({ is_banned: ban }).eq('id', userId);
    showToast(ban ? 'Usuario baneado' : 'Usuario desbaneado');
    loadAdminUsers();
}

async function loadAdminTransactions() {
    const { data } = await db.from('token_transactions').select('*, profiles(email)').order('created_at', { ascending: false }).limit(50);
    
    document.getElementById('adminTransactions').innerHTML = data?.map(t => `
        <div class="transaction-item">
            <div><strong>${t.profiles?.email}</strong><br><small>${t.description}</small></div>
            <span class="amount ${t.amount >= 0 ? 'positive' : 'negative'}">${t.amount >= 0 ? '+' : ''}${t.amount}</span>
        </div>
    `).join('') || '<p>Sin transacciones</p>';
}

async function adminRechargeTokens() {
    const email = document.getElementById('adminTokenEmail').value;
    const amount = parseFloat(document.getElementById('adminTokenAmount').value);
    
    if (!email || !amount) { showToast('Completa los campos', 'error'); return; }
    
    const { data: user } = await db.from('profiles').select('*').eq('email', email).single();
    if (!user) { showToast('Usuario no encontrado', 'error'); return; }
    
    await db.from('profiles').update({ tokens_balance: user.tokens_balance + amount }).eq('id', user.id);
    await db.from('token_transactions').insert({
        user_id: user.id, amount, type: 'recharge', description: 'Recarga por administrador'
    });
    
    showToast(`✅ ${amount} tokens recargados a ${email}`);
    loadAdminUsers();
    loadAdminTransactions();
}

async function loadAdminContent() {
    const { data: restaurants } = await db.from('restaurants').select('*, profiles(email)');
    const { data: nightclubs } = await db.from('nightclubs').select('*, profiles(email)');
    const { data: drivers } = await db.from('profiles').select('*').eq('role', 'delivery');
    
    document.getElementById('adminRestaurants').innerHTML = restaurants?.map(r => `<p>🍽️ ${r.name} (${r.profiles?.email})</p>`).join('') || '<p>Sin restaurantes</p>';
    document.getElementById('adminNightclubs').innerHTML = nightclubs?.map(n => `<p>🎵 ${n.name} (${n.profiles?.email})</p>`).join('') || '<p>Sin discotecas</p>';
    document.getElementById('adminDrivers').innerHTML = drivers?.map(d => `<p>🛵 ${d.full_name} (${d.email})</p>`).join('') || '<p>Sin domiciliarios</p>';
}

// ===== UTILIDADES =====
function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3000);
}

// Cerrar menú al hacer clic fuera
document.addEventListener('click', (e) => {
    if (!e.target.closest('.user-avatar') && !e.target.closest('.user-menu')) {
        document.getElementById('userMenu')?.classList.add('hidden');
    }
});
