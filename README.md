# Votaciones Estudiantiles

App de votaciones estudiantiles que funciona **con y sin internet**.

## Estructura

```
CUSIAN_DECIDE/
├── backend/              # Servidor Node.js + Express
│   ├── data/
│   │   ├── candidatos.json
│   │   └── votos.json
│   ├── routes/
│   │   ├── candidatos.js
│   │   └── votos.js
│   ├── db.js
│   ├── server.js
│   └── package.json
└── frontend/             # PWA (funciona offline)
    ├── css/estilos.css
    ├── js/
    │   ├── db.js               # IndexedDB (guarda datos sin internet)
    │   ├── estado-conexion.js  # detecta si hay internet
    │   ├── auth.js              # login del estudiante
    │   ├── votar.js             # lógica de votación
    │   ├── resultados.js        # resultados en vivo
    │   └── registrar-sw.js
    ├── icons/icon.svg
    ├── index.html      # login
    ├── votar.html       # pantalla de votación
    ├── resultados.html  # resultados
    ├── manifest.json    # config de PWA
    └── service-worker.js # cache offline
```

## Cómo funciona sin internet

1. El navegador guarda la app (HTML, CSS, JS) en caché con el **Service Worker**.
2. Los votos se guardan primero en **IndexedDB** (base de datos del navegador).
3. Si hay internet, el voto se envía directo al servidor.
4. Si no hay internet, el voto queda "pendiente" y se sincroniza automáticamente la próxima vez que la app detecte conexión.
5. Cada estudiante solo puede votar una vez por dispositivo (se valida en el navegador y también en el servidor).

## Instalación

```bash
cd backend
npm install
npm start
```

Abre en el navegador: `http://localhost:3000`

## Uso

1. **index.html**: el estudiante ingresa su código y nombre.
2. **votar.html**: elige un candidato y confirma su voto.
3. **resultados.html**: ve los resultados en tiempo real (o el último dato guardado si no hay internet).

## Notas

- Para instalar la app como PWA en el celular: abre la página en Chrome, toca el menú y selecciona "Instalar aplicación" o "Agregar a pantalla de inicio".
- Los candidatos se editan en `backend/data/candidatos.json`.
- Esta versión no tiene autenticación real (contraseñas) ni cifrado de datos: es un proyecto educativo. Para una elección real de gran escala, se recomienda agregar autenticación robusta y HTTPS.
