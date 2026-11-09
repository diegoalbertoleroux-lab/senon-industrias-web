import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, addDoc, getDocs, doc, setDoc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const ADMIN_EMAIL = "diegoalbertoleroux@gmail.com"; // ⚠️ VERIFICA TU CORREO

// --- LOGIN ---
const loginSection = document.getElementById('admin-login');
const adminMain = document.getElementById('admin-main');
const loginMsg = document.getElementById('login-msg');

document.getElementById('form-admin-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await signInWithEmailAndPassword(auth, document.getElementById('admin-email').value, document.getElementById('admin-password').value); } 
    catch (error) { loginMsg.textContent = "Error: " + error.code; loginMsg.className = "message error"; }
});

onAuthStateChanged(auth, (user) => {
    if (user && user.email === ADMIN_EMAIL) {
        loginSection.style.display = 'none'; adminMain.style.display = 'block';
        cargarCotizaciones(); cargarTickets(); cargarProductos(); cargarClientes();
    } else if (user && user.email !== ADMIN_EMAIL) {
        signOut(auth); loginMsg.textContent = "No autorizado."; loginMsg.className = "message error";
    } else {
        loginSection.style.display = 'flex'; adminMain.style.display = 'none';
    }
});
document.getElementById('btn-logout').addEventListener('click', () => signOut(auth));

// --- PESTAÑAS ---
document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
        document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
        e.target.classList.add('active');
        document.getElementById(e.target.dataset.target).classList.add('active');
    });
});

// --- COTIZACIONES ---
let cotizacionActualId = null;
async function cargarCotizaciones() {
    const tbody = document.getElementById('table-cotizaciones');
    const querySnapshot = await getDocs(collection(db, "cotizaciones"));
    tbody.innerHTML = '';
    querySnapshot.forEach((docSnap) => {
        const c = docSnap.data();
        if (c.estado === 'pendiente') {
            tbody.innerHTML += `
                <tr>
                    <td>${new Date(c.fecha.seconds * 1000).toLocaleDateString()}</td>
                    <td>${c.email}</td>
                    <td>${c.productos.map(p => p.nombre).join(', ')}</td>
                    <td><button class="btn-primary" style="padding:5px 10px; font-size:12px;" onclick="abrirCotizacion('${docSnap.id}', '${encodeURIComponent(JSON.stringify(c.productos))}')">Procesar</button></td>
                </tr>`;
        }
    });
}

window.abrirCotizacion = (id, productosStr) => {
    cotizacionActualId = id;
    const productos = JSON.parse(decodeURIComponent(productosStr));
    document.getElementById('quote-details').innerHTML = productos.map(p => `<div>${p.cantidad}x ${p.nombre} (ID: ${p.id})</div>`).join('');
    document.getElementById('modal-quote').classList.add('active');
};
document.getElementById('close-quote').addEventListener('click', () => document.getElementById('modal-quote').classList.remove('active'));

document.getElementById('btn-save-quote').addEventListener('click', async () => {
    if (!cotizacionActualId) return;
    const nivel = document.getElementById('quote-price-level').value;
    // Aquí en el futuro conectaremos con jsPDF. Por ahora actualizamos el estado.
    try {
        await updateDoc(doc(db, "cotizaciones", cotizacionActualId), { estado: "cotizada", nivel_precio: nivel });
        alert("Cotización procesada. (El PDF se generará en la próxima fase).");
        document.getElementById('modal-quote').classList.remove('active');
        cargarCotizaciones();
    } catch (error) { alert("Error al actualizar."); }
});

// --- SERVICIO TÉCNICO ---
async function cargarTickets() {
    const tbody = document.getElementById('table-servicio');
    const querySnapshot = await getDocs(collection(db, "tickets_servicio"));
    tbody.innerHTML = '';
    querySnapshot.forEach((docSnap) => {
        const t = docSnap.data();
        tbody.innerHTML += `
            <tr>
                <td><strong>${t.cliente}</strong></td>
                <td>${t.equipo}</td>
                <td>${t.falla}</td>
                <td><span class="badge">${t.estado}</span></td>
                <td><button class="btn-outline" style="padding:4px 8px; font-size:12px;" onclick="avanzarTicket('${docSnap.id}', '${t.estado}')">Avanzar</button></td>
            </tr>`;
    });
}

window.avanzarTicket = async (id, estadoActual) => {
    let nuevoEstado = "En Reparación";
    if (estadoActual === "En Reparación") nuevoEstado = "Listo";
    else if (estadoActual === "Listo") nuevoEstado = "Entregado";
    
    await updateDoc(doc(db, "tickets_servicio", id), { estado: nuevoEstado });
    cargarTickets();
};

// --- PRODUCTOS Y CLIENTES (Igual que antes) ---
document.getElementById('form-product').addEventListener('submit', async (e) => {
    e.preventDefault();
    const docRef = await addDoc(collection(db, "catalogo"), {
        nombre: document.getElementById('prod-nombre').value, categoria: document.getElementById('prod-categoria').value, descripcion: document.getElementById('prod-desc').value
    });
    await setDoc(doc(db, "precios", docRef.id), {
        producto_id: docRef.id, precio_A: parseFloat(document.getElementById('prod-pA').value), precio_B: parseFloat(document.getElementById('prod-pB').value), precio_C: parseFloat(document.getElementById('prod-pC').value), precio_D: parseFloat(document.getElementById('prod-pD').value)
    });
    document.getElementById('form-product').reset();
    cargarProductos();
});

async function cargarProductos() {
    const tbody = document.getElementById('table-body');
    const querySnapshot = await getDocs(collection(db, "catalogo"));
    tbody.innerHTML = '';
    querySnapshot.forEach((doc) => { const p = doc.data(); tbody.innerHTML += `<tr><td>${p.nombre}</td><td>${p.categoria}</td></tr>`; });
}

async function cargarClientes() {
    const tbody = document.getElementById('table-clientes');
    const querySnapshot = await getDocs(collection(db, "usuarios"));
    tbody.innerHTML = '';
    querySnapshot.forEach((docSnap) => {
        const c = docSnap.data();
        tbody.innerHTML += `<tr><td>${c.nombre_laboratorio}</td><td>${c.rif}</td><td>${c.nombre_contacto}</td><td>${c.estado}</td><td>${c.estado === 'pendiente' ? `<button class="btn-success" onclick="aprobar('${docSnap.id}')">Aprobar</button>` : 'OK'}</td></tr>`;
    });
}
window.aprobar = async (uid) => { await updateDoc(doc(db, "usuarios", uid), { estado: "aprobado" }); cargarClientes(); };
