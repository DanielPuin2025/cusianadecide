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

  console.log('Botón:', !!btnContinuar);
  console.log('Bienvenida:', !!pantallaBienvenida);
  console.log('Acceso:', !!pantallaAcceso);

  if (btnContinuar && pantallaBienvenida && pantallaAcceso) {
    btnContinuar.addEventListener('click', function() {
      console.log('CLICK EN INGRESAR');
      console.log('Bienvenida clases antes:', pantallaBienvenida.className);
      console.log('Acceso clases antes:', pantallaAcceso.className);
      
      pantallaBienvenida.classList.remove('activo');
      pantallaAcceso.classList.add('activo');
      
      console.log('Bienvenida clases después:', pantallaBienvenida.className);
      console.log('Acceso clases después:', pantallaAcceso.className);
      console.log('Acceso display:', getComputedStyle(pantallaAcceso).display);
    });

    console.log('EVENT LISTENER REGISTRADO');
  } else {
    console.error('FALTAN ELEMENTOS CRÍTICOS');
  }
})();
