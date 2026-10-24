// Lógica de la pantalla de votación: funciona con y sin internet
let sesionActual = null;
let candidatoSeleccionado = null;
let votacionTimeoutHandle = null;
let temporizadorInterval = null;
const VOTACION_DURACION_MS = 2 * 60 * 1000; // 2 minutos

function escaparHtml(texto) {
  const mapa = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return String(texto ?? "").replace(/[&<>"']/g, (caracter) => mapa[caracter] || caracter);
}

async function encabezadosEstudiante() {
  const sesion = sesionActual || (await obtenerDeStore("sesion", "actual"));
  const token = sesion?.token;
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

document.addEventListener("DOMContentLoaded", async () => {
  sesionActual = await obtenerDeStore("sesion", "actual");
  if (!sesionActual || sesionActual.rol !== "estudiante") {
    window.location.href = "index.html";
    return;
  }

  const ingresoTime = Date.now();
  votacionTimeoutHandle = setTimeout(async () => {
    console.log("Tiempo de votación agotado (2 min)");
    await eliminarDeStore("sesion", "actual");
    window.location.href = "index.html?timeout=1";
  }, VOTACION_DURACION_MS);

  // Iniciar temporizador visual
  iniciarTemporizador(ingresoTime);

  const nombre = sesionActual.nombre || `Estudiante ${sesionActual.codigo}`;
  const saludo = document.getElementById("saludo");
  if (saludo) {
    saludo.textContent = `Hola, ${nombre}. Bienvenido/a a las votaciones.`;
    saludo.style.display = "block";
  }

  await verificarEstadoVotaciones();
  await cargarCandidatos();
  await intentarSincronizarVotosPendientes();
  configurarModal();

  // Botón volver
  const btnVolver = document.getElementById("btnVolver");
  if (btnVolver) {
    btnVolver.addEventListener("click", () => {
      window.location.href = "index.html";
    });
  }

  setInterval(async () => {
    await verificarEstadoVotaciones();
    await cargarCandidatos();
  }, 15000);
});

async function verificarEstadoVotaciones() {
  try {
    const resp = await fetch("/api/estado");
    const data = await resp.json().catch(() => ({}));
    const abierto = data && data.abierto !== false;
    const gradosPermitidos = data && data.gradosPermitidos ? data.gradosPermitidos : [];
    const sedesPermitidas = data && data.sedesPermitidas ? data.sedesPermitidas : [];
    const contenedor = document.getElementById("listaCandidatos");
    const mensaje = document.getElementById("mensajeVoto");

    if (!abierto) {
      if (contenedor) contenedor.innerHTML = "";
      if (mensaje) {
        mensaje.textContent = "No es posible votar en este momento. Las votaciones están cerradas.";
        mensaje.className = "mensaje error";
      }
      return;
    }

    // Verificar si el grado del estudiante está permitido
    if (gradosPermitidos.length > 0 && sesionActual) {
      const gradoEstudiante = sesionActual.grado || "";
      if (gradoEstudiante && !gradosPermitidos.some((g) => String(g).toUpperCase() === String(gradoEstudiante).toUpperCase())) {
        if (contenedor) contenedor.innerHTML = "";
        if (mensaje) {
          mensaje.textContent = `Tu grado (${gradoEstudiante}) no está habilitado para votar en este momento. Grados permitidos: ${gradosPermitidos.join(", ")}.`;
          mensaje.className = "mensaje error";
        }
        return;
      }
    }

    // Verificar si la sede del estudiante está permitida
    if (sedesPermitidas.length > 0 && sesionActual) {
      const sedeEstudiante = sesionActual.sede || "";
      if (sedeEstudiante && !sedesPermitidas.some((s) => String(s).toUpperCase() === String(sedeEstudiante).toUpperCase())) {
        if (contenedor) contenedor.innerHTML = "";
        if (mensaje) {
          mensaje.textContent = `Tu sede (${sedeEstudiante}) no está habilitada para votar en este momento. Sedes permitidas: ${sedesPermitidas.join(", ")}.`;
          mensaje.className = "mensaje error";
        }
        return;
      }
    }
  } catch (e) {
    console.error("Error consultando estado de votaciones:", e);
  }
}

async function cargarCandidatos() {
  let candidatos = [];
  try {
    const respuesta = await fetch(`${URL_API}/candidatos`);
    if (!respuesta.ok) throw new Error("Error de red");
    candidatos = await respuesta.json();
    for (const c of candidatos) {
      try { await guardarEnStore("candidatos", c); } catch (e) {}
    }
  } catch (error) {
    candidatos = await obtenerTodoDeStore("candidatos");
  }

  if (!candidatos.length) {
    const contenedor = document.getElementById("listaCandidatos");
    if (contenedor) contenedor.innerHTML = "<p>No hay candidatos disponibles en este momento.</p>";
    return;
  }

  renderizarCandidatos(candidatos);
}

const COLORES_AVATAR = ["#2563eb", "#16a34a", "#f59e0b", "#dc2626", "#7c3aed", "#0891b2"];

function iniciarTemporizador(inicio) {
  const contenedor = document.getElementById("temporizadorVotacion");
  const tiempoElemento = document.getElementById("tiempoRestante");
  if (!contenedor || !tiempoElemento) return;

  contenedor.classList.remove("oculto");

  function actualizar() {
    const transcurrido = Date.now() - inicio;
    const restante = VOTACION_DURACION_MS - transcurrido;

    if (restante <= 0) {
      tiempoElemento.textContent = "00:00";
      tiempoElemento.style.color = "#ef4444";
      contenedor.classList.add("urgente");
      if (temporizadorInterval) clearInterval(temporizadorInterval);
      return;
    }

    const minutos = Math.floor(restante / 60000);
    const segundos = Math.floor((restante % 60000) / 1000);
    tiempoElemento.textContent = `${minutos.toString().padStart(2, "0")}:${segundos.toString().padStart(2, "0")}`;

    // Cambiar color cuando quede menos de 30 segundos
    if (restante < 30000) {
      tiempoElemento.style.color = "#ef4444";
      contenedor.classList.add("urgente");
    } else if (restante < 60000) {
      tiempoElemento.style.color = "#f59e0b";
    }
  }

  actualizar();
  temporizadorInterval = setInterval(actualizar, 1000);
}

function iniciales(nombre) {
  return nombre
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((palabra) => palabra[0].toUpperCase())
    .join("");
}

function resolverRutaImagen(imagen) {
  if (!imagen) return "icons/logo.ico";

  const valor = String(imagen).trim();
  if (!valor) return "icons/logo.ico";
  if (/^data:image\//i.test(valor)) return valor;
  if (/^(https?:)?\/\//i.test(valor)) return valor;

  const normalizada = valor.replace(/^\.\//, "").replace(/^frontend\//, "");
  if (normalizada.startsWith("icons/")) return normalizada;
  if (normalizada.startsWith("/")) return normalizada.slice(1);

  return `icons/${normalizada}`;
}

// Helper para crear img con fallback robusto
function crearImgConFallback(src, alt, className = "foto-candidato", extraOnError = "") {
  const fallback = "icons/logo.ico";
  const onError = `this.onerror=null; this.src='${fallback}'; ${extraOnError}`;
  return `<img src="${src}" alt="${alt}" class="${className}" onerror="${onError}" />`;
}

function renderizarCandidatos(candidatos) {
  const contenedor = document.getElementById("listaCandidatos");
  contenedor.innerHTML = "";

  if (!candidatos.length) {
    contenedor.innerHTML = "<p>No hay candidatos disponibles todavía.</p>";
    return;
  }

  // Ordenar: "Voto en blanco" siempre al final
  const candidatosOrdenados = [...candidatos].sort((a, b) => {
    const aEsBlanco = a.nombre.toLowerCase() === "voto en blanco";
    const bEsBlanco = b.nombre.toLowerCase() === "voto en blanco";
    if (aEsBlanco && !bEsBlanco) return 1;
    if (!aEsBlanco && bEsBlanco) return -1;
    return 0;
  });

  candidatosOrdenados.forEach((candidato, indice) => {
    const color = COLORES_AVATAR[indice % COLORES_AVATAR.length];
    const rutaImagen = resolverRutaImagen(candidato.imagen);
    const esVotoEnBlanco = candidato.nombre.toLowerCase() === "voto en blanco";
    const nombreMostrar = esVotoEnBlanco ? "VOTO EN BLANCO" : candidato.nombre.toUpperCase();
    
    // Usar imagen personalizada para Voto en blanco si existe, sino símbolo ☐
    let contenidoAvatar;
    if (esVotoEnBlanco) {
      const imgBlanco = candidato.imagen
        ? rutaImagen
        : "icons/candidatos/Voto-en-blanco.jpg";
      contenidoAvatar = `${crearImgConFallback(imgBlanco, "VOTO EN BLANCO", "foto-candidato", "this.nextElementSibling.style.display='flex';")}<span class="icono-voto-blanco" aria-label="VOTO EN BLANCO" style="display:none;">☐</span>`;
    } else {
      contenidoAvatar = crearImgConFallback(rutaImagen, escaparHtml(nombreMostrar));
    }
    
    const tarjeta = document.createElement("div");
    tarjeta.className = "tarjeta-candidato";
    tarjeta.innerHTML = `
      <div class="info-candidato">
        <div class="avatar-candidato" style="background:${color}">
          ${contenidoAvatar}
        </div>
        <div class="texto-candidato">
          <h3>${escaparHtml(nombreMostrar)}</h3>
          ${!esVotoEnBlanco ? `<p class="lista">${escaparHtml(candidato.lista)}</p>` : ""}
          <p>${escaparHtml(candidato.cargo)}</p>
          ${!esVotoEnBlanco ? `<p>${escaparHtml(candidato.propuesta)}</p>` : ""}
        </div>
      </div>
      <button class="boton" data-id="${escaparHtml(candidato.id)}">Votar</button>
    `;
    tarjeta
      .querySelector("button[data-id]")
      .addEventListener("click", () => abrirConfirmacion(candidato));
    contenedor.appendChild(tarjeta);
  });
}

function abrirConfirmacion(candidato) {
  candidatoSeleccionado = candidato;
  const nombre = sesionActual?.nombre || `Estudiante ${sesionActual?.codigo || ""}`;
  const esVotoEnBlanco = candidato.nombre.toLowerCase() === "voto en blanco";
  const nombreMostrar = esVotoEnBlanco ? "VOTO EN BLANCO" : candidato.nombre.toUpperCase();
  const listaTexto = esVotoEnBlanco ? "" : ` (${candidato.lista})`;
  document.getElementById("modalTexto").textContent =
    `Hola, ${nombre}. Bienvenido(a) a las votaciones a personería. ¿Confirmas tu voto para ${nombreMostrar}${listaTexto}? Esta acción no se puede deshacer.`;
  document.getElementById("modalConfirmacion").classList.remove("oculto");
}

function configurarModal() {
  document.getElementById("btnCancelar").addEventListener("click", () => {
    candidatoSeleccionado = null;
    document.getElementById("modalConfirmacion").classList.add("oculto");
  });

  document
    .getElementById("btnConfirmar")
    .addEventListener("click", registrarVoto);
}

// Limpiar temporizador al salir de la página
window.addEventListener("beforeunload", () => {
  if (temporizadorInterval) clearInterval(temporizadorInterval);
  if (votacionTimeoutHandle) clearTimeout(votacionTimeoutHandle);
});

async function registrarVoto() {
  const mensaje = document.getElementById("mensajeVoto");
  document.getElementById("modalConfirmacion").classList.add("oculto");

  if (!candidatoSeleccionado) {
    mensaje.textContent = "Selecciona un candidato antes de confirmar.";
    mensaje.className = "mensaje error";
    return;
  }

  const votoLocalPrevio = await obtenerDeStore(
    "votosLocales",
    sesionActual.codigo
  );
  if (votoLocalPrevio && votoLocalPrevio.cargo === candidatoSeleccionado.cargo) {
    mensaje.textContent = `Ya registraste tu voto para el cargo "${candidatoSeleccionado.cargo}". Si crees que es un error, usa "Limpiar datos locales" en la pantalla de inicio.`;
    mensaje.className = "mensaje error";
    console.log("Bloqueado por voto local:", votoLocalPrevio, "sesion:", sesionActual);
    return;
  }

  const voto = {
    estudianteId: sesionActual.codigo,
    candidatoId: candidatoSeleccionado.id,
    cargo: candidatoSeleccionado.cargo,
  };

  if (navigator.onLine) {
    try {
      const respuesta = await fetch(`${URL_API}/votos`, {
        method: "POST",
        headers: await encabezadosEstudiante(),
        body: JSON.stringify(voto),
      });
      const datos = await respuesta.json().catch(() => ({}));

      if (!respuesta.ok) {
        if (respuesta.status === 400 || respuesta.status === 409) {
          mensaje.textContent = datos.motivo || "No se pudo registrar tu voto.";
          mensaje.className = "mensaje error";
          return;
        }
        throw new Error(datos.motivo || "Error al votar");
      }

      await marcarVotoLocal(voto);
      mostrarExito(mensaje);
      return;
    } catch (error) {
      // Si falla la red a mitad de camino, cae a modo offline
    }
  }

  await guardarEnStore("votosPendientes", {
    localId: `local_${Date.now()}`,
    ...voto,
  });
  await marcarVotoLocal(voto);
  if (votacionTimeoutHandle) clearTimeout(votacionTimeoutHandle);
  mensaje.textContent =
    "Sin conexión: tu voto se guardó en este dispositivo y se enviará automáticamente cuando haya internet.";
  mensaje.className = "mensaje exito";
}

async function marcarVotoLocal(voto) {
  await guardarEnStore("votosLocales", {
    estudianteId: voto.estudianteId,
    candidatoId: voto.candidatoId,
    cargo: voto.cargo,
  });
  document.getElementById("listaCandidatos").innerHTML =
    "<p>Ya has registrado tu voto. ¡Gracias por participar!</p>";
}

function mostrarExito(mensaje) {
  mensaje.textContent = "Gracias por participar en las votaciones.";
  mensaje.className = "mensaje exito";

  if (votacionTimeoutHandle) clearTimeout(votacionTimeoutHandle);

  setTimeout(async () => {
    await eliminarDeStore("sesion", "actual");
    await eliminarDeStore("votosPendientes", "all");
    window.location.href = "index.html";
  }, 1400);
}

async function intentarSincronizarVotosPendientes() {
  if (!navigator.onLine) return;
  const pendientes = await obtenerTodoDeStore("votosPendientes");
  if (!pendientes.length) return;

  try {
    const respuesta = await fetch(`${URL_API}/votos/sync`, {
      method: "POST",
      headers: await encabezadosEstudiante(),
      body: JSON.stringify({ votos: pendientes }),
    });
    if (!respuesta.ok) return;

    const datos = await respuesta.json().catch(() => null);
    if (!datos || !Array.isArray(datos.resultados)) return;

    for (const resultado of datos.resultados) {
      if (resultado.ok) {
        await eliminarDeStore("votosPendientes", resultado.localId);
      }
    }
  } catch (error) {
    // Se reintentará en la próxima carga de la página
  }
}
