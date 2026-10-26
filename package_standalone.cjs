const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const targetDir = path.join(rootDir, 'NetPulse-Server-Package');

console.log('Packaging NetPulse Standalone Production Package...');

// Clean existing
if (fs.existsSync(targetDir)) {
  fs.rmSync(targetDir, { recursive: true, force: true });
}
fs.mkdirSync(targetDir, { recursive: true });

function copyDirSync(src, dest, filterFn) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (filterFn && !filterFn(entry.name, srcPath)) continue;

    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath, filterFn);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// 1. Copy client/dist
console.log('-> Copying pre-built frontend (client/dist)...');
copyDirSync(
  path.join(rootDir, 'client', 'dist'),
  path.join(targetDir, 'client', 'dist')
);

// 2. Copy server (including server/node_modules)
console.log('-> Copying server engine & node_modules...');
copyDirSync(
  path.join(rootDir, 'server'),
  path.join(targetDir, 'server')
);

// 3. Initialize clean, empty production data databases (Zero clutter for fresh deployment)
console.log('-> Initializing clean, empty production database in data/...');
const targetDataDir = path.join(targetDir, 'data');
fs.mkdirSync(targetDataDir, { recursive: true });
fs.mkdirSync(path.join(targetDataDir, 'history'), { recursive: true });

const cleanDatabaseTemplates = {
  'devices.json': [],
  'alerts.json': [],
  'logs.json': [],
  'monitoring-results.json': [],
  'outages.json': { activeOutages: {}, history: [] },
  'dns-results.json': [],
  'discovery_events.json': [],
  'threat_alerts.json': [],
  'security_audits.json': [],
  'domains.json': [],
  'domain-health-results.json': [],
  'traceroute-cache.json': {},
  'dns_traffic.json': [],
  'settings.json': {
    defaultInterval: 30,
    latencyWarningThresholdMs: 150,
    packetLossWarningPercent: 20,
    jitterWarningThresholdMs: 35,
    retryCountBeforeDown: 2,
    organizationName: 'NetPulse Enterprise NOC',
    reportSubtitle: 'Infrastructure SLA & Downtime Audit Report',
    slaTargetPercent: 99.9,
    reportLogoUrl: '',
    auditRetentionDays: 90,
    ispPublicIp: '',
    ispGatewayIp: '',
    ispName: '',
    ispPool: '',
    enableWebhookAlerts: false,
    webhookUrl: '',
    enableSoundAlerts: false,
    enableDesktopNotifications: false,
    maintenanceMode: false,
    dnsResolvers: [
      { name: 'Google', ip: '8.8.8.8' },
      { name: 'Cloudflare', ip: '1.1.1.1' },
      { name: 'Quad9', ip: '9.9.9.9' }
    ],
    dnsTestDomains: ['google.com', 'cloudflare.com'],
    dnsCheckIntervalSeconds: 300,
    sslWarningDaysThreshold: 14
  }
};

for (const [filename, content] of Object.entries(cleanDatabaseTemplates)) {
  fs.writeFileSync(
    path.join(targetDataDir, filename),
    JSON.stringify(content, null, 2),
    'utf-8'
  );
}

// 4. Copy python-monitor (scanner & diagnostic tools)
console.log('-> Copying python-monitor scripts...');
copyDirSync(
  path.join(rootDir, 'python-monitor'),
  path.join(targetDir, 'python-monitor'),
  (name) => name !== '__pycache__'
);

// 5. Copy starter batch files
console.log('-> Copying starter batch files & guides...');
const filesToCopy = [
  'START_PRODUCTION_SERVER.bat',
  'ALLOW_FIREWALL_PORT_5000.bat',
  'OFFICE_SERVER_DEPLOYMENT_README.md',
  'ecosystem.config.cjs',
  'package.json'
];

for (const file of filesToCopy) {
  const p = path.join(rootDir, file);
  if (fs.existsSync(p)) {
    fs.copyFileSync(p, path.join(targetDir, file));
  }
}

// 5. Add a crystal-clear README inside the package
const quickReadme = `=======================================================================
     NETPULSE NOC - STANDALONE OFFICE SERVER PRODUCTION PACKAGE
=======================================================================

Yeh folder bilkul standalone aur ready-to-run hai!
Is folder ko aap kisi bhi server / PC par rakh kar chala sakte hain:

CHALANE KA TAREEQA:
1. (Pehli Baar) ALLOW_FIREWALL_PORT_5000.bat par right-click karke "Run as administrator" karein.
2. START_PRODUCTION_SERVER.bat par double-click karein!

DASHBOARD KHOLNA:
- Server PC par:          http://localhost:5000
- Office ke doosre PCs se: http://<SERVER-IP>:5000

Tamam pre-built frontend (client/dist) aur backend server dependencies (server/node_modules)
pehle se is folder me pack hain. Koi extra build ya vite chalane ki zaroorat nahi hai!
`;

fs.writeFileSync(path.join(targetDir, 'README_FIRST.txt'), quickReadme);

console.log('Done! Package created at:', targetDir);
