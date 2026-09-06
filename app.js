// =====================================================
// FENDYX - LÓGICA GLOBAL DE LA APLICACIÓN
// Integración completa con Supabase
// =====================================================

// CONFIGURACIÓN DE SUPABASE
const SUPABASE_URL = 'https://jsrarddyrjmuinwlyten.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzcmFyZGR5cmptdWlud2x5dGVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3MjIxNDQsImV4cCI6MjEwNDI5ODE0NH0.4BBl7Cu0mJFL014dbWGN49AYJVZLxeYbWnegn9-S41M';

// INICIALIZAR CLIENTE DE SUPABASE
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// =====================================================
// VARIABLES GLOBALES
// =====================================================
let currentTab = 'login';

// =====================================================
// INICIALIZACIÓN DE LA APLICACIÓN
// =====================================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Fendyx iniciado correctamente');
    
    // Verificar si ya hay sesión activa
    await checkExistingSession();
    
    // Cargar logo dinámico
    await loadAppLogo();
    
    // Configurar event listeners
    setupEventListeners();
});

// =====================================================
// VERIFICAR SESIÓN EXISTENTE
// =====================================================
async function checkExistingSession() {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
            console.log('✅ Sesión activa encontrada:', session.user.email);
            showMessage('¡Bienvenido de nuevo! Redirigiendo...', 'success');
            setTimeout(() => {
                // Redirigir al dashboard (lo crearemos pronto)
                window.location.href = 'dashboard.html';
            }, 1500);
        }
    } catch (error) {
        console.error('Error al verificar sesión:', error);
    }
}

// =====================================================
// CONFIGURAR EVENT LISTENERS
// =====================================================
function setupEventListeners() {
    // Formulario de Login
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // Formulario de Registro
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }
}

// =====================================================
// CAMBIAR ENTRE TABS (LOGIN/REGISTRO)
// =====================================================
function switchTab(tab) {
    currentTab = tab;
    
    const loginTab = document.getElementById('loginTab');
    const registerTab = document.getElementById('registerTab');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    
    if (tab === 'login') {
        loginTab.classList.add('active');
        registerTab.classList.remove('active');
        loginForm.classList.add('active');
        registerForm.classList.remove('active');
    } else {
        registerTab.classList.add('active');
        loginTab.classList.remove('active');
        registerForm.classList.add('active');
        loginForm.classList.remove('active');
    }
    
    hideMessage();
}

// =====================================================
// MOSTRAR/OCULTAR CONTRASEÑA (BOTÓN PROFESIONAL)
// =====================================================
function togglePassword(inputId, button) {
    const input = document.getElementById(inputId);
    const eyeOpen = button.querySelector('.eye-open');
    const eyeClosed = button.querySelector('.eye-closed');
    
    if (input.type === 'password') {
        input.type = 'text';
        eyeOpen.style.display = 'none';
        eyeClosed.style.display = 'block';
    } else {
        input.type = 'password';
        eyeOpen.style.display = 'block';
        eyeClosed.style.display = 'none';
    }
}

// =====================================================
// ACTUALIZAR CAMPOS DINÁMICOS SEGÚN ROL
// =====================================================
function updateRoleFields() {
    const role = document.getElementById('regRole').value;
    const dynamicFields = document.getElementById('dynamicFields');
    
    let html = '';
    
    switch(role) {
        case 'restaurant':
            html = `
                <div class="form-group">
                    <label for="regRif">RIF del Restaurante</label>
                    <input type="text" id="regRif" placeholder="J-12345678-9" required>
                </div>
                <div class="form-group">
                    <label for="regRestName">Nombre del Restaurante</label>
                    <input type="text" id="regRestName" placeholder="Mi Restaurante" required>
                </div>
                <div class="form-group">
                    <label for="regRestAddress">Dirección</label>
                    <input type="text" id="regRestAddress" placeholder="Av. Principal, Local 1" required>
                </div>
            `;
            break;
            
        case 'delivery':
            html = `
                <div class="form-group">
                    <label for="regLicense">Número de Licencia</label>
                    <input type="text" id="regLicense" placeholder="ABC-123" required>
                </div>
                <div class="form-group">
                    <label for="regPlate">Placa del Vehículo</label>
                    <input type="text" id="regPlate" placeholder="ABC123" required>
                </div>
                <div class="form-group">
                    <label for="regVehicle">Tipo de Vehículo</label>
                    <select id="regVehicle" required>
                        <option value="">Selecciona...</option>
                        <option value="moto">🏍️ Moto</option>
                        <option value="bicicleta">🚲 Bicicleta</option>
                        <option value="carro">🚗 Carro</option>
                    </select>
                </div>
            `;
            break;
            
        case 'nightclub':
            html = `
                <div class="form-group">
                    <label for="regClubName">Nombre de la Discoteca</label>
                    <input type="text" id="regClubName" placeholder="Neon Club" required>
                </div>
                <div class="form-group">
                    <label for="regClubAddress">Dirección</label>
                    <input type="text" id="regClubAddress" placeholder="Zona Rosa, Calle 1" required>
                </div>
            `;
            break;
            
        case 'remote_worker':
            html = `
                <div class="form-group">
                    <label for="regSpecialty">Especialidad</label>
                    <input type="text" id="regSpecialty" placeholder="Desarrollo Web, Diseño, etc." required>
                </div>
                <div class="form-group">
                    <label for="regRate">Tarifa por Minuto (Tokens)</label>
                    <input type="number" id="regRate" placeholder="1" min="0.1" step="0.1" required>
                </div>
            `;
            break;
            
        default:
            html = '';
    }
    
    dynamicFields.innerHTML = html;
}

// =====================================================
// MANEJAR LOGIN
// =====================================================
async function handleLogin(event) {
    event.preventDefault();
    
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const btn = event.target.querySelector('.btn-primary');
    
    // Validaciones
    if (!email || !password) {
        showMessage('Por favor completa todos los campos', 'error');
        return;
    }
    
    // Mostrar loading
    setLoading(btn, true);
    hideMessage();
    
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        });
        
        if (error) throw error;
        
        // Obtener información del perfil del usuario
        const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();
        
        showMessage('¡Login exitoso! Redirigiendo...', 'success');
        console.log('✅ Usuario logueado:', data.user.email, '| Rol:', profile?.role);
        
        // Guardar datos en localStorage para uso en otras páginas
        localStorage.setItem('fendyx_user', JSON.stringify({
            id: data.user.id,
            email: data.user.email,
            role: profile?.role || 'user',
            tokens: profile?.tokens_balance || 0
        }));
        
        // Redirigir según el rol
        setTimeout(() => {
            if (profile?.role === 'admin') {
                window.location.href = 'admin.html';
            } else {
                window.location.href = 'dashboard.html';
            }
        }, 1500);
        
    } catch (error) {
        console.error('Error en login:', error);
        showMessage(getErrorMessage(error.message), 'error');
    } finally {
        setLoading(btn, false);
    }
}

// =====================================================
// MANEJAR REGISTRO
// =====================================================
async function handleRegister(event) {
    event.preventDefault();
    
    const name = document.getElementById('regName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const age = parseInt(document.getElementById('regAge').value);
    const password = document.getElementById('regPassword').value;
    const role = document.getElementById('regRole').value;
    const terms = document.getElementById('regTerms').checked;
    const btn = event.target.querySelector('.btn-primary');
    
    // Validaciones
    if (!name || !email || !age || !password || !role) {
        showMessage('Por favor completa todos los campos', 'error');
        return;
    }
    
    if (age < 18) {
        showMessage('Debes ser mayor de 18 años para usar Fendyx', 'error');
        return;
    }
    
    if (password.length < 6) {
        showMessage('La contraseña debe tener al menos 6 caracteres', 'error');
        return;
    }
    
    if (!terms) {
        showMessage('Debes aceptar los Términos y Condiciones', 'error');
        return;
    }
    
    // Mostrar loading
    setLoading(btn, true);
    hideMessage();
    
    try {
        // Preparar metadata según rol
        let metadata = {
            full_name: name,
            age: age,
            role: role
        };
        
        // Agregar campos específicos según rol
        if (role === 'restaurant') {
            metadata.rif = document.getElementById('regRif')?.value || '';
            metadata.restaurant_name = document.getElementById('regRestName')?.value || '';
            metadata.restaurant_address = document.getElementById('regRestAddress')?.value || '';
        } else if (role === 'delivery') {
            metadata.license_number = document.getElementById('regLicense')?.value || '';
            metadata.vehicle_plate = document.getElementById('regPlate')?.value || '';
            metadata.vehicle_type = document.getElementById('regVehicle')?.value || '';
        } else if (role === 'nightclub') {
            metadata.nightclub_name = document.getElementById('regClubName')?.value || '';
            metadata.nightclub_address = document.getElementById('regClubAddress')?.value || '';
        } else if (role === 'remote_worker') {
            metadata.specialty = document.getElementById('regSpecialty')?.value || '';
            metadata.rate_per_minute = parseFloat(document.getElementById('regRate')?.value) || 1;
        }
        
        // Registrar usuario en Supabase Auth
        const { data, error } = await supabase.auth.signUp({
            email: email,
            password: password,
            options: {
                data: metadata
            }
        });
        
        if (error) throw error;
        
        // Limpiar formulario
        event.target.reset();
        document.getElementById('dynamicFields').innerHTML = '';
        
        // Si requiere confirmación de email
        if (data.user && !data.session) {
            showMessage('✅ ¡Cuenta creada! Revisa tu correo para confirmar. Ahora inicia sesión.', 'success');
        } else {
            // Sesión creada automáticamente
            showMessage('✅ ¡Cuenta creada! Redirigiendo a tu perfil...', 'success');
            
            // Guardar datos
            localStorage.setItem('fendyx_user', JSON.stringify({
                id: data.user.id,
                email: data.user.email,
                role: role,
                tokens: 5
            }));
            
            // Redirigir después de 2 segundos
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 2000);
            return;
        }
        
        console.log('✅ Usuario registrado:', data.user.email);
        
        // Cambiar automáticamente a Login después de 2.5 segundos
        setTimeout(() => {
            switchTab('login');
            // Pre-llenar el email en el formulario de login
            document.getElementById('loginEmail').value = email;
            document.getElementById('loginPassword').focus();
        }, 2500);
        
    } catch (error) {
        console.error('Error en registro:', error);
        showMessage(getErrorMessage(error.message), 'error');
    } finally {
        setLoading(btn, false);
    }
}

// =====================================================
// RECUPERAR CONTRASEÑA
// =====================================================
async function resetPassword() {
    const email = prompt('Ingresa tu correo electrónico para recuperar la contraseña:');
    
    if (!email) return;
    
    try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin
        });
        
        if (error) throw error;
        
        showMessage('✅ Correo de recuperación enviado. Revisa tu bandeja.', 'success');
    } catch (error) {
        showMessage('Error al enviar correo de recuperación', 'error');
    }
}

// =====================================================
// UTILIDADES
// =====================================================

// Mostrar mensaje de error/éxito
function showMessage(message, type) {
    const messageDiv = document.getElementById('authMessage');
    messageDiv.textContent = message;
    messageDiv.className = 'auth-message ' + type;
}

// Ocultar mensaje
function hideMessage() {
    const messageDiv = document.getElementById('authMessage');
    messageDiv.className = 'auth-message hidden';
}

// Activar/desactivar loading en botón
function setLoading(btn, isLoading) {
    const btnText = btn.querySelector('.btn-text');
    const btnLoader = btn.querySelector('.btn-loader');
    
    if (isLoading) {
        btn.disabled = true;
        btnText.classList.add('hidden');
        btnLoader.classList.remove('hidden');
    } else {
        btn.disabled = false;
        btnText.classList.remove('hidden');
        btnLoader.classList.add('hidden');
    }
}

// Traducir mensajes de error de Supabase
function getErrorMessage(message) {
    const errors = {
        'Invalid login credentials': 'Correo o contraseña incorrectos',
        'Email not confirmed': 'Debes confirmar tu correo electrónico primero',
        'User already registered': 'Este correo ya está registrado',
        'Password should be at least 6 characters': 'La contraseña debe tener al menos 6 caracteres',
        'Invalid email': 'Correo electrónico inválido',
        'Email rate limit exceeded': 'Demasiados intentos. Espera unos minutos.',
        'Signup requires a valid password': 'Se requiere una contraseña válida'
    };
    
    return errors[message] || message;
}

// =====================================================
// CARGAR LOGO DINÁMICO DESDE SUPABASE
// =====================================================
async function loadAppLogo() {
    try {
        const { data, error } = await supabase
            .from('app_branding')
            .select('logo_url')
            .eq('id', 1)
            .single();
        
        if (data && data.logo_url) {
            const logoPlaceholder = document.getElementById('appLogo');
            if (logoPlaceholder) {
                logoPlaceholder.innerHTML = `
                    <img src="${data.logo_url}" alt="Fendyx Logo" style="max-width: 120px; border-radius: 10px;">
                    <h1 class="logo-text">FENDYX</h1>
                `;
            }
        }
    } catch (error) {
        console.log('Logo dinámico no disponible, usando placeholder');
    }
}
