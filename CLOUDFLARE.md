# ☁️ CLOUDFLARE.md - Deploy Guide

**Guía de deploy via Cloudflare Tunnel**  
**Requiere:** `cloudflared` instalado (✅ ya está)  

---

## 🔄 Actualización V2 (2026-02-18)

Antes de hacer rollout público con Cloudflare, completar primero:
1. Fix modal close/minimize (click afuera + `Esc`).
2. Fix runtime Claude `EXITED` en entorno local.
3. Refactor base según `docs/analysis-extended/refactor-v2-master-plan.md`.

### Nota importante de WebSocket en esta app
El socket está montado en:

`/api/socket-io`

No usar `/socket.io/` en documentación nueva del proyecto.

### Ingress recomendado (actualizado)
```yaml
ingress:
  - hostname: terminalnexus.tudominio.com
    service: http://localhost:3000
  - service: http_status:404
```

Con Socket.io en el mismo host/puerto, Cloudflare enruta también `/api/socket-io` sin regla separada.

---

## 1. Pre-requisitos

```bash
# Verificar que cloudflared está instalado
cloudflared --version

# Verificar que está logueado
cloudflared tunnel list
```

Si no está logueado:
```bash
cloudflared tunnel login
# Abre el browser para autenticar
```

---

## 2. Crear Tunnel

```bash
# Crear tunnel (una sola vez)
cloudflared tunnel create terminal-nexus

# Guarda el tunnel-id que te devuelve
# Ejemplo: 8f2a9c4b-1234-5678-90ab-cdefghijklmnop
```

---

## 3. Configurar DNS

```bash
# Reemplaza con tu dominio real
# Esto crea el CNAME en Cloudflare automáticamente

cloudflared tunnel route dns terminal-nexus terminalnexus.tudominio.com

# Si querés un subdominio diferente:
cloudflared tunnel route dns terminal-nexus nexus.tudominio.com
```

---

## 4. Configuración del Tunnel

Crear archivo de config:

```bash
sudo mkdir -p /etc/cloudflared
sudo nano /etc/cloudflared/config.yml
```

Contenido:
```yaml
tunnel: TU-TUNNEL-ID-AQUI
credentials-file: /etc/cloudflared/TU-TUNNEL-ID-AQUI.json

# Opcional: logs
logfile: /var/log/cloudflared.log

# Configuración de ingress
ingress:
  # Regla 1: El dashboard
  - hostname: terminalnexus.tudominio.com
    service: http://localhost:3000
    
  # Regla 2: Catch-all (404)
  - service: http_status:404
```

---

## 5. Instalar como Servicio

```bash
# Instalar systemd service
sudo cloudflared service install

# Verificar que se creó el servicio
sudo systemctl status cloudflared

# Start y enable
sudo systemctl start cloudflared
sudo systemctl enable cloudflared
```

---

## 6. Cloudflare Access (Opcional - Recomendado)

Para proteger con login (Zero Trust):

1. Ir a Cloudflare Dashboard → Zero Trust → Access → Applications
2. "Add an application" → Self-hosted
3. Configurar:
   - Application name: Terminal Nexus
   - Session duration: 24h
   - Domain: terminalnexus.tudominio.com
4. Add policies:
   - Name: Allow Admin
   - Action: Allow
   - Include: Email address → tu-email@gmail.com
5. Save

Ahora pedirá login antes de mostrar el dashboard.

---

## 7. Verificación

```bash
# Verificar tunnel está healthy
cloudflared tunnel info terminal-nexus

# Ver logs
sudo journalctl -u cloudflared -f

# Test
# Abrir en browser: https://terminalnexus.tudominio.com
```

---

## 8. Troubleshooting

### Tunnel no conecta
```bash
# Restart service
sudo systemctl restart cloudflared

# Ver logs detallados
sudo cloudflared tunnel run --loglevel debug terminal-nexus
```

### WebSocket no funciona
- Asegurar que Cloudflare proxy está ON (nube naranja en DNS)
- Verificar que la app responde en `/api/socket-io` (sin regla separada de ingress)
- Revisar headers: `Upgrade: websocket`, `Connection: Upgrade`

### Error 502
- El backend no está corriendo en localhost:3000
- Verificar `sudo systemctl status terminal-nexus`

---

## 9. Comandos Útiles

```bash
# Listar tunnels
cloudflared tunnel list

# Info de un tunnel
cloudflared tunnel info terminal-nexus

# Logs en tiempo real
sudo tail -f /var/log/cloudflared.log

# Restart
sudo systemctl restart cloudflared

# Eliminar tunnel (cuidado!)
cloudflared tunnel delete terminal-nexus
```

---

## 10. Configuración Final (Checklist)

- [ ] Tunnel creado y funcionando
- [ ] DNS apuntando al tunnel
- [ ] Servicio systemd de cloudflared activo
- [ ] Dashboard corriendo en localhost:3000
- [ ] Acceso desde `https://terminalnexus.tudominio.com`
- [ ] WebSocket conecta correctamente (revisar network tab)
- [ ] Cloudflare Access configurado (opcional pero recomendado)

---

*Configurado para: Terminal Nexus Dashboard*
