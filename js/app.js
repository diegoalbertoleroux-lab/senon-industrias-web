import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, setDoc, getDocs, collection } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// --- 1. VARIABLES GLOBALES ---
let carrito = [];
let usuarioActual = null;
const catalogContainer = document.getElementById('catalog-container');
const cartCount = document.getElementById('cart-count');
const cartItemsContainer = document.getElementById('cart-items');
const btnOpenAuth = document.getElementById('btn-open-auth');

// --- 2. LÓGICA DEL MODO OSCURO ---
const themeToggle = document.getElementById('theme-toggle');
const iconSun = document.getElementById('icon-sun');
const iconMoon = document.getElementById('icon-moon');

if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark');
    iconSun.style.display = 'block';
    iconMoon.style.display = 'none';
}

themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark');
    const isDark = document.body.classList.contains('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    iconSun.style.display = isDark ? 'block' : 'none';
    iconMoon.style.display = isDark ? 'none' : 'block';
});

// --- 3. CARGAR CATÁLOGO DESDE FIRESTORE ---
async function cargarCatalogo() {
    try {
        const querySnapshot = await getDocs(collection(db, "catalogo"));
        catalogContainer.innerHTML = '';
        
        if(querySnapshot.empty) {
            catalogContainer.innerHTML = '<p style="text-align:center; width:100%; grid-column: 1/-1;">No hay productos en el catálogo aún.</p>';
            return;
        }

        querySnapshot.forEach((doc) => {
            const prod = doc.data();
            const card = document.createElement('div');
            card.className = 'product-card';
            card.innerHTML = `
                <div class="product-category">${prod.categoria || 'General'}</div>
                <h3 class="product-title">${prod.nombre}</h3>
                <p class="product-desc">${prod.descripcion || ''}</p>
                <div class="product-actions">
                    <button class="btn-primary btn-add-cart" data-id="${doc.id}" data-nombre="${prod.nombre}">Agregar a Cotización</button>
                </div>
            `;
            catalogContainer.appendChild(card);
        });

        // Asignar eventos a los botones de agregar
        document.querySelectorAll('.btn-add-cart').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.getAttribute('data-id');
                const nombre = e.target.getAttribute('data-nombre');
                agregarAlCarrito(id, nombre);
            });
        });

    } catch (error) {
        console.error("Error al cargar catálogo: ", error);
        catalogContainer.innerHTML = '<p style="text-align:center; width:100%; grid-column: 1/-1; color:red;">Error al conectar con la base de datos.</p>';
    }
}

// --- 4. LÓGICA DEL CARRITO ---
function agregarAlCarrito(id, nombre) {
    // Verificar si ya existe
    const existe = carrito.find(item => item.id === id);
    if (existe) {
        existe.cantidad++;
    } else {
        carrito.push({ id, nombre, cantidad: 1 });
    }
    actualizarUI();
}

function actualizarUI() {
    // Actualizar contador flotante
    const totalItems = carrito.reduce((sum, item) => sum + item.cantidad, 0);
    cartCount.innerText = totalItems;

    // Actualizar modal del carrito
    cartItemsContainer.innerHTML = '';
    if (carrito.length === 0) {
        cartItemsContainer.innerHTML = '<p style="color:var(--text-muted); text-align:center;">El carrito está vacío.</p>';
        return;
    }

    carrito.forEach((item, index) => {
        const div = document.createElement('div');
        div.style.display = 'flex';
        div.style.justifyContent = 'space-between';
        div.style.marginBottom = '10px';
        div.style.borderBottom = '1px solid var(--border-color)';
        div.style.paddingBottom = '10px';
        div.innerHTML = `
            <span>${item.nombre}</span>
            <span><strong>${item.cantidad}</strong> ud.</span>
        `;
        cartItemsContainer.appendChild(div);
    });
}

// --- 5. MODALES (Abrir/Cerrar) ---
const modalAuth = document.getElementById('modal-auth');
const modalCart = document.getElementById('modal-cart');

btnOpenAuth.addEventListener('click', () => modalAuth.classList.add('active'));
document.getElementById('close-auth').addEventListener('click', () => modalAuth.classList.remove('active'));

document.getElementById('btn-open-cart').addEventListener('click', () => {
    actualizarUI(); // Refrescar por si acaso
    modalCart.classList.add('active');
});
document.getElementById('close-cart').addEventListener('click', () => modalCart.classList.remove('active'));

// --- 6. AUTENTICACIÓN ---
const tabLogin = document.getElementById('tab-login');
const tabRegister = document.getElementById('tab-register');
const formLogin = document.getElementById('form-login');
const formRegister = document.getElementById('form-register');
const authMessage = document.getElementById('auth-message');

tabLogin.addEventListener('click', () => {
    tabLogin.classList.add('active'); tabRegister.classList.remove('active');
    formLogin.classList.add('active'); formRegister.classList.remove('active');
    authMessage.style.display = 'none';
});

tabRegister.addEventListener('click', () => {
    tabRegister.classList.add('active'); tabLogin.classList.remove('active');
    formRegister.classList.add('active'); formLogin.classList.remove('active');
    authMessage.style.display = 'none';
});

function mostrarMensaje(texto, tipo) {
    authMessage.textContent = texto;
    authMessage.className = `message ${tipo}`;
}

// Login
formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    try {
        await signInWithEmailAndPassword(auth, email, password);
        mostrarMensaje("Acceso correcto...", "success");
        setTimeout(() => { modalAuth.classList.remove('active'); }, 1000);
    } catch (error) {
        mostrarMensaje("Correo o contraseña incorrectos.", "error");
    }
});

// Registro
formRegister.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    
    const datosCliente = {
        rif: document.getElementById('reg-rif').value,
        nombre_laboratorio: document.getElementById('reg-lab').value,
        nombre_contacto: document.getElementById('reg-contacto').value,
        telefono: document.getElementById('reg-telefono').value,
        email: email,
        estado: "pendiente",
        nivel_precio: "D",
        fecha_registro: new Date()
    };

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, "usuarios", userCredential.user.uid), datosCliente);
        mostrarMensaje("Registro exitoso. Ya puedes ingresar.", "success");
        setTimeout(() => { tabLogin.click(); }, 2000);
    } catch (error) {
        if (error.code === 'auth/email-already-in-use') mostrarMensaje("Este correo ya está registrado.", "error");
        else mostrarMensaje("Error al registrar. Verifica los datos.", "error");
    }
});

// Observador de Sesión (Si ya está logueado, cambia el botón)
onAuthStateChanged(auth, (user) => {
    if (user) {
        usuarioActual = user;
        btnOpenAuth.textContent = "Cerrar Sesión";
        btnOpenAuth.style.borderColor = "var(--primary)";
        btnOpenAuth.style.color = "var(--primary)";
        btnOpenAuth.onclick = () => {
            signOut(auth);
            window.location.reload();
        };
    } else {
        usuarioActual = null;
        btnOpenAuth.textContent = "Ingresar / Registrarse";
        btnOpenAuth.style.borderColor = "var(--border-color)";
        btnOpenAuth.style.color = "var(--text-main)";
        btnOpenAuth.onclick = () => modalAuth.classList.add('active');
    }
});

// --- 7. BOTÓN DE SOLICITAR COTIZACIÓN ---
document.getElementById('btn-request-quote').addEventListener('click', () => {
    if (carrito.length === 0) {
        alert("Agrega productos al carrito primero.");
        return;
    }
    
    if (!usuarioActual) {
        // Si no está logueado, forzar el registro
        modalCart.classList.remove('active');
        modalAuth.classList.add('active');
        mostrarMensaje("Debes registrarte o ingresar para solicitar una cotización.", "error");
    } else {
        // Si está logueado, procedemos (esto lo programaremos en la siguiente fase)
        alert("¡Perfecto! Estás registrado. En la siguiente fase guardaremos esta solicitud en Firebase para enviártela por WhatsApp.");
    }
});

// Inicializar
cargarCatalogo();
