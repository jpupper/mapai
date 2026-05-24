---
name: fullscreen-mega-ecosystem-manual-v1
description: Manual maestro y estándar de programación exhaustivo para el ecosistema Fullscreen (FSC).
---

# 🌐 Ecosistema Fullscreen (FSC) - Mega Manual de Arquitectura y Estándares

Este documento es la **Única Fuente de Verdad** (Single Source of Truth) para el desarrollo, mantenimiento y despliegue de todas las aplicaciones del ecosistema Fullscreen. Cualquier IA o desarrollador que trabaje en este proyecto DEBE seguir estas directrices al pie de la letra para garantizar la integridad del sistema.

---

## 🏗️ 1. Arquitectura de Identidad Centralizada (SSO)

El ecosistema FSC opera bajo un modelo de **Single Sign-On (SSO)**. La identidad del usuario es global y gestionada por un único microservicio.

### A. El Corazón: `fscauth`
*   **Responsabilidad:** Registro, Login, Recuperación de clave y Gestión de Perfiles.
*   **Base de Datos:** MongoDB `fullscreen_global`.
*   **Puerto Local/Interno:** `3027`.
*   **Identificador Universal:** El `email` del usuario. Aunque MongoDB genera un `_id`, el email es la clave de unificación entre sistemas.
*   **Flujo de Autenticación:** 
    1. El usuario se loguea en `fscauth`.
    2. `fscauth` emite un **JWT (JSON Web Token)** firmado con una `JWT_SECRET` global.
    3. El token se guarda en una cookie de dominio `.fullscreencode.com` para que sea visible por todas las sub-apps.
    4. Las apps satélites validan este token contra el servicio de auth o mediante la clave secreta compartida.

---

## 🖼️ 2. Gestión de Contenidos y Media (Cloudinary)

**PROHIBICIÓN ESTRICTA:** No se permite el almacenamiento de archivos binarios (imágenes, videos, audios, PDFs) en el sistema de archivos local del VPS.

*   **Estándar de Almacenamiento:** Cloudinary es el único proveedor oficial.
*   **Dinámica de Subida:** 
    - El Frontend envía el archivo al Backend de la aplicación.
    - El Backend sube el archivo a Cloudinary usando el SDK de Node.js.
    - Cloudinary devuelve una `secure_url`.
    - El Backend guarda **únicamente la URL** en MongoDB.
*   **Organización de Folders en Cloudinary:**
    - `fsc_auth/avatars/`: Avatares de usuario.
    - `jpshader/previews/`: Previews de shaders.
    - `pizarraia/gallery/`: Imágenes de la pizarra.
    - `artedigital/posts/`: Arte social.

---

## 🔑 3. Configuración y Seguridad (.env)

Cada aplicación debe ser autónoma en su configuración mediante variables de entorno.

### El Archivo `.env` (Mandatorio)
Debe contener TODAS las llaves maestras. Ejemplo detallado:
```env
# --- SERVER CONFIG ---
PORT=3027
NODE_ENV=vps # Valores: 'local' | 'vps'
BASE_PATH=/fscauth # Prefijo de ruta obligatorio

# --- DATABASE ---
MONGODB_URI=mongodb://localhost:27017/fullscreen_global

# --- SECURITY ---
JWT_SECRET=una_clave_larga_y_aleatoria_2026
ADMIN_PASS=rty456fgh # Password para paneles de administración

# --- CLOUDINARY ---
CLOUDINARY_CLOUD_NAME=tu_cloud
CLOUDINARY_API_KEY=tu_key
CLOUDINARY_API_SECRET=tu_secret

# --- DEPLOYMENT (Automatización) ---
VPS_HOST=149.50.139.152
VPS_PORT=5752 # Puerto SSH
VPS_USER=root
GITHUB_TOKEN=ghp_...
GITHUB_REPO=usuario/repo
FTP_HOST=fullscreencode.com
FTP_USER=usuario_ftp
FTP_PASS=pass_ftp
```

---

## 📂 4. Estándar de Estructura de Proyectos

Toda aplicación FSC debe seguir este esquema para que las herramientas de automatización funcionen:

```text
/nombre-app
├── /.env                   # Configuración real (OCULTO EN GIT)
├── /.env.example           # Documentación de las variables necesarias
├── /deployscripts/         # SCRIPTS DE DESPLIEGUE
│   ├── run_deploy.bat      # Orquestador: Compila local -> Sube a Ferozo -> Actualiza VPS
│   ├── server_update.sh    # Script Bash que corre DENTRO del VPS
│   └── upload_ftp.js       # Script de Node para subir el frontend al host estático
├── /models/                # Esquemas de Mongoose
├── /public/                # Frontend (HTML/JS/CSS vainilla)
├── /routes/                # Definición de API Endpoints
├── server.js               # Punto de entrada (Express)
├── install.bat             # INSTALADOR: npm install + setup inicial
├── run.bat                 # EJECUTOR: npm run dev
└── package.json            # Scripts y dependencias
```

---

## 🔌 5. Tabla de Puertos y Ruteo Maestro

Para evitar colisiones en el VPS, cada aplicación tiene un puerto asignado:

| App | Carpeta | Puerto | Endpoint Público |
| :--- | :--- | :--- | :--- |
| **BM Raices (Main)** | `bmraices_local` | **3000** | `/` |
| **Emojis** | `emojis` | **3001** | `/emojis` |
| **Fifuli** | `fifuli` | **3002** | `/fifuli` |
| **Arte Digital** | `artedigitaldata` | **2495** | `/artedigitaldata` |
| **Palabras / Socket** | `palabras` | **3024** | `/textsocket` |
| **Pizarra IA** | `pizarraia` | **3025** | `/pizzarraia` |
| **Diplo IA** | `diploia` | **3060** | `/diploia` |
| **Identity Master** | `fscauth` | **3027** | `/fscauth` |
| **JP Website** | `jpupperwebsite` | **3243** | `/jpupper` |
| **Rose Dashboard** | `rosedashboard` | **3343** | `/rose` |
| **Generador Ciudad** | `generadorciudades` | **3344** | `/generadorciudades` |
| **Trivia DB** | `triviadb` | **3388** | `/triviadb` |
| **Raices Interface** | `raicesinterface` | **3400** | `/raicesinterface` |
| **MasterPrompt** | `masterprompt` | **3451** | `/masterprompt` |
| **LiveIA Server** | `liveiaserver` | **3454** | `/liveiaserver` |
| **Raices Gen** | `raicesgen` | **3500** | `/raicesgen` |
| **PeronPhono** | `peronphono` | **3520** | `/peronphono` |
| **Pink Carpet** | `pinkcarpet` | **3733** | `/pinkcarpet` |
| **Shiny Apps** | `shiny` | **3838** | `/shiny` |
| **Karaoke** | `karaoke` | **4100** | `/karaoke` |
| **Volumetric** | `volumetric` | **4578** | `/volumetric` |
| **Shader Editor** | `jpshadereditor` | **3250** | `/jpshadereditor` |
| **Shokyuu Cards** | `shokyuucards` | **7500** | `/shokyuucards` |
| **ComfyWeb** | `comfyweb` | **8085** | `/comfyweb` |

---

## ⚙️ 6. Configuración de NGINX (Reverse Proxy)

El archivo de Nginx en el VPS (`/etc/nginx/sites-available/...`) debe mapear los puertos internos a las rutas externas.

**Plantilla Estándar FSC:**
```nginx
location /prefijo-app {
    # 1. Redirección al puerto interno
    proxy_pass http://localhost:PUERTO;
    
    # 2. Soporte para WebSockets e Identidad Central (Cookies)
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header Cookie $http_cookie; 
    proxy_cache_bypass $http_upgrade;
    
    # 3. Seguridad y Headers
    add_header 'Access-Control-Allow-Credentials' 'true' always;
    
    # 4. Límites de Carga (Cloudinary sube desde el backend)
    client_max_body_size 100M;
    proxy_read_timeout 300s;
    proxy_connect_timeout 300s;
}
```

---

## 🛡️ 7. Seguridad Crítica: CORS y CSP

Para que el frontend en Ferozo (`fullscreencode.com`) pueda hablar con el backend en el VPS (`dattaweb.com`) sin errores de red:

### A. Política de CORS (Cross-Origin Resource Sharing)
```javascript
app.use(cors({
  origin: [
    "https://fullscreencode.com", 
    "https://vps-4455523-x.dattaweb.com",
    "http://localhost:PUERTO"
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  credentials: true // INDISPENSABLE para leer las cookies de fscauth
}));
```

### B. Política de CSP (Content Security Policy)
Configurada como middleware para permitir que el navegador cargue recursos externos:
- `connect-src`: Debe incluir el dominio del VPS y Cloudinary API.
- `img-src`: Debe permitir `res.cloudinary.com` y `data:`.

---

## 🔄 8. Flujo de Unificación de Usuarios (Integración)

Si se desea migrar usuarios de una base de datos local a la global (`fscauth`):
1.  **Script:** `fscauth/scripts/integrate_users.js`.
2.  **Lógica:** 
    - Conecta a `artedigital`, `pizarraia` y `shadersDB`.
    - Busca coincidencias por **Email**.
    - Crea un registro maestro en `fullscreen_global`.
    - Consolida los permisos específicos en el objeto `permissions` del usuario.
    - El usuario conserva su `origin` para estadísticas.

---

## 🚢 9. Estándar de Despliegue (Dual-Hosting)

1.  **Frontend:** Se sube vía FTP a Ferozo. Es la cara de la app.
2.  **Backend:** Se actualiza vía Git en el VPS. Es el cerebro de la app.
3.  **Proceso PM2:** 
    - Listar procesos: `pm2 list`.
    - Reiniciar: `pm2 restart nombre-app`.
    - Logs: `pm2 logs nombre-app`.

---

## 🔌 10. Estándar de Sincronización Real-time (WebSockets)

Para aplicaciones que requieren sincronización de interfaces entre múltiples clientes (ej: sliders, botones, parámetros de performance), se debe seguir el patrón de **MASTER / SLAVE** para evitar bucles de retroalimentación infinita y saturación del servidor.

### A. Lógica MASTER / SLAVE
*   **MASTER:** Es el único cliente con permiso para emitir (broadcast) actualizaciones de parámetros al servidor.
*   **SLAVE:** Son todos los demás clientes. Solo reciben y aplican los valores que llegan del servidor, sin re-emitirlos.

### B. El Cambio de Rol: `CLAIM MASTER`
Un cliente debe reclamar el rol de Master dinámicamente:
1.  **Detección de Interacción:** Cuando el cliente detecta una interacción física del usuario (Mouse, Teclado, MIDI, Touch).
2.  **Validación de Estado:** 
    - Si el cliente **YA ES MASTER**, emite el valor directamente sin reclamar nada.
    - Si el cliente **ES SLAVE**, debe enviar primero un evento `claimMaster` al servidor antes de emitir los nuevos valores.
3.  **Broadcasting del Reclamo:** El servidor recibe `claimMaster`, actualiza el socket ID del master actual para esa sesión y avisa a todos los clientes quién es el nuevo Master.
4.  **Cese de Sockets:** Los clientes que dejan de ser Master dejan de emitir automáticamente.

### C. Excepciones: Sincronización Multi-Usuario (Dibujo/Touch)
Existen casos donde **TODOS los clientes emiten simultáneamente** sin necesidad de un Master único. 
Ejemplos:
*   **PIZARRAIA:** Los puntos de dibujo de cada usuario.
*   **JP Shader Editor:** Los punteros de ratón/touch de múltiples usuarios.
En estos casos, se utiliza un array de puntos o coordenadas identificados por `socket.id` para que cada cliente renderice los trazos de los demás sin interferir.

### D. Implementación de Referencia (Socket.io)
```javascript
// Servidor
socket.on('claimMaster', (data) => {
    const { identifier, type } = data; // identifier: roomId o shaderName
    masterBySession.set(identifier, socket.id);
    io.to(identifier).emit('masterClaimed', { socketId: socket.id });
});

// Cliente
function onUserInteraction(paramId, value) {
    if (!amIMaster) {
        socket.emit('claimMaster', { identifier: currentRoom, type: 'performance' });
        amIMaster = true;
    }
    socket.emit('paramUpdate', { id: paramId, val: value });
}

socket.on('masterClaimed', (data) => {
    amIMaster = (data.socketId === socket.id);
});
```

---

> **Compromiso Final:** Este Mega Manual garantiza que el ecosistema Fullscreen sea escalable, seguro y profesional. Ninguna funcionalidad debe desarrollarse fuera de estos parámetros.
