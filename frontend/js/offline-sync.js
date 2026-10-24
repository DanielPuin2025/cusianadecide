async function intentarSincronizarVotosPendientes() {
  if (!navigator.onLine) return { sincronizados: 0, pendientes: null };

  const pendientes = await obtenerTodoDeStore("votosPendientes");
  if (!pendientes.length) {
    actualizarExportacionOffline(0);
    return { sincronizados: 0, pendientes: 0 };
  }

  const sesion = await obtenerDeStore("sesion", "actual");
  if (sesion?.rol !== "admin" || !sesion.token) {
    actualizarExportacionOffline(pendientes.length);
    actualizarEstadoSincronizacion(0, pendientes.length, "Inicia sesión como administrador para enviar los votos al servidor.");
    return { sincronizados: 0, pendientes: pendientes.length };
  }

  try {
    const respuesta = await fetch("/api/votos/sync-offline", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sesion.token}`,
      },
      body: JSON.stringify({ votos: pendientes }),
    });
    const datos = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok || !Array.isArray(datos.resultados)) {
      throw new Error(datos.motivo || datos.mensaje || "No se pudieron sincronizar los votos pendientes.");
    }

    let sincronizados = 0;
    for (const resultado of datos.resultados) {
      if (resultado.ok) {
        await eliminarDeStore("votosPendientes", resultado.localId);
        sincronizados++;
      } else {
        console.error(`Voto pendiente ${resultado.localId || ""} no sincronizado: ${resultado.motivo || "Error desconocido"}`);
      }
    }

    const restantes = await obtenerTodoDeStore("votosPendientes");
    actualizarExportacionOffline(restantes.length);
    actualizarEstadoSincronizacion(sincronizados, restantes.length);
    return { sincronizados, pendientes: restantes.length };
  } catch (error) {
    console.error("No fue posible sincronizar votos pendientes:", error);
    actualizarExportacionOffline(pendientes.length);
    actualizarEstadoSincronizacion(0, pendientes.length, error.message);
    return { sincronizados: 0, pendientes: pendientes.length };
  }
}

function actualizarEstadoSincronizacion(sincronizados, pendientes, error = "") {
  const estado = document.getElementById("estadoVotosOffline");
  if (!estado) return;
  if (error) {
    estado.textContent = `Hay ${pendientes} voto(s) pendiente(s). ${error}`;
  } else if (sincronizados > 0) {
    estado.textContent = pendientes
      ? `${sincronizados} voto(s) sincronizado(s). Quedan ${pendientes} pendiente(s).`
      : `${sincronizados} voto(s) sincronizado(s) correctamente.`;
  } else if (pendientes > 0 && navigator.onLine) {
    estado.textContent = `Hay ${pendientes} voto(s) pendiente(s) por resolver. Descarga el respaldo si es necesario.`;
  }
}

async function actualizarExportacionOffline(total) {
  const boton = document.getElementById("btnExportarVotosLocales");
  const estado = document.getElementById("estadoVotosOffline");
  if (boton) boton.hidden = total === 0;
  if (estado && total === 0 && !estado.textContent.includes("sincronizado")) {
    estado.textContent = "";
  }
}

async function exportarVotosLocales() {
  const votos = await obtenerTodoDeStore("votosPendientes");
  if (!votos.length) {
    actualizarExportacionOffline(0);
    return;
  }

  const escapar = (valor) => {
    let texto = String(valor ?? "").replace(/\r?\n/g, " ");
    if (/^[\t=+\-@]/.test(texto)) texto = `'${texto}`;
    return `"${texto.replace(/"/g, '""')}"`;
  };
  const filas = [
    ["ID local", "Fecha y hora", "Código estudiante", "ID candidato", "Candidato", "Cargo"],
    ...votos.map((voto) => [
      voto.localId,
      voto.creadoEn,
      voto.estudianteId,
      voto.candidatoId,
      voto.candidatoNombre,
      voto.cargo,
    ]),
  ];
  const csv = `\uFEFF${filas.map((fila) => fila.map(escapar).join(";")).join("\r\n")}`;
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = `votos-pendientes-${new Date().toISOString().slice(0, 10)}.csv`;
  enlace.click();
  URL.revokeObjectURL(url);
}

document.addEventListener("DOMContentLoaded", async () => {
  const pendientes = await obtenerTodoDeStore("votosPendientes");
  actualizarExportacionOffline(pendientes.length);
  document.getElementById("btnExportarVotosLocales")?.addEventListener("click", exportarVotosLocales);
  if (navigator.onLine) await intentarSincronizarVotosPendientes();
});

window.addEventListener("online", intentarSincronizarVotosPendientes);
