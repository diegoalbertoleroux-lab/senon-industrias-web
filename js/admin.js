import { db } from './firebase-config.js';
import { collection, addDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const formProduct = document.getElementById('form-product');
const tableBody = document.getElementById('table-body');
const adminMessage = document.getElementById('admin-message');

// 1. Función para mostrar mensajes
function mostrarMensaje(texto, tipo) {
    adminMessage.textContent = texto;
    adminMessage.className = `message ${tipo}`;
    setTimeout(() => { adminMessage.className = 'message'; }, 3000);
}

// 2. Guardar un nuevo producto
formProduct.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-save');
    btn.textContent = "Guardando...";
    btn.disabled = true;

    const nuevoProducto = {
        nombre: document.getElementById('prod-nombre').value,
        categoria: document.getElementById('prod-categoria').value,
        descripcion: document.getElementById('prod-desc').value,
        imagen: "" // Lo dejamos vacío por ahora
    };

    try {
        await addDoc(collection(db, "catalogo"), nuevoProducto);
        mostrarMensaje("Producto guardado exitosamente.", "success");
        formProduct.reset();
        cargarTablaProductos(); // Recargar la tabla
    } catch (error) {
        console.error(error);
        mostrarMensaje("Error al guardar el producto.", "error");
    } finally {
        btn.textContent = "Guardar Producto";
        btn.disabled = false;
    }
});

// 3. Cargar productos en la tabla
async function cargarTablaProductos() {
    tableBody.innerHTML = '<tr><td colspan="3">Cargando...</td></tr>';
    try {
        const querySnapshot = await getDocs(collection(db, "catalogo"));
        tableBody.innerHTML = '';
        
        if(querySnapshot.empty) {
            tableBody.innerHTML = '<tr><td colspan="3">No hay productos.</td></tr>';
            return;
        }

        querySnapshot.forEach((doc) => {
            const prod = doc.data();
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${prod.nombre || 'Sin nombre'}</strong></td>
                <td><span class="badge">${prod.categoria || 'General'}</span></td>
                <td style="font-size: 13px; color: var(--text-muted);">${prod.descripcion || ''}</td>
            `;
            tableBody.appendChild(tr);
        });
    } catch (error) {
        console.error(error);
        tableBody.innerHTML = '<tr><td colspan="3" style="color:red;">Error al cargar.</td></tr>';
    }
}

// Inicializar
cargarTablaProductos();
