import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, addDoc, getDocs, doc, setDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const ADMIN_EMAIL = "diegoalbertoleroux@gmail.com"; // ⚠️ VERIFICA TU CORREO
let TASA_BCV = 36.50;
let PRODUCTOS_CACHE = {};
let CLIENTES_CACHE = {};
let PROVEEDORES_CACHE = {};
let COTIZACION_WEB_ACTUAL = null;
let MANUAL_ITEMS = [];
let COMPRA_ITEMS = [];
let chartInstance = null;
let TOTAL_GASTOS = 0;

// --- LOGIN Y NAVEGACIÓN ---
document.getElementById('form-admin-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await signInWithEmailAndPassword(auth, document.getElementById('admin-email').value, document.getElementById('admin-password').value); } 
    catch (error) { document.getElementById('login-msg').textContent = "Error: " + error.code; document.getElementById('login-msg').className = "message error"; }
});

onAuthStateChanged(auth, (user) => {
    if (user && user.email === ADMIN_EMAIL) {
        document.getElementById('admin-login').style.display = 'none';
        document.getElementById('app-main').style.display = 'flex';
        initApp();
    } else {
        document.getElementById('admin-login').style.display = 'flex';
        document.getElementById('app-main').style.display = 'none';
    }
});
document.getElementById('btn-logout').addEventListener('click', () => signOut(auth));

document.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
        document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
        e.currentTarget.classList.add('active');
        const viewId = e.currentTarget.dataset.view;
        document.getElementById(viewId).classList.add('active');
        document.getElementById('page-title').textContent = e.currentTarget.textContent;
        document.querySelector('.sidebar').classList.remove('open');
    });
});

// --- INICIALIZACIÓN ---
async function initApp() {
    try {
        const res = await fetch("https://ve.dolarapi.com/v1/dolares/oficial");
        const data = await res.json();
        TASA_BCV = data.promedio;
        document.getElementById('tasa-display').textContent = `Tasa BCV: Bs. ${TASA_BCV.toFixed(2)}`;
    } catch (e) { document.getElementById('tasa-display').textContent = "Tasa BCV: Error"; }

    await cargarInventario();
    await cargarClientesYProveedores();
    cargarCotizaciones();
    cargarVentas();
    cargarServicios();
    cargarCuentas();
    cargarGastosYGrafica();
}

// --- 1. INVENTARIO ---
async function cargarInventario() {
    const selectCat = document.getElementById('filtro-categoria-inv');
    const catSnap = await getDocs(collection(db, "catalogo"));
    const preSnap = await getDocs(collection(db, "precios"));
    const precios = {}; preSnap.forEach(p => precios[p.data().producto_id] = p.data());
    
    let categorias = new Set(); PRODUCTOS_CACHE = {};
    
    catSnap.forEach(docSnap => {
        const p = docSnap.data();
        const pr = precios[docSnap.id] || { precio_A: 0, costo: 0 };
        PRODUCTOS_CACHE[docSnap.id] = { id: docSnap.id, ...p, ...pr };
        if (p.categoria) categorias.add(p.categoria);
    });

    selectCat.innerHTML = '<option value="">Categorías</option>';
    Array.from(categorias).sort().forEach(c => { selectCat.innerHTML += `<option value="${c}">${c}</option>`; });
    filtrarInventario();
}

window.filtrarInventario = () => {
    const cat = document.getElementById('filtro-categoria-inv').value;
    const tbody = document.getElementById('tbody-inventario');
    tbody.innerHTML = '';
    Object.values(PRODUCTOS_CACHE).forEach(p => {
        if (cat === "" || p.categoria === cat) {
            tbody.innerHTML += `
                <tr>
                    <td>${p.codigo || '-'}</td><td>${p.nombre}</td><td>${p.proveedor || '-'}</td>
                    <td style="color: ${p.stock <= 5 ? '#ef4444' : 'inherit'}; font-weight: ${p.stock <= 5 ? 'bold' : 'normal'};">${p.stock || 0}</td>
                    <td>$${(p.precio_A || 0).toFixed(2)}</td>
                    <td><button class="btn btn-outline btn-sm" onclick="editarProducto('${p.id}')">Editar</button></td>
                </tr>`;
        }
    });
};

window.abrirModalProducto = () => {
    document.getElementById('form-producto').reset();
    document.getElementById('prod-id').value = '';
    document.getElementById('modal-prod-title').textContent = 'Nuevo Producto';
    document.getElementById('modal-producto').classList.add('active');
};

window.editarProducto = (id) => {
    const p = PRODUCTOS_CACHE[id];
    document.getElementById('prod-id').value = id;
    document.getElementById('inv-codigo').value = p.codigo || '';
    document.getElementById('inv-nombre').value = p.nombre || '';
    document.getElementById('inv-marca').value = p.marca || '';
    document.getElementById('inv-categoria').value = p.categoria || '';
    document.getElementById('inv-proveedor').value = p.proveedor_id || '';
    document.getElementById('inv-costo').value = p.costo || 0;
    document.getElementById('inv-pA').value = p.precio_A || 0;
    document.getElementById('inv-stock').value = p.stock || 0;
    document.getElementById('inv-exento').checked = p.exento || false;
    document.getElementById('modal-prod-title').textContent = 'Editar Producto';
    document.getElementById('modal-producto').classList.add('active');
};

document.getElementById('form-producto').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('prod-id').value;
    const pA = parseFloat(document.getElementById('inv-pA').value);
    
    const dataPublica = {
        codigo: document.getElementById('inv-codigo').value, nombre: document.getElementById('inv-nombre').value,
        marca: document.getElementById('inv-marca').value, categoria: document.getElementById('inv-categoria').value,
        proveedor_id: document.getElementById('inv-proveedor').value,
        exento: document.getElementById('inv-exento').checked, stock: parseInt(document.getElementById('inv-stock').value)
    };
    const dataPrecios = { costo: parseFloat(document.getElementById('inv-costo').value), precio_A: pA, precio_B: pA*0.95, precio_C: pA*0.90, precio_D: pA*0.85 };

    if (id) {
        await updateDoc(doc(db, "catalogo", id), dataPublica);
        await updateDoc(doc(db, "precios", id), dataPrecios);
    } else {
        const docRef = await addDoc(collection(db, "catalogo"), dataPublica);
        dataPrecios.producto_id = docRef.id;
        await setDoc(doc(db, "precios", docRef.id), dataPrecios);
    }
    document.getElementById('modal-producto').classList.remove('active');
    cargarInventario();
});

// EXPORTAR LISTAS DE PRECIOS
window.exportarListaPrecios = (nivel, titulo) => {
    const { jsPDF } = window.jspdf; const doc = new jsPDF();
    
    // MEMBRETE ALINEADO
    doc.addImage('img/logo.png', 'PNG', 14, 10, 40, 15);
    doc.setFontSize(9); doc.setTextColor(80);
    doc.text("R.I.F: J-50719484-1 | Telf: 0414-3549096", 196, 15, { align: "right" });
    doc.text("Calle Caracas, Angostura del Orinoco, Ciudad Bolívar", 196, 20, { align: "right" });
    
    doc.setFontSize(16); doc.setTextColor(0);
    doc.text(`LISTA DE PRECIOS - ${titulo}`, 14, 40);
    doc.setFontSize(9); doc.text(`Fecha: ${new Date().toLocaleDateString()} | Tasa: Bs. ${TASA_BCV.toFixed(2)}`, 14, 47);

    const agrupados = {};
    Object.values(PRODUCTOS_CACHE).forEach(p => {
        if(!agrupados[p.categoria]) agrupados[p.categoria] = [];
        agrupados[p.categoria].push(p);
    });

    let currentY = 55;
    Object.keys(agrupados).sort().forEach(cat => {
        doc.setFontSize(11); doc.setFont("helvetica", "bold");
        doc.text(cat.toUpperCase(), 14, currentY);
        
        const filas = agrupados[cat].map(p => [ p.codigo || '-', p.nombre, `$${p[nivel].toFixed(2)}`, `Bs. ${(p[nivel] * TASA_BCV).toFixed(2)}` ]);

        doc.autoTable({
            startY: currentY + 5, head: [["Código", "Producto", "Precio USD", "Precio Bs."]],
            body: filas, theme: 'striped', headStyles: { fillColor: [26, 43, 76] }, styles: { fontSize: 8 },
            margin: { left: 14, right: 14 }
        });
        currentY = doc.lastAutoTable.finalY + 15;
        if (currentY > 260) { doc.addPage(); currentY = 20; }
    });
    doc.save(`Lista_Precios_${nivel}.pdf`);
};

// --- 2. COTIZACIONES Y BUSCADORES (FUNCIONES GLOBALES) ---
async function cargarCotizaciones() {
    const tbody = document.getElementById('tbody-cotizaciones');
    const snap = await getDocs(collection(db, "cotizaciones"));
    tbody.innerHTML = '';
    snap.forEach(d => {
        const c = d.data();
        let btn = '';
        if (c.estado === 'pendiente') btn = `<button class="btn btn-primary btn-sm" onclick="abrirCotizar('${d.id}', '${encodeURIComponent(JSON.stringify(c))}')">Procesar</button>`;
        else if (c.estado === 'aprobada' || c.estado === 'facturada') {
            btn = `<button class="btn btn-outline btn-sm" onclick="generarPDF('${encodeURIComponent(JSON.stringify(c))}', 'COTIZACIÓN')">Cotización</button>
                   <button class="btn btn-primary btn-sm" onclick="generarPDF('${encodeURIComponent(JSON.stringify(c))}', 'FACTURA')">Factura</button>`;
        }
        tbody.innerHTML += `<tr><td>${new Date(c.fecha.seconds*1000).toLocaleDateString()}</td><td>${c.email}</td><td><span class="badge">${c.estado}</span></td><td>${btn}</td></tr>`;
    });
}

window.abrirCotizar = (id, str) => {
    COTIZACION_WEB_ACTUAL = JSON.parse(decodeURIComponent(str)); COTIZACION_WEB_ACTUAL.id = id;
    document.getElementById('cotizar-detalles').innerHTML = COTIZACION_WEB_ACTUAL.productos.map(p => `<div>${p.cantidad}x ${p.nombre}</div>`).join('');
    document.getElementById('modal-cotizar').classList.add('active');
};

window.guardarCotizacionWeb = async () => {
    const nivel = document.getElementById('cotizar-nivel').value;
    let total = 0; let prods = [];
    for (let p of COTIZACION_WEB_ACTUAL.productos) {
        const pr = PRODUCTOS_CACHE[p.id]; 
        let precioU = pr ? pr[nivel] : 0; total += precioU * p.cantidad;
        prods.push({ ...p, precio_unitario: precioU, subtotal: precioU * p.cantidad, codigo: pr ? pr.codigo : 'N/A', exento: pr ? pr.exento : false });
        if (pr) { const nuevoStock = Math.max(0, (pr.stock || 0) - p.cantidad); await updateDoc(doc(db, "catalogo", p.id), { stock: nuevoStock }); }
    }
    await updateDoc(doc(db, "cotizaciones", COTIZACION_WEB_ACTUAL.id), { estado: "aprobada", total_usd: total, productos_con_precio: prods });
    await addDoc(collection(db, "cxc"), { cliente_email: COTIZACION_WEB_ACTUAL.email, monto: total, estado: "pendiente", fecha: new Date() });
    document.getElementById('modal-cotizar').classList.remove('active');
    cargarCotizaciones(); cargarVentas(); cargarCuentas(); cargarGastosYGrafica(); cargarInventario();
    Swal.fire('Aprobada', 'Stock descontado', 'success');
};

window.abrirModalCotizacionManual = () => {
    const select = document.getElementById('manual-cot-cliente');
    select.innerHTML = '<option value="">Seleccione un cliente...</option>';
    Object.keys(CLIENTES_CACHE).forEach(id => { select.innerHTML += `<option value="${id}">${CLIENTES_CACHE[id].nombre_laboratorio}</option>`; });
    MANUAL_ITEMS = []; renderManualItems();
    document.getElementById('modal-cotizacion-manual').classList.add('active');
};

window.cambiarNivelCliente = () => {
    const id = document.getElementById('manual-cot-cliente').value;
    if(id && CLIENTES_CACHE[id] && CLIENTES_CACHE[id].nivel_precio) {
        document.getElementById('manual-nivel').value = CLIENTES_CACHE[id].nivel_precio;
        renderManualItems();
    }
};

// ESTA FUNCION SE LLAMA DIRECTO DESDE EL HTML
window.buscarProductoManual = (query) => {
    const q = query.toLowerCase(); const resDiv = document.getElementById('res-manual');
    if (q.length < 1) { resDiv.style.display = 'none'; return; }
    // Si por alguna razon el cache esta vacio, avisamos
    if (Object.keys(PRODUCTOS_CACHE).length === 0) {
        resDiv.innerHTML = '<div class="search-item" style="color:red;">Cargando inventario, espere 2 segundos...</div>';
        resDiv.style.display = 'block'; return;
    }
    const matches = Object.values(PRODUCTOS_CACHE).filter(p => p.nombre.toLowerCase().includes(q) || (p.codigo && p.codigo.toLowerCase().includes(q))).slice(0, 5);
    if (matches.length > 0) {
        resDiv.innerHTML = matches.map(p => `<div class="search-item" onclick="agregarManual('${p.id}')"><strong>${p.nombre}</strong> - $${p.precio_A}</div>`).join('');
        resDiv.style.display = 'block';
    } else { resDiv.innerHTML = '<div class="search-item">No encontrado</div>'; resDiv.style.display = 'block'; }
};

window.agregarManual = (id) => {
    const p = PRODUCTOS_CACHE[id]; MANUAL_ITEMS.push({ id, nombre: p.nombre, codigo: p.codigo, cantidad: 1, precio_A: p.precio_A, precio_B: p.precio_B, precio_C: p.precio_C, precio_D: p.precio_D, exento: p.exento, stock: p.stock });
    document.getElementById('res-manual').style.display = 'none'; document.getElementById('manual-buscar').value = ''; renderManualItems();
};
window.quitarManual = (i) => { MANUAL_ITEMS.splice(i, 1); renderManualItems(); };

function renderManualItems() {
    const container = document.getElementById('manual-lista');
    const nivel = document.getElementById('manual-nivel').value;
    let total = 0;
    container.innerHTML = MANUAL_ITEMS.map((item, i) => {
        const precioU = item[nivel] || 0; total += precioU * item.cantidad;
        return `<div style="display:flex; justify-content:space-between; margin-bottom:8px;"><span>${item.cantidad}x ${item.nombre}</span><span>$${(precioU * item.cantidad).toFixed(2)}</span><button class="btn btn-outline btn-sm" onclick="quitarManual(${i})">X</button></div>`;
    }).join('');
    document.getElementById('manual-total').value = `$${total.toFixed(2)}`;
}
document.getElementById('manual-nivel').addEventListener('change', renderManualItems);

window.guardarCotizacionManual = async () => {
    const clienteId = document.getElementById('manual-cot-cliente').value;
    if (!clienteId || MANUAL_ITEMS.length === 0) return Swal.fire('Error', 'Faltan datos', 'error');
    const cliente = CLIENTES_CACHE[clienteId];
    let total = 0; let prods = [];
    
    MANUAL_ITEMS.forEach(item => {
        const nivel = document.getElementById('manual-nivel').value;
        const precioU = item[nivel] || 0; total += precioU * item.cantidad;
        prods.push({ id: item.id, nombre: item.nombre, codigo: item.codigo, cantidad: item.cantidad, precio_unitario: precioU, subtotal: precioU * item.cantidad, exento: item.exento });
    });
    
    for (let item of MANUAL_ITEMS) {
        const p = PRODUCTOS_CACHE[item.id];
        if(p) { const nuevoStock = Math.max(0, (p.stock || 0) - item.cantidad); await updateDoc(doc(db, "catalogo", item.id), { stock: nuevoStock }); }
    }

    await addDoc(collection(db, "cotizaciones"), { cliente_id: clienteId, email: cliente.email, estado: "aprobada", total_usd: total, productos_con_precio: prods, fecha: new Date(), es_manual: true });
    await addDoc(collection(db, "cxc"), { cliente_email: cliente.email, monto: total, estado: "pendiente", fecha: new Date() });
    
    document.getElementById('modal-cotizacion-manual').classList.remove('active');
    cargarCotizaciones(); cargarVentas(); cargarCuentas(); cargarGastosYGrafica(); cargarInventario();
    Swal.fire('¡Éxito!', 'Cotización creada', 'success');
};

// --- 3. VENTAS Y PDFs ---
async function cargarVentas() {
    const tbody = document.getElementById('tbody-ventas'); const snap = await getDocs(collection(db, "cotizaciones"));
    tbody.innerHTML = ''; let tot = 0;
    snap.forEach(d => {
        const c = d.data();
        if (c.estado === 'aprobada' || c.estado === 'facturada') {
            tot += c.total_usd;
            tbody.innerHTML += `<tr><td>${new Date().toLocaleDateString()}</td><td>${c.email}</td><td>$${c.total_usd.toFixed(2)}</td><td><button class="btn btn-primary btn-sm" onclick="generarPDF('${encodeURIComponent(JSON.stringify(c))}', 'FACTURA')">Factura</button></td></tr>`;
        }
    });
    if(document.getElementById('dash-ingresos')) document.getElementById('dash-ingresos').textContent = `$${tot.toFixed(2)}`;
}

window.generarPDF = (str, tipo) => {
    const c = JSON.parse(decodeURIComponent(str));
    const { jsPDF } = window.jspdf; const doc = new jsPDF();
    
    // MEMBRETE
    doc.addImage('img/logo.png', 'PNG', 14, 10, 35, 15);
    doc.setFontSize(9); doc.setTextColor(80);
    doc.text("R.I.F: J-50719484-1 | Telf: 0414-3549096", 196, 15, { align: "right" });
    doc.text("Calle Caracas, Angostura del Orinoco, Ciudad Bolívar", 196, 20, { align: "right" });
    
    doc.setFontSize(16); doc.setTextColor(0);
    doc.text(tipo, 14, 40);
    
    doc.setFontSize(10); doc.setFont("helvetica", "normal");
    doc.text(`CLIENTE: ${c.email.split('@')[0].toUpperCase()}`, 14, 50);
    doc.text(`FECHA: ${new Date().toLocaleDateString()}`, 150, 50);
    
    let base = 0; let exento = 0;
    const filas = c.productos_con_precio.map(p => {
        if(p.exento) exento += p.subtotal; else base += p.subtotal;
        return [p.cantidad, p.nombre, p.codigo || '-', `$${p.precio_unitario.toFixed(2)}`, `$${p.subtotal.toFixed(2)}`];
    });

    doc.autoTable({ startY: 60, head: [["CANT.", "DESCRIPCIÓN", "SKU", "PRECIO USD", "TOTAL USD"]], body: filas, theme: 'grid', headStyles: { fillColor: [26, 43, 76], textColor: [255,255,255] }, styles: { fontSize: 9 } });

    let y = doc.lastAutoTable.finalY + 10; doc.setFont("helvetica", "bold");
    
    if(tipo === 'FACTURA') {
        const iva = base * 0.16; const totalFactura = base + exento + iva;
        doc.text(`Base Imponible: $${base.toFixed(2)}`, 130, y);
        doc.text(`Monto Exento: $${exento.toFixed(2)}`, 130, y+6);
        doc.text(`IVA (16%): $${iva.toFixed(2)}`, 130, y+12);
        doc.setFontSize(12);
        doc.text(`TOTAL FACTURA: $${totalFactura.toFixed(2)}`, 130, y+22);
        doc.text(`TOTAL Bs: Bs. ${(totalFactura * TASA_BCV).toFixed(2)}`, 130, y+28);
    } else {
        doc.text(`SUBTOTAL USD: $${c.total_usd.toFixed(2)}`, 130, y);
        doc.setFontSize(12); doc.text(`TOTAL Bs: Bs. ${(c.total_usd * TASA_BCV).toFixed(2)}`, 130, y+8);
    }
    doc.save(`${tipo}_${c.email.split('@')[0]}.pdf`);
};

// --- 4. PROVEEDORES, COMPRAS Y CLIENTES ---
async function cargarClientesYProveedores() {
    const snapC = await getDocs(collection(db, "usuarios"));
    const tbodyC = document.getElementById('tbody-clientes'); tbodyC.innerHTML = ''; CLIENTES_CACHE = {};
    snapC.forEach(d => {
        CLIENTES_CACHE[d.id] = d.data();
        tbodyC.innerHTML += `<tr><td>${d.data().nombre_laboratorio}</td><td>${d.data().rif}</td><td>${d.data().nombre_contacto}</td><td><button class="btn btn-outline btn-sm">Ver</button></td></tr>`;
    });

    const snapP = await getDocs(collection(db, "proveedores"));
    const tbodyP = document.getElementById('tbody-proveedores'); tbodyP.innerHTML = '';
    const select = document.getElementById('compra-proveedor'); const selectProd = document.getElementById('inv-proveedor');
    select.innerHTML = '<option value="">Seleccione...</option>'; selectProd.innerHTML = '<option value="">Seleccione...</option>';
    PROVEEDORES_CACHE = {};
    snapP.forEach(d => { 
        PROVEEDORES_CACHE[d.id] = d.data(); 
        tbodyP.innerHTML += `<tr><td>${d.data().nombre}</td><td>${d.data().rif}</td></tr>`;
        select.innerHTML += `<option value="${d.id}">${d.data().nombre}</option>`;
        selectProd.innerHTML += `<option value="${d.id}">${d.data().nombre}</option>`;
    });
}

document.getElementById('form-cliente-manual').addEventListener('submit', async (e) => {
    e.preventDefault();
    await addDoc(collection(db, "usuarios"), {
        nombre_laboratorio: document.getElementById('cli-lab').value || 'Sin Nombre', 
        rif: document.getElementById('cli-rif').value, nombre_contacto: document.getElementById('cli-contacto').value, 
        direccion: document.getElementById('cli-direccion').value, email: document.getElementById('cli-email').value, 
        nivel_precio: document.getElementById('cli-nivel').value, estado: 'aprobado'
    });
    document.getElementById('modal-cliente').classList.remove('active');
    document.getElementById('form-cliente-manual').reset(); cargarClientesYProveedores();
});

document.getElementById('form-proveedor').addEventListener('submit', async (e) => {
    e.preventDefault();
    await addDoc(collection(db, "proveedores"), { nombre: document.getElementById('prov-nombre').value, rif: document.getElementById('prov-rif').value });
    document.getElementById('form-proveedor').reset(); cargarClientesYProveedores();
});

// FUNCION DE COMPRAS DIRECTA DESDE EL HTML
window.buscarProductoCompra = (query) => {
    const q = query.toLowerCase(); const resDiv = document.getElementById('res-compra');
    if (q.length < 1) { resDiv.style.display = 'none'; return; }
    if (Object.keys(PRODUCTOS_CACHE).length === 0) {
        resDiv.innerHTML = '<div class="search-item" style="color:red;">Cargando...</div>';
        resDiv.style.display = 'block'; return;
    }
    const matches = Object.values(PRODUCTOS_CACHE).filter(p => p.nombre.toLowerCase().includes(q) || (p.codigo && p.codigo.toLowerCase().includes(q))).slice(0, 5);
    if (matches.length > 0) {
        resDiv.innerHTML = matches.map(p => `<div class="search-item" onclick="agregarCompra('${p.id}')"><strong>${p.nombre}</strong> - Costo: $${p.costo}</div>`).join('');
        resDiv.style.display = 'block';
    } else { resDiv.innerHTML = '<div class="search-item">No encontrado</div>'; resDiv.style.display = 'block'; }
};

window.agregarCompra = (id) => {
    const p = PRODUCTOS_CACHE[id]; COMPRA_ITEMS.push({ id, nombre: p.nombre, costo: p.costo, cantidad: 1 });
    document.getElementById('res-compra').style.display = 'none'; document.getElementById('compra-buscar-prod').value = ''; renderCompraItems();
};
window.quitarCompra = (i) => { COMPRA_ITEMS.splice(i, 1); renderCompraItems(); };

function renderCompraItems() {
    const container = document.getElementById('lista-compra'); let total = 0;
    container.innerHTML = COMPRA_ITEMS.map((item, index) => {
        total += item.costo * item.cantidad;
        return `<div style="display:flex; justify-content:space-between; margin-bottom:5px;"><span>${item.cantidad}x ${item.nombre}</span><span>$${(item.costo * item.cantidad).toFixed(2)}</span><button class="btn btn-outline btn-sm" onclick="quitarCompra(${index})">X</button></div>`;
    }).join('');
    document.getElementById('compra-monto').value = `$${total.toFixed(2)}`;
}

document.getElementById('form-compra').addEventListener('submit', async (e) => {
    e.preventDefault();
    const total = parseFloat(document.getElementById('compra-monto').value.replace('$',''));
    const pagada = document.getElementById('compra-pagada').checked;
    const conIva = document.getElementById('compra-iva').checked;
    if (COMPRA_ITEMS.length === 0) return Swal.fire('Error', 'Agrega productos', 'error');
    
    await addDoc(collection(db, "compras"), { proveedor_id: document.getElementById('compra-proveedor').value, items: COMPRA_ITEMS, monto: total, pagada, conIva, fecha: new Date() });
    if (!pagada) await addDoc(collection(db, "cxp"), { proveedor_id: document.getElementById('compra-proveedor').value, monto: total, estado: "pendiente", fecha: new Date() });
    
    for (let item of COMPRA_ITEMS) {
        const p = PRODUCTOS_CACHE[item.id];
        if(p) { const nuevoStock = (p.stock || 0) + item.cantidad; await updateDoc(doc(db, "catalogo", item.id), { stock: nuevoStock }); }
    }

    COMPRA_ITEMS = []; document.getElementById('form-compra').reset(); renderCompraItems(); cargarCuentas(); cargarInventario();
    Swal.fire({ title: '¡Compra Registrada!', text: 'Stock sumado.', icon: 'success', timer: 2000, showConfirmButton: false });
});

// --- 5. SERVICIO TÉCNICO CON PDF EDITABLE ---
document.getElementById('form-reparacion-manual').addEventListener('submit', async (e) => {
    e.preventDefault();
    await addDoc(collection(db, "tickets_servicio"), { 
        cliente: document.getElementById('rep-cliente').value, 
        equipo: document.getElementById('rep-equipo').value, 
        falla: document.getElementById('rep-falla').value, 
        actividades: document.getElementById('rep-actividades').value,
        observaciones: document.getElementById('rep-observaciones').value,
        estado: "Recibido", fecha: new Date() 
    });
    document.getElementById('modal-reparacion').classList.remove('active'); 
    document.getElementById('form-reparacion-manual').reset(); cargarServicios();
    Swal.fire('Registrado', 'Ticket creado', 'success');
});

async function cargarServicios() {
    const tbody = document.getElementById('tbody-servicio'); const snap = await getDocs(collection(db, "tickets_servicio")); tbody.innerHTML = '';
    snap.forEach(d => { 
        const t = d.data();
        tbody.innerHTML += `<tr><td>${t.cliente}</td><td>${t.equipo}</td><td>${t.falla}</td><td><span class="badge">${t.estado}</span></td><td><button class="btn btn-outline btn-sm" onclick="generarInformeTecnico('${encodeURIComponent(JSON.stringify(t))}')">Informe PDF</button></td></tr>`; 
    });
}

window.generarInformeTecnico = (str) => {
    const t = JSON.parse(decodeURIComponent(str));
    const { jsPDF } = window.jspdf; const doc = new jsPDF();
    
    doc.addImage('img/logo.png', 'PNG', 14, 10, 35, 15);
    doc.setFontSize(9); doc.setTextColor(80);
    doc.text("R.I.F: J-50719484-1 | Telf: 0414-3549096", 196, 15, { align: "right" });
    doc.text("Calle Caracas, Angostura del Orinoco, Ciudad Bolívar", 196, 20, { align: "right" });

    doc.setFontSize(16); doc.setTextColor(0);
    doc.text("INFORME DE SERVICIO TÉCNICO", 14, 40);
    
    doc.setFontSize(10); doc.text(`Cliente: ${t.cliente}`, 14, 55); 
    doc.text(`Equipo: ${t.equipo}`, 14, 65);
    
    doc.setFont("helvetica", "bold"); doc.text(`Falla Reportada:`, 14, 75); 
    doc.setFont("helvetica", "normal"); doc.text(t.falla, 14, 81, { maxWidth: 180 });

    if(t.actividades) {
        doc.setFont("helvetica", "bold"); doc.text(`Actividades Realizadas:`, 14, 95);
        doc.setFont("helvetica", "normal"); doc.text(t.actividades, 14, 101, { maxWidth: 180 });
    }

    if(t.observaciones) {
        doc.setFont("helvetica", "bold"); doc.text(`Observaciones:`, 14, 120);
        doc.setFont("helvetica", "normal"); doc.text(t.observaciones, 14, 126, { maxWidth: 180 });
    }
    
    doc.save(`Informe_${t.cliente.replace(/ /g, '_')}.pdf`);
};

// --- 6. CUENTAS Y GASTOS ---
async function cargarCuentas() {
    const cxc = await getDocs(collection(db, "cxc")); const tCxc = document.getElementById('tbody-cxc'); tCxc.innerHTML = '';
    let totalCobrar = 0;
    cxc.forEach(d => { 
        const m = d.data().monto || 0;
        if(d.data().estado === 'pendiente') {
            totalCobrar += m;
            tCxc.innerHTML += `<tr><td>${d.data().cliente_email || 'Cliente'}</td><td>$${m.toFixed(2)}</td><td><span class="badge" style="background:#fef3c7; color:#b45309;">Pendiente</span></td><td><button class="btn btn-success btn-sm" onclick="saldarCuenta('${d.id}', 'cxc')">Cobrar</button></td></tr>`; 
        }
    });
    if(document.getElementById('dash-cobrar')) document.getElementById('dash-cobrar').textContent = `$${totalCobrar.toFixed(2)}`;

    const cxp = await getDocs(collection(db, "cxp")); const tCxp = document.getElementById('tbody-cxp'); tCxp.innerHTML = '';
    cxp.forEach(d => { 
        const m = d.data().monto || 0;
        if(d.data().estado === 'pendiente') {
            const prov = PROVEEDORES_CACHE[d.data().proveedor_id]?.nombre || 'Proveedor';
            tCxp.innerHTML += `<tr><td>${prov}</td><td>$${m.toFixed(2)}</td><td><span class="badge" style="background:#fef3c7; color:#b45309;">Pendiente</span></td><td><button class="btn btn-success btn-sm" onclick="saldarCuenta('${d.id}', 'cxp')">Pagar</button></td></tr>`; 
        }
    });
}

window.saldarCuenta = async (id, tipo) => {
    await updateDoc(doc(db, tipo, id), { estado: "pagado" });
    cargarCuentas();
    Swal.fire('¡Saldado!', 'La cuenta ha sido marcada como pagada.', 'success');
};

// GASTOS Y GRAFICA
document.getElementById('form-gasto').addEventListener('submit', async (e) => {
    e.preventDefault();
    await addDoc(collection(db, "gastos"), { 
        descripcion: document.getElementById('gasto-desc').value, 
        monto: parseFloat(document.getElementById('gasto-monto').value), 
        fecha: new Date() 
    });
    document.getElementById('form-gasto').reset();
    Swal.fire({ title: 'Gasto Registrado', icon: 'success', timer: 1500, showConfirmButton: false });
    cargarGastosYGrafica();
});

async function cargarGastosYGrafica() {
    // 1. Sumar gastos
    const gastosSnap = await getDocs(collection(db, "gastos"));
    TOTAL_GASTOS = 0;
    gastosSnap.forEach(d => TOTAL_GASTOS += d.data().monto);

    // 2. Sacar datos de ventas
    const snap = await getDocs(collection(db, "cotizaciones"));
    let ventasSemana = [0,0,0,0,0,0,0];
    let totalVentas = 0;
    
    snap.forEach(d => {
        if(d.data().estado === 'aprobada' || d.data().estado === 'facturada') {
            const dia = new Date(d.data().fecha.seconds * 1000).getDay(); 
            ventasSemana[dia] += d.data().total_usd;
            totalVentas += d.data().total_usd;
        }
    });

    // 3. Actualizar Dashboard
    if(document.getElementById('dash-ganancia')) {
        document.getElementById('dash-ganancia').textContent = `$${(totalVentas - TOTAL_GASTOS).toFixed(2)}`;
    }

    const ctx = document.getElementById('chart-dashboard').getContext('2d');
    if(chartInstance) chartInstance.destroy();
    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
            datasets: [{ label: 'Ventas (USD)', data: ventasSemana, borderColor: '#ff6b00', backgroundColor: 'rgba(255, 107, 0, 0.1)', fill: true, tension: 0.4 }]
        },
        options: { responsive: true }
    });
}
