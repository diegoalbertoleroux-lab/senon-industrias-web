import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, addDoc, getDocs, doc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// --- 1. LÓGICA DE LOGIN DE ADMIN ---
const loginSection = document.getElementById('admin-login');
const adminMain = document.getElementById('admin-main');
const formLogin = document.getElementById('form-admin-login');
const loginMsg = document.getElementById('login-msg');

// ⚠️ IMPORTANTE: Pon aquí el correo EXACTO que creaste en Firebase Authentication
// Ejemplo: "diegoalbertoleroux@gmail.com"
const ADMIN_EMAIL = "TU_CORREO_AQUI@gmail.com"; 

formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('admin-email').value;
    const pass = document.getElementById('admin-password').value;
    
    // Mostrar mensaje de espera
    loginMsg.textContent = "Verificando...";
    loginMsg.className = "message";
    loginMsg.style.display = 'block';

    try {
        await signInWithEmailAndPassword(auth, email, pass);
        loginMsg.style.display = 'none';
    } catch (error) {
        console.error("Error de login:", error);
        // Aquí mostramos el error real en pantalla para saber qué pasa
        loginMsg.textContent = "Error: " + error.code; 
        loginMsg.className = "message error";
    }
});

onAuthStateChanged(auth, (user) => {
    // Verificamos que haya un usuario Y que sea el administrador
    if (user && user.email === ADMIN_EMAIL) {
        loginSection.style.display = 'none';
        adminMain.style.display = 'block';
        cargarProductos();
        cargarClientes();
    } else if (user && user.email !== ADMIN_EMAIL) {
        // Si es un cliente que intentó entrar al admin, lo sacamos
        signOut(auth);
        loginMsg.textContent = "No tienes permisos de administrador.";
        loginMsg.className = "message error";
        loginMsg.style.display = 'block';
    } else {
        loginSection.style.display = 'flex';
        adminMain.style.display = 'none';
    }
});

document.getElementById('btn-logout').addEventListener('click', () => signOut(auth));

// --- 2. LÓGICA DE PESTAÑAS ---
document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
        document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
        e.target.classList.add('active');
        document.getElementById(e.target.dataset.target).classList.add('active');
    });
});

// --- 3. GUARDAR PRODUCTO CON PRECIOS ---
const formProduct = document.getElementById('form-product');
const adminMessage = document.getElementById('admin-message');

formProduct.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-save');
    btn.textContent = "Guardando...";
    btn.disabled = true;

    const nombre = document.getElementById('prod-nombre').value;
    const categoria = document.getElementById('prod-categoria').value;
    const desc = document.getElementById('prod-desc').value;

    try {
        // A. Guardar en la colección pública (sin precios)
        const docRef = await addDoc(collection(db, "catalogo"), {
            nombre: nombre,
            categoria: categoria,
            descripcion: desc
        });

        // B. Guardar los precios en la colección privada usando el mismo ID
        await setDoc(doc(db, "precios", docRef.id), {
            producto_id: docRef.id,
            precio_A: parseFloat(document.getElementById('prod-pA').value),
            precio_B: parseFloat(document.getElementById('prod-pB').value),
            precio_C: parseFloat(document.getElementById('prod-pC').value),
            precio_D: parseFloat(document.getElementById('prod-pD').value)
        });

        adminMessage.textContent = "Producto y precios guardados.";
        adminMessage.className = "message success";
        formProduct.reset();
        cargarProductos();
        setTimeout(() => adminMessage.className = 'message', 3000);

    } catch (error) {
        console.error(error);
        adminMessage.textContent = "Error al guardar.";
        adminMessage.className = "message error";
    } finally {
        btn.textContent = "Guardar Producto";
        btn.disabled = false;
    }
});

// --- 4. CARGAR TABLA PRODUCTOS ---
async function cargarProductos() {
    const tbody = document.getElementById('table-body');
    tbody.innerHTML = '<tr><td>Cargando...</td></tr>';
    const querySnapshot = await getDocs(collection(db, "catalogo"));
    tbody.innerHTML = '';
    querySnapshot.forEach((doc) => {
        const p = doc.data();
        tbody.innerHTML += `<tr><td><strong>${p.nombre}</strong></td><td><span class="badge">${p.categoria}</span></td></tr>`;
    });
}

// --- 5. CARGAR Y APROBAR CLIENTES ---
async function cargarClientes() {
    const tbody = document.getElementById('table-clientes');
    tbody.innerHTML = '<tr><td colspan="5">Cargando...</td></tr>';
    
    try {
        const querySnapshot = await getDocs(collection(db, "usuarios"));
        tbody.innerHTML = '';
        
        if(querySnapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="5">No hay clientes registrados.</td></tr>';
            return;
        }

        querySnapshot.forEach((docSnap) => {
            const c = docSnap.data();
            const isPendiente = c.estado === 'pendiente';
            const btnAccion = isPendiente 
                ? `<button class="btn-success" onclick="aprobarCliente('${docSnap.id}')">Aprobar</button>`
                : `<span style="color:#22c55e; font-weight:bold;">Aprobado</span>`;

            tbody.innerHTML += `
                <tr>
                    <td><strong>${c.nombre_laboratorio}</strong></td>
                    <td>${c.rif}</td>
                    <td>${c.nombre_contacto}<br><small>${c.telefono}</small></td>
                    <td>${isPendiente ? '⏳ Pendiente' : '✅ ' + c.estado}</td>
                    <td>${btnAccion}</td>
                </tr>
            `;
        });
    } catch (error) {
        console.error(error);
        tbody.innerHTML = '<tr><td colspan="5" style="color:red;">Error al cargar clientes.</td></tr>';
    }
}

// Función global para el botón de aprobar
window.aprobarCliente = async (uid) => {
    try {
        const userRef = doc(db, "usuarios", uid);
        await updateDoc(userRef, { estado: "aprobado" });
        cargarClientes(); // Recargar tabla
    } catch (error) {
        alert("Error al aprobar cliente.");
    }
};
