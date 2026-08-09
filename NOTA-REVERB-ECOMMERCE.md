# 🔌 Reverb en el ecommerce (pruebas.hsperu.pe) — publicar notificaciones al ERP

El ecommerce publica eventos `nuevo` al Reverb del ERP (mismo servidor hs-web-python, puerto 8082).

## 1) `.env` del ecommerce (VPS) — variables que SÍ usa (Pusher client)

> NOTA: usa `REVERB_HOST` / `REVERB_PORT` / `REVERB_SCHEME` y las `REVERB_APP_*`.
> `REVERB_SERVER_*` son del servidor Reverb del ERP, NO del ecommerce.

```
REVERB_HOST=127.0.0.1
REVERB_PORT=8082
REVERB_SCHEME=http
REVERB_APP_ID=140e45e252f56bbe
REVERB_APP_KEY=HP3jLKLcVHcO1emMZwiWsLXXRtQaOhS
REVERB_APP_SECRET=M0CGFcGHJM55Ck7A09vuF5Lx59tBDpxKTSbcQGlz
```

Verificar:

```bash
grep -nE "^REVERB_" .env
# debe incluir: REVERB_HOST, REVERB_PORT, REVERB_SCHEME, REVERB_APP_ID/KEY/SECRET
```

## 2) Reiniciar el proceso PM2

```bash
pm2 restart backend-cyberhouse
pm2 list
pm2 logs backend-cyberhouse --lines 20
```

## 3) Verificar publicación

Revisa el log del proceso por errores de autenticación/conexión al publicar `nuevo`.