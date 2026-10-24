// Muestra resultados en vivo si hay internet, o el último resultado guardado si no hay
const COLORES = ["#2563eb", "#16a34a", "#f59e0b", "#dc2626", "#7c3aed", "#0891b2"];
const MEDALLAS = ["🥇", "🥈", "🥉"];

function escaparHtml(texto) {
  const mapa = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return String(texto ?? "").replace(/[&<>"']/g, (caracter) => mapa[caracter] || caracter);
}

function resolverRutaImagen(imagen) {
  if (!imagen) return "icons/logo.ico";

  const valor = String(imagen).trim();
  if (!valor) return "icons/logo.ico";
  if (/^(https?:)?\/\//i.test(valor)) return valor;

  const normalizada = valor.replace(/^\.\//, "").replace(/^frontend\//, "");
  if (normalizada.startsWith("icons/")) return normalizada;
  if (normalizada.startsWith("/")) return normalizada.slice(1);

  return `icons/${normalizada}`;
}

document.addEventListener("DOMContentLoaded", async () => {
  const sesion = await obtenerDeStore("sesion", "actual");
  if (!sesion || sesion.rol !== "admin") {
    window.location.href = "index.html";
    return;
  }

  const botonReiniciar = document.getElementById("btnReiniciar");
  const botonCerrarSesion = document.getElementById("btnCerrarSesion");
  const formCandidato = document.getElementById("formCandidato");
  const botonLimpiar = document.getElementById("btnLimpiarForm");
  const botonExportar = document.getElementById("btnExportarCandidatos");
  const botonNuevo = document.getElementById("btnNuevoCandidato");
  const imagenArchivo = document.getElementById("imagenArchivo");
  const imagenRuta = document.getElementById("imagenCandidato");
  const pestanas = document.querySelectorAll("[data-pestana]");
  const botonExportarVotos = document.getElementById("btnExportarVotos");

  if (botonReiniciar) {
    botonReiniciar.addEventListener("click", reiniciarVotaciones);
  }

  if (botonCerrarSesion) {
    botonCerrarSesion.addEventListener("click", async () => {
      await eliminarDeStore("sesion", "actual");
      await eliminarDeStore("candidatos", "all");
      await eliminarDeStore("resultadosCache", "all");
      await eliminarDeStore("votosPendientes", "all");
      await eliminarDeStore("votosLocales", "all");
      window.location.href = "index.html";
    });
  }

  if (formCandidato) {
    formCandidato.addEventListener("submit", guardarCandidato);
  }

  if (botonLimpiar) {
    botonLimpiar.addEventListener("click", limpiarFormularioCandidato);
  }

  if (botonExportar) {
    botonExportar.addEventListener("click", exportarCandidatos);
  }
  botonExportarVotos?.addEventListener("click", exportarVotos);

  botonNuevo?.addEventListener("click", () => {
    cambiarPestana("candidatos");
    limpiarFormularioCandidato();
    document.getElementById("nombreCandidato")?.focus();
  });
  imagenArchivo?.addEventListener("change", cargarFotoDesdeEquipo);
  imagenRuta?.addEventListener("input", () => mostrarVistaPrevia(imagenRuta.value.trim()));
  pestanas.forEach((pestana) => {
    pestana.addEventListener("click", () => cambiarPestana(pestana.dataset.pestana));
  });

  const tiempoLimite = setTimeout(() => {
    const contenedor = document.getElementById("listaResultados");
    const texto = contenedor?.textContent || "";
    if (/Cargando|Esperando resultados/.test(texto)) {
      contenedor.innerHTML = "<p>No se pudieron cargar los resultados. Revisa tu conexión o inicia sesión nuevamente.</p>";
    }
    const info = document.getElementById("infoSincronizacion");
    const infoTexto = info?.textContent || "";
    if (/Verificando|Sin conexión/.test(infoTexto)) {
      info.textContent = "No se pudo conectar con el servidor.";
      info.className = "mensaje error";
    }
  }, 12000);

  try {
    await cargarResultados();
    await cargarCandidatosAdmin();
  } catch (error) {
    console.error("Error al iniciar panel:", error);
    const contenedor = document.getElementById("listaResultados");
    if (contenedor) contenedor.innerHTML = `<p>Error al cargar el panel: ${error.message}</p>`;
  } finally {
    clearTimeout(tiempoLimite);
  }
});

async function encabezadosAdmin(incluirContenido = false) {
  const sesion = await obtenerDeStore("sesion", "actual");
  const encabezados = { Authorization: `Bearer ${sesion?.token || ""}` };
  if (incluirContenido) encabezados["Content-Type"] = "application/json";
  return encabezados;
}

function mostrarMensaje(texto, tipo = "exito") {
  const info = document.getElementById("infoSincronizacion");
  if (!info) return;
  info.textContent = texto;
  info.className = `mensaje ${tipo}`;
}

function cambiarPestana(nombre) {
  const verCandidatos = nombre === "candidatos";
  document.getElementById("seccionCandidatos")?.classList.toggle("oculto", !verCandidatos);
  document.getElementById("seccionVotaciones")?.classList.toggle("oculto", verCandidatos);
  document.querySelectorAll("[data-pestana]").forEach((pestana) => {
    pestana.classList.toggle("activa", pestana.dataset.pestana === nombre);
  });
}

function mostrarVistaPrevia(origen) {
  const imagen = document.getElementById("previewImagenCandidato");
  const texto = document.getElementById("sinPreviewImagen");
  if (!imagen || !texto) return;
  if (!origen) {
    imagen.hidden = true;
    imagen.removeAttribute("src");
    texto.hidden = false;
    return;
  }
  imagen.src = origen;
  imagen.hidden = false;
  texto.hidden = true;
}

function cargarFotoDesdeEquipo(evento) {
  const archivo = evento.target.files?.[0];
  if (!archivo) return;
  if (!archivo.type.startsWith("image/")) {
    mostrarMensaje("Selecciona un archivo de imagen válido.", "error");
    evento.target.value = "";
    return;
  }
  const lector = new FileReader();
  lector.addEventListener("load", () => {
    document.getElementById("imagenCandidato").value = lector.result;
    mostrarVistaPrevia(lector.result);
  });
  lector.readAsDataURL(archivo);
}

async function reiniciarVotaciones() {
  const confirmar = window.confirm(
    "¿Seguro que quieres reiniciar todas las votaciones? Esto borrará el registro de votos."
  );

  if (!confirmar) return;

  const info = document.getElementById("infoSincronizacion");

  try {
    const respuesta = await fetch("/api/votos/reset", {
      method: "POST",
      headers: await encabezadosAdmin(true),
    });
    const datos = await respuesta.json().catch(() => ({}));

    if (!respuesta.ok) {
      throw new Error(datos.motivo || "No se pudo reiniciar las votaciones.");
    }

    await limpiarVotosLocales();
    await cargarResultados();
    mostrarMensaje(datos.motivo || "Las votaciones fueron reiniciadas correctamente.");
  } catch (error) {
    mostrarMensaje(error.message || "No se pudo reiniciar las votaciones.", "error");
  }
}

async function limpiarVotosLocales() {
  const [votosLocales, votosPendientes, resultadosCache] = await Promise.all([
    obtenerTodoDeStore("votosLocales"),
    obtenerTodoDeStore("votosPendientes"),
    obtenerTodoDeStore("resultadosCache"),
  ]);

  await Promise.all([
    ...votosLocales.map((voto) => eliminarDeStore("votosLocales", voto.estudianteId)),
    ...votosPendientes.map((voto) => eliminarDeStore("votosPendientes", voto.localId)),
    ...resultadosCache.map((resultado) => eliminarDeStore("resultadosCache", resultado.id)),
  ]);
}

async function cargarCandidatosAdmin() {
  try {
    const respuesta = await fetch("/api/candidatos");
    if (!respuesta.ok) throw new Error("Error de red");
    const candidatos = await respuesta.json();
    renderizarCandidatosAdmin(candidatos);
  } catch (error) {
    renderizarCandidatosAdmin([]);
  }
}

function renderizarCandidatosAdmin(candidatos) {
  const contenedor = document.getElementById("listaCandidatosAdmin");
  if (!contenedor) return;
  contenedor.innerHTML = "";

  if (!candidatos.length) {
    contenedor.innerHTML = "<p>No hay candidatos registrados.</p>";
    return;
  }

  candidatos.forEach((candidato) => {
    const item = document.createElement("div");
    item.className = "item-admin";
    item.innerHTML = `
      <div class="admin-candidato-info">
        <img class="admin-foto-candidato" src="${escaparHtml(candidato.imagen) || "icons/logo.ico"}" alt="Foto de ${escaparHtml(candidato.nombre)}" onerror="this.src='icons/logo.ico'" />
        <div>
        <strong>${escaparHtml(candidato.nombre)}</strong><br />
        <small>${escaparHtml(candidato.lista)} · ${escaparHtml(candidato.cargo)}</small>
        </div>
      </div>
      <div class="acciones-admin">
        <button type="button" class="boton secundario" data-editar="${escaparHtml(candidato.id)}">Editar</button>
        <button type="button" class="boton boton-peligro" data-borrar="${escaparHtml(candidato.id)}">Eliminar</button>
      </div>
    `;
    contenedor.appendChild(item);
  });

  contenedor.querySelectorAll("[data-editar]").forEach((boton) => {
    boton.addEventListener("click", () => cargarCandidatoParaEditar(boton.dataset.editar));
  });

  contenedor.querySelectorAll("[data-borrar]").forEach((boton) => {
    boton.addEventListener("click", () => borrarCandidato(boton.dataset.borrar));
  });
}

async function guardarCandidato(evento) {
  evento.preventDefault();
  const id = document.getElementById("candidatoId").value;
  const payload = {
    nombre: document.getElementById("nombreCandidato").value.trim(),
    lista: document.getElementById("listaCandidato").value.trim(),
    cargo: document.getElementById("cargoCandidato").value.trim(),
    propuesta: document.getElementById("propuestaCandidato").value.trim(),
    imagen: document.getElementById("imagenCandidato").value.trim(),
    inspiracion: document.getElementById("inspiracionCandidato").value.trim(),
  };

  const metodo = id ? "PUT" : "POST";
  const url = id ? `/api/candidatos/${id}` : "/api/candidatos";

  try {
    const respuesta = await fetch(url, {
      method: metodo,
      headers: await encabezadosAdmin(true),
      body: JSON.stringify(payload),
    });
    const datos = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok) throw new Error(datos.motivo || "No se pudo guardar el candidato");
    limpiarFormularioCandidato();
    await Promise.all([cargarCandidatosAdmin(), cargarResultados()]);
    mostrarMensaje(id ? "Candidato actualizado correctamente." : "Candidato agregado correctamente.");
  } catch (error) {
    mostrarMensaje(error.message || "No se pudo guardar el candidato", "error");
  }
}

async function cargarCandidatoParaEditar(id) {
  try {
    const respuesta = await fetch(`/api/candidatos/${id}`);
    if (!respuesta.ok) throw new Error("Error");
    const candidato = await respuesta.json();
    if (!candidato) return;
    cambiarPestana("candidatos");
    document.getElementById("candidatoId").value = candidato.id;
    document.getElementById("nombreCandidato").value = candidato.nombre || "";
    document.getElementById("listaCandidato").value = candidato.lista || "";
    document.getElementById("cargoCandidato").value = candidato.cargo || "";
    document.getElementById("propuestaCandidato").value = candidato.propuesta || "";
    document.getElementById("imagenCandidato").value = candidato.imagen || "";
    document.getElementById("inspiracionCandidato").value = candidato.inspiracion || "";
    document.getElementById("imagenArchivo").value = "";
    mostrarVistaPrevia(candidato.imagen || "");
    document.getElementById("btnGuardarCandidato").textContent = "Guardar cambios";
    document.getElementById("nombreCandidato").scrollIntoView({ behavior: "smooth", block: "center" });
    document.getElementById("nombreCandidato").focus();
  } catch (error) {
    window.alert("No se pudo cargar el candidato");
  }
}

function limpiarFormularioCandidato() {
  document.getElementById("candidatoId").value = "";
  document.getElementById("nombreCandidato").value = "";
  document.getElementById("listaCandidato").value = "";
  document.getElementById("cargoCandidato").value = "";
  document.getElementById("propuestaCandidato").value = "";
  document.getElementById("imagenCandidato").value = "";
  document.getElementById("imagenArchivo").value = "";
  document.getElementById("inspiracionCandidato").value = "";
  document.getElementById("btnGuardarCandidato").textContent = "Guardar candidato";
  mostrarVistaPrevia("");
}

async function borrarCandidato(id) {
  const confirmar = window.confirm("¿Deseas borrar este candidato?");
  if (!confirmar) return;
  try {
    const respuesta = await fetch(`/api/candidatos/${id}`, {
      method: "DELETE",
      headers: await encabezadosAdmin(),
    });
    const datos = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok) throw new Error(datos.motivo || "No se pudo borrar");
    await Promise.all([cargarCandidatosAdmin(), cargarResultados()]);
    mostrarMensaje("Candidato eliminado correctamente.");
  } catch (error) {
    mostrarMensaje(error.message || "No se pudo borrar el candidato", "error");
  }
}

async function exportarCandidatos() {
  try {
    const respuesta = await fetch("/api/candidatos/exportar", {
      headers: await encabezadosAdmin(),
    });
    if (!respuesta.ok) throw new Error("No se pudo descargar el archivo");
    const archivo = await respuesta.blob();
    const enlace = document.createElement("a");
    enlace.href = URL.createObjectURL(archivo);
    enlace.download = "candidatos.json";
    enlace.click();
    URL.revokeObjectURL(enlace.href);
    mostrarMensaje("Archivo de candidatos descargado.");
  } catch (error) {
    mostrarMensaje(error.message || "No se pudo descargar el archivo", "error");
  }
}

async function exportarVotos() {
  try {
    const respuesta = await fetch("/api/votos/exportar", {
      headers: await encabezadosAdmin(),
    });
    if (!respuesta.ok) throw new Error("No se pudieron descargar los registros");
    const archivo = await respuesta.blob();
    const enlace = document.createElement("a");
    enlace.href = URL.createObjectURL(archivo);
    enlace.download = "registros-votacion.csv";
    enlace.click();
    URL.revokeObjectURL(enlace.href);
    mostrarMensaje("Registros de votación descargados.");
  } catch (error) {
    mostrarMensaje(error.message || "No se pudieron descargar los registros", "error");
  }
}

async function cargarResultados() {
  const info = document.getElementById("infoSincronizacion");
  let resultados = [];

  try {
    const respuesta = await fetch("/api/votos/resultados", {
      headers: await encabezadosAdmin(),
    });
    if (!respuesta.ok) throw new Error("Error de red");
    resultados = await respuesta.json();
    for (const r of resultados) {
      await guardarEnStore("resultadosCache", r);
    }
    info.textContent = "Resultados actualizados en tiempo real.";
  } catch (error) {
    try {
      resultados = await obtenerTodoDeStore("resultadosCache");
    } catch (e) {
      resultados = [];
    }
    info.textContent =
      "Sin conexión: mostrando el último resultado guardado en este dispositivo.";
  }

  try {
    renderizarResultados(resultados);
  } catch (error) {
    console.error("Error al renderizar resultados:", error);
    const contenedor = document.getElementById("listaResultados");
    if (contenedor) contenedor.innerHTML = `<p>Error al mostrar resultados: ${error.message}</p>`;
  }
}

function renderizarResultados(resultados) {
  const contenedor = document.getElementById("listaResultados");
  contenedor.innerHTML = "";

  const totalVotos = resultados.reduce((sum, r) => sum + (r.votos || 0), 0);
  animarNumero(document.getElementById("totalVotosNumero"), totalVotos);

  if (!resultados.length) {
    contenedor.innerHTML = "<p>Todavía no hay resultados disponibles.</p>";
    const seccionGrafica = document.getElementById("seccionGrafica");
    if (seccionGrafica) seccionGrafica.innerHTML = "<p class=\"texto-grafica-vacia\">Aún no hay votos registrados.</p>";
    return;
  }

  const ordenados = resultados
    .slice()
    .sort((a, b) =>
      String(a.cargo || "").localeCompare(String(b.cargo || "")) ||
      (b.votos || 0) - (a.votos || 0)
    );

  const puestosCalculados = new Map();
  const porCargo = new Map();

  ordenados.forEach((candidato) => {
    const cargo = candidato.cargo || "Sin cargo";
    if (!porCargo.has(cargo)) porCargo.set(cargo, []);
    porCargo.get(cargo).push(candidato);
  });

  porCargo.forEach((lista) => {
    const candidatosOrdenados = [...lista].sort((a, b) => (b.votos || 0) - (a.votos || 0));})

    const info = candidatosOrdenados.map((candidato, indice) => {
      const votos = candidato.votos || 0;
      const medalla = votos > 0 ? MEDALLAS[indice] || "" : "";
      const esPrimero = indice === 0;
      let textoPuesto = "";

      if (!votos) {
        textoPuesto = "";
      } else if (esPrimero) {
        textoPuesto = "1er puesto";
      } else {
        const candidatosEnMismoPuesto = candidatosOrdenados.filter(
          (c) => (c.votos || 0) === votos
        );
        const hayEmpateEnPuesto = candidatosEnMismoPuesto.length > 1;
        if (hayEmpateEnPuesto) {
          textoPuesto = "Empate";
        } else {
        const puestoBase = indice + 1;
        textoPuesto = puestoBase === 1 ? "1er puesto" : puestoBase === 2 ? "2do puesto" : "3er puesto";
        }
      }

      return { candidato, medalla, textoPuesto, votos };
    });

    info.forEach((item) => {
      puestosCalculados.set(item.candidato.id, item);
    });
  }

  const usados = new Set();