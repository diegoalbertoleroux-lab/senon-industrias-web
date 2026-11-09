import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, addDoc, getDocs, doc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ⚠️ IMPORTANTE: CAMBIA ESTO POR TU CORREO DE ADMINISTRADOR
const ADMIN_EMAIL = "diegoalbertoleroux@gmail.com"; 

const loginSection = document.getElementById('admin-login');
const adminMain = document.getElementById('admin-main');
const formLogin = document.getElementById('form-admin-login');
const loginMsg = document.getElementById('login-msg');

formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('admin-email').value;
    const pass = document.getElementById('admin-password').value;
    
    loginMsg.textContent = "Verificando...";
    loginMsg.className = "message";
    loginMsg.style.display = 'block';

    try {
        await signInWithEmailAndPassword(auth, email, pass);
        loginMsg.style.display = 'none';
    } catch (error) {
        loginMsg.textContent = "Error: " + error.code; 
        loginMsg.className = "message error";
    }
});

onAuthStateChanged(auth, (user) => {
    if (user && user.email === ADMIN_EMAIL) {
        loginSection.style.display = 'none';
        adminMain.style.display = 'block';
        cargarProductos();
        cargarClientes();
    } else if (user && user.email !== ADMIN_EMAIL) {
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

document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
        document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
        e.target.classList.add('active');
        document.getElementById(e.target.dataset.target).classList.add('active');
    });
});

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
        const docRef = await addDoc(collection(db, "catalogo"), {
            nombre: nombre,
            categoria: categoria,
            descripcion: desc
        });

        await setDoc(doc(db, "precios", docRef.id), {
            producto_id: docRef.id,
            precio_A: parseFloat(document.getElementById('prod-pA').value),
            precio_B: parseFloat(document.getElementById('prod-pB').value),
            precio_C: parseFloat(document.getElementById('prod-pC').value),
            precio_D: parseFloat(document.getElementById('prod-pD').value)
        });

        adminMessage.textContent = "Producto y precios guardados.";
        adminMessage.className = "message success";
        adminMessage.style.display = 'block';
        formProduct.reset();
        cargarProductos();
        setTimeout(() => { adminMessage.style.display = 'none'; }, 3000);

    } catch (error) {
        adminMessage.textContent = "Error al guardar.";
        adminMessage.className = "message error";
        adminMessage.style.display = 'block';
    } finally {
        btn.textContent = "Guardar en Base de Datos";
        btn.disabled = false;
    }
});

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
                : `<span style="color:var(--success); font-weight:bold;">Aprobado</span>`;

            tbody.innerHTML += `
                <tr>
                    <td><strong>${c.nombre_laboratorio}</strong></td>
                    <td>${c.rif}</td>
                    <td>${c.nombre_contacto}<br><small>${c.telefono}</small></td>
                    <td>${isPendiente ? '⏳ Pendiente' : '✅ Aprobado'}</td>
                    <td>${btnAccion}</td>
                </tr>
            `;
        });
    } catch (error) {
        tbody.innerHTML = '<tr><td colspan="5" style="color:red;">Error al cargar clientes.</td></tr>';
    }
}

window.aprobarCliente = async (uid) => {
    try {
        const userRef = doc(db, "usuarios", uid);
        await updateDoc(userRef, { estado: "aprobado" });
        cargarClientes(); 
    } catch (error) {
        alert("Error al aprobar cliente.");
    }
};
