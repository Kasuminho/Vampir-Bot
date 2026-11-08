let heartbeatInterval = null;

/**
 * Inicia o serviço de envio de pulso (heartbeat) para Healthchecks.io ou BetterStack.
 * O bot envia uma requisição HTTP periódica (padrão: 60s). Se o bot parar de enviar
 * (por crash, desligamento do PC ou queda de internet), os servidores da nuvem
 * detectam a ausência e disparam a notificação imediatamente no Discord.
 */
function startHeartbeatService(url, intervalSeconds = 60) {
  const targetUrl = url || process.env.HEALTHCHECKS_PING_URL || process.env.BETTERSTACK_HEARTBEAT_URL;
  if (!targetUrl) {
    console.log('[HEARTBEAT] Nenhuma URL de monitoramento configurada em HEALTHCHECKS_PING_URL.');
    return;
  }

  const cleanUrl = targetUrl.trim().replace(/\/$/, '');
  const intervalMs = Math.max(15, intervalSeconds) * 1000;

  async function ping(suffix = '') {
    try {
      const fullUrl = suffix ? `${cleanUrl}/${suffix}` : cleanUrl;
      const res = await fetch(fullUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'VampirBot-Uptime-Monitor/1.0'
        }
      });
      return res.ok;
    } catch (err) {
      console.warn('[HEARTBEAT] Falha transitória ao enviar pulso de uptime:', err.message);
      return false;
    }
  }

  // Envia o primeiro pulso imediatamente na inicialização
  ping().then((ok) => {
    if (ok) {
      console.log('[HEARTBEAT] Pulso de inicialização enviado com sucesso para o monitor de Uptime!');
    }
  });

  if (heartbeatInterval) clearInterval(heartbeatInterval);
  heartbeatInterval = setInterval(() => {
    ping();
  }, intervalMs);

  // Registra notificação de falha em caso de exceções não tratadas
  process.on('uncaughtException', (err) => {
    try {
      fetch(`${cleanUrl}/fail`, {
        method: 'POST',
        body: `Crash: ${err.message}`
      }).catch(() => {});
    } catch {}
  });
}

function stopHeartbeatService() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

module.exports = {
  startHeartbeatService,
  stopHeartbeatService,
  startBetterStackHeartbeat: startHeartbeatService
};
