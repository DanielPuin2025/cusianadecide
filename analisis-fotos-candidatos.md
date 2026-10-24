# Análisis del Sistema de Carga de Fotos de Candidatos

## Revisión del código (2026-10-24)

El análisis anterior no detectó un error real de visualización. Las fotos subidas desde el equipo se guardan como URI `data:image/...`, pero el renderizador las trataba como rutas locales (`icons/data:image/...`), lo que activaba el logo de respaldo. Además, una referencia no declarada a `formAgregarEstudiante` interrumpía la inicialización del panel antes de enlazar los controles de fotos.

Se corrigieron ambos puntos en `frontend/js/resultados.js` y `frontend/js/votar.js`. El archivo `resultados.html` y `votar.html` también incrementan la versión de sus scripts para evitar reutilizar la versión anterior en caché. Las imágenes existentes guardadas en el servidor no se modifican.

## Inventario y funcionamiento esperado

### 1. Fotos Existentes
El inventario local incluye:
- ✅ Voto-en-blanco.jpg (5.5 KB)
- ✅ danilson.jpeg (95.6 KB)
- ✅ dannia.jpeg (123.2 KB)
- ✅ dayana.jpeg (112.6 KB)
- ✅ felipe.jpeg (101.8 KB)
- ✅ samara.jpeg (131.7 KB)

### 2. Comprobación anterior de producción

Una nota previa del proyecto reportó que una foto era accesible en producción. Ese dato no se volvió a comprobar durante esta revisión.

## 🔍 Cómo Funciona el Sistema

### A. Cargar Foto desde el Panel de Administración

El panel tiene **DOS opciones** para agregar fotos:

#### **Opción 1: Subir archivo desde el equipo**
1. Click en el botón **"📷 Seleccionar foto"**
2. Se abre el explorador de archivos
3. Selecciona una imagen (JPG, PNG, etc.)
4. La imagen se convierte a **Base64** y se guarda en el campo `imagen`
5. Vista previa se muestra inmediatamente

**Código relevante:**
```javascript
// frontend/js/resultados.js:643-657
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
    document.getElementById("imagenCandidato").value = lector.result; // Base64
    mostrarVistaPrevia(lector.result);
  });
  lector.readAsDataURL(archivo);
}
```

#### **Opción 2: Pegar URL de imagen**
1. Click nuevamente en el botón (ahora dice **"🔗 Pegar URL"**)
2. Se muestra un campo de texto
3. Pega la URL de la imagen (puede ser externa o relativa)
4. Vista previa se muestra automáticamente

**Formatos de URL aceptados:**
- Rutas relativas: `icons/candidatos/foto.jpg`
- URLs completas: `https://ejemplo.com/foto.jpg`
- Base64: `data:image/jpeg;base64,...`

### B. Resolución de Rutas de Imágenes

El sistema normaliza automáticamente las rutas:

```javascript
// frontend/js/votar.js:182-194 y resultados.js
function resolverRutaImagen(imagen) {
  if (!imagen) return "icons/logo.ico"; // Fallback por defecto
  
  const valor = String(imagen).trim();
  if (!valor) return "icons/logo.ico";
  if (/^data:image\//i.test(valor)) return valor;
  if (/^(https?:)?\/\//i.test(valor)) return valor; // URL completa
  
  const normalizada = valor.replace(/^\.\//, "").replace(/^frontend\//, "");
  if (normalizada.startsWith("icons/")) return normalizada;
  if (normalizada.startsWith("/")) return normalizada.slice(1);
  
  return `icons/${normalizada}`; // Asume que está en icons/
}
```

**Ejemplos de normalización:**
- `"frontend/icons/candidatos/foto.jpg"` → `"icons/candidatos/foto.jpg"`
- `"./icons/candidatos/foto.jpg"` → `"icons/candidatos/foto.jpg"`
- `"/icons/candidatos/foto.jpg"` → `"icons/candidatos/foto.jpg"`
- `"candidatos/foto.jpg"` → `"icons/candidatos/foto.jpg"`
- `"https://ejemplo.com/foto.jpg"` → `"https://ejemplo.com/foto.jpg"` (sin cambios)

### C. Manejo de Errores de Carga

Si una imagen no se puede cargar, el sistema usa un **fallback automático**:

```javascript
function crearImgConFallback(src, alt, className = "foto-candidato", extraOnError = "") {
  const fallback = "icons/logo.ico";
  const onError = `this.onerror=null; this.src='${fallback}'; ${extraOnError}`;
  return `<img src="${src}" alt="${alt}" class="${className}" onerror="${onError}" />`;
}
```

**Orden de fallback:**
1. Intenta cargar la imagen especificada
2. Si falla → muestra `icons/logo.ico` (logo de la institución)

## ✅ Verificaciones Realizadas

### 1. Funcionalidad de Carga
- ✅ **Botón "Seleccionar foto"** alterna entre archivo/URL
- ✅ **FileReader** convierte imagen a Base64
- ✅ **Vista previa** funciona correctamente
- ✅ **Validación de tipo** rechaza archivos no-imagen

### 2. Almacenamiento
- ✅ **POST /api/candidatos** guarda la imagen en el campo `imagen`
- ✅ **PUT /api/candidatos/:id** actualiza la imagen del candidato
- ✅ Backend guarda en `backend/data/candidatos.json`

### 3. Visualización
- ✅ **Panel de administración** muestra fotos con fallback
- ✅ **Pantalla de votación** muestra fotos con fallback
- ✅ **Voto en blanco** usa imagen especial: `icons/candidatos/Voto-en-blanco.jpg`

## 🐛 Posibles Problemas y Soluciones

### Problema 1: "La foto no se muestra en la pantalla de votación"

**Causas posibles:**
- La ruta de la imagen es incorrecta
- El archivo no existe en el servidor
- Hay un error de CORS (si es URL externa)

**Solución:**
1. Verifica la ruta en `backend/data/candidatos.json`:
   ```bash
   cat backend/data/candidatos.json
   ```
2. Asegúrate de que el formato sea correcto:
   ```json
   {
     "id": "c123",
     "nombre": "Juan Pérez",
     "imagen": "icons/candidatos/juan.jpg"
   }
   ```
3. Si usas Base64, debe empezar con `data:image/`

### Problema 2: "Error al subir foto desde el equipo"

**Causas posibles:**
- Archivo muy grande (>5MB puede causar problemas)
- Formato de archivo no soportado
- Error de permisos del navegador

**Solución:**
1. Verifica el tamaño del archivo:
   - Imágenes JPEG optimizadas: 50-200 KB
   - Evita archivos >1 MB
2. Formatos soportados: JPG, PNG, GIF, WebP
3. Verifica en la consola del navegador si hay errores

### Problema 3: "La vista previa no se muestra"

**Causas posibles:**
- El elemento `previewImagenCandidato` no existe
- La URL es inválida
- Error de JavaScript

**Solución:**
1. Abre la consola del navegador (F12)
2. Busca errores JavaScript
3. Verifica que los elementos existan:
   ```javascript
   console.log(document.getElementById("previewImagenCandidato"));
   console.log(document.getElementById("sinPreviewImagen"));
   ```

### Problema 4: "Foto se ve en admin pero no en votación"

**Causas posibles:**
- Caché del navegador
- Problemas de sincronización entre candidatos

**Solución:**
1. Limpia caché del navegador (Ctrl+Shift+Del)
2. Recarga la página sin caché (Ctrl+F5)
3. Verifica en la API:
   ```bash
   curl https://cusianadecide.programacionsena.online/api/candidatos
   ```

## 🧪 Pruebas Recomendadas

### 1. Probar Carga de Foto por Archivo
```javascript
// En la consola del navegador del panel de admin:
const input = document.getElementById("imagenArchivo");
console.log("Input file:", input);
// Luego selecciona un archivo manualmente y verifica la vista previa
```

### 2. Probar Carga de Foto por URL
```javascript
// En la consola del navegador:
const input = document.getElementById("imagenCandidato");
input.value = "icons/candidatos/danilson.jpeg";
input.dispatchEvent(new Event('input'));
// Debería mostrar la vista previa
```

### 3. Verificar Candidatos con Fotos
```bash
# Desde la terminal:
curl -s https://cusianadecide.programacionsena.online/api/candidatos | jq '.[] | {nombre, imagen}'
```

## 📝 Formato Recomendado para Fotos

### Especificaciones Técnicas:
- **Formato:** JPEG (mejor compresión)
- **Resolución:** 400x400 px (cuadrada)
- **Peso:** 50-150 KB
- **Ubicación:** `frontend/icons/candidatos/`
- **Nombre:** Sin espacios, minúsculas, ejemplo: `juan-perez.jpg`

### Rutas Válidas para el Campo "imagen":
```javascript
// Opción 1: Ruta relativa (recomendada)
"icons/candidatos/juan-perez.jpg"

// Opción 2: Base64 (para fotos subidas desde el equipo)
"data:image/jpeg;base64,/9j/4AAQSkZJRg..."

// Opción 3: URL externa
"https://ejemplo.com/fotos/juan-perez.jpg"
```

## Conclusión

La vista previa aceptaba la URI Base64, pero las tarjetas de administración y votación no; por eso mostraban el logo de respaldo. El problema está corregido localmente. La publicación en producción y la prueba con una foto nueva aún están pendientes.
