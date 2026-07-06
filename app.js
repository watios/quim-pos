// =========================================================================
// 1. CONFIGURACIÓN GLOBAL Y BASE DE DATOS LOCAL (DEXIE.JS)
// =========================================================================
const db = new Dexie('QuimDB'); 
db.version(1).stores({
  config: 'key',
  categorias: '++id, nombre',
  articulos: '++id, nombre, categoriaId',
  clientes: '++id, nombre, cedula',
  facturas: '++id, fecha'
});

// Estado de la Aplicación
let globalExchangeRate = 645.00; // 💵 Tasa ajustada a 645.00 VES
let currentCart = [];
let selectedClientId = null;
let invoicePage = 1;
const INVOICES_PER_PAGE = 5;
let deferredPrompt = null; 

// Función Global de Sanitización (Evita Inyecciones XSS)
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Orquestador de Arranque Seguro (Corregido con await para evitar la condición de carrera)
document.addEventListener('DOMContentLoaded', async () => {
  await inicializarTasaGlobal();
  await verificarYSembrarDatos(); // 🌟 Inyección automática y espera de Datos Semilla
  configurarEnrutamientoMenu();
  configurarAccionesPWA();
  configurarMotoresBusquedaVenta();
  
  // Carga inicial y renderizado de módulos una vez que la DB está lista
  actualizarDesplegablesCategorias();
  actualizarDesplegablesArticulos();
  cargarArticulosUI();
  cargarCategoriasUI();
  cargarClientesUI(); // 👥 Ahora renderiza los clientes sembrados de forma garantizada
  cargarFacturasUI();
});

// =========================================================================
// 1.1 FUNCIÓN SEMILLA: INICIALIZACIÓN AUTOMÁTICA DE DATOS
// =========================================================================
async function verificarYSembrarDatos() {
  const conteoCategorias = await db.categorias.count();
  
  if (conteoCategorias === 0) {
    console.log('📦 Inicializando base de datos local con catálogo de víveres, clientes y facturas...');
    
    // 1. Registro de las 6 Categorías de Víveres
    const c1 = await db.categorias.add({ nombre: 'Charcutería y Lácteos' });
    const c2 = await db.categorias.add({ nombre: 'Carbohidratos y Granos' });
    const c3 = await db.categorias.add({ nombre: 'Enlatados y Conservas' });
    const c4 = await db.categorias.add({ nombre: 'Salsas y Condimentos' });
    const c5 = await db.categorias.add({ nombre: 'Snacks y Confitería' });
    const c6 = await db.categorias.add({ nombre: 'Bebidas y Líquidos' });

    // 2. Registro de los 20 Artículos vinculados
    await db.articulos.bulkAdd([
      { nombre: 'Queso Blanco Duro (1 kg)', categoriaId: c1, descripcion: 'Queso llanero apto para rallar o freír', priceUSD: 5.50, stock: 12 },
      { nombre: 'Jamón de Pierna Estándar (1 kg)', categoriaId: c1, descripcion: 'Jamón de pierna rebanado', priceUSD: 7.20, stock: 8 },
      { nombre: 'Leche Completa en Polvo (1 kg)', categoriaId: c1, descripcion: 'Leche entera instantánea en bolsa', priceUSD: 8.50, stock: 15 },
      { nombre: 'Harina de Maíz Precocida (1 kg)', categoriaId: c2, descripcion: 'Harina tradicional para preparación de arepas', priceUSD: 1.40, stock: 60 },
      { nombre: 'Arroz Blanco Grano Entero (1 kg)', categoriaId: c2, descripcion: 'Arroz tipo I de mesa', priceUSD: 1.30, stock: 45 },
      { nombre: 'Pasta Larga Espagueti (1 kg)', categoriaId: c2, descripcion: 'Pasta de sémola de trigo duro', priceUSD: 1.25, stock: 40 },
      { nombre: 'Caraotas Negras Seleccionadas (500g)', categoriaId: c2, descripcion: 'Granos negros nacionales', priceUSD: 1.50, stock: 25 },
      { nombre: 'Harina de Trigo Todo Uso (1 kg)', categoriaId: c2, descripcion: 'Harina refinada para panadería u hogar', priceUSD: 1.45, stock: 30 },
      { nombre: 'Atún en Aceite Vegetal (140g)', categoriaId: c3, descripcion: 'Lomitos compactos de atún en lata', priceUSD: 1.80, stock: 35 },
      { nombre: 'Sardinas en Salsa de Tomate (170g)', categoriaId: c3, descripcion: 'Sardinas enteras en conserva enlatada', priceUSD: 0.90, stock: 50 },
      { nombre: 'Maíz Dulce en Granos (200g)', categoriaId: c3, descripcion: 'Granos de maíz tierno listos para servir', priceUSD: 1.20, stock: 20 },
      { nombre: 'Mayonesa Clásica (445g)', categoriaId: c4, descripcion: 'Aderezo cremoso emulsionado tradicional', priceUSD: 2.50, stock: 18 },
      { nombre: 'Salsas de Tomate Ketchup (397g)', categoriaId: c4, descripcion: 'Salsa a base de concentrado de tomate dulce', priceUSD: 2.10, stock: 22 },
      { nombre: 'Aceite Vegetal de Soya (1 Litro)', categoriaId: c4, descripcion: 'Aceite refinado comestible multiusos', priceUSD: 3.15, stock: 24 },
      { nombre: 'Sal Refinada de Mesa (1 kg)', categoriaId: c4, descripcion: 'Sal blanca de mesa molida yodada', priceUSD: 0.60, stock: 40 },
      { nombre: 'Galletas de Soda (Paquete Familiar)', categoriaId: c5, descripcion: 'Galletas saladas crujientes multipack', priceUSD: 1.95, stock: 28 },
      { nombre: 'Chocolate con Leche (Barra 100g)', categoriaId: c5, descripcion: 'Barra de chocolate tradicional de repostería/consumo', priceUSD: 1.50, stock: 35 },
      { nombre: 'Papas Fritas Onduladas (Bolsa Grande)', categoriaId: c5, descripcion: 'Snack crujiente sabor original salado', priceUSD: 2.10, stock: 15 },
      { nombre: 'Refresco Sabor Cola (2 Litros)', categoriaId: c6, descripcion: 'Bebida gaseosa azucharada familiar', priceUSD: 2.50, stock: 30 },
      { nombre: 'Jugo de Naranja Pasteurizado (1L)', categoriaId: c6, descripcion: 'Bebida cítrica líquida refrigerada con pulpa', priceUSD: 1.80, stock: 14 }
    ]);

    // 3. Registro de 25 Clientes Semilla
    await db.clientes.bulkAdd([
      { nombre: 'Carlos Mendoza', tipoDoc: 'V', cedula: '12345678' },
      { nombre: 'María Rodríguez', tipoDoc: 'V', cedula: '87654321' },
      { nombre: 'Juan Pérez', tipoDoc: 'V', cedula: '11223344' },
      { nombre: 'Ana Gómez', tipoDoc: 'V', cedula: '55667788' },
      { nombre: 'Luis Martínez', tipoDoc: 'V', cedula: '99887766' },
      { nombre: 'Elena Torres', tipoDoc: 'V', cedula: '44332211' },
      { nombre: 'Pedro Castillo', tipoDoc: 'V', cedula: '66778899' },
      { nombre: 'Carmen Díaz', tipoDoc: 'V', cedula: '22334455' },
      { nombre: 'José Hernández', tipoDoc: 'V', cedula: '77665544' },
      { nombre: 'Sofía Silva', tipoDoc: 'V', cedula: '88990011' },
      { nombre: 'Diego Acosta', tipoDoc: 'V', cedula: '33445566' },
      { nombre: 'Laura Morales', tipoDoc: 'V', cedula: '55443322' },
      { nombre: 'Miguel Rivas', tipoDoc: 'V', cedula: '66554433' },
      { nombre: 'Patricia Colmenares', tipoDoc: 'V', cedula: '99001122' },
      { nombre: 'Alejandro Rojas', tipoDoc: 'V', cedula: '44556677' },
      { nombre: 'Gabriela Espinoza', tipoDoc: 'V', cedula: '15987412' },
      { nombre: 'Ricardo Vargas', tipoDoc: 'V', cedula: '13645789' },
      { nombre: 'Vanessa Ortega', tipoDoc: 'V', cedula: '19456123' },
      { nombre: 'Fernando Sifontes', tipoDoc: 'V', cedula: '11025896' },
      { nombre: 'Daniela Benítez', tipoDoc: 'V', cedula: '22456789' },
      { nombre: 'Manuel Miranda', tipoDoc: 'V', cedula: '14785236' },
      { nombre: 'Beatriz Fuentes', tipoDoc: 'V', cedula: '16951753' },
      { nombre: 'Javier Palacios', tipoDoc: 'V', cedula: '18523964' },
      { nombre: 'Natalia Gutiérrez', tipoDoc: 'V', cedula: '20147369' },
      { nombre: 'Roberto Chirinos', tipoDoc: 'V', cedula: '12369874' }
    ]);

    // Recuperamos entidades para estructurar facturas válidas
    const articulosDB = await db.articulos.toArray();
    const clientesDB = await db.clientes.toArray();
    const facturasSemilla = [];

    // 4. Generación y Registro Semilla de 30 Facturas
    for (let i = 1; i <= 30; i++) {
      const clienteAsignado = clientesDB[(i - 1) % clientesDB.length];
      const art1 = articulosDB[(i * 2) % articulosDB.length];
      const art2 = articulosDB[(i * 3) % articulosDB.length];

      const qty1 = (i % 3) + 1;
      const qty2 = (i % 2) + 1;

      const carritoSimulado = [
        {
          articuloId: art1.id,
          nombre: art1.nombre,
          priceUSD: art1.priceUSD,
          maxStock: art1.stock,
          qty: qty1,
          itemDiscountUSD: 0
        }
      ];

      if (i % 2 === 0) {
        carritoSimulado.push({
          articuloId: art2.id,
          nombre: art2.nombre,
          priceUSD: art2.priceUSD,
          maxStock: art2.stock,
          qty: qty2,
          itemDiscountUSD: 0
        });
      }

      let subtotal = 0;
      carritoSimulado.forEach(item => subtotal += (item.qty * item.priceUSD));
      
      const descuentoGlobal = i % 5 === 0 ? 1.00 : 0; 
      const totalUSD = Math.max(0, subtotal - descuentoGlobal);
      const fechaCalculada = new Date(Date.now() - (30 - i) * 3600000 * 8).toISOString();

      facturasSemilla.push({
        fecha: fechaCalculada,
        clienteId: clienteAsignado.id,
        items: carritoSimulado,
        subtotalUSD: subtotal,
        descuentoUSD: descuentoGlobal,
        totalUSD: totalUSD,
        tasaAplicada: globalExchangeRate,
        totalVES: totalUSD * globalExchangeRate
      });
    }

    await db.facturas.bulkAdd(facturasSemilla);
    console.log('✅ Base de datos poblada de manera exitosa.');
  }
}

// =========================================================================
// 2. CONTROL DE LA TASA CAMBIARIA REFERENCIAL
// =========================================================================
async function inicializarTasaGlobal() {
  const record = await db.config.get('tasa');
  if (record) {
    globalExchangeRate = parseFloat(record.value) || 645.00;
  } else {
    await db.config.put({ key: 'tasa', value: 645.00 });
  }
  document.getElementById('headerRateDisplay').innerText = `Tasa: ${globalExchangeRate.toFixed(2)} VES`;
  document.getElementById('configTasaInput').value = globalExchangeRate;
}

document.getElementById('btnGuardarTasa').addEventListener('click', async () => {
  const value = parseFloat(document.getElementById('configTasaInput').value);
  if (!value || value <= 0) {
    showStatus('⚠️ Ingrese una tasa numérica válida.');
    return;
  }
  await db.config.put({ key: 'tasa', value: value });
  await inicializarTasaGlobal();
  calcularTotalesCarrito();
  showStatus('💵 Tasa cambiaria actualizada globalmente.');
});

// =========================================================================
// 3. ENRUTAMIENTO NATIVO DE LA INTERFAZ (UI)
// =========================================================================
function configurarEnrutamientoMenu() {
  document.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('click', () => {
      if (item.id === 'menu-item-update' || item.id === 'menu-item-install') { return; }

      const targetId = item.dataset.target;
      if (!targetId) return;

      const label = item.querySelector('.menu-label').innerText;
      
      document.getElementById('main-menu').classList.remove('active');
      document.getElementById(targetId).classList.add('active');
      
      document.getElementById('btnBackToMenu').style.visibility = 'visible';
      document.getElementById('appTitle').innerText = label;

      if (targetId === 'sec-ventas') { resetTerminalVentas(); }
      if (targetId === 'sec-articulos') { cargarArticulosUI(); resetFormArticulo(); actualizarDesplegablesCategorias(); }
      if (targetId === 'sec-inventario') { actualizarDesplegablesArticulos(); }
      if (targetId === 'sec-categorias') { cargarCategoriasUI(); resetFormCat(); }
      if (targetId === 'sec-clientes') { document.getElementById('searchClienteInput').value = ''; cargarClientesUI(); resetFormCliente(); }
      if (targetId === 'sec-facturas') { cargarFacturasUI(); }
    });
  });

  document.getElementById('btnBackToMenu').addEventListener('click', () => {
    document.querySelectorAll('.section-content').forEach(sec => sec.classList.remove('active'));
    document.getElementById('main-menu').classList.add('active');
    document.getElementById('btnBackToMenu').style.visibility = 'hidden';
    document.getElementById('appTitle').innerText = '🏠 Quim Control'; 
  });
}

function showStatus(message) {
  const toast = document.getElementById('toastStatus');
  toast.innerText = message;
  toast.style.display = 'block';
  setTimeout(() => { toast.style.display = 'none'; }, 3000);
}

// =========================================================================
// 4. MÓDULO: GESTIÓN DE CATEGORÍAS
// =========================================================================
async function actualizarDesplegablesCategorias() {
  const cats = await db.categorias.toArray();
  const selectNode = document.getElementById('articuloCategoria');
  if (selectNode) {
    selectNode.innerHTML = cats.map(c => `<option value="${c.id}">${escapeHtml(c.nombre)}</option>`).join('');
  }
}

async function cargarCategoriasUI() {
  const cats = await db.categorias.toArray();
  const container = document.getElementById('categoriasList');
  container.innerHTML = cats.map(c => `
    <div class="person-item">
      <div class="person-info"><div class="nombre">🏷️ ${escapeHtml(c.nombre)} [ID: ${c.id}]</div></div>
      <div class="action-buttons">
        <button class="btn-action" onclick="editarCat(${c.id})">Editar</button>
        <button class="btn-action delete" onclick="eliminarCat(${c.id})">Eliminar</button>
      </div>
    </div>
  `).join('');
}

document.getElementById('btnGuardarCat').addEventListener('click', async () => {
  const idVal = document.getElementById('catId').value;
  const nombre = document.getElementById('catNombre').value.trim();
  if (!nombre) return;

  if (idVal) {
    await db.categorias.update(parseInt(idVal), { nombre });
    showStatus('🔄 Categoría actualizada con éxito.');
  } else {
    await db.categorias.add({ nombre });
    showStatus('✅ Categoría registrada de forma local.');
  }
  resetFormCat(); cargarCategoriasUI();
});

async function editarCat(id) {
  const c = await db.categorias.get(id);
  if (!c) return;
  document.getElementById('catId').value = c.id;
  document.getElementById('catNombre').value = c.nombre;
  document.getElementById('formCatTitle').innerText = '🔄 Editar Categoría';
  document.getElementById('btnCancelarCatEdicion').style.display = 'block';
}

document.getElementById('btnCancelarCatEdicion').addEventListener('click', () => { resetFormCat(); });
function resetFormCat() {
  document.getElementById('catId').value = '';
  document.getElementById('catNombre').value = '';
  document.getElementById('formCatTitle').innerText = '🏷️ Registrar Categoría';
  document.getElementById('btnCancelarCatEdicion').style.display = 'none';
}

async function eliminarCat(id) {
  const vinculados = await db.articulos.where('categoriaId').equals(id).count();
  if (vinculados > 0) {
    showStatus(`🚨 Imposible eliminar: existen ${vinculados} artículos bajo esta categoría.`);
    return;
  }
  if (confirm('¿Desea borrar esta categoría?')) {
    await db.categorias.delete(id);
    cargarCategoriasUI();
  }
}

// =========================================================================
// 5. MÓDULO: CATALOGO DE ARTÍCULOS (CRUD)
// =========================================================================
async function actualizarDesplegablesArticulos() {
  const items = await db.articulos.toArray();
  const selectNode = document.getElementById('invItemSelect');
  if (selectNode) {
    selectNode.innerHTML = items.map(i => `<option value="${i.id}">${escapeHtml(i.nombre)} (Stock: ${i.stock})</option>`).join('');
  }
}

async function cargarArticulosUI(filterText = '') {
  let items = await db.articulos.toArray();
  if (filterText) {
    items = items.filter(i => i.nombre.toLowerCase().includes(filterText.toLowerCase()));
  }
  const container = document.getElementById('articulosList');
  container.innerHTML = items.map(i => `
    <div class="person-item">
      <div class="person-info">
        <div class="nombre">${escapeHtml(i.nombre)} <span style="font-size:0.8rem; color:#64748b;">[ID: ${i.id}]</span></div>
        <div class="cedula">Precio: <strong>${i.priceUSD.toFixed(2)} $</strong> | Existencia: <strong>${i.stock} unids</strong></div>
      </div>
      <div class="action-buttons">
        <button class="btn-action" onclick="editarArticulo(${i.id})">Editar</button>
        <button class="btn-action delete" onclick="eliminarArticulo(${i.id})">Eliminar</button>
      </div>
    </div>
  `).join('');
}

document.getElementById('searchArticuloInput').addEventListener('input', (e) => {
  cargarArticulosUI(e.target.value);
});

document.getElementById('btnGuardarArticulo').addEventListener('click', async () => {
  const idVal = document.getElementById('articuloId').value;
  const nombre = document.getElementById('articuloNombre').value.trim();
  const catId = document.getElementById('articuloCategoria').value;
  const descripcion = document.getElementById('articuloDescripcion').value.trim();
  const precio = parseFloat(document.getElementById('articuloPrecio').value);

  if (!nombre || !catId || isNaN(precio) || precio < 0) {
    showStatus('⚠️ Verifique los campos obligatorios (*) y valores de precio.');
    return;
  }

  const parsedCatId = isNaN(parseInt(catId)) ? catId : parseInt(catId);

  if (idVal) {
    await db.articulos.update(parseInt(idVal), {
      nombre, categoriaId: parsedCatId, descripcion, priceUSD: precio
    });
    showStatus('🔄 Ficha técnica del artículo actualizada.');
  } else {
    await db.articulos.add({
      nombre, categoriaId: parsedCatId, descripcion, priceUSD: precio, stock: 0
    });
    showStatus('✅ Nuevo artículo indexado en el catálogo.');
  }
  resetFormArticulo(); cargarArticulosUI();
});

async function editarArticulo(id) {
  const i = await db.articulos.get(id);
  if (!i) return;
  document.getElementById('articuloId').value = i.id;
  document.getElementById('articuloNombre').value = i.nombre;
  document.getElementById('articuloCategoria').value = i.categoriaId;
  document.getElementById('articuloDescripcion').value = i.descripcion || '';
  document.getElementById('articuloPrecio').value = i.priceUSD;
  
  document.getElementById('formArticuloTitle').innerText = '🔄 Editar Artículo';
  document.getElementById('btnCancelarArticuloEdicion').style.display = 'block';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.getElementById('btnCancelarArticuloEdicion').addEventListener('click', () => { resetFormArticulo(); });
function resetFormArticulo() {
  document.getElementById('articuloId').value = '';
  document.getElementById('articuloNombre').value = '';
  document.getElementById('articuloDescripcion').value = '';
  document.getElementById('articuloPrecio').value = '';
  document.getElementById('formArticuloTitle').innerText = '📦 Crear Nuevo Artículo';
  document.getElementById('btnCancelarArticuloEdicion').style.display = 'none';
}

async function eliminarArticulo(id) {
  if (confirm('🚨 ¿Seguro que desea remover este artículo del catálogo?')) {
    await db.articulos.delete(id);
    cargarArticulosUI();
  }
}

// =========================================================================
// 6. MÓDULO: CARGA DE STOCK (INVENTARIO)
// =========================================================================
document.getElementById('btnGuardarCarga').addEventListener('click', async () => {
  const artId = parseInt(document.getElementById('invItemSelect').value);
  const qty = parseInt(document.getElementById('invCantidad').value);

  if (!artId || isNaN(qty) || qty <= 0) {
    showStatus('⚠️ Ingrese una cantidad válida de entrada.');
    return;
  }

  const art = await db.articulos.get(artId);
  if (!art) return;

  const nuevoStock = (art.stock || 0) + qty;
  await db.articulos.update(artId, { stock: nuevoStock });
  
  document.getElementById('invCantidad').value = '';
  actualizarDesplegablesArticulos();
  showStatus(`📥 Stock incrementado (+${qty} unids) con éxito.`);
});

// =========================================================================
// 7. MÓDULO: CONTROL DE CLIENTES (Estructura robusta de búsqueda contra strings/numbers)
// =========================================================================
async function cargarClientesUI(filterText = '') {
  let clientList = await db.clientes.toArray();
  
  // Aplicación del motor de búsqueda local robusto contra tipos primitivos
  if (filterText) {
    const query = filterText.toLowerCase().trim();
    clientList = clientList.filter(c => {
      const idMatch = c.id && c.id.toString() === query;
      const nombreMatch = c.nombre && c.nombre.toLowerCase().includes(query);
      const cedulaMatch = c.cedula && c.cedula.toString().includes(query);
      return idMatch || nombreMatch || cedulaMatch;
    });
  }

  const container = document.getElementById('clientesList');
  
  if (clientList.length === 0) {
    container.innerHTML = '<p style="text-align:center; color:#64748b; padding:12px;">No se encontraron clientes que coincidan.</p>';
    return;
  }

  container.innerHTML = clientList.map(c => `
    <div class="person-item">
      <div class="person-info">
        <div class="nombre">
          <span style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-size: 0.8rem; margin-right: 6px; font-weight: bold; color: #475569;">ID: ${c.id}</span>
          ${escapeHtml(c.nombre)}
        </div>
        <div class="cedula">Documento: <strong>${escapeHtml(c.tipoDoc || 'V')}-${escapeHtml(c.cedula || '')}</strong></div>
      </div>
      <div class="action-buttons">
        <button class="btn-action" onclick="editarCliente(${c.id})">Editar</button>
        <button class="btn-action delete" onclick="eliminarCliente(${c.id})">Eliminar</button>
      </div>
    </div>
  `).join('');
}

// Escuchador reactivo asignado al input de filtrado del padrón
document.getElementById('searchClienteInput').addEventListener('input', (e) => {
  cargarClientesUI(e.target.value);
});

document.getElementById('btnGuardarCliente').addEventListener('click', async () => {
  const idVal = document.getElementById('clienteId').value;
  const nombre = document.getElementById('clienteNombre').value.trim();
  const tipoDoc = document.getElementById('clienteNacionalidad').value;
  const cedula = document.getElementById('clienteCedula').value.replace(/\D/g, '');

  if (!nombre || !cedula) {
    showStatus('⚠️ Complete los campos requeridos para identificar al cliente.');
    return;
  }

  const dataCliente = { nombre, tipoDoc, cedula };

  if (idVal) {
    await db.clientes.update(parseInt(idVal), dataCliente);
    showStatus('🔄 Cliente actualizado.');
  } else {
    await db.clientes.add(dataCliente);
    showStatus('✅ Cliente registrado en el padrón local.');
  }
  document.getElementById('searchClienteInput').value = '';
  resetFormCliente(); cargarClientesUI();
});

async function editarCliente(id) {
  const c = await db.clientes.get(id);
  if (!c) return;
  document.getElementById('clienteId').value = c.id;
  document.getElementById('clienteNombre').value = c.nombre;
  document.getElementById('clienteNacionalidad').value = c.tipoDoc;
  document.getElementById('clienteCedula').value = c.cedula;
  
  document.getElementById('formClienteTitle').innerText = '🔄 Editar Cliente';
  document.getElementById('btnCancelarClienteEdicion').style.display = 'block';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.getElementById('btnCancelarClienteEdicion').addEventListener('click', () => { resetFormCliente(); });
function resetFormCliente() {
  document.getElementById('clienteId').value = '';
  document.getElementById('clienteNombre').value = '';
  document.getElementById('clienteCedula').value = '';
  document.getElementById('formClienteTitle').innerText = '👥 Registrar / Editar Cliente';
  document.getElementById('btnCancelarClienteEdicion').style.display = 'none';
}

async function eliminarCliente(id) {
  if (confirm('¿Eliminar este cliente del dispositivo?')) {
    await db.clientes.delete(id);
    document.getElementById('searchClienteInput').value = '';
    cargarClientesUI();
  }
}

// =========================================================================
// 8. TERMINAL DE VENTAS ACTIVA (CARRITO DE COMPRAS)
// =========================================================================
function configurarMotoresBusquedaVenta() {
  const clientSearchInput = document.getElementById('saleClientSearch');
  const itemSearchInput = document.getElementById('saleItemSearch');

  clientSearchInput.addEventListener('input', async (e) => {
    const q = e.target.value.toLowerCase().trim();
    const resultsContainer = document.getElementById('saleClientResults');
    if (!q) { resultsContainer.innerHTML = ''; return; }

    const records = await db.clientes.toArray();
    const filtrados = records.filter(c => c.id.toString() === q || c.nombre.toLowerCase().includes(q) || c.cedula.toString().includes(q));

    resultsContainer.innerHTML = filtrados.map(c => `
      <div class="search-result-item" onclick="seleccionarClienteParaVenta(${c.id})">
        👥 <strong>[ID: ${c.id}]</strong> ${escapeHtml(c.nombre)} [${c.tipoDoc}-${c.cedula}]
      </div>
    `).join('');
  });

  itemSearchInput.addEventListener('input', async (e) => {
    const q = e.target.value.toLowerCase().trim();
    const resultsContainer = document.getElementById('saleItemResults');
    if (!q) { resultsContainer.innerHTML = ''; return; }

    const records = await db.articulos.toArray();
    const filtrados = records.filter(i => i.nombre.toLowerCase().includes(q));

    resultsContainer.innerHTML = filtrados.map(i => `
      <div class="search-result-item" onclick="agregarArticuloAlCarrito(${i.id})">
        📦 ${escapeHtml(i.nombre)} - <strong>${i.priceUSD.toFixed(2)} $</strong> (Disp: ${i.stock} unids)
      </div>
    `).join('');
  });
}

async function seleccionarClienteParaVenta(id) {
  const c = await db.clientes.get(id);
  if (!c) return;
  selectedClientId = c.id;
  document.getElementById('selectedClientBadge').innerText = `✅ Cliente: [ID: ${c.id}] ${c.nombre}`;
  document.getElementById('saleClientSearch').value = '';
  document.getElementById('saleClientResults').innerHTML = '';
}

async function agregarArticuloAlCarrito(id) {
  const art = await db.articulos.get(id);
  if (!art) return;
  if (art.stock <= 0) {
    showStatus('🚨 Operación bloqueada: Artículo sin existencias en el inventario.');
    return;
  }

  const existing = currentCart.find(c => c.articuloId === id);
  if (existing) {
    if (existing.qty >= art.stock) {
      showStatus('⚠️ No puedes exceder el stock disponible.');
      return;
    }
    existing.qty++;
  } else {
    currentCart.push({
      articuloId: id,
      nombre: art.nombre,
      priceUSD: art.priceUSD,
      maxStock: art.stock,
      qty: 1,
      itemDiscountUSD: 0
    });
  }
  document.getElementById('saleItemSearch').value = '';
  document.getElementById('saleItemResults').innerHTML = '';
  renderCarrito();
}

function renderCarrito() {
  const tbody = document.getElementById('cartTableBody');
  if (currentCart.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#64748b;">El carrito de compras está vacío.</td></tr>`;
    calcularTotalesCarrito();
    return;
  }

  tbody.innerHTML = currentCart.map((c, idx) => {
    const subtotalItem = (c.qty * c.priceUSD) - c.itemDiscountUSD;
    return `
      <tr>
        <td><strong>${escapeHtml(c.nombre)}</strong></td>
        <td>
          <input type="number" value="${c.qty}" min="1" max="${c.maxStock}" style="width:70px; margin:0; padding:6px;" onchange="cambiarCantidadItem(${idx}, this.value)">
        </td>
        <td>${c.priceUSD.toFixed(2)} $</td>
        <td>
          <input type="number" value="${c.itemDiscountUSD}" min="0" step="0.01" style="width:80px; margin:0; padding:6px; color:#dc2626;" onchange="cambiarDescuentoItem(${idx}, this.value)">
        </td>
        <td><strong>${subtotalItem.toFixed(2)} $</strong></td>
        <td>
          <button class="btn-action delete" style="padding:4px 8px;" onclick="removerItemCarrito(${idx})">❌</button>
        </td>
      </tr>
    `;
  }).join('');
  calcularTotalesCarrito();
}

function cambiarCantidadItem(idx, val) {
  const cantidad = parseInt(val) || 1;
  if (cantidad > currentCart[idx].maxStock) {
    showStatus(`⚠️ Stock excedido. Máximo: ${currentCart[idx].maxStock}`);
    currentCart[idx].qty = currentCart[idx].maxStock;
  } else {
    currentCart[idx].qty = cantidad;
  }
  renderCarrito();
}

// =========================================================================
// CORREGIDO: Declaración de precioBruto sin espacios en blanco ilegales
// =========================================================================
function cambiarDescuentoItem(idx, val) {
  const desc = parseFloat(val) || 0;
  const precioBruto = currentCart[idx].qty * currentCart[idx].priceUSD;
  if (desc > precioBruto) {
    showStatus('⚠️ El descuento no puede superar el costo del artículo.');
    currentCart[idx].itemDiscountUSD = precioBruto;
  } else {
    currentCart[idx].itemDiscountUSD = desc;
  }
  renderCarrito();
}

function removerItemCarrito(idx) {
  currentCart.splice(idx, 1);
  renderCarrito();
}

function calcularTotalesCarrito() {
  let subtotal = 0;
  let descuentosEspecificos = 0;
  
  currentCart.forEach(c => {
    subtotal += (c.qty * c.priceUSD);
    descuentosEspecificos += c.itemDiscountUSD;
  });

  const descuentoGlobal = parseFloat(document.getElementById('cartGlobalDiscount').value) || 0;
  const totalDescuentos = descuentosEspecificos + descuentoGlobal;
  let totalUSD = Math.max(0, subtotal - totalDescuentos);
  
  const totalVES = totalUSD * globalExchangeRate;

  document.getElementById('txtSubtotalUSD').innerText = subtotal.toFixed(2);
  document.getElementById('txtDescuentosUSD').innerText = totalDescuentos.toFixed(2);
  document.getElementById('txtTotalUSD').innerText = totalUSD.toFixed(2);
  document.getElementById('txtTotalVES').innerText = totalVES.toFixed(2);
}

document.getElementById('cartGlobalDiscount').addEventListener('input', () => {
  calcularTotalesCarrito();
});

document.getElementById('btnProcesarFactura').addEventListener('click', async () => {
  if (currentCart.length === 0) {
    showStatus('🚨 Carrito vacío. Ingrese productos para facturar.');
    return;
  }

  try {
    for (let c of currentCart) {
      const art = await db.articulos.get(c.articuloId);
      const stockFinal = Math.max(0, (art.stock || 0) - c.qty);
      await db.articulos.update(c.articuloId, { stock: stockFinal });
    }

    let subtotal = 0;
    let descItems = 0;
    currentCart.forEach(c => {
      subtotal += (c.qty * c.priceUSD);
      descItems += c.itemDiscountUSD;
    });

    const descGlobal = parseFloat(document.getElementById('cartGlobalDiscount').value) || 0;
    const totalUSD = Math.max(0, subtotal - (descItems + descGlobal));

    const nuevaFactura = {
      fecha: new Date().toISOString(),
      clienteId: selectedClientId,
      items: currentCart,
      subtotalUSD: subtotal,
      descuentoUSD: (descItems + descGlobal),
      totalUSD: totalUSD,
      tasaAplicada: globalExchangeRate,
      totalVES: totalUSD * globalExchangeRate
    };

    const idGenerado = await db.facturas.add(nuevaFactura);
    showStatus(`🎉 Factura N° 00${idGenerado} emitida correctamente.`);
    resetTerminalVentas();
  } catch (error) {
    console.error(error);
    showStatus('❌ Fallo crítico de base de datos en la facturación.');
  }
});

function resetTerminalVentas() {
  currentCart = [];
  selectedClientId = null;
  document.getElementById('selectedClientBadge').innerText = '⚠️ Ningún cliente seleccionado (Venta General)';
  document.getElementById('cartGlobalDiscount').value = '0';
  document.getElementById('saleClientSearch').value = '';
  document.getElementById('saleItemSearch').value = '';
  renderCarrito();
}

// =========================================================================
// 9. REPOSITORIO COMPROBANTES Y PAGINACIÓN INTEGRADA
// =========================================================================
async function cargarFacturasUI() {
  const totalInvoices = await db.facturas.count();
  const maxPage = Math.ceil(totalInvoices / INVOICES_PER_PAGE) || 1;
  
  if (invoicePage > maxPage) invoicePage = maxPage;
  if (invoicePage < 1) invoicePage = 1;

  document.getElementById('lblPaginacion').innerText = `Página ${invoicePage} de ${maxPage}`;

  const offset = (invoicePage - 1) * INVOICES_PER_PAGE;
  let arr = await db.facturas.orderBy('id').reverse().toArray();
  const paginados = arr.slice(offset, offset + INVOICES_PER_PAGE);

  const container = document.getElementById('facturasList');
  if (paginados.length === 0) {
    container.innerHTML = '<p style="text-align:center; color:#64748b;">No hay registros contables en este bloque.</p>';
    return;
  }

  const listClientes = await db.clientes.toArray();
  const clientMap = new Map(listClientes.map(c => [c.id, `${c.nombre} (${c.tipoDoc}-${c.cedula}) [ID: ${c.id}]`]));

  container.innerHTML = paginados.map(f => `
    <div class="person-item" style="flex-direction: column; align-items: flex-start; gap: 8px;">
      <div style="display:flex; justify-content:space-between; width:100%; border-bottom:1px solid #e2e8f0; padding-bottom:4px;">
        <span style="color:#b45309; font-weight:bold;">🧾 Factura N°: 00${f.id}</span>
        <span style="font-size:0.8rem; color:#64748b;">📅 ${f.fecha.substring(0,10)}</span>
      </div>
      <div class="cedula" style="width:100%;">
        <strong>Cliente:</strong> ${clientMap.get(f.clienteId) || 'Venta de Mostrador / General'}<br>
        <strong>Monto Neto:</strong> <span style="color:#10b981; font-weight:bold;">${f.totalUSD.toFixed(2)} $</span> | ${f.totalVES.toFixed(2)} VES
      </div>
      <button class="btn primary" style="padding:6px; font-size:0.8rem; margin:0;" onclick="imprimirFacturaPDF(${f.id})">🖨️ Imprimir Factura (PDF)</button>
    </div>
  `).join('');
}

document.getElementById('btnPrevPage').addEventListener('click', () => {
  if (invoicePage > 1) { invoicePage--; cargarFacturasUI(); }
});
document.getElementById('btnNextPage').addEventListener('click', () => {
  invoicePage++; cargarFacturasUI();
});

// =========================================================================
// 10. GENERACIÓN LIMPIA DE COMPROBANTES DE IMPRESIÓN / PDF
// =========================================================================
async function imprimirFacturaPDF(id) {
  const f = await db.facturas.get(id);
  if (!f) return;

  document.getElementById('printInvoiceId').innerText = `FACTURA DE VENTA N°: 000${f.id}`;
  document.getElementById('printInvoiceMeta').innerText = `Fecha de Emisión: ${f.fecha.substring(0,10)} ${f.fecha.substring(11,16)}`;
  
  if (f.clienteId) {
    const c = await db.clientes.get(f.clienteId);
    if (c) {
      document.getElementById('printClientName').innerHTML = `<strong>Razón Social:</strong> ${escapeHtml(c.nombre)} (ID: ${c.id})`;
      document.getElementById('printClientDoc').innerHTML = `<strong>Cédula / RIF:</strong> ${c.tipoDoc}-${c.cedula}`;
    } else {
      document.getElementById('printClientName').innerHTML = `<strong>Razón Social:</strong> CLIENTE REMOVIDO / YA NO EXISTE`;
      document.getElementById('printClientDoc').innerHTML = `<strong>Cédula / RIF:</strong> N/A`;
    }
  } else {
    document.getElementById('printClientName').innerHTML = `<strong>Razón Social:</strong> CLIENTE GENERAL CONTADOR`;
    document.getElementById('printClientDoc').innerHTML = `<strong>Cédula / RIF:</strong> COMPRA DE MOSTRADOR`;
  }

  const tbodyPrint = document.getElementById('printTableBody');
  tbodyPrint.innerHTML = f.items.map(i => {
    const totalNetoItem = (i.qty * i.priceUSD) - i.itemDiscountUSD;
    return `
      <tr>
        <td>${escapeHtml(i.nombre)}</td>
        <td style="text-align: center;">${i.qty}</td>
        <td style="text-align: right;">${i.priceUSD.toFixed(2)} $</td>
        <td style="text-align: right; color: #c62828;">${i.itemDiscountUSD.toFixed(2)} $</td>
        <td style="text-align: right; font-weight: bold;">${totalNetoItem.toFixed(2)} $</td>
      </tr>
    `;
  }).join('');

  document.getElementById('printSubtotalUSD').innerText = `${f.subtotalUSD.toFixed(2)} $`;
  document.getElementById('printDescuentosUSD').innerText = `${f.descuentoUSD.toFixed(2)} $`;
  document.getElementById('printTotalUSD').innerText = `${f.totalUSD.toFixed(2)} $`;
  document.getElementById('printTotalVES').innerText = `${f.totalVES.toFixed(2)} VES`;
  document.getElementById('printExchangeRateMeta').innerText = `Tasa cambiaria aplicada: ${f.tasaAplicada.toFixed(2)} VES/USD. Procesado localmente en terminal PWA de manera offline.`;

  window.print();
}

// =========================================================================
// 11. SISTEMA OPERATIVO PWA (CICLO DE VIDA, INSTALACIÓN Y ACTUALIZACIÓN)
// =========================================================================
function configurarAccionesPWA() {
  const btnInstall = document.getElementById('menu-item-install');
  const btnUpdate = document.getElementById('menu-item-update');

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (btnInstall) btnInstall.style.display = 'flex';
  });

  if (btnInstall) {
    btnInstall.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`Resultado de la instalación de Quim: ${outcome}`);
      deferredPrompt = null;
      btnInstall.style.display = 'none';
    });
  }

  if (btnUpdate) {
    btnUpdate.addEventListener('click', () => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
          for (let registration of registrations) {
            registration.update();
          }
          showStatus('🔄 Buscando parches en red... Recargando terminal.');
          setTimeout(() => { window.location.reload(); }, 1000);
        });
      } else {
        window.location.reload();
      }
    });
  }
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('🚀 Service Worker activo en alcance:', reg.scope))
      .catch(err => console.error('❌ Error de registro del Service Worker:', err));
  });
}