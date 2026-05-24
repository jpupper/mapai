#!/bin/bash

set -euo pipefail

# 1. LIMPIEZA DE CARACTERES ESPECIALES (CRLF)
sed -i 's/\r$//' .env 2>/dev/null
sed -i 's/\r$//' deployscripts/server_update.sh 2>/dev/null

# 2. CARGAR VARIABLES DESDE .ENV
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
else
    echo "ERROR CRITICO: No se encontro el archivo .env en el VPS."
    echo "Asegurate de crear uno en $(pwd)/.env con las credenciales necesarias."
    exit 1
fi

# Configuracion
TOKEN=$(echo ${GITHUB_TOKEN:-""} | tr -d '\r')
REPO=$(echo ${GITHUB_REPO:-"jpupper/diploia"} | tr -d '\r')
BRANCH=$(echo ${GITHUB_BRANCH:-""} | tr -d '\r')
APP_NAME="mapai"
REPO_URL="https://$TOKEN@github.com/$REPO"

echo "------------------------------------------------"
echo "DEPLOOY: $APP_NAME (Repo: $REPO)"
echo "------------------------------------------------"

detect_branch() {
    if [ -n "${BRANCH:-}" ]; then
        echo "$BRANCH"
        return
    fi
    if git ls-remote --exit-code --heads origin main >/dev/null 2>&1; then
        echo "main"
        return
    fi
    if git ls-remote --exit-code --heads origin master >/dev/null 2>&1; then
        echo "master"
        return
    fi
    echo "main"
}

# 3. ACTUALIZACION DE GIT (Reset hard para asegurar que coincide con GitHub)
if [ ! -d ".git" ]; then
    echo "Clonando repositorio por primera vez..."
    git init
    git remote add origin "$REPO_URL"
    TARGET_BRANCH="$(detect_branch)"
    git fetch origin "$TARGET_BRANCH"
    git checkout -B "$TARGET_BRANCH" "origin/$TARGET_BRANCH"
else
    echo "Actualizando repositorio..."
    git remote set-url origin "$REPO_URL"
    TARGET_BRANCH="$(detect_branch)"
    git fetch origin "$TARGET_BRANCH"
    git checkout -B "$TARGET_BRANCH" "origin/$TARGET_BRANCH"
    git reset --hard "origin/$TARGET_BRANCH"
fi

echo "Version desplegada:"
git rev-parse HEAD

# 4. INSTALACION DE DEPENDENCIAS
echo "Instalando dependencias..."
npm install --omit=dev

echo "Chequeando conexion a MongoDB..."
MONGO_CHECK() {
node - <<'NODE'
const mongoose = require('mongoose');
const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/diploia';
mongoose.connect(uri, { serverSelectionTimeoutMS: 6000 })
  .then(async () => {
    console.log(`[OK] MongoDB responde: ${uri}`);
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error(`[ERR] No se pudo conectar a MongoDB: ${uri}`);
    console.error(String(err && err.message ? err.message : err));
    try { await mongoose.disconnect(); } catch {}
    process.exit(1);
  });
NODE
}

if ! MONGO_CHECK; then
    if echo "${MONGODB_URI:-mongodb://localhost:27017/diploia}" | grep -Eq 'mongodb://(localhost|127\.0\.0\.1)'; then
        echo "Intentando reiniciar MongoDB (servicio local)..."
        (systemctl restart mongod || systemctl restart mongodb || service mongod restart || service mongodb restart) 2>/dev/null || true
    fi
    echo "Reintentando conexion a MongoDB..."
    MONGO_CHECK || exit 1
fi

# 5. REINICIO TOTAL DE PM2 (Borrar y Crear)
echo "Reestableciendo instancia de PM2..."
if ! command -v pm2 >/dev/null 2>&1; then
    npm install -g pm2
fi
pm2 delete "$APP_NAME" 2>/dev/null || true
pm2 start server.js --name "$APP_NAME" || echo "Fallo critico: No se encontro el archivo para PM2"
pm2 save

echo "------------------------------------------------"
echo "DEPLOY FINALIZADO CON EXITO"
echo "------------------------------------------------"
pm2 list
echo "------------------------------------------------"
