document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("formLogin");
  const mensaje = document.getElementById("mensajeLogin");

  const pantalla = document.getElementById("pantallaBienvenida");
  document.getElementById("btnContinuar")?.addEventListener("click", () => {
    pantalla?.classList.add("modo-acceso");
    document.getElementById("codigo")?.focus();
  });
  document.getElementById("btnVolverBienvenida")?.addEventListener("click", () => {
    pantalla?.classList.remove("modo-acceso");
    if (mensaje) mensaje.textContent = "";
  });

  const modalCreadores = document.getElementById("modalCreadores");
  document.getElementById("btnVerCreadores")?.addEventListener("click", () => {
    if (modalCreadores) modalCreadores.hidden = false;
  });
  const cerrarCreadores = () => { if (modalCreadores) modalCreadores.hidden = true; };
  document.getElementById("btnCerrarCreadores")?.addEventListener("click", cerrarCreadores);
  modalCreadores?.addEventListener("click", (e) => { if (e.target === modalCreadores) cerrarCreadores(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") cerrarCreadores(); });

  form?.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const codigo = document.getElementById("codigo").value.trim();
    if (!codigo) return mostrarError("Ingresa tu código");

    try {
      const respuesta = await fetch("/api/auth/validar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo }),
      });
      const datos = await respuesta.json().catch(() => ({}));
      if (!respuesta.ok) return mostrarError(datos.motivo || "Código no válido.");

      if (datos.rol === "admin") {
        await guardarEnStore("sesion", {
          clave: "actual",
          rol: "admin",
          codigo: datos.codigo || "admin",
          nombre: datos.nombre || "Administrador",
          token: datos.token,
        });
        window.location.href = "resultados.html";
        return;
      }

      await guardarEnStore("sesion", {
        clave: "actual",
        rol: "estudiante",
        codigo: datos.codigo,
        nombre: datos.nombre || `Estudiante ${datos.codigo}`,
        grado: datos.grado || "",
        sede: datos.sede || "",
        token: datos.token,
      });
      await eliminarDeStore("votosLocales", datos.codigo);
      window.location.href = "votar.html";
    } catch (error) {
      console.error("Error en ingreso:", error);
      mostrarError("No se pudo validar el código en este momento.");
    }
  });

  function mostrarError(texto) {
    if (!mensaje) return;
    mensaje.textContent = texto;
    mensaje.className = "mensaje error";
  }
});
