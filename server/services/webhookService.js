/**
 * NetPulse Webhook Dispatcher
 * Dispatches real-time outage & recovery alerts to Discord, Slack, Teams, or custom webhooks.
 */

export async function sendAlertWebhook(webhookUrl, { title, message, status, device, ip, timestamp }) {
  if (!webhookUrl || typeof webhookUrl !== 'string' || !webhookUrl.startsWith('http')) {
    return false;
  }

  const isDiscord = webhookUrl.includes('discord.com/api/webhooks');
  const isSlack = webhookUrl.includes('hooks.slack.com');

  let payload;
  const timeStr = timestamp || new Date().toISOString();

  if (isDiscord) {
    const color = status === 'DOWN' ? 0xef4444 : status === 'RECOVERY' || status === 'UP' ? 0x10b981 : 0xf59e0b;
    payload = {
      username: 'NetPulse Enterprise Monitor',
      avatar_url: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
      embeds: [{
        title: title || (status === 'DOWN' ? '🚨 Host Outage Alert' : '✅ Host Recovery Alert'),
        description: message || 'Network status change detected',
        color,
        fields: [
          { name: 'Device Name', value: String(device || 'Unknown'), inline: true },
          { name: 'Target IP', value: String(ip || 'N/A'), inline: true },
          { name: 'Current Status', value: `**${status}**`, inline: true }
        ],
        footer: { text: 'NetPulse Real-Time NOC Monitor' },
        timestamp: timeStr
      }]
    };
  } else if (isSlack) {
    const icon = status === 'DOWN' ? '🔴' : '🟢';
    payload = {
      text: `${icon} *${title || 'NetPulse Alert'}*\n>${message || ''}\n*Device:* \`${device}\` (${ip}) | *Status:* *${status}*`
    };
  } else {
    payload = {
      event: 'NETPULSE_ALERT',
      title: title || 'NetPulse Alert',
      message: message || '',
      status: status || 'INFO',
      device: device || 'System',
      ip: ip || '127.0.0.1',
      timestamp: timeStr
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const resp = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'NetPulse-Monitoring-Engine/2.0'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      throw new Error(`Webhook endpoint returned HTTP ${resp.status}: ${errText.slice(0, 100)}`);
    }
    return true;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

export default {
  sendAlertWebhook
};
