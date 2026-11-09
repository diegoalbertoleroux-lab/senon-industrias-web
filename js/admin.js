<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Panel Admin | Senon Industrias</title>
    <link rel="stylesheet" href="css/styles.css">
</head>
<body>

    <!-- PANTALLA DE LOGIN (Bloquea todo hasta iniciar sesión) -->
    <div id="admin-login" class="auth-container" style="display: flex; height: 100vh; max-width: 100%; background: var(--bg-color);">
        <div class="auth-card">
            <div class="logo-container" style="text-align: center; margin-bottom: 20px;">
                <div class="logo-text">SENON</div>
                <div class="logo-subtext">PANEL DE ADMINISTRACIÓN</div>
            </div>
            <div id="login-msg" class="message"></div>
            <form id="form-admin-login">
                <div class="form-group">
                    <label>Correo de Administrador</label>
                    <input type="email" id="admin-email" class="form-control" required>
                </div>
                <div class="form-group">
                    <label>Contraseña</label>
                    <input type="password" id="admin-password" class="form-control" required>
                </div>
                <button type="submit" class="btn-primary btn-full" id="btn-admin-login">Acceder al Sistema</button>
            </form>
        </div>
    </div>

    <!-- APLICACIÓN ADMIN (Oculta por defecto) -->
    <div id="admin-main">
        <header class="header-admin" style="display: flex; justify-content: space-between; align-items: center; padding: 15px 5%; background: var(--card-bg); border-bottom: 1px solid var(--border-color);">
            <div class="logo-container">
                <div class="logo-text">SENON <span style="font-size:14px; color:var(--primary);">ADMIN</span></div>
            </div>
            <div style="display: flex; gap: 15px;">
                <a href="index.html" class="btn-outline" style="text-decoration:none;">Ver Catálogo</a>
                <button id="btn-logout" class="btn-outline" style="color: #ef4444; border-color: #ef4444;">Cerrar Sesión</button>
            </div>
        </header>

        <main class="admin-container">
            <!-- Pestañas -->
            <div class="admin-tabs">
                <button class="admin-tab active" data-target="tab-inventario">Inventario y Precios</button>
                <button class="admin-tab" data-target="tab-clientes">Directorio de Clientes</button>
            </div>

            <!-- PESTAÑA: INVENTARIO -->
            <div id="tab-inventario" class="admin-section active">
                <div class="admin-grid">
                    <!-- Formulario Producto -->
                    <div class="admin-card">
                        <h2>Nuevo Producto</h2>
                        <div id="admin-message" class="message" style="margin-bottom:15px;"></div>
                        <form id="form-product">
                            <div class="form-group">
                                <label>Nombre del Producto</label>
                                <input type="text" id="prod-nombre" class="form-control" required>
                            </div>
                            <div class="form-group">
                                <label>Categoría</label>
                                <select id="prod-categoria" class="form-control" required>
                                    <option value="Bioquimica">Bioquímica</option>
                                    <option value="Hematologia">Hematología</option>
                                    <option value="Coagulacion">Coagulación</option>
                                    <option value="Serologia">Serología</option>
                                    <option value="Miscelaneos">Misceláneos</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Descripción Pública</label>
                                <textarea id="prod-desc" class="form-control" rows="2" required></textarea>
                            </div>
                            
                            <h3 style="font-size: 16px; margin: 15px 0 10px 0;">Precios (Solo Admin)</h3>
                            <div class="grid-precios">
                                <div class="form-group"><label>Precio A (USD)</label><input type="number" step="0.01" id="prod-pA" class="form-control" required></div>
                                <div class="form-group"><label>Precio B (USD)</label><input type="number" step="0.01" id="prod-pB" class="form-control" required></div>
                                <div class="form-group"><label>Precio C (USD)</label><input type="number" step="0.01" id="prod-pC" class="form-control" required></div>
                                <div class="form-group"><label>Precio D (USD)</label><input type="number" step="0.01" id="prod-pD" class="form-control" required></div>
                            </div>

                            <button type="submit" class="btn-primary btn-full" id="btn-save" style="margin-top: 15px;">Guardar Producto</button>
                        </form>
                    </div>

                    <!-- Tabla Productos -->
                    <div class="admin-card" style="overflow-x: auto;">
                        <h2>Productos en Catálogo</h2>
                        <table class="table-products">
                            <thead><tr><th>Producto</th><th>Categoría</th></tr></thead>
                            <tbody id="table-body"></tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- PESTAÑA: CLIENTES -->
            <div id="tab-clientes" class="admin-section">
                <div class="admin-card">
                    <h2>Laboratorios Registrados</h2>
                    <table class="table-products">
                        <thead>
                            <tr>
                                <th>Laboratorio</th>
                                <th>RIF</th>
                                <th>Contacto</th>
                                <th>Estado</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="table-clientes"></tbody>
                    </table>
                </div>
            </div>

        </main>
    </div>

    <script type="module" src="js/admin.js"></script>
</body>
</html>
