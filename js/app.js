import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, setDoc, getDocs, collection, addDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let carrito = [];
let usuarioActual = null;

// Modo Oscuro
const themeToggle = document.getElementById('theme-toggle');
const themeIcon = document.getElementById('theme-icon');
if (localStorage.getItem('theme') === 'dark') { document.body.classList.add('dark'); themeIcon.textContent = '☀️'; }
themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark');
    const isDark = document.body.classList.contains('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    themeIcon.textContent = isDark ? '☀️' : '🌙';
});

// Cargar Catálogo
async function cargarCatalogo() {
    const container = document.getElementById('catalog-container');
    try {
        const querySnapshot = await getDocs(collection(db, "catalogo"));
        container.innerHTML = '';
        if(querySnapshot.empty) { container.innerHTML = '<p>No hay productos.</p>'; return; }
        
        querySnapshot.forEach((doc) => {
            const prod = doc.data();
            container.innerHTML += `
                <div class="product-card">
                    <div class="badge">${prod.categoria}</div>
                    <h3 class="product-title">${prod.nombre}</h3>
                    <p class="product-desc">${prod.descripcion}</p>
                    <button class="btn-primary btn-add-cart" data-id="${doc.id}" data-nombre="${prod.nombre}">Agregar</button>
                </div>`;
        });

        document.querySelectorAll('.btn-add-cart').forEach(btn => {
            btn.addEventListener('click', (e) => agregarAlCarrito(e.target.dataset.id, e.target.dataset.nombre));
        });
    } catch (error) { container.innerHTML = '<p>Error al cargar.</p>'; }
}

// Carrito
function agregarAlCarrito(id, nombre) {
    const item = carrito.find(i => i.id === id);
    if (item) item.cantidad++; else carrito.push({ id, nombre, cantidad: 1 });
    actualizarUI();
}

function actualizarUI() {
    document.getElementById('cart-count').innerText = carrito.reduce((s, i) => s + i.cantidad, 0);
    const container = document.getElementById('cart-items');
    container.innerHTML = carrito.length === 0 ? '<p>Vacío.</p>' : carrito.map(i => `<div style="display:flex; justify-content:space-between; margin-bottom:10px;"><span>${i.nombre}</span><b>${i.cantidad} ud.</b></div>`).join('');
}

// Modales Generales
function toggleModal(id, show) { document.getElementById(id).classList.toggle('active', show); }
document.getElementById('btn-open-auth').addEventListener('click', () => toggleModal('modal-auth', true));
document.getElementById('close-auth').addEventListener('click', () => toggleModal('modal-auth', false));
document.getElementById('btn-open-cart').addEventListener('click', () => toggleModal('modal-cart', true));
document.getElementById('close-cart').addEventListener('click', () => toggleModal('modal-cart', false));
document.getElementById('btn-open-service').addEventListener('click', () => toggleModal('modal-service', true));
document.getElementById('close-service').addEventListener('click', () => toggleModal('modal-service', false));

// Login / Registro
const authMessage = document.getElementById('auth-message');
document.getElementById('tab-login').addEventListener('click', () => { document.getElementById('tab-login').classList.add('active'); document.getElementById('tab-register').classList.remove('active'); document.getElementById('form-login').classList.add('active'); document.getElementById('form-register').classList.remove('active'); });
document.getElementById('tab-register').addEventListener('click', () => { document.getElementById('tab-register').classList.add('active'); document.getElementById('tab-login').classList.remove('active'); document.getElementById('form-register').classList.add('active'); document.getElementById('form-login').classList.remove('active'); });

document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await signInWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-password').value); toggleModal('modal-auth', false); } 
    catch (error) { authMessage.textContent = "Error de credenciales."; authMessage.className = "message error"; }
});

document.getElementById('form-register').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        const user = await createUserWithEmailAndPassword(auth, document.getElementById('reg-email').value, document.getElementById('reg-password').value);
        await setDoc(doc(db, "usuarios", user.user.uid), {
            rif: document.getElementById('reg-rif').value, nombre_laboratorio: document.getElementById('reg-lab').value,
            nombre_contacto: document.getElementById('reg-contacto').value, telefono: document.getElementById('reg-telefono').value,
            email: document.getElementById('reg-email').value, estado: "pendiente"
        });
        authMessage.textContent = "Registrado. Espera aprobación."; authMessage.className = "message success";
        setTimeout(() => document.getElementById('tab-login').click(), 2000);
    } catch (error) { authMessage.textContent = "Error al registrar."; authMessage.className = "message error"; }
});

onAuthStateChanged(auth, (user) => {
    usuarioActual = user;
    const btn = document.getElementById('btn-open-auth');
    if (user) {
        btn.textContent = "Cerrar Sesión"; btn.onclick = () => { signOut(auth); window.location.reload(); };
    } else {
        btn.textContent = "Ingresar / Registrarse"; btn.onclick = () => toggleModal('modal-auth', true);
    }
});

// Guardar Cotización
document.getElementById('btn-request-quote').addEventListener('click', async () => {
    if (carrito.length === 0) return alert("Carrito vacío");
    if (!usuarioActual) { toggleModal('modal-cart', false); toggleModal('modal-auth', true); return alert("Inicia sesión para cotizar"); }

    try {
        await addDoc(collection(db, "cotizaciones"), {
            cliente_id: usuarioActual.uid, email: usuarioActual.email,
            productos: carrito, estado: "pendiente", fecha: new Date()
        });
        alert("¡Solicitud enviada! El administrador la revisará pronto.");
        carrito = []; actualizarUI(); toggleModal('modal-cart', false);
    } catch (error) { alert("Error al enviar solicitud."); }
});

// Guardar Ticket de Servicio
document.getElementById('form-service').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        await addDoc(collection(db, "tickets_servicio"), {
            cliente: document.getElementById('srv-lab').value, equipo: document.getElementById('srv-equipo').value,
            falla: document.getElementById('srv-falla').value, estado: "Recibido", fecha: new Date()
        });
        const msg = document.getElementById('service-message');
        msg.textContent = "Reporte enviado correctamente."; msg.className = "message success";
        document.getElementById('form-service').reset();
        setTimeout(() => { toggleModal('modal-service', false); msg.style.display = 'none'; }, 2000);
    } catch (error) { alert("Error al enviar reporte."); }
});

cargarCatalogo();
