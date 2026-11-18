
const $ = id => document.getElementById(id);

const STORAGE = "pagaya_datos";

const datosIniciales = {
  usuarios: [],
  productos: [
    {id:1, nombre:"Empanada", precio:5, stock:18, descripcion:"Empanada recién preparada"},
    {id:2, nombre:"Queque", precio:4, stock:12, descripcion:"Porción de queque"},
    {id:3, nombre:"Salchipapa", precio:12, stock:10, descripcion:"Porción personal"},
    {id:4, nombre:"Coca-Cola", precio:6, stock:20, descripcion:"Botella personal"},
    {id:5, nombre:"Pilfrut", precio:2, stock:25, descripcion:"Bebida frutal"}
  ],
  reservas: [],
  gastos: []
};

let db;

try {
  db = JSON.parse(localStorage.getItem(STORAGE)) || structuredClone(datosIniciales);
} catch {
  db = structuredClone(datosIniciales);
}

// Compatibilidad con datos guardados antes de la actualización.
db.productos = Array.isArray(db.productos) ? db.productos : [];
db.reservas = Array.isArray(db.reservas) ? db.reservas : [];
db.gastos = Array.isArray(db.gastos) ? db.gastos : [];
db.usuarios = Array.isArray(db.usuarios) ? db.usuarios : [];
db.productos.forEach(p => { if (!Number.isFinite(Number(p.costo))) p.costo = 0; });
let usuarioActual = null;
let carrito = [];

function guardar() {
  localStorage.setItem(STORAGE, JSON.stringify(db));
}

function dinero(numero) {
  return "Bs " + Number(numero).toFixed(2).replace(".", ",");
}

function fechaHoy() {
  const d = new Date();
  return d.getFullYear() + "-" +
    String(d.getMonth()+1).padStart(2,"0") + "-" +
    String(d.getDate()).padStart(2,"0");
}

function mesActual() {
  return fechaHoy().slice(0,7);
}

function escapar(texto) {
  return String(texto).replace(/[&<>"']/g, letra => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;",
    '"':"&quot;", "'":"&#39;"
  })[letra]);
}

function aviso(texto) {
  const caja = $("toast");
  caja.textContent = texto;
  caja.classList.add("show");
  setTimeout(() => caja.classList.remove("show"), 2500);
}

function mostrarVista(id) {
  ["loginView","clientView","ownerView"].forEach(v =>
    $(v).classList.add("hidden")
  );

  $(id).classList.remove("hidden");
  $("logoutBtn").classList.toggle("hidden", id === "loginView");
}

// CAMBIAR TIPO DE INGRESO

function cambiarTab(tipo) {
  document.querySelectorAll(".tabs:not(.admin-tabs) .tab")
    .forEach(b => b.classList.toggle("active", b.dataset.tab === tipo));

  $("clientLoginForm").classList.toggle("hidden", tipo !== "client");
  $("registerForm").classList.add("hidden");
  $("ownerLoginForm").classList.toggle("hidden", tipo !== "owner");
  $("authMessage").textContent = "";
}

document.querySelectorAll("[data-tab]").forEach(b => {
  b.addEventListener("click", () => cambiarTab(b.dataset.tab));
});

$("showRegister").addEventListener("click", () => {
  $("clientLoginForm").classList.add("hidden");
  $("registerForm").classList.remove("hidden");
});

$("backLogin").addEventListener("click", () => {
  $("registerForm").classList.add("hidden");
  $("clientLoginForm").classList.remove("hidden");
});

// REGISTRO DE CLIENTES

$("registerForm").addEventListener("submit", e => {
  e.preventDefault();

  const nombre = $("registerName").value.trim();
  const password = $("registerPassword").value;

  if (db.usuarios.some(u => u.nombre.toLowerCase() === nombre.toLowerCase())) {
    $("authMessage").textContent = "Ese nombre ya está registrado.";
    return;
  }

  db.usuarios.push({nombre, password});
  guardar();

  iniciarSesion({tipo:"cliente", nombre});
});

// INGRESO DEL CLIENTE

$("clientLoginForm").addEventListener("submit", e => {
  e.preventDefault();

  const nombre = $("clientName").value.trim();
  const password = $("clientPassword").value;

  const usuario = db.usuarios.find(u =>
    u.nombre.toLowerCase() === nombre.toLowerCase() &&
    u.password === password
  );

  if (!usuario) {
    $("authMessage").textContent = "Datos incorrectos. Revisa tu cuenta.";
    return;
  }

  iniciarSesion({tipo:"cliente", nombre:usuario.nombre});
});

// INGRESO DE LA DUEÑA

$("ownerLoginForm").addEventListener("submit", e => {
  e.preventDefault();

  if ($("ownerUser").value === "admin" &&
      $("ownerPassword").value === "1234") {
    iniciarSesion({tipo:"dueña", nombre:"Administradora"});
  } else {
    $("authMessage").textContent = "Usuario o contraseña incorrectos.";
  }
});

// INICIAR SESIÓN

function iniciarSesion(usuario) {
  usuarioActual = usuario;

  $("sessionLabel").textContent =
    usuario.tipo === "dueña"
      ? "Sesión: Dueña del snack"
      : "Hola, " + usuario.nombre;

  if (usuario.tipo === "dueña") {
    mostrarVista("ownerView");
    actualizarAdministracion();
  } else {
    mostrarVista("clientView");
    mostrarProductos();
    mostrarMisReservas();
  }
}

// CERRAR SESIÓN

$("logoutBtn").addEventListener("click", () => {
  usuarioActual = null;
  carrito = [];

  $("clientLoginForm").reset();
  $("ownerLoginForm").reset();
  $("sessionLabel").textContent = "Bienvenido";

  mostrarVista("loginView");
  cambiarTab("client");
});

// PRODUCTOS PARA EL CLIENTE

function iconoProducto(nombre) {
  const n = nombre.toLowerCase();

  if (n.includes("bebida") || n.includes("coca") || n.includes("pilfrut"))
    return "🥤";

  if (n.includes("empanada")) return "🥟";
  if (n.includes("queque")) return "🍰";
  if (n.includes("salchipapa")) return "🍟";

  return "🍴";
}

function mostrarProductos() {
  const busqueda = $("productSearch").value.toLowerCase();

  const productos = db.productos.filter(p =>
    p.nombre.toLowerCase().includes(busqueda)
  );

  $("productGrid").innerHTML = productos.length
    ? productos.map(p => `
      <article class="product">
        <div class="product-icon">${iconoProducto(p.nombre)}</div>
        <h3>${escapar(p.nombre)}</h3>
        <p>${escapar(p.descripcion)}</p>
        <div class="product-footer">
          <div>
            <div class="price">${dinero(p.precio)}</div>
            <span class="stock">
              ${p.stock > 0 ? p.stock + " disponibles" : "Agotado"}
            </span>
          </div>
          <button class="btn primary" data-add="${p.id}"
            ${p.stock <= 0 ? "disabled" : ""}>
            Añadir
          </button>
        </div>
      </article>
    `).join("")
    : '<div class="empty">No hay productos disponibles.</div>';

  document.querySelectorAll("[data-add]").forEach(b => {
    b.addEventListener("click", () => agregarCarrito(Number(b.dataset.add)));
  });

  $("cartCount").textContent =
    carrito.reduce((s, item) => s + item.cantidad, 0);
}

$("productSearch").addEventListener("input", mostrarProductos);

// CARRITO

function agregarCarrito(id) {
  const producto = db.productos.find(p => p.id === id);
  const item = carrito.find(x => x.id === id);
  const cantidad = item ? item.cantidad : 0;

  if (!producto || cantidad >= producto.stock) {
    aviso("No hay más unidades disponibles.");
    return;
  }

  if (item) {
    item.cantidad++;
  } else {
    carrito.push({id, cantidad:1});
  }

  mostrarProductos();
  aviso("Producto añadido al carrito.");
}

$("openCartBtn").addEventListener("click", () => {
  mostrarCarrito();
  $("cartModal").classList.remove("hidden");
});

function mostrarCarrito() {
  $("cartItems").innerHTML = carrito.length
    ? carrito.map(item => {
        const p = db.productos.find(x => x.id === item.id);

        if (!p) return "";

        return `
          <div class="cart-row">
            <span>${escapar(p.nombre)} × ${item.cantidad}</span>
            <strong>${dinero(p.precio * item.cantidad)}</strong>
            <button class="remove" data-remove="${p.id}">Quitar</button>
          </div>
        `;
      }).join("")
    : '<div class="empty">Tu carrito está vacío.</div>';

  document.querySelectorAll("[data-remove]").forEach(b => {
    b.addEventListener("click", () => {
      carrito = carrito.filter(x => x.id !== Number(b.dataset.remove));
      mostrarCarrito();
      mostrarProductos();
    });
  });

  const total = carrito.reduce((s, item) => {
    const p = db.productos.find(x => x.id === item.id);
    return s + (p ? p.precio * item.cantidad : 0);
  }, 0);

  $("cartTotal").textContent = dinero(total);
  $("checkoutForm").classList.toggle("hidden", carrito.length === 0);
}

// CONFIRMAR RESERVA

$("checkoutForm").addEventListener("submit", e => {
  e.preventDefault();

  if (!carrito.length || usuarioActual?.tipo !== "cliente") return;

  // Comprobar stock antes de confirmar
  for (const item of carrito) {
    const p = db.productos.find(x => x.id === item.id);

    if (!p || p.stock < item.cantidad) {
      aviso("No hay suficiente inventario. Revisa tu carrito.");
      mostrarProductos();
      return;
    }
  }

  const productosReserva = carrito.map(item => {
    const p = db.productos.find(x => x.id === item.id);

    p.stock -= item.cantidad;

    return {
      id:p.id,
      nombre:p.nombre,
      precio:p.precio,
      costo:Number(p.costo)||0,
      cantidad:item.cantidad
    };
  });

  const total = productosReserva.reduce(
    (s, p) => s + p.precio * p.cantidad, 0
  );

  db.reservas.unshift({
    id:"PG-" + Date.now().toString().slice(-7),
    cliente:usuarioActual.nombre,
    productos:productosReserva,
    total,
    pago:$("paymentMethod").value,
    estado:"Pendiente",
    fecha:new Date().toISOString()
  });

  guardar();

  carrito = [];
  $("cartModal").classList.add("hidden");

  mostrarProductos();
  mostrarMisReservas();

  aviso("¡Tu reserva fue registrada!");
});

// RESERVAS DEL CLIENTE

function mostrarMisReservas() {
  const reservas = db.reservas.filter(r =>
    r.cliente === usuarioActual?.nombre
  );

  $("myOrders").innerHTML = reservas.length
    ? reservas.map(r => `
      <div class="order-row">
        <div>
          <strong>${r.id}</strong>
          <div class="order-info">
            ${r.productos.map(p =>
              `${escapar(p.nombre)} ×${p.cantidad}`
            ).join(", ")}
            · Pago: ${r.pago}
          </div>
        </div>
        <div>
          <strong>${dinero(r.total)}</strong>
          <div class="status">${r.estado}</div>
        </div>
      </div>
    `).join("")
    : '<div class="empty">Todavía no tienes reservas.</div>';
}

// PANEL DE ADMINISTRACIÓN

function actualizarAdministracion() {
  mostrarEstadisticas();
  mostrarInventario();
  mostrarTodasReservas();
  mostrarMovimientos();
  mostrarReportes();
}

// ESTADÍSTICAS CONTABLES

function fechaLocal(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" :
    `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function ventaReal(r) { return r.estado === "Entregada"; }
function costoReserva(r) { return r.productos.reduce((s,p) => s + (Number(p.costo)||0) * p.cantidad,0); }
function mostrarEstadisticas() {
  const ventas = db.reservas.filter(ventaReal);
  const ingresos = ventas.filter(r => fechaLocal(r.fechaEntrega || r.fecha).slice(0,7) === mesActual()).reduce((s,r)=>s+r.total,0);
  const costos = ventas.filter(r => fechaLocal(r.fechaEntrega || r.fecha).slice(0,7) === mesActual()).reduce((s,r)=>s+costoReserva(r),0);
  const gastos = db.gastos.filter(g => fechaLocal(g.fecha).slice(0,7) === mesActual()).reduce((s,g)=>s+g.monto,0);
  $("todaySales").textContent = dinero(ventas.filter(r=>fechaLocal(r.fechaEntrega || r.fecha)===fechaHoy()).reduce((s,r)=>s+r.total,0));
  $("monthIncome").textContent = dinero(ingresos);
  $("monthExpenses").textContent = dinero(gastos);
  $("monthProfit").textContent = dinero(ingresos-costos-gastos);
}
function mostrarMovimientos() {
  const movimientos = [
    ...db.reservas.filter(ventaReal).map(r=>({fecha:r.fechaEntrega||r.fecha,tipo:"Venta entregada",descripcion:r.id+" · "+r.cliente,monto:r.total})),
    ...db.gastos.map(g=>({fecha:g.fecha,tipo:"Gasto",descripcion:g.descripcion,monto:-g.monto}))
  ].sort((a,b)=>new Date(b.fecha)-new Date(a.fecha));
  $("movementTable").innerHTML = movimientos.length ? movimientos.map(m=>`<tr><td>${fechaLocal(m.fecha)}</td><td>${escapar(m.tipo)}</td><td>${escapar(m.descripcion)}</td><td>${dinero(m.monto)}</td></tr>`).join("") : '<tr><td colspan="4">Sin movimientos registrados.</td></tr>';
}

// INVENTARIO

function mostrarInventario() {
  $("inventoryTable").innerHTML = db.productos.length
    ? db.productos.map(p => `
      <tr>
        <td><strong>${escapar(p.nombre)}</strong></td>
        <td>${dinero(p.precio)}</td>
        <td>${dinero(p.costo || 0)}</td>
        <td>${p.stock}</td>
        <td>
          ${p.stock === 0
            ? '<span class="status">Agotado</span>'
            : p.stock <= 5
              ? '<span class="low-stock">Stock bajo</span>'
              : '<span class="status">Disponible</span>'}
        </td>
        <td>
          <button class="small-btn" data-edit="${p.id}">Editar</button>
          <button class="small-btn delete" data-delete="${p.id}">Quitar</button>
        </td>
      </tr>
    `).join("")
    : '<tr><td colspan="5">No hay productos.</td></tr>';

  document.querySelectorAll("[data-edit]").forEach(b => {
    b.addEventListener("click", () => editarProducto(Number(b.dataset.edit)));
  });

  document.querySelectorAll("[data-delete]").forEach(b => {
    b.addEventListener("click", () => quitarProducto(Number(b.dataset.delete)));
  });
}

// AÑADIR PRODUCTOS

$("addProductBtn").addEventListener("click", () => abrirFormularioProducto());

function abrirFormularioProducto(producto = null) {
  $("productForm").reset();
  $("editProductId").value = producto ? producto.id : "";
  $("productModalTitle").textContent =
    producto ? "Editar producto" : "Añadir producto";

  if (producto) {
    $("newProductName").value = producto.nombre;
    $("newProductPrice").value = producto.precio;
    $("newProductCost").value = producto.costo || 0;
    $("newProductStock").value = producto.stock;
    $("newProductDescription").value = producto.descripcion;
  }

  $("productModal").classList.remove("hidden");
}

function editarProducto(id) {
  const producto = db.productos.find(p => p.id === id);

  if (producto) abrirFormularioProducto(producto);
}

$("productForm").addEventListener("submit", e => {
  e.preventDefault();

  const id = $("editProductId").value;

  const nuevo = {
    nombre:$("newProductName").value.trim(),
    precio:Number($("newProductPrice").value),
    costo:Number($("newProductCost").value),
    stock:Number($("newProductStock").value),
    descripcion:$("newProductDescription").value.trim()
  };

  if (!nuevo.nombre || nuevo.precio <= 0 || nuevo.costo < 0 || !Number.isInteger(nuevo.stock) || nuevo.stock < 0) {
    aviso("Revisa los datos del producto.");
    return;
  }

  if (id) {
    const producto = db.productos.find(p => p.id === Number(id));
    Object.assign(producto, nuevo);
  } else {
    db.productos.push({
      id:Date.now(),
      ...nuevo
    });
  }

  guardar();
  $("productModal").classList.add("hidden");
  actualizarAdministracion();

  aviso("Producto guardado correctamente.");
});

// QUITAR PRODUCTOS

function quitarProducto(id) {
  const producto = db.productos.find(p => p.id === id);

  if (!producto) return;

  if (!confirm("¿Quieres quitar " + producto.nombre + "?")) return;

  db.productos = db.productos.filter(p => p.id !== id);
  carrito = carrito.filter(item => item.id !== id);

  guardar();
  actualizarAdministracion();

  aviso("Producto eliminado del catálogo.");
}

// RESERVAS DE TODOS LOS CLIENTES

function mostrarTodasReservas() {
  $("allOrders").innerHTML = db.reservas.length
    ? db.reservas.map(r => `
      <div class="order-row">
        <div>
          <strong>${r.id} - ${escapar(r.cliente)}</strong>
          <div class="order-info">
            ${r.productos.map(p =>
              `${escapar(p.nombre)} ×${p.cantidad}`
            ).join(", ")}
            · ${r.pago}
          </div>
        </div>
        <div>
          <strong>${dinero(r.total)}</strong>
          <select data-status="${r.id}">
            ${["Pendiente","Preparando","Lista","Entregada","Cancelada"].map(s =>
              `<option ${r.estado === s ? "selected" : ""}>${s}</option>`
            ).join("")}
          </select>
        </div>
      </div>
    `).join("")
    : '<div class="empty">Todavía no hay reservas.</div>';

  document.querySelectorAll("[data-status]").forEach(select => {
    select.addEventListener("change", () => {
      cambiarEstado(select.dataset.status, select.value);
    });
  });
}

// CAMBIAR ESTADO Y DEVOLVER STOCK SI SE CANCELA

function cambiarEstado(id, nuevoEstado) {
  const reserva = db.reservas.find(r => r.id === id);

  if (!reserva) return;

  if (reserva.estado === "Cancelada") {
    aviso("Una reserva cancelada no se puede reactivar.");
    mostrarTodasReservas();
    return;
  }

  if (nuevoEstado === "Cancelada") {
    reserva.productos.forEach(item => {
      const producto = db.productos.find(p => p.id === item.id);

      if (producto) producto.stock += item.cantidad;
    });
  }

  if (nuevoEstado === "Entregada" && reserva.estado !== "Entregada") reserva.fechaEntrega = new Date().toISOString();
  reserva.estado = nuevoEstado;

  guardar();
  actualizarAdministracion();

  aviso("Estado de reserva actualizado.");
}

// REGISTRAR GASTOS

$("expenseForm").addEventListener("submit", e => {
  e.preventDefault();

  const descripcion = $("expenseDescription").value.trim();
  const monto = Number($("expenseAmount").value);

  if (!descripcion || monto <= 0) {
    aviso("Introduce una descripción y un monto válido.");
    return;
  }

  db.gastos.unshift({
    descripcion,
    monto,
    fecha:new Date().toISOString()
  });

  guardar();
  $("expenseForm").reset();
  actualizarAdministracion();

  aviso("Gasto registrado correctamente.");
});

// TABULADORES DE ADMINISTRACIÓN

document.querySelectorAll("[data-panel]").forEach(b => {
  b.addEventListener("click", () => {
    document.querySelectorAll(".admin-tabs .tab")
      .forEach(x => x.classList.toggle("active", x === b));

    document.querySelectorAll(".admin-panel")
      .forEach(panel => panel.classList.toggle("hidden", panel.id !== b.dataset.panel));
  });
});

// CERRAR VENTANAS

document.querySelectorAll("[data-close]").forEach(b => {
  b.addEventListener("click", () => {
    $(b.dataset.close).classList.add("hidden");
  });
});

["cartModal","productModal"].forEach(id => {
  $(id).addEventListener("click", e => {
    if (e.target.id === id) $(id).classList.add("hidden");
  });
});

// INICIO

cambiarTab("client");

// ================= REPORTES DIARIOS Y EXPORTACIÓN XLSX =================
$("reportDate").value = fechaHoy();
$("reportDate").addEventListener("change", mostrarReportes);
function resumenDia(fecha) {
  const ventas = db.reservas.filter(r => ventaReal(r) && fechaLocal(r.fechaEntrega || r.fecha) === fecha);
  const gastos = db.gastos.filter(g=>fechaLocal(g.fecha)===fecha);
  const cantidades = new Map();
  for(const r of ventas) for(const p of r.productos) {
    const clave = p.nombre;
    cantidades.set(clave,(cantidades.get(clave)||0)+p.cantidad);
  }
  const ordenados = [...cantidades].sort((a,b)=>b[1]-a[1]);
  const ingresos = ventas.reduce((s,r)=>s+r.total,0);
  const costos = ventas.reduce((s,r)=>s+costoReserva(r),0);
  const gastoTotal = gastos.reduce((s,g)=>s+g.monto,0);
  return {ventas,gastos,cantidades,ingresos,costos,gastoTotal,ganancia:ingresos-costos-gastoTotal,
    unidades:[...cantidades.values()].reduce((a,b)=>a+b,0),top:ordenados.length?`${ordenados[0][0]} (${ordenados[0][1]} unidades)`:"Sin ventas entregadas"};
}
function mostrarReportes() {
  const fecha = $("reportDate").value || fechaHoy();
  const r = resumenDia(fecha);
  $("reportStock").textContent = db.productos.reduce((s,p)=>s+p.stock,0);
  $("reportUnits").textContent = r.unidades;
  $("reportIncome").textContent = dinero(r.ingresos);
  $("reportExpenses").textContent = dinero(r.gastoTotal);
  $("reportProfit").textContent = dinero(r.ganancia);
  const hora = iso => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? "--:--" : d.toLocaleTimeString("es-BO",{hour:"2-digit",minute:"2-digit"}); };
  $("reportDailyIncomeTable").innerHTML = r.ventas.length ? r.ventas.map(v => `<tr><td>${hora(v.fechaEntrega||v.fecha)}</td><td>${escapar(v.id)}</td><td>${escapar(v.cliente)}</td><td>${v.productos.map(p=>escapar(p.nombre)+" x"+p.cantidad).join(", ")}</td><td>${dinero(v.total)}</td></tr>`).join("") : '<tr><td colspan="5">No se registraron ingresos por ventas entregadas este día.</td></tr>';
  $("reportDailyExpenseTable").innerHTML = r.gastos.length ? r.gastos.map(g => `<tr><td>${hora(g.fecha)}</td><td>${escapar(g.descripcion)}</td><td>${dinero(g.monto)}</td></tr>`).join("") : '<tr><td colspan="3">No se registraron gastos este día.</td></tr>';
  $("reportTop").textContent = r.top;
  mostrarTablaCuatroColumnas();
  $("reportProductTable").innerHTML = db.productos.map(p=>`<tr><td>${escapar(p.nombre)}</td><td>${p.stock}</td><td>${dinero(p.costo||0)}</td><td>${dinero(p.precio)}</td><td>${r.cantidades.get(p.nombre)||0}</td></tr>`).join("") || '<tr><td colspan="5">Sin productos.</td></tr>';
}
// Tabla principal: cada fecha contiene ingresos, gastos y producto con mas unidades entregadas.
function filasResumenDiario() {
  const fechas = new Set();
  for (const pedido of db.reservas) if (ventaReal(pedido)) fechas.add(fechaLocal(pedido.fechaEntrega || pedido.fecha));
  for (const gasto of db.gastos) fechas.add(fechaLocal(gasto.fecha));
  fechas.add($("reportDate").value || fechaHoy());
  return [...fechas].filter(Boolean).sort((a,b)=>b.localeCompare(a)).map(fecha => {
    const r = resumenDia(fecha);
    return [fecha, r.ingresos, r.gastoTotal, r.top];
  });
}
function mostrarTablaCuatroColumnas() {
  const cuerpo = $("reportFourColTable");
  if (!cuerpo) return;
  cuerpo.innerHTML = filasResumenDiario().map((f,i)=>`<tr class="${i%2?'report-alt':''}"><td>${escapar(f[0])}</td><td>${dinero(f[1])}</td><td>${dinero(f[2])}</td><td>${escapar(f[3])}</td></tr>`).join("");
}
// XLSX mínimo: formato Office Open XML, ZIP sin compresión, compatible con Excel y MATLAB.
function crc32(bytes) {
  let crc=0xffffffff;
  for(const b of bytes){crc^=b;for(let k=0;k<8;k++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
  return (crc^0xffffffff)>>>0;
}
function zipArchivos(archivos) {
  const enc=new TextEncoder(), partes=[], central=[];let offset=0;
  const u16=n=>[n&255,(n>>>8)&255],u32=n=>[n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255];
  for(const [nombre,contenido] of archivos){
    const nb=enc.encode(nombre), data=enc.encode(contenido), crc=crc32(data);
    const local=new Uint8Array([...u32(0x04034b50),...u16(20),...u16(0),...u16(0),...u16(0),...u16(0),...u32(crc),...u32(data.length),...u32(data.length),...u16(nb.length),...u16(0),...nb]);
    partes.push(local,data);
    central.push(new Uint8Array([...u32(0x02014b50),...u16(20),...u16(20),...u16(0),...u16(0),...u16(0),...u16(0),...u32(crc),...u32(data.length),...u32(data.length),...u16(nb.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(offset),...nb]));
    offset+=local.length+data.length;
  }
  const centralSize=central.reduce((s,a)=>s+a.length,0), count=archivos.length;
  const fin=new Uint8Array([...u32(0x06054b50),...u16(0),...u16(0),...u16(count),...u16(count),...u32(centralSize),...u32(offset),...u16(0)]);
  return new Blob([...partes,...central,fin],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
}
function xmlEsc(s){return String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");}
function letraCol(n){let s="";for(n++;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;}
function hojaXML(filas, destacada=false){
  const rows=filas.map((fila,i)=>`<row r="${i+1}"${i===0?' ht="32" customHeight="1"':''}>${fila.map((v,k)=>{
    const celda=letraCol(k)+(i+1);
    const estilo= destacada ? (i===0?1:(k===1?3:(k===2?4:(i%2===0?2:5)))) : (i===0?1:(i%2===0?2:0));
    if(typeof v==="number" && Number.isFinite(v)) return `<c r="${celda}" s="${estilo}"><v>${v}</v></c>`;
    return `<c r="${celda}" s="${estilo}" t="inlineStr"><is><t>${xmlEsc(v)}</t></is></c>`;
  }).join("")}</row>`).join("");
  const columnas=destacada?'<cols><col min="1" max="1" width="19" customWidth="1"/><col min="2" max="3" width="23" customWidth="1"/><col min="4" max="4" width="48" customWidth="1"/></cols>':'';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>${columnas}<sheetData>${rows}</sheetData>${destacada?`<autoFilter ref="A1:D${Math.max(2,filas.length)}"/>`:''}</worksheet>`;
}
function estilosXML(){
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FF067565"/><name val="Calibri"/></font></fonts>
  <fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF17466A"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE6F4FA"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE6F5ED"/><bgColor indexed="64"/></patternFill></fill></fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="6"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="3" borderId="0" xfId="0" applyFill="1"/><xf numFmtId="2" fontId="2" fillId="4" borderId="0" xfId="0" applyFont="1" applyFill="1" applyNumberFormat="1"/><xf numFmtId="2" fontId="0" fillId="3" borderId="0" xfId="0" applyFill="1" applyNumberFormat="1"/><xf numFmtId="0" fontId="0" fillId="4" borderId="0" xfId="0" applyFill="1"/></cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
}
function crearExcel(hojas){
  const archivos=[], tipos=['<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'];
  const libros=[],relaciones=[];
  hojas.forEach(([nombre,filas],i)=>{const n=i+1;libros.push(`<sheet name="${xmlEsc(nombre)}" sheetId="${n}" r:id="rId${n}"/>`);relaciones.push(`<Relationship Id="rId${n}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${n}.xml"/>`);tipos.push(`<Override PartName="/xl/worksheets/sheet${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`);archivos.push([`xl/worksheets/sheet${n}.xml`,hojaXML(filas,i===0)]);});
  relaciones.push(`<Relationship Id="rId${hojas.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`);
  tipos.push('</Types>');
  archivos.push(['[Content_Types].xml',tipos.join('')]);
  archivos.push(['_rels/.rels','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>']);
  archivos.push(['xl/workbook.xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${libros.join('')}</sheets></workbook>`]);
  archivos.push(['xl/_rels/workbook.xml.rels',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relaciones.join('')}</Relationships>`]);
  archivos.push(['xl/styles.xml',estilosXML()]);
  return zipArchivos(archivos);
}
function descargarReporte() {
  if(usuarioActual?.tipo!=="dueña") return;
  const fecha = $("reportDate").value || fechaHoy();
  const r = resumenDia(fecha);
  const ingresosDia = [["Fecha","Hora","ID_reserva","Cliente","Productos","Ingreso_Bs","Costo_productos_Bs"]];
  const gastosDia = [["Fecha","Hora","Descripcion","Gasto_Bs"]];
  const movimientosDia = [["Fecha","Hora","Tipo","Descripcion","Ingreso_Bs","Gasto_Bs","Saldo_movimiento_Bs"]];
  const hora = iso => {const d=new Date(iso);return Number.isNaN(d.getTime())?"":d.toTimeString().slice(0,8);};
  for (const pedido of r.ventas) {
    const iso = pedido.fechaEntrega || pedido.fecha;
    const detalle = pedido.productos.map(p=>p.nombre+" x"+p.cantidad).join(", ");
    ingresosDia.push([fecha,hora(iso),pedido.id,pedido.cliente,detalle,pedido.total,costoReserva(pedido)]);
    movimientosDia.push([fecha,hora(iso),"Ingreso",pedido.id+" - "+pedido.cliente,pedido.total,0,pedido.total]);
  }
  for (const g of r.gastos) {
    gastosDia.push([fecha,hora(g.fecha),g.descripcion,g.monto]);
    movimientosDia.push([fecha,hora(g.fecha),"Gasto",g.descripcion,0,g.monto,-g.monto]);
  }
  movimientosDia.splice(1,movimientosDia.length-1,...movimientosDia.slice(1).sort((a,b)=>a[1].localeCompare(b[1])));
  ingresosDia.push(["TOTAL DEL DÍA","","","","",r.ingresos,r.costos]);
  gastosDia.push(["TOTAL DEL DÍA","","",r.gastoTotal]);
  movimientosDia.push(["TOTAL DEL DÍA","","","",r.ingresos,r.gastoTotal,r.ingresos-r.gastoTotal]);
  const resumen = [
    ["Fecha","Unidades_vendidas","Ingresos_del_dia_Bs","Gastos_del_dia_Bs","Saldo_caja_estimado_Bs","Costo_productos_vendidos_Bs","Ganancia_estimada_Bs","Producto_mas_vendido"],
    [fecha,r.unidades,r.ingresos,r.gastoTotal,r.ingresos-r.gastoTotal,r.costos,r.ganancia,r.top]
  ];
  const matlab = [
    ["Fecha","Unidades_vendidas","Ingresos_Bs","Gastos_Bs","Costo_productos_Bs","Saldo_caja_estimado_Bs","Ganancia_estimada_Bs"],
    [fecha,r.unidades,r.ingresos,r.gastoTotal,r.costos,r.ingresos-r.gastoTotal,r.ganancia]
  ];
  const inventario = [["ID","Producto","Stock_actual","Costo_unitario_Bs","Precio_venta_Bs","Valor_stock_Bs"],...db.productos.map(p=>[p.id,p.nombre,p.stock,Number(p.costo)||0,p.precio,p.stock*(Number(p.costo)||0)])];
  const ventasHistoricas = [["Fecha_entrega","ID_reserva","Cliente","Producto","Cantidad","Precio_unitario_Bs","Costo_unitario_Bs","Total_Bs","Costo_total_Bs","Estado","Metodo_pago"]];
  for(const pedido of db.reservas) for(const item of pedido.productos) ventasHistoricas.push([fechaLocal(pedido.fechaEntrega||pedido.fecha),pedido.id,pedido.cliente,item.nombre,item.cantidad,item.precio,Number(item.costo)||0,item.cantidad*item.precio,item.cantidad*(Number(item.costo)||0),pedido.estado,pedido.pago]);
  const gastosHistoricos = [["Fecha","Descripcion","Monto_Bs"],...db.gastos.map(g=>[fechaLocal(g.fecha),g.descripcion,g.monto])];
  const resumenPorFecha = [["Fecha","Ingresos del día (Bs)","Gastos del día (Bs)","Producto más vendido del día"], ...filasResumenDiario()];
  const blob=crearExcel([
    ["Resumen por dia",resumenPorFecha],
    ["Resumen diario",resumen],
    ["Ingresos del dia",ingresosDia],
    ["Gastos del dia",gastosDia],
    ["Movimientos del dia",movimientosDia],
    ["Inventario",inventario],
    ["Ventas historicas",ventasHistoricas],
    ["Gastos historicos",gastosHistoricos],
    ["Datos_MATLAB",matlab]
  ]);
  const url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download=`PagaYa_Ingresos_Gastos_${fecha}.xlsx`;
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
  aviso("Excel descargado: fecha, ingresos, gastos y producto mas vendido.");
}
$("downloadExcelBtn").addEventListener("click",descargarReporte);
