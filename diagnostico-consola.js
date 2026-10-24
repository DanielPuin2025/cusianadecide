// Script de diagnóstico para el panel de administración
// Pega este código en la consola del navegador (F12) cuando estés en el panel de resultados

console.clear();
console.log("=== DIAGNÓSTICO COMPLETO - CUSIANA DECIDE ===\n");

// 1. Verificar que las funciones existen
console.log("1. Verificando funciones...");
console.log("   - obtenerDeStore:", typeof obtenerDeStore);
console.log("   - encabezadosAdmin:", typeof encabezadosAdmin);
console.log("   - fetch:", typeof fetch);

// 2. Verificar sesión actual
(async () => {
  try {
    console.log("\n2. Verificando sesión...");
    const sesion = await obtenerDeStore("sesion", "actual");

    if (!sesion) {
      console.error("   ❌ No hay sesión guardada");
      console.log("\n   SOLUCIÓN: Cierra sesión y vuelve a ingresar con código 202616");
      return;
    }

    console.log("   ✅ Sesión encontrada");
    console.log("   - Rol:", sesion.rol);
    console.log("   - Código:", sesion.codigo);
    console.log("   - Nombre:", sesion.nombre);
    console.log("   - Token:", sesion.token ? sesion.token.substring(0, 20) + "..." : "NO HAY TOKEN");

    if (sesion.rol !== "admin") {
      console.error("   ❌ La sesión no es de administrador");
      return;
    }

    if (!sesion.token) {
      console.error("   ❌ No hay token en la sesión");
      console.log("\n   SOLUCIÓN: Cierra sesión y vuelve a ingresar");
      return;
    }

    // 3. Probar endpoint de estado
    console.log("\n3. Probando API de estado...");
    try {
      const respEstado = await fetch("/api/estado");
      const dataEstado = await respEstado.json();
      console.log("   ✅ Estado actual:", dataEstado);
    } catch (e) {
      console.error("   ❌ Error al obtener estado:", e.message);
    }

    // 4. Probar abrir votaciones
    console.log("\n4. Probando abrir votaciones...");
    try {
      const headers = await encabezadosAdmin(true);
      console.log("   Headers:", headers);

      const respAbrir = await fetch("/api/estado/abrir", {
        method: "POST",
        headers: headers,
        body: JSON.stringify({ grados: [], sedes: [] })
      });

      console.log("   - HTTP Status:", respAbrir.status);

      const dataAbrir = await respAbrir.json();
      console.log("   - Respuesta:", dataAbrir);

      if (respAbrir.ok) {
        console.log("   ✅ Votaciones abiertas correctamente");
      } else if (respAbrir.status === 401 || respAbrir.status === 403) {
        console.error("   ❌ Token inválido o expirado");
        console.log("\n   SOLUCIÓN: Cierra sesión y vuelve a ingresar con código 202616");
      } else {
        console.error("   ❌ Error:", dataAbrir.motivo || dataAbrir.mensaje);
      }
    } catch (e) {
      console.error("   ❌ Error de red al abrir votaciones:", e.message);
      console.log("   Detalles del error:", e);
    }

    // 5. Verificar elementos del DOM
    console.log("\n5. Verificando elementos del DOM...");
    const elementos = {
      "btnAbrirVotaciones": document.getElementById("btnAbrirVotaciones"),
      "btnCerrarVotaciones": document.getElementById("btnCerrarVotaciones"),
      "estadoVotacionesBadge": document.getElementById("estadoVotacionesBadge"),
      "infoSincronizacion": document.getElementById("infoSincronizacion")
    };

    for (const [nombre, elemento] of Object.entries(elementos)) {
      if (elemento) {
        console.log(`   ✅ ${nombre} existe`);
      } else {
        console.error(`   ❌ ${nombre} NO existe`);
      }
    }

    // 6. Verificar listeners del botón
    console.log("\n6. Info del botón abrir votaciones...");
    const btnAbrir = document.getElementById("btnAbrirVotaciones");
    if (btnAbrir) {
      console.log("   - Texto:", btnAbrir.textContent);
      console.log("   - Disabled:", btnAbrir.disabled);
      console.log("   - Classes:", btnAbrir.className);
    }

    console.log("\n=== FIN DEL DIAGNÓSTICO ===");
    console.log("\nSi el diagnóstico muestra un error de token, sigue estos pasos:");
    console.log("1. Click en 'Cerrar sesión'");
    console.log("2. Limpia caché del navegador (Ctrl+Shift+Del)");
    console.log("3. Recarga la página (F5)");
    console.log("4. Ingresa nuevamente con código: 202616");

  } catch (error) {
    console.error("\n❌ Error general en diagnóstico:", error);
    console.error("Stack trace:", error.stack);
  }
})();
