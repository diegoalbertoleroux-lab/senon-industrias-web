import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, addDoc, getDocs, doc, setDoc, updateDoc, query, where, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const ADMIN_EMAIL = "diegoalbertoleroux@gmail.com"; // ⚠️ CAMBIA ESTO
const WA_NUMBER = "584143549096";
let TASA_BCV = 36.50;
let PRODUCTOS_CACHE = {};
let CLIENTES_CACHE = {};
let PROVEEDORES_CACHE = {};
let COTIZACION_ACTUAL = null;

// 1. INICIALIZACIÓN Y LOGIN
document.getElementById('form-admin-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await signInWithEmailAndPassword(auth, document.getElementById('admin-email').value, document.getElementById('admin-password').value); } 
    catch (error) { document.getElementById('login-msg').textContent = "Error: " + error.code; document.getElementById('login-msg').className = "message error"; }
});

onAuthStateChanged(auth, (user) => {
    if (user && user.email === ADMIN_EMAIL) {
        document.getElementById('admin-login').style.display = 'none';
        document.getElementById('app-main').style.display = 'block';
        initApp();
    } else {
        document.getElementById('admin-login').style.display = 'flex';
        document.getElementById('app-main').style.display = 'none';
    }
});

document.getElementById('btn-logout').addEventListener('click', () => signOut(auth));

// 2. NAVEGACIÓN (SIDEBAR)
const viewTitles = { 'view-dashboard': 'Dashboard', 'view-cotizaciones': 'Cotizaciones', 'view-facturas': 'Facturación Manual', 'view-inventario': 'Inventario', 'view-clientes': 'Clientes', 'view-proveedores': 'Proveedores', 'view-servicio': 'Servicio Técnico', 'view-cuentas': 'Cuentas' };
document.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
        document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
        e.currentTarget.classList.add('active');
        const viewId = e.currentTarget.dataset.view;
        document.getElementById(viewId).classList.add('active');
        document.getElementById('page-title').textContent = viewTitles[viewId];
        document.querySelector('.sidebar').classList.remove('open'); // Cerrar en móvil
    });
});
document.getElementById('menu-toggle').addEventListener('click', () => document.querySelector('.sidebar').classList.toggle('open'));

// 3. CARGA DE DATOS GLOBAL
async function initApp() {
    try {
        const res = await fetch("https://ve.dolarapi.com/v1/dolares/oficial");
        const data = await res.json();
        TASA_BCV = data.promedio;
        document.getElementById('tasa-display').textContent = `Tasa BCV: Bs. ${TASA_BCV.toFixed(2)}`;
    } catch (e) { document.getElementById('tasa-display').textContent = "Tasa BCV: Error"; }

    await cargarInventario();
    await cargarClientes();
    await cargarProveedores();
    cargarCotizaciones();
    cargarServicios();
    cargarCuentas();
    cargarCompras();
}

// 4. INVENTARIO Y AJUSTES MASIVOS
async function cargarInventario() {
    const tbody = document.getElementById('tbody-inventario');
    tbody.innerHTML = '<tr><td colspan="6">Cargando...</td></tr>';
    const catSnap = await getDocs(collection(db, "catalogo"));
    const preSnap = await getDocs(collection(db, "precios"));
    const precios = {};
    preSnap.forEach(p => precios[p.data().producto_id] = p.data());
    
    tbody.innerHTML = '';
    catSnap.forEach(docSnap => {
        const p = docSnap.data();
        const pr = precios[docSnap.id] || { precio_A: 0, costo: 0 };
        PRODUCTOS_CACHE[docSnap.id] = { ...p, ...pr };
        tbody.innerHTML += `
            <tr>
                <td>${p.codigo || 'N/A'}</td><td>${p.nombre}</td><td>${p.marca || ''}</td>
                <td>$${pr.costo.toFixed(2)}</td><td>$${pr.precio_A.toFixed(2)}</td>
                <td>${p.exento ? '✅' : '❌'}</td>
            </tr>`;
    });
}

window.aplicarAjusteMasivo = async () => {
    const pct = parseFloat(document.getElementById('ajuste-porcentaje').value);
    const nivel = document.getElementById('ajuste-nivel').value;
    if (isNaN(pct)) return alert("Ingresa un porcentaje válido");
    
    if (!confirm(`¿Aplicar ${pct}% al ${nivel} de todos los productos?`)) return;
    
    const preSnap = await getDocs(collection(db, "precios"));
    for (let d of preSnap.docs) {
        const data = d.data();
        let nuevoPrecio = data[nivel] + (data[nivel] * (pct / 100));
        await updateDoc(doc(db, "precios", d.id), { [nivel]: nuevoPrecio });
    }
    alert("Ajuste aplicado."); cargarInventario();
};

document.getElementById('form-producto').addEventListener('submit', async (e) => {
    e.preventDefault();
    const pA = parseFloat(document.getElementById('inv-pA').value);
    const docRef = await addDoc(collection(db, "catalogo"), {
        codigo: document.getElementById('inv-codigo').value,
        nombre: document.getElementById('inv-nombre').value,
        marca: document.getElementById('inv-marca').value,
        categoria: document.getElementById('inv-categoria').value,
        exento: document.getElementById('inv-exento').checked,
        descripcion: "", stock: parseInt(document.getElementById('inv-stock').value)
    });
    await setDoc(doc(db, "precios", docRef.id), {
        producto_id: docRef.id, costo: parseFloat(document.getElementById('inv-costo').value),
        precio_A: pA, precio_B: pA * 0.95, precio_C: pA * 0.90, precio_D: pA * 0.85
    });
    document.getElementById('form-producto').reset();
    document.getElementById('msg-inventario').textContent = "Guardado"; document.getElementById('msg-inventario').className = "message success";
    cargarInventario();
    setTimeout(() => document.getElementById('msg-inventario').style.display = 'none', 2000);
});

// 5. CLIENTES Y PROVEEDORES
async function cargarClientes() {
    const tbody = document.getElementById('tbody-clientes');
    const select = document.getElementById('cxc-cliente');
    const snap = await getDocs(collection(db, "usuarios"));
    tbody.innerHTML = ''; select.innerHTML = '<option value="">Seleccione cliente...</option>';
    snap.forEach(d => {
        const c = d.data(); CLIENTES_CACHE[d.id] = c;
        tbody.innerHTML += `<tr><td>${c.nombre_laboratorio}</td><td>${c.rif}</td><td>${c.nombre_contacto}</td><td>${c.estado}</td><td>${c.estado==='pendiente'?`<button class="btn btn-success btn-sm" onclick="aprobarCliente('${d.id}')">Aprobar</button>`:'OK'}</td></tr>`;
        select.innerHTML += `<option value="${d.id}">${c.nombre_laboratorio}</option>`;
    });
}
window.aprobarCliente = async (id) => { await updateDoc(doc(db, "usuarios", id), { estado: "aprobado" }); cargarClientes(); };

async function cargarProveedores() {
    const select = document.getElementById('compra-proveedor');
    const selectCxp = document.getElementById('cxp-proveedor');
    const snap = await getDocs(collection(db, "proveedores"));
    select.innerHTML = ''; selectCxp.innerHTML = '';
    snap.forEach(d => {
        PROVEEDORES_CACHE[d.id] = d.data();
        select.innerHTML += `<option value="${d.id}">${d.data().nombre}</option>`;
        selectCxp.innerHTML += `<option value="${d.id}">${d.data().nombre}</option>`;
    });
}
document.getElementById('form-proveedor').addEventListener('submit', async (e) => {
    e.preventDefault();
    await addDoc(collection(db, "proveedores"), {
        nombre: document.getElementById('prov-nombre').value, rif: document.getElementById('prov-rif').value, contacto: document.getElementById('prov-contacto').value
    });
    document.getElementById('form-proveedor').reset(); cargarProveedores();
});

// 6. COTIZACIONES Y PDFs (El diseño exacto del PDF)
async function cargarCotizaciones() {
    const tbody = document.getElementById('tbody-cotizaciones');
    const snap = await getDocs(collection(db, "cotizaciones"));
    tbody.innerHTML = '';
    snap.forEach(d => {
        const c = d.data();
        tbody.innerHTML += `
            <tr>
                <td>${new Date(c.fecha.seconds*1000).toLocaleDateString()}</td><td>${c.email}</td>
                <td>${c.productos.map(p=>p.nombre).join(', ')}</td><td><span class="badge">${c.estado}</span></td>
                <td>
                    ${c.estado === 'pendiente' ? `<button class="btn btn-primary btn-sm" onclick="abrirCotizar('${d.id}', '${encodeURIComponent(JSON.stringify(c))}')">Procesar</button>` : 
                    `<button class="btn btn-outline btn-sm" onclick="generarPDF('${encodeURIComponent(JSON.stringify(c))}', 'COTIZACION')">PDF</button>
                     <button class="btn btn-success btn-sm" onclick="generarPDF('${encodeURIComponent(JSON.stringify(c))}', 'NOTA DE ENTREGA')">Nota Entrega</button>`}
                </td>
            </tr>`;
    });
}

window.abrirCotizar = (id, str) => {
    COTIZACION_ACTUAL = JSON.parse(decodeURIComponent(str)); COTIZACION_ACTUAL.id = id;
    document.getElementById('cotizar-detalles').innerHTML = COTIZACION_ACTUAL.productos.map(p => `<div>${p.cantidad}x ${p.nombre}</div>`).join('');
    document.getElementById('modal-cotizar').classList.add('active');
};

window.guardarCotizacion = async () => {
    const nivel = document.getElementById('cotizar-nivel').value;
    let total = 0; let prods = [];
    for (let p of COTIZACION_ACTUAL.productos) {
        const pr = PRODUCTOS_CACHE[p.id]; // Asumiendo que p.id es el ID del catálogo
        let precioU = pr ? pr[nivel] : 0;
        total += precioU * p.cantidad;
        prods.push({ ...p, precio_unitario: precioU, subtotal: precioU * p.cantidad, codigo: pr ? pr.codigo : 'N/A' });
    }
    await updateDoc(doc(db, "cotizaciones", COTIZACION_ACTUAL.id), {
        estado: "cotizada", nivel_precio: nivel, total_usd: total, total_ves: total * TASA_BCV, tasa_bcv: TASA_BCV, productos_con_precio: prods
    });
    document.getElementById('modal-cotizar').classList.remove('active');
    cargarCotizaciones();
};

window.generarPDF = (str, tipo) => {
    const c = JSON.parse(decodeURIComponent(str));
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Encabezado idéntico al PDF que enviaste
    doc.setFontSize(10); doc.setTextColor(100);
    doc.text("Calle caracas cruce con callejón sin nombre edif. Primer piso 1 of 3, 4 y 5", 14, 15);
    doc.text("barrio el merecure, angostura del Orinoco ciudad Bolivar", 14, 20);
    doc.text("R.I.F: J-50719484-1 | Telf: 0414-3549096", 14, 25);
    
    // Título
    doc.setFontSize(16); doc.setTextColor(0);
    doc.text(tipo, 14, 40);
    
    // Datos Cliente
    doc.setFontSize(10);
    doc.text(`CLIENTE: ${c.email.split('@')[0].toUpperCase()}`, 14, 50);
    doc.text(`C.I/RIF: ${c.rif_cliente || 'V-00000000'}`, 14, 55);
    doc.text(`DIRECCIÓN: ${c.direccion_cliente || 'No registrada'}`, 14, 60);
    
    doc.text(`FECHA: ${new Date().toLocaleDateString()}`, 150, 50);

    // Tabla
    const filas = c.productos_con_precio.map(p => [
        p.cantidad, p.nombre, p.codigo || '-', `$${p.precio_unitario.toFixed(2)}`, `$${p.subtotal.toFixed(2)}`
    ]);
    
    doc.autoTable({
        startY: 70,
        head: [["CANTIDAD", "DESCRIPCIÓN", "SKU", "PRECIO USD", "TOTAL USD"]],
        body: filas,
        theme: 'plain',
        headStyles: { fontStyle: 'bold', textColor: [0,0,0], lineWidth: { bottom: 0.5 } },
        bodyStyles: { lineWidth: { bottom: 0.1 }, textColor: [50,50,50] }
    });

    const finalY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(10); doc.setFont("helvetica", "bold");
    doc.text(`TOTAL DE ITEMS: ${c.productos_con_precio.length}`, 14, finalY);
    doc.text(`SUBTOTAL USD: $${c.total_usd.toFixed(2)}`, 130, finalY);
    doc.text(`TOTAL USD: $${c.total_usd.toFixed(2)}`, 130, finalY + 7);
    doc.text(`TOTAL Bs: Bs. ${c.total_ves.toFixed(2)}`, 130, finalY + 14);

    doc.setFont("helvetica", "normal");
    doc.text("Observaciones", 14, finalY + 30);
    doc.line(14, finalY + 32, 190, finalY + 32);
    
    doc.save(`${tipo.replace(' ', '_')}.pdf`);
};

// 7. FACTURACIÓN MANUAL
window.calcularFactura = () => {
    const base = parseFloat(document.getElementById('fac-base').value) || 0;
    const exento = parseFloat(document.getElementById('fac-exento').value) || 0;
    const iva = base * 0.16;
    const igtf = (base + iva + exento) * 0.03; // Opcional si aplica
    const totalUSD = base + iva + exento + igtf;
    
    document.getElementById('fac-iva-usd').textContent = `$${iva.toFixed(2)}`;
    document.getElementById('fac-igtf-usd').textContent = `$${igtf.toFixed(2)}`;
    document.getElementById('fac-total-usd').textContent = `$${totalUSD.toFixed(2)}`;
    document.getElementById('fac-total-ves').textContent = `Bs. ${(totalUSD * TASA_BCV).toFixed(2)}`;
};

// 8. SERVICIO TÉCNICO Y CUENTAS
async function cargarServicios() {
    const tbody = document.getElementById('tbody-servicio');
    const snap = await getDocs(collection(db, "tickets_servicio"));
    tbody.innerHTML = '';
    snap.forEach(d => {
        const t = d.data();
        tbody.innerHTML += `<tr><td>${t.cliente}</td><td>${t.equipo}</td><td>${t.falla}</td><td><span class="badge">${t.estado}</span></td><td><button class="btn btn-outline btn-sm" onclick="generarInformeTecnico('${encodeURIComponent(JSON.stringify(t))}')">Informe PDF</button></td></tr>`;
    });
}
window.generarInformeTecnico = (str) => {
    const t = JSON.parse(decodeURIComponent(str));
    const { jsPDF } = window.jspdf; const doc = new jsPDF();
    // (Aquí iría el diseño del Informe DYM exacto)
    doc.text("INFORME DE SERVICIO TECNICO", 14, 20);
    doc.text(`Cliente: ${t.cliente}`, 14, 30);
    doc.text(`Equipo: ${t.equipo}`, 14, 40);
    doc.text(`Falla: ${t.falla}`, 14, 50);
    doc.save("Informe_Tecnico.pdf");
};

async function cargarCuentas() {
    const cxc = await getDocs(collection(db, "cxc"));
    const tCxc = document.getElementById('tbody-cxc'); tCxc.innerHTML = '';
    cxc.forEach(d => { tCxc.innerHTML += `<tr><td>${CLIENTES_CACHE[d.data().cliente_id]?.nombre_laboratorio||'N/A'}</td><td>$${d.data().monto}</td><td>${d.data().estado}</td></tr>`; });
    
    const cxp = await getDocs(collection(db, "cxp"));
    const tCxp = document.getElementById('tbody-cxp'); tCxp.innerHTML = '';
    cxp.forEach(d => { tCxp.innerHTML += `<tr><td>${PROVEEDORES_CACHE[d.data().proveedor_id]?.nombre||'N/A'}</td><td>$${d.data().monto}</td><td>${d.data().estado}</td></tr>`; });
}

document.getElementById('form-cxc').addEventListener('submit', async (e) => {
    e.preventDefault();
    await addDoc(collection(db, "cxc"), { cliente_id: document.getElementById('cxc-cliente').value, monto: parseFloat(document.getElementById('cxc-monto').value), estado: "pendiente" });
    cargarCuentas();
});
document.getElementById('form-cxp').addEventListener('submit', async (e) => {
    e.preventDefault();
    await addDoc(collection(db, "cxp"), { proveedor_id: document.getElementById('cxp-proveedor').value, monto: parseFloat(document.getElementById('cxp-monto').value), estado: "pendiente" });
    cargarCuentas();
});

async function cargarCompras() {
    const tbody = document.getElementById('tbody-compras');
    const snap = await getDocs(collection(db, "compras"));
    tbody.innerHTML = '';
    snap.forEach(d => { tbody.innerHTML += `<tr><td>${new Date(d.data().fecha.seconds*1000).toLocaleDateString()}</td><td>${PROVEEDORES_CACHE[d.data().proveedor_id]?.nombre}</td><td>$${d.data().monto}</td></tr>`; });
}
document.getElementById('form-compra').addEventListener('submit', async (e) => {
    e.preventDefault();
    await addDoc(collection(db, "compras"), { proveedor_id: document.getElementById('compra-proveedor').value, monto: parseFloat(document.getElementById('compra-monto').value), fecha: new Date() });
    cargarCompras();
});
