# Guía de Despliegue - CUSIAN DECIDE

## 📋 Pasos para Desplegar a GitHub y EasyPanel

### 1. Configurar Repositorio en GitHub

#### Opción A: Si ya tienes un repositorio en GitHub
```bash
# Agregar el remote (reemplaza con tu URL)
git remote add origin https://github.com/TU_USUARIO/CUSIAN_DECIDE.git

# Verificar
git remote -v

# Subir cambios
git push -u origin master
```

#### Opción B: Si necesitas crear un nuevo repositorio
1. Ve a https://github.com/new
2. Nombre del repositorio: `CUSIAN_DECIDE` (o el que prefieras)
3. Déjalo como **Público** o **Privado** según tu preferencia
4. **NO** inicialices con README, .gitignore ni licencia (ya los tienes)
5. Copia la URL del repositorio que aparecerá
6. Ejecuta los comandos:

```bash
# Agregar el remote (reemplaza con la URL que copiaste)
git remote add origin https://github.com/TU_USUARIO/CUSIAN_DECIDE.git

# Subir cambios
git branch -M main
git push -u origin main
```

### 2. Configurar Despliegue en EasyPanel

#### 2.1. Conectar Repositorio
1. Ingresa a tu panel de EasyPanel
2. Ve a la sección de tu aplicación "cusianadecide"
3. En **Source**, conecta con GitHub y selecciona el repositorio

#### 2.2. Configuración de Build
```yaml
Build Command:
  cd backend && npm install

Start Command:
  cd backend && node server.js

Port: 3000
```

#### 2.3. Variables de Entorno (si las necesitas)
```
NODE_ENV=production
PORT=3000
```

### 3. Desplegar los Cambios

#### Después de hacer push a GitHub:
EasyPanel detectará automáticamente los cambios y hará un nuevo despliegue.

**⚠️ IMPORTANTE: ¿Necesitas reiniciar el servicio en EasyPanel?**

**NO** es necesario reiniciar manualmente si:
- Configuraste el auto-deploy en EasyPanel
- Los cambios solo son de frontend (HTML, CSS, JS)

**SÍ** necesitas reiniciar si:
- Cambiaste código del backend (server.js, routes, db.js)
- Agregaste nuevas dependencias en package.json
- Cambiaste variables de entorno

### 4. Reiniciar en EasyPanel (si es necesario)

#### Opción A: Desde el Dashboard
1. Ve a tu aplicación en EasyPanel
2. Click en **"Restart"** o **"Redeploy"**

#### Opción B: Forzar redespliegue
1. Haz un commit vacío:
```bash
git commit --allow-empty -m "Trigger redeploy"
git push
```

### 5. Verificar el Despliegue

Después del despliegue, verifica:

1. **Estado del sitio**: https://cusianadecide.programacionsena.online
2. **API funcionando**: https://cusianadecide.programacionsena.online/api/estado
3. **Frontend actualizado**: Verifica que `offline-sync.js` esté cargando

```bash
# Verificar desde la terminal
curl -I https://cusianadecide.programacionsena.online/js/offline-sync.js
```

### 6. Probar la Solución del Error

1. Abre https://cusianadecide.programacionsena.online
2. Ingresa con código de admin: `202616`
3. Ve al panel de resultados
4. Intenta **Abrir votaciones**
5. Si aparece el error nuevamente, abre la consola del navegador (F12) y ejecuta el script de diagnóstico del archivo `diagnostico-votaciones.md`

### 7. Comandos Útiles

```bash
# Ver estado de Git
git status

# Ver historial de commits
git log --oneline

# Hacer nuevos cambios
git add .
git commit -m "Descripción del cambio"
git push

# Ver logs en EasyPanel (desde SSH si tienes acceso)
pm2 logs
# o
tail -f /var/log/app.log
```

## 🔧 Solución de Problemas

### Error: "offline-sync.js 404 Not Found"
- Verifica que el archivo esté en `frontend/js/offline-sync.js`
- Haz commit y push del archivo
- Espera a que EasyPanel redespliegue

### Error: "Token inválido o expirado"
- Cierra sesión en el panel de admin
- Limpia caché del navegador (Ctrl+Shift+Del)
- Vuelve a ingresar con código: `202616`

### EasyPanel no detecta cambios
- Verifica que el webhook esté configurado
- Fuerza redespliegue con commit vacío
- Revisa logs en EasyPanel

### Cambios no se reflejan en el sitio
- Limpia caché del navegador (Ctrl+F5)
- Verifica que los archivos tengan el parámetro de versión actualizado (ej: `?v=14`)
- Considera incrementar la versión en los tags de script

## 📝 Notas Importantes

- **Archivos ignorados**: Los archivos en `backend/data/*.json` NO se subirán a GitHub (datos sensibles)
- **Respaldos**: Asegúrate de respaldar `backend/data/` antes de cualquier cambio importante
- **Cache**: Los navegadores pueden cachear archivos JS/CSS, usa `Ctrl+F5` para recargar sin caché

## ✅ Checklist de Despliegue

- [ ] Commit creado localmente
- [ ] Repositorio GitHub configurado
- [ ] Push a GitHub exitoso
- [ ] EasyPanel detectó cambios
- [ ] Despliegue completado en EasyPanel
- [ ] Sitio accesible
- [ ] API respondiendo correctamente
- [ ] Error de "abrir votaciones" solucionado
- [ ] Pruebas en navegador exitosas
