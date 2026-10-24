# Diagnóstico del Error "Error al abrir las votaciones"

## Problema Identificado

El error "Error al abrir las votaciones" aparece en el panel de administración cuando se intenta abrir las votaciones desde https://cusianadecide.programacionsena.online

## Causas Posibles

1. **Discrepancia entre versión local y producción**: El archivo `resultados.html` en producción incluye `offline-sync.js` pero la versión local no lo tenía.

2. **Sesión expirada o token inválido**: El middleware de autenticación requiere un token válido que expira después de 30 minutos.

3. **Error de red o CORS**: La petición al endpoint `/api/estado/abrir` puede estar fallando por problemas de red.

## Soluciones Aplicadas

✅ Descargado el archivo `offline-sync.js` desde producción
✅ Actualizado `resultados.html` para incluir el script faltante

## Pasos para Diagnosticar en Producción

### 1. Abrir la Consola del Navegador

En Chrome/Edge: `F12` → Pestaña "Console"

### 2. Ejecutar Script de Diagnóstico

Copia y pega este código en la consola del navegador:

```javascript
console.clear();
console.log("=== DIAGNÓSTICO DE VOTACIONES ===");

// 1. Verificar sesión guardada
(async () => {
  const sesion = await obtenerDeStore("sesion", "actual");
  console.log("1. Sesión actual:", sesion);
  
  if (!sesion) {
    console.error("❌ No hay sesión guardada");
    return;
  }
  
  if (sesion.rol !== "admin") {
    console.error("❌ La sesión no es de administrador");
    return;
  }
  
  console.log("✅ Sesión de admin encontrada");
  
  // 2. Verificar token
  if (!sesion.token) {
    console.error("❌ No hay token en la sesión");
    return;
  }
  
  console.log("✅ Token encontrado:", sesion.token.substring(0, 10) + "...");
  
  // 3. Probar endpoint de estado
  try {
    const resp = await fetch("/api/estado");
    const data = await resp.json();
    console.log("3. Estado actual:", data);
  } catch (e) {
    console.error("❌ Error al obtener estado:", e);
  }
  
  // 4. Probar abrir votaciones
  try {
    const resp = await fetch("/api/estado/abrir", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${sesion.token}`
      },
      body: JSON.stringify({ grados: [], sedes: [] })
    });
    
    const data = await resp.json();
    console.log("4. Respuesta de abrir votaciones:");
    console.log("   Status:", resp.status);
    console.log("   Data:", data);
    
    if (resp.ok) {
      console.log("✅ Votaciones abiertas correctamente");
    } else if (resp.status === 401) {
      console.error("❌ Token inválido o expirado. Debes cerrar sesión y volver a ingresar.");
    } else {
      console.error("❌ Error:", data.motivo || data.mensaje);
    }
  } catch (e) {
    console.error("❌ Error al abrir votaciones:", e);
    console.error("Detalles:", e.message);
  }
})();
```

### 3. Interpretar Resultados

**Si aparece "Token inválido o expirado":**
- Cerrar sesión en el panel de administración
- Volver a ingresar con el código de administrador: `202616`

**Si aparece error de red:**
- Verificar que el servidor backend está corriendo
- Revisar logs del servidor con: `pm2 logs` o revisar la consola del servidor

**Si aparece otro error:**
- Copiar el mensaje completo del error
- Revisar los logs del backend

## Verificación del Backend

### Verificar que el servidor está corriendo:

```bash
# Si usas PM2:
pm2 status
pm2 logs votaciones-backend

# Si usas node directamente:
ps aux | grep node
```

### Verificar estado de las votaciones:

```bash
cat backend/data/estado-votaciones.json
```

### Verificar logs recientes:

```bash
tail -f /ruta/logs/servidor.log
```

## Solución Rápida

Si todo falla, intenta estos pasos:

1. **Cerrar sesión** en el panel de administración
2. **Limpiar caché** del navegador (Ctrl+Shift+Del)
3. **Recargar** la página (Ctrl+F5)
4. **Volver a ingresar** con código: `202616`
5. **Intentar abrir las votaciones** nuevamente

## Archivos Actualizados

- `frontend/js/offline-sync.js` (nuevo)
- `frontend/resultados.html` (actualizado)

## Próximos Pasos

1. Subir los archivos actualizados al servidor de producción
2. Verificar que el error se ha resuelto
3. Si persiste, ejecutar el script de diagnóstico y reportar los resultados
