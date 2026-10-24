# Diagnóstico y solución del cierre de votaciones

## Causa encontrada

En `frontend/js/resultados.js` se consultaba `formAgregarEstudiante` antes de declararlo. El `ReferenceError` interrumpía la inicialización del panel de administración y evitaba registrar los eventos de los controles, incluidos los botones para cerrar y abrir las votaciones.

Se corrigió declarando el formulario antes de usarlo. El botón de cierre ya estaba conectado al endpoint `POST /api/estado/cerrar`; no era necesario cambiar su lógica ni el estado en el backend.

## Verificación local

- `node --check` pasa para `resultados.js` y `votar.js`.
- Se verificó que el formulario de agregar estudiante se declara antes de su primer uso.
- La corrección todavía debe desplegarse y probarse en Easypanel; este repositorio no confirma el estado del contenedor de producción.

## Pasos para desplegar y comprobar

1. Publicar los cambios del repositorio y reconstruir/reiniciar la aplicación en Easypanel según el flujo normal del proyecto.
2. Iniciar sesión de nuevo como administrador, abrir el panel y recargar la página.
3. Cerrar las votaciones y confirmar la acción. El panel debe mostrar el estado cerrado; una consulta `GET /api/estado` debe devolver `"abierto": false`.
4. Confirmar que los estudiantes ya no pueden emitir votos.
5. Para volver a habilitar la votación, usar el control **Abrir votaciones** del panel.

Si el endpoint devuelve HTTP 401, la sesión de administrador expiró o se reinició el proceso del backend; vuelve a iniciar sesión y repite la acción. No uses una solicitud de apertura como prueba del botón de cierre, porque cambiaría el estado real de la votación.
