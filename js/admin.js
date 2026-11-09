import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, addDoc, getDocs, doc, setDoc, updateDoc, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const ADMIN_EMAIL = "diegoalbertoleroux@gmail.com"; // ⚠️ CAMBIA ESTO
let TASA_BCV = 36.50;
let PRODUCTOS_CACHE = {};
let CLIENTES_CACHE = {};
let PROVEEDORES_CACHE = {};
let COTIZACION_ACTUAL = null;
let COMPRA_ACTUAL_ITEMS = [];

// --- INICIALIZACIÓN ---
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

// --- NAVEGACIÓN ---
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

// --- INICIALIZAR DATOS ---
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
    cargarFacturas();
    cargarServicios();
    cargarCuentas();
    cargarCompras();
}

// --- 1. INVENTARIO Y CATEGORÍAS ---
async function cargarInventario() {
    const tbody = document.getElementById('tbody-inventario');
    const selectCat = document.getElementById('filtro-categoria-inv');
    
    const catSnap = await getDocs(collection(db, "catalogo"));
    const preSnap = await getDocs(collection(db, "precios"));
    
    const precios = {}; preSnap.forEach(p => precios[p.data().producto_id] = p.data());
    
    let categorias = new Set();
    PRODUCTOS_CACHE = {}; // Limpiar cache
    
    catSnap.forEach(docSnap => {
        const p = docSnap.data();
        const pr = precios[docSnap.id] || { precio_A: 0, costo: 0 };
        PRODUCTOS_CACHE[docSnap.id] = { id: docSnap.id, ...p, ...pr };
        if (p.categoria) categorias.add(p.categoria);
    });

    // Llenar select de categorías
    selectCat.innerHTML = '<option value="">Todas las categorías</option>';
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
                    <td>${p.codigo || 'N/A'}</td><td>${p.nombre}</td><td><span class="badge">${p.categoria}</span></td>
                    <td>${p.stock || 0}</td><td>$${(p.costo || 0).toFixed(2)}</td><td>$${(p.precio_A || 0).toFixed(2)}</td>
                    <td>${p.exento ? '✅' : '❌'}</td>
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
        codigo: document.getElementById('inv-codigo').value,
        nombre: document.getElementById('inv-nombre').value,
        marca: document.getElementById('inv-marca').value,
        categoria: document.getElementById('inv-categoria').value,
        exento: document.getElementById('inv-exento').checked,
        stock: parseInt(document.getElementById('inv-stock').value)
    };
    const dataPrecios = {
        costo: parseFloat(document.getElementById('inv-costo').value),
        precio_A: pA, precio_B: pA * 0.95, precio_C: pA * 0.90, precio_D: pA * 0.85
    };

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

// --- 2. COTIZACIONES Y FACTURAS ---
async function cargarCotizaciones() {
    const tbody = document.getElementById('tbody-cotizaciones');
    const snap = await getDocs(collection(db, "cotizaciones"));
    tbody.innerHTML = '';
    snap.forEach(d => {
        const c = d.data();
        if(c.estado === 'pendiente') {
            tbody.innerHTML += `
                <tr>
                    <td>${new Date(c.fecha.seconds*1000).toLocaleDateString()}</td><td>${c.email}</td>
                    <td><span class="badge">Pendiente</span></td>
                    <td><button class="btn btn-primary btn-sm" onclick="abrirCotizar('${d.id}', '${encodeURIComponent(JSON.stringify(c))}')">Procesar</button></td>
                </tr>`;
        }
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
        const pr = PRODUCTOS_CACHE[p.id]; 
        let precioU = pr ? pr[nivel] : 0;
        total += precioU * p.cantidad;
        prods.push({ ...p, precio_unitario: precioU, subtotal: precioU * p.cantidad, codigo: pr ? pr.codigo : 'N/A', exento: pr ? pr.exento : false });
    }
    
    await updateDoc(doc(db, "cotizaciones", COTIZACION_ACTUAL.id), {
        estado: "aprobada", nivel_precio: nivel, total_usd: total, productos_con_precio: prods
    });

    // CREAR CUENTA POR COBRAR AUTOMÁTICA
    await addDoc(collection(db, "cxc"), {
        cliente_email: COTIZACION_ACTUAL.email,
        cotizacion_id: COTIZACION_ACTUAL.id,
        monto: total, estado: "pendiente", fecha: new Date()
    });

    document.getElementById('modal-cotizar').classList.remove('active');
    cargarCotizaciones(); cargarFacturas(); cargarCuentas();
};

async function cargarFacturas() {
    const tbody = document.getElementById('tbody-facturas');
    const snap = await getDocs(collection(db, "cotizaciones"));
    tbody.innerHTML = '';
    snap.forEach(d => {
        const c = d.data();
        if (c.estado === 'aprobada' || c.estado === 'facturada') {
            tbody.innerHTML += `
                <tr>
                    <td>${new Date().toLocaleDateString()}</td><td>${c.email}</td><td>$${c.total_usd.toFixed(2)}</td>
                    <td><span class="badge">${c.estado}</span></td>
                    <td>
                        <button class="btn btn-outline btn-sm" onclick="generarPDF('${encodeURIComponent(JSON.stringify(c))}', 'COTIZACIÓN')">Cotización</button>
                        <button class="btn btn-primary btn-sm" onclick="generarPDF('${encodeURIComponent(JSON.stringify(c))}', 'FACTURA')">Factura (IVA)</button>
                    </td>
                </tr>`;
        }
    });
}

// --- 3. GENERACIÓN DE PDF (COTIZACIÓN Y FACTURA CON IVA) ---
window.generarPDF = (str, tipo) => {
    const c = JSON.parse(decodeURIComponent(str));
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Encabezado (Ajusta esto a tus datos reales)
    doc.setFontSize(10); doc.setTextColor(100);
    doc.text("Calle caracas cruce con callejón sin nombre edif. Primer piso 1 of 3, 4 y 5", 14, 15);
    doc.text("barrio el merecure, angostura del Orinoco ciudad Bolivar", 14, 20);
    doc.text("R.I.F: J-50719484-1 | Telf: 0414-3549096", 14, 25);
    
    doc.setFontSize(16); doc.setTextColor(0);
    doc.text(tipo, 14, 40);
    
    doc.setFontSize(10);
    doc.text(`CLIENTE: ${c.email.split('@')[0].toUpperCase()}`, 14, 50);
    doc.text(`FECHA: ${new Date().toLocaleDateString()}`, 150, 50);

    // Cálculos de Facturación
    let baseImponible = 0; let montoExento = 0;
    const filas = c.productos_con_precio.map(p => {
        if (p.exento) { montoExento += p.subtotal; } 
        else { baseImponible += p.subtotal; }
        return [ p.cantidad, p.nombre, p.codigo || '-', `$${p.precio_unitario.toFixed(2)}`, `$${p.subtotal.toFixed(2)}`, `Bs. ${(p.subtotal * TASA_BCV).toFixed(2)}` ];
    });

    doc.autoTable({
        startY: 70,
        head: [["CANT.", "DESCRIPCIÓN", "SKU", "PRECIO USD", "TOTAL USD", "TOTAL Bs."]],
        body: filas,
        theme: 'grid',
        headStyles: { fillColor: [26, 43, 76] }
    });

    let finalY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(10); doc.setFont("helvetica", "bold");
    
    if (tipo === 'FACTURA') {
        const iva = baseImponible * 0.16;
        const totalFactura = baseImponible + montoExento + iva;
        
        doc.text(`Base Imponible: $${baseImponible.toFixed(2)}`, 130, finalY);
        doc.text(`Monto Exento: $${montoExento.toFixed(2)}`, 130, finalY + 6);
        doc.text(`IVA (16%): $${iva.toFixed(2)}`, 130, finalY + 12);
        doc.setFontSize(12);
        doc.text(`TOTAL FACTURA: $${totalFactura.toFixed(2)}`, 130, finalY + 22);
        doc.text(`TOTAL Bs: Bs. ${(totalFactura * TASA_BCV).toFixed(2)}`, 130, finalY + 28);
    } else {
        doc.text(`SUBTOTAL USD: $${c.total_usd.toFixed(2)}`, 130, finalY);
        doc.text(`TOTAL Bs: Bs. ${(c.total_usd * TASA_BCV).toFixed(2)}`, 130, finalY + 7);
    }

    doc.save(`${tipo}_${c.email.split('@')[0]}.pdf`);
};

// --- 4. COMPRAS Y BÚSQUEDA INTELIGENTE ---
document.getElementById('compra-buscar-prod').addEventListener('input', (e) => {
    const queryText = e.target.value.toLowerCase();
    const resultsDiv = document.getElementById('resultados-busqueda');
    if (queryText.length < 2) { resultsDiv.style.display = 'none'; return; }

    const matches = Object.values(PRODUCTOS_CACHE).filter(p => 
        p.nombre.toLowerCase().includes(queryText) || (p.codigo && p.codigo.toLowerCase().includes(queryText))
    ).slice(0, 5);

    if (matches.length > 0) {
        resultsDiv.innerHTML = matches.map(p => `
            <div style="padding:10px; border-bottom:1px solid var(--border-color); cursor:pointer;" onclick="agregarACompra('${p.id}')">
                <strong>${p.nombre}</strong> (${p.codigo}) - Costo: $${p.costo}
            </div>
        `).join('');
        resultsDiv.style.display = 'block';
    } else {
        resultsDiv.innerHTML = `<div style="padding:10px; color:var(--primary); cursor:pointer;" onclick="abrirModalProducto()">Producto no encontrado. Haga clic para crearlo.</div>`;
        resultsDiv.style.display = 'block';
    }
});

window.agregarACompra = (id) => {
    const p = PRODUCTOS_CACHE[id];
    COMPRA_ACTUAL_ITEMS.push({ id, nombre: p.nombre, costo: p.costo, cantidad: 1 });
    document.getElementById('resultados-busqueda').style.display = 'none';
    document.getElementById('compra-buscar-prod').value = '';
    renderCompraItems();
};

function renderCompraItems() {
    const container = document.getElementById('lista-compra-actual');
    let total = 0;
    container.innerHTML = COMPRA_ACTUAL_ITEMS.map((item, index) => {
        total += item.costo * item.cantidad;
        return `<div style="display:flex; justify-content:space-between; background:var(--input-bg); padding:10px; margin-bottom:5px; border-radius:5px;">
            <span>${item.nombre}</span>
            <span>$${(item.costo * item.cantidad).toFixed(2)}</span>
            <button type="button" class="btn btn-danger btn-sm" onclick="quitarDeCompra(${index})">X</button>
        </div>`;
    }).join('');
    document.getElementById('compra-monto').value = total.toFixed(2);
}

window.quitarDeCompra = (index) => {
    COMPRA_ACTUAL_ITEMS.splice(index, 1);
    renderCompraItems();
};

document.getElementById('form-compra').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (COMPRA_ACTUAL_ITEMS.length === 0) return alert("Agrega al menos un producto");
    const pagada = document.getElementById('compra-pagada').checked;
    const total = parseFloat(document.getElementById('compra-monto').value);

    await addDoc(collection(db, "compras"), {
        proveedor_id: document.getElementById('compra-proveedor').value,
        items: COMPRA_ACTUAL_ITEMS, monto: total, pagada: pagada, fecha: new Date()
    });

    if (!pagada) {
        await addDoc(collection(db, "cxp"), { monto: total, estado: "pendiente", fecha: new Date() });
    }

    COMPRA_ACTUAL_ITEMS = [];
    document.getElementById('form-compra').reset(); renderCompraItems();
    cargarCompras(); cargarCuentas();
});

// --- 5. SERVICIO TÉCNICO MANUAL ---
document.getElementById('form-reparacion-manual').addEventListener('submit', async (e) => {
    e.preventDefault();
    await addDoc(collection(db, "tickets_servicio"), {
        cliente: document.getElementById('rep-cliente').value, equipo: document.getElementById('rep-equipo').value,
        falla: document.getElementById('rep-falla').value, estado: "Recibido", fecha: new Date()
    });
    document.getElementById('modal-reparacion').classList.remove('active');
    document.getElementById('form-reparacion-manual').reset();
    cargarServicios();
});

async function cargarServicios() {
    const tbody = document.getElementById('tbody-servicio');
    const snap = await getDocs(collection(db, "tickets_servicio"));
    tbody.innerHTML = '';
    snap.forEach(d => {
        const t = d.data();
        tbody.innerHTML += `<tr><td>${t.cliente}</td><td>${t.equipo}</td><td>${t.falla}</td><td><span class="badge">${t.estado}</span></td><td><button class="btn btn-outline btn-sm" onclick="alert('PDF en construccion')">Informe</button></td></tr>`;
    });
}

// --- 6. CUENTAS ---
async function cargarCuentas() {
    const cxc = await getDocs(collection(db, "cxc"));
    const tCxc = document.getElementById('tbody-cxc'); tCxc.innerHTML = '';
    cxc.forEach(d => { tCxc.innerHTML += `<tr><td>${d.data().cliente_email || 'Cliente Web'}</td><td>$${d.data().monto.toFixed(2)}</td><td><span class="badge">${d.data().estado}</span></td></tr>`; });
    
    const cxp = await getDocs(collection(db, "cxp"));
    const tCxp = document.getElementById('tbody-cxp'); tCxp.innerHTML = '';
    cxp.forEach(d => { tCxp.innerHTML += `<tr><td>Proveedor</td><td>$${d.data().monto.toFixed(2)}</td><td><span class="badge">${d.data().estado}</span></td></tr>`; });
}

// Auxiliares
async function cargarClientesYProveedores() {
    const snapP = await getDocs(collection(db, "proveedores"));
    const select = document.getElementById('compra-proveedor'); select.innerHTML = '';
    snapP.forEach(d => { select.innerHTML += `<option value="${d.id}">${d.data().nombre}</option>`; });
}
async function cargarCompras() {
    const tbody = document.getElementById('tbody-compras'); if(!tbody) return;
    const snap = await getDocs(collection(db, "compras")); tbody.innerHTML = '';
    snap.forEach(d => { tbody.innerHTML += `<tr><td>${new Date(d.data().fecha.seconds*1000).toLocaleDateString()}</td><td>Ver detalles</td><td>$${d.data().monto}</td></tr>`; });
}
