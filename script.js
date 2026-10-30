
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
}

// ESTADÍSTICAS CONTABLES

function mostrarEstadisticas() {
  const ventasHoy = db.reservas
    .filter(r => r.estado !== "Cancelada" && r.fecha.slice(0,10) === fechaHoy())
    .reduce((s,r) => s + r.total, 0);

  const ingresos = db.reservas
    .filter(r => r.estado !== "Cancelada" && r.fecha.slice(0,7) === mesActual())
    .reduce((s,r) => s + r.total, 0);

  const gastos = db.gastos
    .filter(g => g.fecha.slice(0,7) === mesActual())
    .reduce((s,g) => s + g.monto, 0);

  $("todaySales").textContent = dinero(ventasHoy);
  $("monthIncome").textContent = dinero(ingresos);
  $("monthExpenses").textContent = dinero(gastos);
  $("monthProfit").textContent = dinero(ingresos - gastos);
}

// INVENTARIO

function mostrarInventario() {
  $("inventoryTable").innerHTML = db.productos.length
    ? db.productos.map(p => `
      <tr>
        <td><strong>${escapar(p.nombre)}</strong></td>
        <td>${dinero(p.precio)}</td>
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
    stock:Number($("newProductStock").value),
    descripcion:$("newProductDescription").value.trim()
  };

  if (!nuevo.nombre || nuevo.precio <= 0 || nuevo.stock < 0) {
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
