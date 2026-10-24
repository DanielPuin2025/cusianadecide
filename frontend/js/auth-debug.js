(function() {
  console.log('=== AUTH FINAL INICIADO ===');
  
  function $(id) {
    const el = document.getElementById(id);
    if (!el) console.warn('Elemento no encontrado:', id);
    return el;
  }

  const btnContinuar = $('btnContinuar');
  const pantallaBienvenida = $('pantallaBienvenida');
  const pantallaAcceso = $('pantallaAcceso');
  const formLogin = $('formLogin');
  const formAdmin = $('formAdmin');
  const mensaje = $('mensajeLogin');

  console.log('Botón:', !!btnContinuar);
  console.log('Bienvenida:', !!pantallaBienvenida);
  console.log('Acceso:', !!pantallaAcceso);
  console.log('FormLogin:', !!formLogin);
  console.log('FormAdmin:', !!formAdmin);

  if (btnContinuar && pantallaBienvenida && pantallaAcceso) {
    btnContinuar.addEventListener('click', function() {
      console.log('CLICK EN INGRESAR');
      pantallaBienvenida.classList.remove('activo');
      pantallaAcceso.classList.add('activo');
      console.log('Acceso display:', getComputedStyle(pantallaAcceso).display);
    });
    console.log('EVENT LISTENER INGRESAR REGISTRADO');
  } else {
    console.error('FALTAN ELEMENTOS CRÍTICOS');
  }

  function mostrarError(texto) {
    if (mensaje) {
      mensaje.textContent = texto;
      mensaje.className = 'mensaje error';
    }
    console.error('ERROR:', texto);
  }

  if (formLogin) {
    formLogin.addEventListener('submit', async (e) => {
      e.preventDefault();
      console.log('FORMULARIO ESTUDIANTE ENVIADO');
      const codigo = $('codigo').value.trim();
      if (!codigo) return mostrarError('Ingresa tu código estudiantil');

      try {
        const respuesta = await fetch('/api/auth/validar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ codigo })
        });
        const datos = await respuesta.json().catch(() => ({}));
        console.log('Respuesta validar:', respuesta.status, datos);
        if (!respuesta.ok) return mostrarError(datos.motivo || 'No puedes votar con este código.');
        
        const token = datos.token;
        const sesion = {
          clave: 'actual',
          rol: 'estudiante',
          codigo: datos.codigo,
          nombre: datos.nombre || 'Estudiante ' + datos.codigo,
          token: token
        };
        
        await guardarEnStore("sesion", sesion);
        console.log('Sesión guardada, redirigiendo a votar.html');
        window.location.href = 'votar.html';
      } catch (error) {
        console.error('Error en login estudiante:', error);
        mostrarError('No se pudo validar tu código en este momento.');
      }
    });
    console.log('FORM LOGIN REGISTRADO');
  }

  if (formAdmin) {
    formAdmin.addEventListener('submit', async (e) => {
      e.preventDefault();
      console.log('FORMULARIO ADMIN ENVIADO');
      const password = $('passwordAdmin').value.trim();
      if (!password) return mostrarError('Ingresa la contraseña del administrador');

      try {
        const respuesta = await fetch('/api/auth/admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password })
        });
        const datos = await respuesta.json().catch(() => ({}));
        console.log('Respuesta admin:', respuesta.status, datos);
        if (!respuesta.ok) return mostrarError(datos.motivo || 'Contraseña incorrecta');
        
        const token = datos.token;
        const sesion = {
          clave: 'actual',
          rol: 'admin',
          codigo: 'admin',
          nombre: 'Administrador',
          token: token
        };
        
        await guardarEnStore("sesion", sesion);
        console.log('Sesión admin guardada, redirigiendo a resultados.html');
        window.location.href = 'resultados.html';
      } catch (error) {
        console.error('Error en login admin:', error);
        mostrarError('No se pudo iniciar sesión en este momento.');
      }
    });
    console.log('FORM ADMIN REGISTRADO');
  }

  console.log('=== AUTH FINAL INICIALIZADO ===');
})();
