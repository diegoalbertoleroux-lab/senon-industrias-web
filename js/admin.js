import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, addDoc, getDocs, doc, setDoc, updateDoc, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const ADMIN_EMAIL = "diegoalbertoleroux@gmail.com"; // ⚠️ VERIFICA TU CORREO
const WA_NUMBER = "584143549096"; 
let TASA_BCV = 36.50; // Valor por defecto

// --- 1. OBTENER TASA BCV ---
async function obtenerTasa() {
    try {
        const res = await fetch("https://ve.dolarapi.com/v1/dolares/oficial");
        const data = await res.json();
        TASA_BCV = data.promedio;
        document.getElementById('tasa-bcv-display').innerHTML = `Tasa BCV: Bs. ${TASA_BCV.toFixed(2)}`;
    } catch (e) { document.getElementById('tasa-bcv-display').innerHTML = `Tasa BCV: (Error de red)`; }
}

// --- 2. LOGIN ---
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
        obtenerTasa();
        cargarCotizaciones(); cargarTickets(); cargarProductos(); cargarClientes(); cargarFinanzas();
    } else if (user && user.email !== ADMIN_EMAIL) {
        signOut(auth); loginMsg.textContent = "No autorizado."; loginMsg.className = "message error";
    } else {
        loginSection.style.display = 'flex'; adminMain.style.display = 'none';
    }
});
document.getElementById('btn-logout').addEventListener('click', () => signOut(auth));

// --- 3. PESTAÑAS ---
document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
        document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
        e.target.classList.add('active');
        document.getElementById(e.target.dataset.target).classList.add('active');
    });
});

// --- 4. COTIZACIONES Y PDF ---
let cotizacionActual = null;
async function cargarCotizaciones() {
    const tbody = document.getElementById('table-cotizaciones');
    const querySnapshot = await getDocs(collection(db, "cotizaciones"));
    tbody.innerHTML = '';
    querySnapshot.forEach((docSnap) => {
        const c = docSnap.data();
        let acciones = '';
        if (c.estado === 'pendiente') {
            acciones = `<button class="btn-primary" style="padding:5px 10px; font-size:12px;" onclick="abrirCotizacion('${docSnap.id}', '${encodeURIComponent(JSON.stringify(c))}')">Procesar</button>`;
        } else {
            acciones = `
                <button class="btn-outline" style="padding:5px 10px; font-size:12px; margin-right:5px;" onclick="generarPDF('${encodeURIComponent(JSON.stringify(c))}')">PDF</button>
                <button class="btn-success" style="padding:5px 10px; font-size:12px;" onclick="enviarWhatsApp('${encodeURIComponent(JSON.stringify(c))}')">WhatsApp</button>
            `;
        }
        tbody.innerHTML += `
            <tr>
                <td>${new Date(c.fecha.seconds * 1000).toLocaleDateString()}</td>
                <td>${c.email}</td>
                <td>${c.productos.map(p => p.nombre).join(', ')}</td>
                <td><span class="badge">${c.estado}</span></td>
                <td>${acciones}</td>
            </tr>`;
    });
}

window.abrirCotizacion = (id, dataStr) => {
    cotizacionActual = JSON.parse(decodeURIComponent(dataStr));
    cotizacionActual.id = id;
    document.getElementById('quote-details').innerHTML = cotizacionActual.productos.map(p => `<div>${p.cantidad}x ${p.nombre}</div>`).join('');
    document.getElementById('modal-quote').classList.add('active');
};
document.getElementById('close-quote').addEventListener('click', () => document.getElementById('modal-quote').classList.remove('active'));

document.getElementById('btn-save-quote').addEventListener('click', async () => {
    if (!cotizacionActual) return;
    const nivel = document.getElementById('quote-price-level').value;
    
    try {
        // Obtenemos los precios reales de cada producto
        let totalUSD = 0;
        const productosConPrecio = [];
        
        for (let p of cotizacionActual.productos) {
            const precioDoc = await getDocs(query(collection(db, "precios"), where("producto_id", "==", p.id)));
            let precioUnitario = 0;
            if (!precioDoc.empty) {
                precioUnitario = precioDoc.docs[0].data()[nivel];
            }
            const subtotal = precioUnitario * p.cantidad;
            totalUSD += subtotal;
            productosConPrecio.push({ ...p, precio_unitario: precioUnitario, subtotal: subtotal });
        }

        const totalVES = totalUSD * TASA_BCV;

        await updateDoc(doc(db, "cotizaciones", cotizacionActual.id), { 
            estado: "cotizada", 
            nivel_precio: nivel,
            total_usd: totalUSD,
            total_ves: totalVES,
            tasa_bcv: TASA_BCV,
            productos_con_precio: productosConPrecio
        });
        
        alert(`Cotización procesada. Total: $${totalUSD.toFixed(2)} | Bs. ${totalVES.toFixed(2)}`);
        document.getElementById('modal-quote').classList.remove('active');
        cargarCotizaciones();
    } catch (error) { console.error(error); alert("Error al procesar."); }
});

// GENERAR PDF
window.generarPDF = (dataStr) => {
    const c = JSON.parse(decodeURIComponent(dataStr));
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Encabezado
    doc.setFontSize(22); doc.setTextColor(232, 106, 36);
    doc.text("SENON INDUSTRIAS C.A.", 14, 20);
    doc.setFontSize(10); doc.setTextColor(100);
    doc.text("RIF: J-50719484-1 | Tel: +58 414-3549096", 14, 28);
    doc.text("Ciudad Bolívar, Edo. Angostura del Orinoco", 14, 33);
    
    doc.setFontSize(14); doc.setTextColor(0);
    doc.text("COTIZACIÓN FORMAL", 14, 50);
    doc.setFontSize(10);
    doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 14, 58);
    doc.text(`Cliente: ${c.email}`, 14, 64);
    doc.text(`Tasa BCV aplicada: Bs. ${c.tasa_bcv.toFixed(2)}`, 14, 70);

    // Tabla
    const filas = c.productos_con_precio.map(p => [
        p.nombre, p.cantidad, `$${p.precio_unitario.toFixed(2)}`, `$${p.subtotal.toFixed(2)}`, `Bs. ${(p.subtotal * c.tasa_bcv).toFixed(2)}`
    ]);
    
    doc.autoTable({
        startY: 80,
        head: [["Producto", "Cant.", "Precio USD", "Subtotal USD", "Subtotal Bs."]],
        body: filas,
        theme: 'grid',
        headStyles: { fillColor: [26, 43, 76] }
    });

    const finalY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(12);
    doc.text(`TOTAL USD: $${c.total_usd.toFixed(2)}`, 140, finalY);
    doc.text(`TOTAL Bs.: Bs. ${c.total_ves.toFixed(2)}`, 140, finalY + 7);
    
    doc.setFontSize(8); doc.setTextColor(150);
    doc.text("Esta cotización tiene una validez de 15 días.", 14, 280);
    
    doc.save(`Cotizacion_${c.email.split('@')[0]}.pdf`);
};

// WHATSAPP
window.enviarWhatsApp = (dataStr) => {
    const c = JSON.parse(decodeURIComponent(dataStr));
    let texto = `*SENON INDUSTRIAS C.A.*\n*Cotización Formal*\n\n`;
    texto += `Hola, adjuntamos los detalles de su cotización:\n\n`;
    c.productos_con_precio.forEach(p => {
        texto += `▪ ${p.cantidad}x ${p.nombre} - $${p.subtotal.toFixed(2)}\n`;
    });
    texto += `\n*Total USD:* $${c.total_usd.toFixed(2)}`;
    texto += `\n*Total Bs:* Bs. ${c.total_ves.toFixed(2)}`;
    texto += `\n*(Tasa BCV: ${c.tasa_bcv.toFixed(2)})*`;
    
    window.open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(texto)}`, '_blank');
};

// --- 5. SERVICIO TÉCNICO ---
async function cargarTickets() {
    const tbody = document.getElementById('table-servicio');
    const querySnapshot = await getDocs(collection(db, "tickets_servicio"));
    tbody.innerHTML = '';
    querySnapshot.forEach((docSnap) => {
        const t = docSnap.data();
        tbody.innerHTML += `
            <tr>
                <td><strong>${t.cliente}</strong></td><td>${t.equipo}</td><td>${t.falla}</td>
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

// --- 6. INVENTARIO (CON COSTO) ---
document.getElementById('form-product').addEventListener('submit', async (e) => {
    e.preventDefault();
    const docRef = await addDoc(collection(db, "catalogo"), {
        nombre: document.getElementById('prod-nombre').value, categoria: document.getElementById('prod-categoria').value, descripcion: document.getElementById('prod-desc').value
    });
    await setDoc(doc(db, "precios", docRef.id), {
        producto_id: docRef.id, 
        costo: parseFloat(document.getElementById('prod-costo').value),
        precio_A: parseFloat(document.getElementById('prod-pA').value), precio_B: parseFloat(document.getElementById('prod-pB').value), 
        precio_C: parseFloat(document.getElementById('prod-pC').value), precio_D: parseFloat(document.getElementById('prod-pD').value)
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

// --- 7. CLIENTES ---
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

// --- 8. FINANZAS Y DASHBOARD ---
document.getElementById('form-gasto').addEventListener('submit', async (e) => {
    e.preventDefault();
    await addDoc(collection(db, "transacciones"), {
        tipo: "egreso", descripcion: document.getElementById('gasto-desc').value, monto_usd: parseFloat(document.getElementById('gasto-monto').value), fecha: new Date()
    });
    document.getElementById('gasto-message').textContent = "Gasto registrado.";
    document.getElementById('gasto-message').className = "message success";
    document.getElementById('form-gasto').reset();
    cargarFinanzas();
    setTimeout(() => document.getElementById('gasto-message').style.display = 'none', 2000);
});

async function cargarFinanzas() {
    // 1. Sumar ingresos (Cotizaciones procesadas)
    const cotizaciones = await getDocs(collection(db, "cotizaciones"));
    let ingresos = 0;
    cotizaciones.forEach(d => { if (d.data().estado === 'cotizada') ingresos += d.data().total_usd || 0; });

    // 2. Sumar gastos
    const transacciones = await getDocs(collection(db, "transacciones"));
    let gastos = 0;
    transacciones.forEach(d => { if (d.data().tipo === 'egreso') gastos += d.data().monto_usd || 0; });

    // 3. Mostrar
    document.getElementById('stat-ingresos').textContent = `$${ingresos.toFixed(2)}`;
    document.getElementById('stat-ganancia').textContent = `$${(ingresos - gastos).toFixed(2)}`;

    // 4. Gráfico (simulado con los datos actuales)
    const ctx = document.getElementById('salesChart').getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Ingresos', 'Egresos', 'Ganancia'],
            datasets: [{
                label: 'USD',
                data: [ingresos, gastos, ingresos - gastos],
                backgroundColor: ['#10b981', '#ef4444', '#e86a24'],
                borderRadius: 6
            }]
        },
        options: { responsive: true, plugins: { legend: { display: false } } }
    });
}
