import net from 'net';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import dataStore from './dataStore.js';
import { broadcastDeviceStatus } from '../websocket/socketHandler.js';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = process.env.DATA_DIR || path.resolve(__dirname, '../../data');

const AUDITS_FILE = path.join(DATA_DIR, 'security_audits.json');
const TRAFFIC_FILE = path.join(DATA_DIR, 'dns_traffic.json');
const THREATS_FILE = path.join(DATA_DIR, 'threat_alerts.json');
const POLICY_FILE = path.join(DATA_DIR, 'search_policy_rules.json');
const ENDPOINT_FILE = path.join(DATA_DIR, 'endpoint_telemetry.json');
const ENDPOINTS_DIR = path.join(DATA_DIR, 'endpoints');

// Sanitize IP or Hostname to safe filesystem filename
export function sanitizeEndpointKey(key = '') {
  return String(key || 'unknown')
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '_');
}

const DEFAULT_SEARCH_POLICY = {
  restrictedRules: [
    'netflix.com',
    'tiktok.com',
    'olx.com.pk',
    'daraz.pk',
    'freeconvert.com',
    'freedownloadmanager.org',
    'cricinfo.com',
    'torrent',
    'vpn',
    'movie download',
    'games'
  ],
  criticalRules: [
    'ransomware',
    'hack',
    'crack',
    'keygen',
    'piratebay',
    '1337x',
    'darkweb',
    'bypass firewall',
    'exploit',
    'mimikatz',
    'metasploit',
    'bet365',
    '1xbet',
    'whatismyipaddress.com'
  ]
};

// Ensure data files exist
function initSecurityStorage() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(AUDITS_FILE)) {
    fs.writeFileSync(AUDITS_FILE, JSON.stringify({}, null, 2));
  }
  if (!fs.existsSync(TRAFFIC_FILE)) {
    fs.writeFileSync(TRAFFIC_FILE, JSON.stringify([], null, 2));
  }
  if (!fs.existsSync(THREATS_FILE)) {
    fs.writeFileSync(THREATS_FILE, JSON.stringify([], null, 2));
  }
  if (!fs.existsSync(POLICY_FILE)) {
    fs.writeFileSync(POLICY_FILE, JSON.stringify(DEFAULT_SEARCH_POLICY, null, 2));
  }
  if (!fs.existsSync(ENDPOINTS_DIR)) {
    fs.mkdirSync(ENDPOINTS_DIR, { recursive: true });
  }
}
initSecurityStorage();

// Critical & Common Ports Threat Catalog
export const PORT_CATALOG = [
  {
    port: 445,
    service: 'SMB / CIFS',
    risk: 'CRITICAL',
    protocol: 'TCP',
    cve: 'CVE-2017-0144 (EternalBlue) / MS17-010',
    attackType: 'Ransomware Lateral Propagation & Remote Code Execution',
    description: 'Server Message Block file & printer sharing protocol',
    exploitTarget: 'WannaCry, NotPetya, EternalBlue, Lateral Ransomware Propagation',
    mitigation: 'Block port 445 on WAN and internal boundaries. Disable legacy SMBv1 and enforce SMB signing/encryption.',
    remediationSteps: [
      'Immediately block Port 445 on perimeter firewalls and router WAN interfaces.',
      'Disable legacy SMBv1 in Windows (Disable-WindowsOptionalFeature -Online -FeatureName SMB1Protocol).',
      'Enforce SMB signing and SMB encryption for internal file shares.',
      'Isolate internal file sharing to dedicated private management VLANs.'
    ],
    firewallCmd: {
      powershell: 'New-NetFirewallRule -DisplayName "Block Port 445 (SMB/CIFS)" -Direction Inbound -LocalPort 445 -Protocol TCP -Action Block',
      linuxUfw: 'sudo ufw deny 445/tcp',
      linuxIptables: 'sudo iptables -A INPUT -p tcp --dport 445 -j DROP'
    }
  },
  {
    port: 3389,
    service: 'RDP (Remote Desktop)',
    risk: 'CRITICAL',
    protocol: 'TCP',
    cve: 'CVE-2019-0708 (BlueKeep) & Credential Spraying',
    attackType: 'Pre-Auth Remote Code Execution & Automated Brute Force',
    description: 'Windows Remote Desktop Protocol administrative access',
    exploitTarget: 'BlueKeep, Automated credential brute-force, Ransomware deployment',
    mitigation: 'Never expose RDP directly to network. Restrict access through VPN, require NLA, and enable MFA.',
    remediationSteps: [
      'Never expose RDP (Port 3389) directly to public Internet or untrusted subnets.',
      'Require secure WireGuard / OpenVPN or SSH Bastion tunnel to access remote desktops.',
      'Enforce Network Level Authentication (NLA) on Windows System Properties.',
      'Configure Account Lockout Policies to prevent automated password dictionary attacks.'
    ],
    firewallCmd: {
      powershell: 'New-NetFirewallRule -DisplayName "Block Port 3389 (RDP)" -Direction Inbound -LocalPort 3389 -Protocol TCP -Action Block',
      linuxUfw: 'sudo ufw deny 3389/tcp',
      linuxIptables: 'sudo iptables -A INPUT -p tcp --dport 3389 -j DROP'
    }
  },
  {
    port: 23,
    service: 'Telnet',
    risk: 'CRITICAL',
    protocol: 'TCP',
    cve: 'CWE-319 (Cleartext Transmission of Sensitive Information) / Mirai',
    attackType: 'Cleartext Credential Eavesdropping & IoT Botnet Takeover',
    description: 'Unencrypted legacy remote terminal session',
    exploitTarget: 'Cleartext credential eavesdropping, Mirai IoT botnet propagation',
    mitigation: 'Disable Telnet daemon completely. Migrate to SSH (Port 22) with key authentication.',
    remediationSteps: [
      'Stop and permanently disable the Telnet service daemon.',
      'Migrate all remote management to SSH (Port 22) with Ed25519 cryptographic keys.',
      'Change default manufacturer credentials on all network routers and switches.'
    ],
    firewallCmd: {
      powershell: 'Stop-Service -Name "TlntSvr" -ErrorAction SilentlyContinue; New-NetFirewallRule -DisplayName "Block Port 23 (Telnet)" -Direction Inbound -LocalPort 23 -Protocol TCP -Action Block',
      linuxUfw: 'sudo ufw deny 23/tcp',
      linuxIptables: 'sudo iptables -A INPUT -p tcp --dport 23 -j DROP'
    }
  },
  {
    port: 27017,
    service: 'MongoDB',
    risk: 'CRITICAL',
    protocol: 'TCP',
    cve: 'CWE-306 (Missing Authentication for Critical Function)',
    attackType: 'Unauthenticated Data Dump & Database Ransomware Extortion',
    description: 'NoSQL Document Database Engine',
    exploitTarget: 'Unauthenticated database wipe, ransomware database extortions',
    mitigation: 'Bind to 127.0.0.1 or private VPC only. Enable authorization in mongod.conf.',
    remediationSteps: [
      'Bind MongoDB strictly to localhost (127.0.0.1) in mongod.conf (net.bindIp: 127.0.0.1).',
      'Enable database user authentication: security.authorization: enabled.',
      'Block Port 27017 from all external and public network segments.'
    ],
    firewallCmd: {
      powershell: 'New-NetFirewallRule -DisplayName "Block Port 27017 (MongoDB)" -Direction Inbound -LocalPort 27017 -Protocol TCP -Action Block',
      linuxUfw: 'sudo ufw deny 27017/tcp',
      linuxIptables: 'sudo iptables -A INPUT -p tcp --dport 27017 -j DROP'
    }
  },
  {
    port: 6379,
    service: 'Redis',
    risk: 'CRITICAL',
    protocol: 'TCP',
    cve: 'CWE-284 (Improper Access Control) & Cron RCE',
    attackType: 'Unauthenticated Remote Code Execution & SSH Key Overwrite',
    description: 'In-Memory Data Store & Cache',
    exploitTarget: 'Unauthenticated Remote Code Execution (cron write / SSH key upload)',
    mitigation: 'Set strong requirepass, rename dangerous commands (FLUSHALL, CONFIG), bind to localhost.',
    remediationSteps: [
      'Bind Redis strictly to localhost (127.0.0.1) in redis.conf (bind 127.0.0.1).',
      'Set a strong 32+ character authentication key using "requirepass <Password>".',
      'Rename or disable destructive commands: rename-command FLUSHALL "" and rename-command CONFIG "".'
    ],
    firewallCmd: {
      powershell: 'New-NetFirewallRule -DisplayName "Block Port 6379 (Redis)" -Direction Inbound -LocalPort 6379 -Protocol TCP -Action Block',
      linuxUfw: 'sudo ufw deny 6379/tcp',
      linuxIptables: 'sudo iptables -A INPUT -p tcp --dport 6379 -j DROP'
    }
  },
  {
    port: 135,
    service: 'MS RPC / EPMAP',
    risk: 'HIGH',
    protocol: 'TCP',
    cve: 'MS03-026 / MS03-039 (Blaster Worm)',
    attackType: 'RPC Buffer Overflow & Remote System Enumeration',
    description: 'Microsoft Remote Procedure Call Endpoint Mapper',
    exploitTarget: 'Blaster worm, unauthenticated RPC buffer overflows, system reconnaissance',
    mitigation: 'Block port 135 at firewall. Filter inbound RPC from untrusted network segments.',
    remediationSteps: [
      'Block Port 135 on perimeter router and host firewall.',
      'Filter inbound RPC requests and restrict to authorized domain controllers only.'
    ],
    firewallCmd: {
      powershell: 'New-NetFirewallRule -DisplayName "Block Port 135 (MS RPC)" -Direction Inbound -LocalPort 135 -Protocol TCP -Action Block',
      linuxUfw: 'sudo ufw deny 135/tcp',
      linuxIptables: 'sudo iptables -A INPUT -p tcp --dport 135 -j DROP'
    }
  },
  {
    port: 139,
    service: 'NetBIOS Session',
    risk: 'HIGH',
    protocol: 'TCP',
    cve: 'NetBIOS Name Service Poisoning (LLMNR/NBT-NS)',
    attackType: 'Relay Attacks, NTLM Hash Harvesting & Man-in-the-Middle',
    description: 'NetBIOS Session Service for Windows Workgroups',
    exploitTarget: 'NetBIOS name enumeration, session hijacking, relay attacks',
    mitigation: 'Disable NetBIOS over TCP/IP in Network Adapter IPv4 Advanced settings.',
    remediationSteps: [
      'Disable NetBIOS over TCP/IP in Network Adapter IPv4 Advanced WINS settings.',
      'Block Inbound Port 139 on all external and untrusted interfaces.'
    ],
    firewallCmd: {
      powershell: 'New-NetFirewallRule -DisplayName "Block Port 139 (NetBIOS)" -Direction Inbound -LocalPort 139 -Protocol TCP -Action Block',
      linuxUfw: 'sudo ufw deny 139/tcp',
      linuxIptables: 'sudo iptables -A INPUT -p tcp --dport 139 -j DROP'
    }
  },
  {
    port: 1433,
    service: 'MS SQL Server',
    risk: 'HIGH',
    protocol: 'TCP',
    cve: 'xp_cmdshell Remote Code Execution & SA Dictionary Attacks',
    attackType: 'Database Takeover & OS Command Execution',
    description: 'Microsoft SQL Relational Database',
    exploitTarget: 'Automated SA user brute-force, xp_cmdshell command execution',
    mitigation: 'Change default port, disable SA account, bind to internal interfaces only.',
    remediationSteps: [
      'Disable or rename default SA administrator account and enforce complex passwords.',
      'Disable xp_cmdshell extended stored procedures in SQL Server Management Studio.',
      'Restrict SQL Server TCP listening to internal application server IP addresses.'
    ],
    firewallCmd: {
      powershell: 'New-NetFirewallRule -DisplayName "Block Port 1433 (MS SQL)" -Direction Inbound -LocalPort 1433 -Protocol TCP -Action Block',
      linuxUfw: 'sudo ufw deny 1433/tcp',
      linuxIptables: 'sudo iptables -A INPUT -p tcp --dport 1433 -j DROP'
    }
  },
  {
    port: 3306,
    service: 'MySQL',
    risk: 'MEDIUM',
    protocol: 'TCP',
    cve: 'CWE-287 (Improper Authentication) / External Exposure',
    attackType: 'Credential Brute-Force & Unauthorized Data Exfiltration',
    description: 'MySQL / MariaDB database server',
    exploitTarget: 'Credential brute-force, unauthorized external database extraction',
    mitigation: 'Ensure bind-address = 127.0.0.1 and disable remote root login.',
    remediationSteps: [
      'Set bind-address = 127.0.0.1 in MySQL config (my.cnf or my.ini).',
      'Disable remote root login; allow root access from localhost only.',
      'Grant database permissions only to specific web server host IPs.'
    ],
    firewallCmd: {
      powershell: 'New-NetFirewallRule -DisplayName "Block Port 3306 (MySQL)" -Direction Inbound -LocalPort 3306 -Protocol TCP -Action Block',
      linuxUfw: 'sudo ufw deny 3306/tcp',
      linuxIptables: 'sudo iptables -A INPUT -p tcp --dport 3306 -j DROP'
    }
  },
  {
    port: 5432,
    service: 'PostgreSQL',
    risk: 'MEDIUM',
    protocol: 'TCP',
    cve: 'CWE-284 (Improper Access Control)',
    attackType: 'Database Credential Dictionary Attacks & Table Dumps',
    description: 'PostgreSQL Object-Relational Database',
    exploitTarget: 'Database credential dictionary attacks, unauthorized table access',
    mitigation: 'Restrict pg_hba.conf client CIDRs to authorized application hosts only.',
    remediationSteps: [
      'Restrict pg_hba.conf client addresses strictly to application host CIDR blocks.',
      'Enforce SCRAM-SHA-256 password hashing for all PostgreSQL user roles.',
      'Block Port 5432 at perimeter router and firewall.'
    ],
    firewallCmd: {
      powershell: 'New-NetFirewallRule -DisplayName "Block Port 5432 (PostgreSQL)" -Direction Inbound -LocalPort 5432 -Protocol TCP -Action Block',
      linuxUfw: 'sudo ufw deny 5432/tcp',
      linuxIptables: 'sudo iptables -A INPUT -p tcp --dport 5432 -j DROP'
    }
  },
  {
    port: 21,
    service: 'FTP',
    risk: 'MEDIUM',
    protocol: 'TCP',
    cve: 'CWE-319 (Cleartext Protocol Exposure)',
    attackType: 'Cleartext Credential Sniffing & Anonymous Malware Upload',
    description: 'File Transfer Protocol (Cleartext)',
    exploitTarget: 'Cleartext username/password sniffing, anonymous upload malware hosting',
    mitigation: 'Decommission plain FTP; transition to SFTP (Port 22) or FTPS (TLS/SSL).',
    remediationSteps: [
      'Disable anonymous FTP logins immediately.',
      'Decommission plain unencrypted FTP; transition to SFTP (Port 22) or FTPS.',
      'Block Inbound Port 21 on firewall.'
    ],
    firewallCmd: {
      powershell: 'New-NetFirewallRule -DisplayName "Block Port 21 (FTP)" -Direction Inbound -LocalPort 21 -Protocol TCP -Action Block',
      linuxUfw: 'sudo ufw deny 21/tcp',
      linuxIptables: 'sudo iptables -A INPUT -p tcp --dport 21 -j DROP'
    }
  },
  {
    port: 22,
    service: 'SSH',
    risk: 'LOW',
    protocol: 'TCP',
    cve: 'Automated SSH Dictionary Attacks',
    attackType: 'Automated Dictionary / Brute-Force Scanning',
    description: 'Secure Shell Remote Administration',
    exploitTarget: 'Automated dictionary / brute-force scanning',
    mitigation: 'Enforce public key authentication only, disable root login, deploy Fail2ban.',
    remediationSteps: [
      'Disable password authentication (PasswordAuthentication no) in sshd_config.',
      'Disable direct root login (PermitRootLogin no).',
      'Deploy Fail2ban or CrowdSec to automatically drop brute-forcing IPs.'
    ],
    firewallCmd: {
      powershell: 'New-NetFirewallRule -DisplayName "Restrict Port 22 (SSH)" -Direction Inbound -LocalPort 22 -Protocol TCP -Action Block',
      linuxUfw: 'sudo ufw limit 22/tcp',
      linuxIptables: 'sudo iptables -A INPUT -p tcp --dport 22 -m state --state NEW -m recent --set -j ACCEPT'
    }
  },
  {
    port: 80,
    service: 'HTTP',
    risk: 'LOW',
    protocol: 'TCP',
    cve: 'CWE-319 (Unencrypted Web Communications)',
    attackType: 'Man-in-the-Middle Credential Interception',
    description: 'Unencrypted World Wide Web Hypertext Transfer',
    exploitTarget: 'Man-in-the-Middle credential interception, cookie hijacking',
    mitigation: 'Redirect all HTTP traffic to HTTPS (Port 443) and implement HTTP Strict Transport Security (HSTS).',
    remediationSteps: [
      'Configure web server to redirect 100% of HTTP traffic to HTTPS.',
      'Deploy HSTS (Strict-Transport-Security) header with max-age=31536000.'
    ],
    firewallCmd: {
      powershell: 'New-NetFirewallRule -DisplayName "Block Port 80 (HTTP)" -Direction Inbound -LocalPort 80 -Protocol TCP -Action Block',
      linuxUfw: 'sudo ufw deny 80/tcp',
      linuxIptables: 'sudo iptables -A INPUT -p tcp --dport 80 -j DROP'
    }
  },
  {
    port: 443,
    service: 'HTTPS',
    risk: 'SAFE',
    protocol: 'TCP',
    cve: 'Standard Encrypted Web Channel',
    attackType: 'Encrypted Web Communications (Monitor Web App Layer)',
    description: 'Encrypted Secure Web Server (TLS/SSL)',
    exploitTarget: 'Web application vulnerabilities (SQLi, XSS) - Port itself is secure',
    mitigation: 'Keep web application libraries patched and enforce TLS 1.2+ with modern cipher suites.',
    remediationSteps: [
      'Ensure TLS 1.2 and TLS 1.3 are enabled while deprecating SSLv3, TLS 1.0, and TLS 1.1.',
      'Maintain automated renewal of valid SSL/TLS certificates.'
    ],
    firewallCmd: {
      powershell: '# Port 443 is typically required for encrypted web traffic',
      linuxUfw: 'sudo ufw allow 443/tcp',
      linuxIptables: 'sudo iptables -A INPUT -p tcp --dport 443 -j ACCEPT'
    }
  },
  {
    port: 53,
    service: 'DNS',
    risk: 'INFO',
    protocol: 'TCP/UDP',
    cve: 'DNS Amplification / Cache Poisoning',
    attackType: 'DDoS Reflection & Cache Poisoning',
    description: 'Domain Name System Resolution',
    exploitTarget: 'DNS amplification DDoS reflector, DNS cache poisoning',
    mitigation: 'Ensure recursive resolver is closed to external public IPs.',
    remediationSteps: [
      'Ensure open recursion is disabled for public external IP addresses.',
      'Deploy DNS Response Rate Limiting (RRL) to block amplification attacks.'
    ],
    firewallCmd: {
      powershell: 'New-NetFirewallRule -DisplayName "Block Port 53 External DNS" -Direction Inbound -LocalPort 53 -Protocol UDP -Action Block',
      linuxUfw: 'sudo ufw deny 53',
      linuxIptables: 'sudo iptables -A INPUT -p udp --dport 53 -j DROP'
    }
  },
  {
    port: 8080,
    service: 'HTTP Alt / Proxy',
    risk: 'LOW',
    protocol: 'TCP',
    cve: 'Exposed Management / Development Consoles',
    attackType: 'Internal Console Reconnaissance & Credential Spraying',
    description: 'Alternate Web / Proxy / Management UI',
    exploitTarget: 'Exposed internal development consoles (Tomcat, Jenkins, Node)',
    mitigation: 'Ensure administrative consoles require strong multi-factor authentication.',
    remediationSteps: [
      'Block public exposure of development / staging application servers.',
      'Enforce strong authentication and VPN access for administrative dashboards.'
    ],
    firewallCmd: {
      powershell: 'New-NetFirewallRule -DisplayName "Block Port 8080" -Direction Inbound -LocalPort 8080 -Protocol TCP -Action Block',
      linuxUfw: 'sudo ufw deny 8080/tcp',
      linuxIptables: 'sudo iptables -A INPUT -p tcp --dport 8080 -j DROP'
    }
  }
];

// Asynchronous single TCP port probe with fast timeout
export function probePort(host, port, timeoutMs = 700) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let isFinished = false;

    socket.setTimeout(timeoutMs);

    socket.on('connect', () => {
      if (!isFinished) {
        isFinished = true;
        socket.destroy();
        resolve({ port, open: true });
      }
    });

    socket.on('timeout', () => {
      if (!isFinished) {
        isFinished = true;
        socket.destroy();
        resolve({ port, open: false, reason: 'timeout' });
      }
    });

    socket.on('error', (err) => {
      if (!isFinished) {
        isFinished = true;
        socket.destroy();
        resolve({ port, open: false, error: err.code || err.message });
      }
    });

    try {
      socket.connect(port, host);
    } catch (err) {
      if (!isFinished) {
        isFinished = true;
        resolve({ port, open: false, error: err.message });
      }
    }
  });
}

export async function checkHostReachable(host, timeoutMs = 600) {
  try {
    const cleanHost = String(host || '').split(':')[0].trim();
    if (!cleanHost) return false;
    if (cleanHost === '127.0.0.1' || cleanHost === 'localhost' || cleanHost === '::1') return true;

    const isWin = process.platform === 'win32';
    const pingCmd = 'ping';
    const args = isWin ? ['-n', '1', '-w', String(timeoutMs), cleanHost] : ['-c', '1', '-W', '1', cleanHost];
    const { stdout } = await execFileAsync(pingCmd, args, { timeout: timeoutMs + 400 });
    return /TTL=|bytes from/i.test(stdout) && !/Destination host unreachable|Request timed out|100% loss|could not find host|General failure/i.test(stdout);
  } catch (err) {
    return false;
  }
}

// Security Audit for a single Device/IP
export async function auditDevicePorts(device) {
  const rawHost = typeof device === 'string' ? device : device.ip;
  const cleanHost = String(rawHost || '').split(':')[0].trim();
  const host = cleanHost;
  const deviceName = typeof device === 'object' ? device.name : rawHost;
  const deviceId = typeof device === 'object' ? device.id : rawHost;
  const knownStatus = typeof device === 'object' ? (device.status || '').toUpperCase() : '';

  // 1. If device is explicitly marked DOWN or PAUSED or monitoring is disabled
  if (knownStatus === 'DOWN' || knownStatus === 'PAUSED' || (typeof device === 'object' && device.monitoring === false)) {
    const offlineReport = {
      deviceId,
      deviceName,
      ip: rawHost,
      scannedAt: new Date().toISOString(),
      isOnline: false,
      riskScore: null,
      overallLevel: 'OFFLINE',
      totalScanned: 0,
      openPortsCount: 0,
      openPorts: [],
      threats: [],
      statusNote: 'Device is currently DOWN / Offline. Port vulnerability audit cannot be performed on an unreachable host.'
    };
    saveDeviceAudit(deviceId, offlineReport);
    return offlineReport;
  }

  // 2. Scan all catalog ports in parallel
  const probePromises = PORT_CATALOG.map(async (item) => {
    const result = await probePort(host, item.port);
    return {
      ...item,
      open: result.open
    };
  });

  const probedPorts = await Promise.all(probePromises);
  const openPorts = probedPorts.filter((p) => p.open);

  // 3. Pre-check: If 0 open ports responded, verify if host is REALLY reachable right now
  let isOnline = true;
  if (openPorts.length === 0) {
    if (host === '127.0.0.1' || host === 'localhost') {
      isOnline = true;
    } else {
      // Must actually test real live reachability right now
      const pingOk = await checkHostReachable(host, 600);
      isOnline = pingOk;
    }
  }

  if (!isOnline) {
    const offlineReport = {
      deviceId,
      deviceName,
      ip: rawHost,
      scannedAt: new Date().toISOString(),
      isOnline: false,
      riskScore: null,
      overallLevel: 'OFFLINE',
      totalScanned: PORT_CATALOG.length,
      openPortsCount: 0,
      openPorts: [],
      threats: [],
      statusNote: 'Device is offline / unreachable. Bring device online to audit ports.'
    };
    saveDeviceAudit(deviceId, offlineReport);
    return offlineReport;
  }

  // 4. Host is online - compute risk score
  let riskScore = 100;
  let hasCritical = false;
  let hasHigh = false;
  let hasMedium = false;

  const threatsFound = [];

  for (const p of openPorts) {
    if (p.risk === 'CRITICAL') {
      riskScore -= 28;
      hasCritical = true;
      threatsFound.push({
        id: `threat-${deviceId}-${p.port}-${Date.now()}`,
        deviceId,
        deviceName,
        deviceIp: host,
        port: p.port,
        service: p.service,
        severity: 'CRITICAL',
        protocol: p.protocol || 'TCP',
        cve: p.cve || 'N/A',
        attackType: p.attackType || 'Critical Exploit Exposure',
        title: `Critical Port ${p.port} (${p.service}) Exposed`,
        description: `Device has ${p.service} open. Potential attack vector: ${p.exploitTarget}`,
        recommendation: p.mitigation,
        remediationSteps: p.remediationSteps || [p.mitigation],
        firewallCmd: p.firewallCmd || {
          powershell: `New-NetFirewallRule -DisplayName "Block Port ${p.port}" -Direction Inbound -LocalPort ${p.port} -Protocol TCP -Action Block`,
          linuxUfw: `sudo ufw deny ${p.port}/tcp`,
          linuxIptables: `sudo iptables -A INPUT -p tcp --dport ${p.port} -j DROP`
        },
        timestamp: new Date().toISOString()
      });
    } else if (p.risk === 'HIGH') {
      riskScore -= 16;
      hasHigh = true;
      threatsFound.push({
        id: `threat-${deviceId}-${p.port}-${Date.now()}`,
        deviceId,
        deviceName,
        deviceIp: host,
        port: p.port,
        service: p.service,
        severity: 'HIGH',
        protocol: p.protocol || 'TCP',
        cve: p.cve || 'N/A',
        attackType: p.attackType || 'High Risk Exposure',
        title: `High Risk Port ${p.port} (${p.service}) Open`,
        description: `Exposed ${p.service} service is susceptible to: ${p.exploitTarget}`,
        recommendation: p.mitigation,
        remediationSteps: p.remediationSteps || [p.mitigation],
        firewallCmd: p.firewallCmd || {
          powershell: `New-NetFirewallRule -DisplayName "Block Port ${p.port}" -Direction Inbound -LocalPort ${p.port} -Protocol TCP -Action Block`,
          linuxUfw: `sudo ufw deny ${p.port}/tcp`,
          linuxIptables: `sudo iptables -A INPUT -p tcp --dport ${p.port} -j DROP`
        },
        timestamp: new Date().toISOString()
      });
    } else if (p.risk === 'MEDIUM') {
      riskScore -= 8;
      hasMedium = true;
      threatsFound.push({
        id: `threat-${deviceId}-${p.port}-${Date.now()}`,
        deviceId,
        deviceName,
        deviceIp: host,
        port: p.port,
        service: p.service,
        severity: 'MEDIUM',
        protocol: p.protocol || 'TCP',
        cve: p.cve || 'N/A',
        attackType: p.attackType || 'Database / Service Exposure',
        title: `Medium Risk Port ${p.port} (${p.service}) Open`,
        description: `Exposed ${p.service} service is susceptible to: ${p.exploitTarget}`,
        recommendation: p.mitigation,
        remediationSteps: p.remediationSteps || [p.mitigation],
        firewallCmd: p.firewallCmd || {
          powershell: `New-NetFirewallRule -DisplayName "Block Port ${p.port}" -Direction Inbound -LocalPort ${p.port} -Protocol TCP -Action Block`,
          linuxUfw: `sudo ufw deny ${p.port}/tcp`,
          linuxIptables: `sudo iptables -A INPUT -p tcp --dport ${p.port} -j DROP`
        },
        timestamp: new Date().toISOString()
      });
    } else if (p.risk === 'LOW') {
      riskScore -= 2;
    }
  }

  riskScore = Math.max(10, Math.min(100, riskScore));

  let overallLevel = 'SAFE';
  if (hasCritical) overallLevel = 'CRITICAL';
  else if (hasHigh) overallLevel = 'HIGH';
  else if (hasMedium || riskScore < 85) overallLevel = 'MEDIUM';

  const auditReport = {
    deviceId,
    deviceName,
    ip: host,
    scannedAt: new Date().toISOString(),
    isOnline: true,
    riskScore,
    overallLevel,
    totalScanned: PORT_CATALOG.length,
    openPortsCount: openPorts.length,
    openPorts: openPorts.map((p) => ({
      port: p.port,
      service: p.service,
      risk: p.risk,
      protocol: p.protocol || 'TCP',
      cve: p.cve || 'N/A',
      attackType: p.attackType || 'Service Exposure',
      exploitTarget: p.exploitTarget,
      mitigation: p.mitigation,
      remediationSteps: p.remediationSteps || [p.mitigation],
      firewallCmd: p.firewallCmd || {
        powershell: `New-NetFirewallRule -DisplayName "Block Port ${p.port}" -Direction Inbound -LocalPort ${p.port} -Protocol TCP -Action Block`,
        linuxUfw: `sudo ufw deny ${p.port}/tcp`,
        linuxIptables: `sudo iptables -A INPUT -p tcp --dport ${p.port} -j DROP`
      }
    })),
    threats: threatsFound,
    statusNote: openPorts.length === 0
      ? 'Device is online and all audited ports are closed/shielded.'
      : `${openPorts.length} open service port(s) detected.`
  };

  saveDeviceAudit(deviceId, auditReport);

  if (threatsFound.length > 0) {
    appendThreatAlerts(threatsFound);
  }

  return auditReport;
}

// Save audit result to security_audits.json
function saveDeviceAudit(deviceId, report) {
  try {
    const data = JSON.parse(fs.readFileSync(AUDITS_FILE, 'utf8') || '{}');
    data[deviceId] = report;
    fs.writeFileSync(AUDITS_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error saving device audit:', err);
  }
}

// Get all saved audits
export function getSavedAudits() {
  try {
    return JSON.parse(fs.readFileSync(AUDITS_FILE, 'utf8') || '{}');
  } catch (err) {
    return {};
  }
}

// Append new threat alerts
export function appendThreatAlerts(newThreats) {
  try {
    let threats = JSON.parse(fs.readFileSync(THREATS_FILE, 'utf8') || '[]');
    // Filter duplicates by device and port
    const existingKeys = new Set(threats.map((t) => `${t.deviceIp}:${t.port}:${t.title || ''}`));
    const fresh = newThreats.filter((t) => !existingKeys.has(`${t.deviceIp}:${t.port}:${t.title || ''}`));
    threats = [...fresh, ...threats].slice(0, 100); // keep recent 100
    fs.writeFileSync(THREATS_FILE, JSON.stringify(threats, null, 2));

    if (fresh.length > 0) {
      import('./emailReportService.js')
        .then((mod) => mod.default.notifySecurityThreat(fresh))
        .catch(() => {});
    }
  } catch (err) {
    console.error('Error appending threat alerts:', err);
  }
}

// Get threat alerts
export function getThreatAlerts() {
  try {
    return JSON.parse(fs.readFileSync(THREATS_FILE, 'utf8') || '[]');
  } catch (err) {
    return [];
  }
}

// Resolve / dismiss a threat alert
export function resolveThreatAlert(threatId) {
  try {
    let threats = JSON.parse(fs.readFileSync(THREATS_FILE, 'utf8') || '[]');
    threats = threats.filter((t) => t.id !== threatId);
    fs.writeFileSync(THREATS_FILE, JSON.stringify(threats, null, 2));
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// Detect Server's real LAN IPv4 address (so remote PCs never get 'localhost')
export function getServerLanIp() {
  try {
    const nets = os.networkInterfaces();
    let fallbackIp = null;
    for (const [name, list] of Object.entries(nets)) {
      const lowerName = name.toLowerCase();
      const isVirtual =
        lowerName.includes('vethernet') ||
        lowerName.includes('wsl') ||
        lowerName.includes('docker') ||
        lowerName.includes('vmware') ||
        lowerName.includes('virtualbox') ||
        lowerName.includes('loopback');

      for (const iface of list || []) {
        if (iface.family === 'IPv4' && !iface.internal && !iface.address.startsWith('169.254.')) {
          if (!isVirtual) {
            return iface.address;
          }
          if (!fallbackIp) fallbackIp = iface.address;
        }
      }
    }
    return fallbackIp || '127.0.0.1';
  } catch (e) {
    return '127.0.0.1';
  }
}

// Get custom Restricted & Critical Search/Website Policy Rules
export function getSearchPolicyRules() {
  const lanIp = getServerLanIp();
  const serverUrl = `http://${lanIp}:${process.env.PORT || 5000}`;
  try {
    if (!fs.existsSync(POLICY_FILE)) {
      fs.writeFileSync(POLICY_FILE, JSON.stringify(DEFAULT_SEARCH_POLICY, null, 2));
      return { ...DEFAULT_SEARCH_POLICY, serverLanIp: lanIp, serverUrl };
    }
    const parsed = JSON.parse(fs.readFileSync(POLICY_FILE, 'utf8'));
    return {
      restrictedRules: Array.isArray(parsed.restrictedRules) ? parsed.restrictedRules : DEFAULT_SEARCH_POLICY.restrictedRules,
      criticalRules: Array.isArray(parsed.criticalRules) ? parsed.criticalRules : DEFAULT_SEARCH_POLICY.criticalRules,
      serverLanIp: lanIp,
      serverUrl
    };
  } catch (err) {
    return { ...DEFAULT_SEARCH_POLICY, serverLanIp: lanIp, serverUrl };
  }
}

// Re-evaluate all stored traffic records whenever Policy Rules are updated
export function reclassifyAllTrafficWithPolicy() {
  try {
    let traffic = JSON.parse(fs.readFileSync(TRAFFIC_FILE, 'utf8') || '[]');
    traffic = traffic.map((item) => {
      const classification = classifyDomain(item.domain, {
        url: item.url,
        searchQuery: item.searchQuery,
        pageTitle: item.pageTitle,
        searchEngine: item.searchEngine
      });
      return {
        ...item,
        category: classification.category,
        threatLevel: classification.threatLevel,
        flagReason: classification.flagReason
      };
    });
    fs.writeFileSync(TRAFFIC_FILE, JSON.stringify(traffic, null, 2));
    return traffic;
  } catch (err) {
    return [];
  }
}

// Save custom Restricted & Critical Search/Website Policy Rules
export function saveSearchPolicyRules({ restrictedRules, criticalRules }) {
  const cleanRestricted = Array.from(
    new Set(
      (Array.isArray(restrictedRules) ? restrictedRules : [])
        .map((r) => String(r || '').toLowerCase().trim())
        .filter(Boolean)
    )
  );
  const cleanCritical = Array.from(
    new Set(
      (Array.isArray(criticalRules) ? criticalRules : [])
        .map((r) => String(r || '').toLowerCase().trim())
        .filter(Boolean)
    )
  );

  const updatedPolicy = {
    restrictedRules: cleanRestricted,
    criticalRules: cleanCritical,
    updatedAt: new Date().toISOString()
  };

  fs.writeFileSync(POLICY_FILE, JSON.stringify(updatedPolicy, null, 2));
  const updatedTraffic = reclassifyAllTrafficWithPolicy();
  return {
    policy: updatedPolicy,
    traffic: updatedTraffic
  };
}

// Classify domain, URL, and user search query threat & category
export function classifyDomain(domain, extra = {}) {
  const d = (domain || '').toLowerCase().trim();
  const q = (extra.searchQuery || '').toLowerCase().trim();
  const title = (extra.pageTitle || '').toLowerCase().trim();
  const url = (extra.url || '').toLowerCase().trim();
  const combinedText = `${d} ${q} ${title} ${url}`;

  // 0. Check Admin Custom Policy Rules FIRST (Critical & Restricted Websites / Keywords)
  const policy = getSearchPolicyRules();

  for (const critRule of policy.criticalRules || []) {
    const rule = critRule.toLowerCase().trim();
    if (!rule) continue;
    if (d === rule || d.endsWith(`.${rule}`) || combinedText.includes(rule)) {
      return {
        category: 'Critical Policy Alert',
        threatLevel: 'MALICIOUS',
        flagReason: `Matched Critical Rule: "${rule}"`
      };
    }
  }

  for (const restRule of policy.restrictedRules || []) {
    const rule = restRule.toLowerCase().trim();
    if (!rule) continue;
    if (d === rule || d.endsWith(`.${rule}`) || combinedText.includes(rule)) {
      return {
        category: 'Restricted Website / Search',
        threatLevel: 'SUSPICIOUS',
        flagReason: `Matched Restricted Rule: "${rule}"`
      };
    }
  }

  // 1. Malicious / High-Risk Exploit or Crypto Mining patterns (Domain or Search Keyword)
  if (
    /(coinhive|xmrig|pool\.mine|cryptonight|nanopool|monero|stratum|f2pool|2miners)\./.test(d) ||
    /\b(ransomware|mimikatz|metasploit|sqlmap|keylogger|rat download|ddos tool|darkweb|c2-server|reverse shell)\b/.test(combinedText)
  ) {
    return {
      category: q ? 'Flagged Security Search' : 'Crypto Mining & Malware',
      threatLevel: 'MALICIOUS',
      flagReason: q
        ? `High-risk security/exploit keyword searched: "${extra.searchQuery}"`
        : 'Potential Unauthorized Malware or Cryptocurrency Miner Activity'
    };
  }

  // 2. Suspicious / Policy-Violation Keywords (Torrents, Cracks, Piracy, Bypass, Gambling, Untrusted TLDs)
  if (
    /(malware|phish|exploit|ransom|payload|ddos-guard|onion|tor2web|piratebay|1337x|yts|fitgirl|rutracker|bet365|1xbet)\./.test(d) ||
    /\.(xyz|top|work|click|country|kim|stream|gq|cf|tk)$/.test(d) ||
    /\b(crack download|keygen|serial key|piratebay|1337x|torrent download|bypass firewall|free vpn download|hack password|phishing kit)\b/.test(combinedText)
  ) {
    return {
      category: q ? 'Restricted / Policy Search' : 'Suspicious / Untrusted Site',
      threatLevel: 'SUSPICIOUS',
      flagReason: q
        ? `Policy-restricted keyword searched: "${extra.searchQuery}"`
        : 'High-entropy, piracy, or commonly abused untrusted extension'
    };
  }

  // 3. AI Assistants & LLM Tools
  if (/(chatgpt\.com|openai\.com|claude\.ai|gemini\.google|perplexity\.ai|deepseek\.com|copilot\.microsoft|huggingface\.co)/.test(d)) {
    return {
      category: 'AI & LLM Assistant',
      threatLevel: 'SAFE',
      flagReason: q ? `AI Prompt / Topic: "${extra.searchQuery}"` : 'Generative AI Productivity Platform'
    };
  }

  // 4. Video & Media Streaming (YouTube, Netflix, etc.)
  if (/(youtube\.com|youtu\.be|netflix\.com|twitch\.tv|spotify\.com|tiktok\.com|vimeo\.com|dailymotion\.com|soundcloud\.com)/.test(d)) {
    return {
      category: 'Video & Media Streaming',
      threatLevel: 'SAFE',
      flagReason: q ? `Media / Video Search: "${extra.searchQuery}"` : 'Standard Video & Media Streaming Platform'
    };
  }

  // 5. Known Search Engines
  if (/(google\.|bing\.com|yahoo\.com|duckduckgo\.com|baidu\.com|yandex\.|ecosia\.org|startpage\.com)/.test(d) && !/(docs|drive|mail|accounts|photos|myaccount)\.google/.test(d)) {
    return {
      category: 'Search Engine',
      threatLevel: 'SAFE',
      flagReason: q ? `User Search Query on ${extra.searchEngine || 'Search Engine'}` : 'Verified Public Search Provider'
    };
  }

  // 6. Social Media & Messaging
  if (/(facebook\.com|instagram\.com|whatsapp\.com|whatsapp\.net|twitter\.com|x\.com|reddit\.com|linkedin\.com|discord\.com|telegram\.org|pinterest\.com)/.test(d)) {
    return {
      category: 'Social Media & Chat',
      threatLevel: 'SAFE',
      flagReason: 'Social Networking & Communication Platform'
    };
  }

  // 7. Corporate Work, HR, Email & Productivity
  if (/(office\.com|outlook\.|live\.com|microsoftonline\.com|sharepoint\.com|teams\.microsoft|docs\.google|drive\.google|mail\.google|accounts\.google|myaccount\.google|photos\.google|novarahr\.com|abilityglobal\.io|mslevelup\.com|zoom\.us|slack\.com|notion\.so|figma\.com|canva\.com)/.test(d)) {
    return {
      category: 'Work & Enterprise Apps',
      threatLevel: 'SAFE',
      flagReason: 'Authorized Corporate Workspace & Cloud Productivity'
    };
  }

  // 8. Developer & Cloud Infrastructure
  if (/(github\.com|gitlab\.com|stackoverflow\.com|npm|npmjs\.com|python\.org|microsoft\.com|apple\.com|amazonaws\.com|cloudflare\.com|azure\.com|vercel\.com|netlify\.com|docker\.com)/.test(d)) {
    return {
      category: 'Developer & Cloud Infra',
      threatLevel: 'SAFE',
      flagReason: 'Trusted Enterprise & Developer Service'
    };
  }

  // 9. E-Commerce & Shopping
  if (/(daraz\.|amazon\.|aliexpress\.|olx\.|ebay\.com|shopify\.com|temu\.com)/.test(d)) {
    return {
      category: 'Shopping & E-Commerce',
      threatLevel: 'SAFE',
      flagReason: q ? `Product Search: "${extra.searchQuery}"` : 'Online Retail & Marketplace'
    };
  }

  // 10. General Web
  return {
    category: q ? 'Web Search' : 'General Web Traffic',
    threatLevel: 'SAFE',
    flagReason: q ? `Search Query: "${extra.searchQuery}"` : 'Standard Web Browsing / DNS Resolution'
  };
}

// Helper to build a single enriched activity record
function buildEnrichedActivityRecord(record) {
  const cleanDomain = String(record.domain || '')
    .replace(/^https?:\/\//i, '')
    .split('/')[0]
    .toLowerCase()
    .trim();

  const classification = classifyDomain(cleanDomain, {
    url: record.url,
    searchQuery: record.searchQuery,
    pageTitle: record.pageTitle,
    searchEngine: record.searchEngine
  });

  const hasSearch = Boolean(record.searchQuery && String(record.searchQuery).trim());
  const queryType = record.queryType || (hasSearch ? 'SEARCH' : record.url ? 'WEB_VISIT' : 'DNS');

  return {
    id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: record.timestamp || new Date().toISOString(),
    clientIp: record.clientIp || '127.0.0.1',
    hostname: record.hostname || 'Local Endpoint',
    username: record.username || '',
    winUser: record.winUser || '',
    profileName: record.profileName || '',
    profileEmail: record.profileEmail || '',
    isIncognito: Boolean(record.isIncognito),
    browser: record.browser || (queryType === 'DNS' ? 'DNS Cache' : 'Browser'),
    domain: cleanDomain,
    url: record.url || `https://${cleanDomain}`,
    pageTitle: record.pageTitle || cleanDomain,
    searchQuery: hasSearch ? String(record.searchQuery).trim() : '',
    searchEngine: record.searchEngine || (hasSearch ? 'Web Search' : ''),
    queryType,
    category: classification.category,
    threatLevel: classification.threatLevel,
    flagReason: classification.flagReason
  };
}

// Ingest single DNS / Web / Search Activity Record
export function logDnsTrafficRecord(record) {
  const res = logDnsTrafficBatch([record]);
  return res.added[0] || null;
}

// Ingest batch of User Search & Web Activity Records (Deduplicated & Sorted)
export function logDnsTrafficBatch(records = []) {
  try {
    if (!Array.isArray(records) || records.length === 0) {
      return { addedCount: 0, added: [] };
    }

    let existing = [];
    try {
      existing = JSON.parse(fs.readFileSync(TRAFFIC_FILE, 'utf8') || '[]');
    } catch (e) {
      existing = [];
    }

    // Build signature map to prevent duplicate flooding (per IP + Windows User + Browser + Query)
    const sigMap = new Map();
    for (const item of existing) {
      const sig = `${item.clientIp}|${item.username || ''}|${item.browser || ''}|${item.domain}|${item.searchQuery || ''}|${item.pageTitle || ''}`;
      sigMap.set(sig, item);
    }

    const newlyAdded = [];
    const newThreats = [];

    for (const raw of records) {
      if (!raw || !raw.domain) continue;
      // Skip localhost dashboard traffic
      const dLow = String(raw.domain).toLowerCase();
      if (dLow.startsWith('localhost') || dLow.startsWith('127.0.0.1')) continue;

      const enriched = buildEnrichedActivityRecord(raw);
      const sig = `${enriched.clientIp}|${enriched.username || ''}|${enriched.browser || ''}|${enriched.domain}|${enriched.searchQuery || ''}|${enriched.pageTitle || ''}`;

      if (!sigMap.has(sig)) {
        sigMap.set(sig, enriched);
        newlyAdded.push(enriched);

        if (enriched.threatLevel === 'MALICIOUS' || (enriched.threatLevel === 'SUSPICIOUS' && enriched.searchQuery)) {
          newThreats.push({
            id: `threat-search-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            deviceIp: enriched.clientIp,
            deviceName: `${enriched.hostname || 'Endpoint'} (${enriched.clientIp})`,
            port: 443,
            service: enriched.searchQuery ? `Browser Search (${enriched.browser})` : 'Web/DNS Access',
            severity: enriched.threatLevel === 'MALICIOUS' ? 'CRITICAL' : 'HIGH',
            title: enriched.searchQuery
              ? `Flagged User Search: "${enriched.searchQuery}"`
              : `Suspicious Domain Access: ${enriched.domain}`,
            description: `User "${enriched.username || 'Active User'}" on ${enriched.hostname} (${enriched.clientIp}) via ${enriched.browser}: ${enriched.flagReason}`,
            recommendation: `Review endpoint ${enriched.clientIp} (${enriched.hostname}) browsing session and verify compliance with security policy.`,
            timestamp: enriched.timestamp
          });
        }
      }
    }

    // Merge and sort newest first, prioritizing Browser Searches & Web Visits over raw DNS
    const merged = Array.from(sigMap.values()).sort((a, b) => {
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    }).slice(0, 600);

    fs.writeFileSync(TRAFFIC_FILE, JSON.stringify(merged, null, 2));

    if (newThreats.length > 0) {
      appendThreatAlerts(newThreats);
    }

    // Persist per-endpoint search & activity records into dedicated data/endpoints/<ip>.json files
    if (newlyAdded.length > 0) {
      const byIp = {};
      for (const item of newlyAdded) {
        const ip = String(item.clientIp || '').trim();
        if (!ip || ip === '127.0.0.1' || ip.toLowerCase() === 'localhost') continue;
        if (!byIp[ip]) byIp[ip] = [];
        byIp[ip].push(item);
      }

      for (const [epIp, items] of Object.entries(byIp)) {
        try {
          const epFile = path.join(ENDPOINTS_DIR, `${sanitizeEndpointKey(epIp)}.json`);
          let epData = {};
          if (fs.existsSync(epFile)) {
            epData = JSON.parse(fs.readFileSync(epFile, 'utf8') || '{}');
          }
          if (!epData.ip) epData.ip = epIp;
          if (!epData.hostname && items[0]?.hostname) epData.hostname = items[0].hostname;
          if (!epData.activeUser && (items[0]?.winUser || items[0]?.username)) {
            epData.activeUser = items[0].winUser || items[0].username;
          }
          if (!Array.isArray(epData.searches)) epData.searches = [];
          if (!Array.isArray(epData.webActivity)) epData.webActivity = [];
          if (!Array.isArray(epData.pingProbes)) epData.pingProbes = [];

          const existingSignatures = new Set([
            ...epData.searches.map((s) => `${s.timestamp}|${s.searchQuery || ''}|${s.domain || ''}`),
            ...epData.webActivity.map((w) => `${w.timestamp}|${w.domain || ''}|${w.url || ''}`)
          ]);

          for (const rec of items) {
            const isSearch = Boolean(rec.searchQuery && String(rec.searchQuery).trim());
            const sig = isSearch
              ? `${rec.timestamp}|${rec.searchQuery || ''}|${rec.domain || ''}`
              : `${rec.timestamp}|${rec.domain || ''}|${rec.url || ''}`;
            if (!existingSignatures.has(sig)) {
              existingSignatures.add(sig);
              if (isSearch) {
                epData.searches.unshift(rec);
              } else {
                epData.webActivity.unshift(rec);
              }
            }
          }

          epData.searches = epData.searches.slice(0, 500);
          epData.webActivity = epData.webActivity.slice(0, 500);

          if (!epData.summary) epData.summary = {};
          epData.summary.totalSearches = epData.searches.length;
          const allEpEvents = [...epData.searches, ...epData.webActivity];
          epData.summary.criticalCount = allEpEvents.filter(
            (r) => r.threatLevel === 'MALICIOUS' || r.threatLevel === 'CRITICAL'
          ).length;
          epData.summary.restrictedCount = allEpEvents.filter(
            (r) => r.threatLevel === 'SUSPICIOUS' || r.threatLevel === 'RESTRICTED'
          ).length;

          fs.writeFileSync(epFile, JSON.stringify(epData, null, 2));
        } catch (e) {
          console.error(`Failed to update individual endpoint JSON for ${epIp}:`, e.message);
        }
      }
    }

    return { addedCount: newlyAdded.length, totalCount: merged.length, added: newlyAdded };
  } catch (err) {
    console.error('Error logging DNS/Search traffic batch:', err);
    return { addedCount: 0, added: [] };
  }
}

// Get recent DNS & User Search Traffic Records
export function getDnsTrafficRecords(limit = 200) {
  try {
    const traffic = JSON.parse(fs.readFileSync(TRAFFIC_FILE, 'utf8') || '[]');
    return traffic.slice(0, limit);
  } catch (err) {
    return [];
  }
}

// Clear DNS Traffic log
export function clearDnsTrafficLog() {
  try {
    fs.writeFileSync(TRAFFIC_FILE, JSON.stringify([], null, 2));
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ============================================================================
// ENDPOINT USER IDENTITY & PING TELEMETRY ENGINE
// ============================================================================

export function getEndpointData(targetIdentifier = '') {
  try {
    if (!fs.existsSync(ENDPOINTS_DIR)) {
      fs.mkdirSync(ENDPOINTS_DIR, { recursive: true });
    }
    const clean = String(targetIdentifier || '').trim();
    if (!clean) return null;

    // Direct filename match: data/endpoints/<clean>.json
    const directPath = path.join(ENDPOINTS_DIR, `${sanitizeEndpointKey(clean)}.json`);
    if (fs.existsSync(directPath)) {
      return JSON.parse(fs.readFileSync(directPath, 'utf8') || '{}');
    }

    // Scan all files in ENDPOINTS_DIR matching IP, Hostname or ActiveUser
    const files = fs.readdirSync(ENDPOINTS_DIR).filter((f) => f.endsWith('.json'));
    const lowerClean = clean.toLowerCase();
    for (const f of files) {
      try {
        const fullPath = path.join(ENDPOINTS_DIR, f);
        const data = JSON.parse(fs.readFileSync(fullPath, 'utf8') || '{}');
        if (
          String(data.ip || '').toLowerCase() === lowerClean ||
          String(data.hostname || '').toLowerCase() === lowerClean ||
          String(data.activeUser || '').toLowerCase() === lowerClean
        ) {
          return data;
        }
      } catch (_) {}
    }
  } catch (err) {
    console.error('Error reading endpoint data:', err.message);
  }
  return null;
}

export function listEndpointsData() {
  const result = [];
  try {
    if (!fs.existsSync(ENDPOINTS_DIR)) return result;
    const files = fs.readdirSync(ENDPOINTS_DIR).filter((f) => f.endsWith('.json'));
    for (const f of files) {
      try {
        const fullPath = path.join(ENDPOINTS_DIR, f);
        const data = JSON.parse(fs.readFileSync(fullPath, 'utf8') || '{}');
        result.push({
          ip: data.ip || f.replace('.json', ''),
          hostname: data.hostname || 'Workstation',
          activeUser: data.activeUser || 'Active User',
          userDomain: data.userDomain || '',
          lastSeen: data.lastSeen,
          totalProbes: data.summary?.totalProbes || (data.pingProbes || []).length,
          uptimePercentage: data.summary?.uptimePercentage || '100.0%',
          outages: data.summary?.outages || 0,
          totalSearches: data.summary?.totalSearches || (data.searches || []).length,
          criticalCount: data.summary?.criticalCount || 0,
          restrictedCount: data.summary?.restrictedCount || 0
        });
      } catch (_) {}
    }
  } catch (_) {}
  return result;
}

export function getEndpointPingReport(targetIp = '') {
  let endpointMap = {};
  try {
    if (fs.existsSync(ENDPOINT_FILE)) {
      endpointMap = JSON.parse(fs.readFileSync(ENDPOINT_FILE, 'utf8') || '{}');
    }
  } catch (_) {}

  const cleanIp = String(targetIp || '').trim();
  const isAllRequested = cleanIp.toUpperCase() === 'ALL';

  // 1. If a specific endpoint is targeted (or default single PC), check its dedicated JSON file first
  let dedicatedEpData = null;
  if (cleanIp && !isAllRequested) {
    dedicatedEpData = getEndpointData(cleanIp);
  }

  // If no specific IP requested or not found, but we have endpoints in ENDPOINTS_DIR, pick the latest active one
  if (!dedicatedEpData && !isAllRequested) {
    const epFiles = fs.existsSync(ENDPOINTS_DIR)
      ? fs.readdirSync(ENDPOINTS_DIR).filter((f) => f.endsWith('.json'))
      : [];
    if (epFiles.length > 0) {
      dedicatedEpData = getEndpointData(epFiles[0].replace('.json', ''));
    }
  }

  // If we found a dedicated endpoint JSON file for this single PC
  if (dedicatedEpData) {
    const probes = Array.isArray(dedicatedEpData.pingProbes) ? dedicatedEpData.pingProbes : [];
    const ph = dedicatedEpData.pingHealth || {};
    const summary = dedicatedEpData.summary || {};

    const totalProbes = summary.totalProbes || probes.length;
    const outageCount = summary.outages !== undefined ? summary.outages : probes.filter((p) => p.isOutage).length;
    const degradedCount = summary.degraded !== undefined ? summary.degraded : probes.filter((p) => p.status === 'DEGRADED').length;
    const uptimePct = summary.uptimePercentage ? summary.uptimePercentage.replace('%', '') : (totalProbes > 0 ? (((totalProbes - outageCount) / totalProbes) * 100).toFixed(1) : '100.0');

    const lastProbe = probes.length > 0 ? probes[probes.length - 1] : null;

    const latestGoogle =
      ph.google?.latency !== undefined
        ? `${ph.google.latency}ms`
        : ph.googleLatencyMs !== undefined
        ? `${ph.googleLatencyMs}ms`
        : lastProbe?.googlePing || '—';

    const latestCloudflare =
      ph.cloudflare?.latency !== undefined
        ? `${ph.cloudflare.latency}ms`
        : ph.cloudflareLatencyMs !== undefined
        ? `${ph.cloudflareLatencyMs}ms`
        : lastProbe?.cloudflarePing || '—';

    const latestJitter =
      ph.jitter !== undefined
        ? `${ph.jitter}ms`
        : ph.jitterMs !== undefined
        ? `${ph.jitterMs}ms`
        : lastProbe?.jitter || '0ms';

    const latestLoss =
      ph.packetLoss !== undefined
        ? `${ph.packetLoss}%`
        : ph.packetLossPercent !== undefined
        ? `${ph.packetLossPercent}%`
        : lastProbe?.packetLoss || '0%';

    return {
      ip: dedicatedEpData.ip,
      hostname: dedicatedEpData.hostname || 'Workstation',
      activeUser: dedicatedEpData.activeUser || 'Active User',
      isSingleEndpoint: true,
      logFile: ph.logFile || `data/endpoints/${sanitizeEndpointKey(dedicatedEpData.ip)}.json`,
      totalProbes,
      outageCount,
      degradedCount,
      uptimePercentage: `${uptimePct}%`,
      latestGoogle,
      latestCloudflare,
      latestJitter,
      latestLoss,
      hasInternetDownIncident: outageCount > 0,
      hasDegradedIncident: degradedCount > 0,
      qualityScore: ph.qualityScore || 'Optimal (Grade A+)',
      allEndpoints: [], // Dedicated single-user report has NO other endpoints mixed in
      entries: probes,
      rawLog: ''
    };
  }

  // 2. Fallback to endpointMap / fleet if no dedicated file exists
  let entry = null;
  if (cleanIp && !isAllRequested) {
    entry =
      endpointMap[cleanIp.toLowerCase()] ||
      Object.values(endpointMap).find(
        (e) => String(e.ip || '').toLowerCase() === cleanIp.toLowerCase() || String(e.hostname || '').toLowerCase() === cleanIp.toLowerCase()
      );
  }
  if (!entry) {
    entry = Object.values(endpointMap)[0] || null;
  }

  const pingHealth = entry?.pingHealth || null;
  const entries = [];
  let totalProbes = 0;
  let outageCount = 0;
  let degradedCount = 0;

  if (pingHealth && Array.isArray(pingHealth.recentSamples) && pingHealth.recentSamples.length > 0) {
    totalProbes = pingHealth.recentSamples.length;
    pingHealth.recentSamples.forEach((s, idx) => {
      const loss = typeof s.loss === 'number' ? s.loss : 0;
      const isDown = loss >= 50;
      const isDegraded = !isDown && loss > 0;
      const status = isDown ? 'DOWN / OUTAGE' : isDegraded ? 'DEGRADED' : 'ONLINE / UP';

      if (isDown) outageCount++;
      else if (isDegraded) degradedCount++;

      entries.push({
        id: idx + 1,
        timestamp: s.time || s.timestamp || `T-${idx + 1}`,
        user: entry?.activeUser || 'Active User',
        googlePing: s.google !== undefined && s.google !== null ? `${s.google}ms` : '—',
        googleDetails: '',
        cloudflarePing: s.cloudflare !== undefined && s.cloudflare !== null ? `${s.cloudflare}ms` : '—',
        cloudflareDetails: '',
        jitter: s.jitter !== undefined ? `${s.jitter}ms` : '0ms',
        packetLoss: `${loss}%`,
        status,
        isOutage: isDown,
        quality: pingHealth.qualityScore || 'Optimal (Grade A+)'
      });
    });
  }

  const allEndpoints = Object.values(endpointMap).map((ep) => {
    const ph = ep.pingHealth || {};
    const gLat =
      typeof ph.googleLatencyMs === 'number'
        ? `${ph.googleLatencyMs}ms`
        : typeof ph.google?.latency === 'number'
        ? `${ph.google.latency}ms`
        : '—';
    const cfLat =
      typeof ph.cloudflareLatencyMs === 'number'
        ? `${ph.cloudflareLatencyMs}ms`
        : typeof ph.cloudflare?.latency === 'number'
        ? `${ph.cloudflare.latency}ms`
        : '—';
    const jit =
      typeof ph.jitterMs === 'number'
        ? `${ph.jitterMs}ms`
        : typeof ph.jitter === 'number'
        ? `${ph.jitter}ms`
        : '0ms';
    const lossVal =
      typeof ph.packetLossPercent === 'number'
        ? ph.packetLossPercent
        : typeof ph.packetLoss === 'number'
        ? ph.packetLoss
        : 0;
    const isDown = lossVal >= 50 || ph.internetStatus === 'DOWN';
    return {
      ip: ep.ip || '—',
      hostname: ep.hostname || ep.ip || 'Workstation',
      activeUser: ep.activeUser || 'Active User',
      googlePing: gLat,
      cloudflarePing: cfLat,
      jitter: jit,
      packetLoss: `${lossVal}%`,
      qualityScore: ph.qualityScore || (isDown ? 'Outage (Grade F)' : 'Optimal (Grade A+)'),
      status: isDown ? 'DOWN / OUTAGE' : lossVal > 0 ? 'DEGRADED' : 'ONLINE / UP',
      lastSeen: ep.lastSeen || ph.testedAt || new Date().toISOString()
    };
  });

  const uptimePct =
    totalProbes > 0
      ? (((totalProbes - outageCount) / totalProbes) * 100).toFixed(1)
      : '100.0';

  return {
    ip: entry?.ip || cleanIp || 'All Endpoints',
    hostname: entry?.hostname || (cleanIp ? 'Workstation' : 'All Monitored Workstations'),
    activeUser: entry?.activeUser || 'Active User',
    isSingleEndpoint: Boolean(cleanIp && !isAllRequested),
    logFile: pingHealth?.logFile || '',
    totalProbes,
    outageCount,
    degradedCount,
    uptimePercentage: `${uptimePct}%`,
    latestGoogle: entries.length > 0 ? entries[entries.length - 1].googlePing : '—',
    latestCloudflare: entries.length > 0 ? entries[entries.length - 1].cloudflarePing : '—',
    latestJitter: entries.length > 0 ? entries[entries.length - 1].jitter : '0ms',
    latestLoss: entries.length > 0 ? entries[entries.length - 1].packetLoss : '0%',
    hasInternetDownIncident: outageCount > 0,
    hasDegradedIncident: degradedCount > 0,
    qualityScore: pingHealth?.qualityScore || 'Optimal (Grade A+)',
    allEndpoints: isAllRequested ? allEndpoints : [],
    entries,
    rawLog: ''
  };
}

export function generateEndpointPingPdfHtml(targetIp = '') {
  const report = getEndpointPingReport(targetIp);
  const generatedAt = new Date().toLocaleString();
  const reportId = `PING-${Date.now().toString(36).toUpperCase().slice(-6)}`;

  const esc = (s) =>
    String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const endpointRows = (report.allEndpoints || [])
    .map((ep, idx) => {
      const isDown = ep.status.includes('DOWN');
      const isDeg = ep.status.includes('DEGRADED');
      const stBg = isDown ? '#ffe4e6' : isDeg ? '#fef3c7' : '#dcfce7';
      const stCol = isDown ? '#be123c' : isDeg ? '#b45309' : '#15803d';
      return `
        <tr style="background:${idx % 2 === 0 ? '#ffffff' : '#f8fafc'}; border-bottom:1px solid #e2e8f0;">
          <td style="padding:9px 12px; font-weight:700; color:#0f172a;">${esc(ep.hostname)}</td>
          <td style="padding:9px 12px; font-family:monospace; color:#0284c7; font-weight:600;">${esc(ep.ip)}</td>
          <td style="padding:9px 12px; color:#4f46e5; font-weight:600;">${esc(ep.activeUser)}</td>
          <td style="padding:9px 12px; font-family:monospace; font-weight:700; color:#0f172a;">${esc(ep.googlePing)}</td>
          <td style="padding:9px 12px; font-family:monospace; font-weight:700; color:#0f172a;">${esc(ep.cloudflarePing)}</td>
          <td style="padding:9px 12px; font-family:monospace; color:#475569;">${esc(ep.jitter)}</td>
          <td style="padding:9px 12px; font-family:monospace; font-weight:700; color:${ep.packetLoss !== '0%' ? '#e11d48' : '#059669'};">${esc(ep.packetLoss)}</td>
          <td style="padding:9px 12px; text-align:center;">
            <span style="display:inline-block; padding:3px 9px; border-radius:999px; font-size:10px; font-weight:800; background:${stBg}; color:${stCol};">
              ${esc(ep.status)}
            </span>
          </td>
        </tr>
      `;
    })
    .join('');

  const probeRows = (report.entries || [])
    .slice()
    .reverse()
    .slice(0, 150)
    .map((e, idx) => {
      const isDown = e.isOutage || String(e.status).includes('DOWN');
      const isDeg = !isDown && String(e.status).includes('DEGRADED');
      const stBg = isDown ? '#ffe4e6' : isDeg ? '#fef3c7' : '#dcfce7';
      const stCol = isDown ? '#be123c' : isDeg ? '#b45309' : '#15803d';
      return `
        <tr style="background:${isDown ? '#fff1f2' : idx % 2 === 0 ? '#ffffff' : '#f8fafc'}; border-bottom:1px solid #e2e8f0;">
          <td style="padding:8px 10px; font-family:monospace; font-size:11px; color:#64748b;">#${e.id}</td>
          <td style="padding:8px 10px; font-family:monospace; font-size:11px; color:#334155;">${esc(e.timestamp)}</td>
          <td style="padding:8px 10px; font-size:11px; font-weight:600; color:#0f172a;">${esc(e.user)}</td>
          <td style="padding:8px 10px; font-family:monospace; font-size:11px; font-weight:700; color:#0284c7;">${esc(e.googlePing)}</td>
          <td style="padding:8px 10px; font-family:monospace; font-size:11px; font-weight:700; color:#d97706;">${esc(e.cloudflarePing)}</td>
          <td style="padding:8px 10px; font-family:monospace; font-size:11px; color:#475569;">${esc(e.jitter)}</td>
          <td style="padding:8px 10px; font-family:monospace; font-size:11px; font-weight:700; color:${e.packetLoss !== '0%' ? '#e11d48' : '#059669'};">${esc(e.packetLoss)}</td>
          <td style="padding:8px 10px; text-align:center;">
            <span style="display:inline-block; padding:2px 8px; border-radius:999px; font-size:10px; font-weight:800; background:${stBg}; color:${stCol};">
              ${esc(e.status)}
            </span>
          </td>
          <td style="padding:8px 10px; font-size:11px; color:#475569;">${esc(e.quality)}</td>
        </tr>
      `;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>NetPulse_WAN_Ping_Audit_Report_${esc(report.hostname)}_${new Date().toISOString().slice(0, 10)}</title>
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 20px;
      font-family: "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #f1f5f9;
      color: #0f172a;
      font-size: 12px;
    }
    .toolbar {
      max-width: 960px;
      margin: 0 auto 16px auto;
      background: #0f172a;
      color: #ffffff;
      padding: 12px 20px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .btn {
      background: linear-gradient(90deg, #0ea5e9, #6366f1);
      color: #fff;
      border: 0;
      padding: 9px 18px;
      border-radius: 8px;
      font-weight: 700;
      font-size: 12px;
      cursor: pointer;
    }
    .sheet {
      max-width: 960px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 14px;
      overflow: hidden;
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
    }
    .banner {
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      color: #ffffff;
      padding: 24px 28px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 4px solid #0ea5e9;
    }
    .kpis {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 10px;
      padding: 20px 28px 10px 28px;
    }
    .kpi {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 12px 10px;
      text-align: center;
    }
    .kpi small {
      display: block;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      color: #64748b;
    }
    .kpi strong {
      display: block;
      font-size: 18px;
      font-weight: 800;
      margin-top: 4px;
      font-family: Consolas, monospace;
    }
    .section {
      padding: 14px 28px 22px 28px;
    }
    .section h3 {
      margin: 0 0 10px 0;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #0f172a;
      border-left: 4px solid #0ea5e9;
      padding-left: 10px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #cbd5e1;
    }
    th {
      background: #0f172a;
      color: #ffffff;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 9px 10px;
      text-align: left;
    }
    @media print {
      body { background: #ffffff; padding: 0; }
      .toolbar { display: none !important; }
      .sheet { border: 0; box-shadow: none; max-width: 100%; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <div>
      <strong>NetPulse Continuous WAN Ping &amp; Outage PDF Report</strong>
      <span style="color:#94a3b8; margin-left:8px;">Select "Save as PDF" in the print dialog to save the PDF file.</span>
    </div>
    <button class="btn" onclick="window.print()">🖨️ Download / Save as PDF</button>
  </div>

  <div class="sheet">
    <div class="banner">
      <div>
        <div style="font-size:10px; font-weight:800; color:#38bdf8; letter-spacing:1.2px; text-transform:uppercase;">
          NETPULSE ENTERPRISE NOC • ENDPOINT WAN PING &amp; OUTAGE AUDIT
        </div>
        <h1 style="margin:6px 0 4px 0; font-size:20px; font-weight:800;">
          Continuous Internet Ping &amp; Outage Report (${esc(report.hostname)})
        </h1>
        <div style="color:#cbd5e1; font-size:12px;">
          Target IP: <strong>${esc(report.ip)}</strong> &bull; Logged-In User: <strong>${esc(report.activeUser)}</strong> &bull; Quality: <strong>${esc(report.qualityScore)}</strong>
        </div>
      </div>
      <div style="text-align:right; font-family:monospace; font-size:11px; color:#cbd5e1;">
        <div style="display:inline-block; background:#10b981; color:#fff; font-weight:800; padding:4px 12px; border-radius:999px; margin-bottom:6px;">
          UPTIME: ${esc(report.uptimePercentage)}
        </div>
        <div>Ref: ${reportId}</div>
        <div>${esc(generatedAt)}</div>
      </div>
    </div>

    <div class="kpis">
      <div class="kpi">
        <small>Google 8.8.8.8</small>
        <strong style="color:#0284c7;">${esc(report.latestGoogle)}</strong>
      </div>
      <div class="kpi">
        <small>Cloudflare 1.1.1.1</small>
        <strong style="color:#d97706;">${esc(report.latestCloudflare)}</strong>
      </div>
      <div class="kpi">
        <small>WAN Uptime %</small>
        <strong style="color:#059669;">${esc(report.uptimePercentage)}</strong>
      </div>
      <div class="kpi">
        <small>Outage Events</small>
        <strong style="color:${report.outageCount > 0 ? '#e11d48' : '#059669'};">${report.outageCount}</strong>
      </div>
      <div class="kpi">
        <small>Jitter / Variance</small>
        <strong style="color:#6366f1;">${esc(report.latestJitter)}</strong>
      </div>
      <div class="kpi">
        <small>Packet Loss</small>
        <strong style="color:${report.latestLoss !== '0%' ? '#e11d48' : '#059669'};">${esc(report.latestLoss)}</strong>
      </div>
    </div>

    ${
      !report.isSingleEndpoint && endpointRows
        ? `
      <div class="section">
        <h3>Connected Endpoints WAN Reachability Summary (${report.allEndpoints.length} Workstations)</h3>
        <table>
          <thead>
            <tr>
              <th>Hostname</th>
              <th>IP Address</th>
              <th>Active User</th>
              <th>8.8.8.8 Ping</th>
              <th>1.1.1.1 Ping</th>
              <th>Jitter</th>
              <th>Loss</th>
              <th style="text-align:center;">WAN Status</th>
            </tr>
          </thead>
          <tbody>
            ${endpointRows}
          </tbody>
        </table>
      </div>
    `
        : ''
    }

    <div class="section">
      <h3>Continuous WAN Ping &amp; Outage Probe Chronology (${esc(report.hostname)} &bull; ${esc(report.activeUser)} &bull; ${esc(report.ip)})</h3>
      <table>
        <thead>
          <tr>
            <th>Probe</th>
            <th>Timestamp</th>
            <th>User Session</th>
            <th>Google 8.8.8.8</th>
            <th>Cloudflare 1.1.1.1</th>
            <th>Jitter</th>
            <th>Packet Loss</th>
            <th style="text-align:center;">Status</th>
            <th>Quality Grade</th>
          </tr>
        </thead>
        <tbody>
          ${
            probeRows ||
            `<tr><td colspan="9" style="padding:18px; text-align:center; color:#64748b;">No probe entries recorded yet.</td></tr>`
          }
        </tbody>
      </table>
    </div>
  </div>

  <script>
    window.addEventListener('load', function() {
      setTimeout(function() { window.print(); }, 350);
    });
  </script>
</body>
</html>`;
}

export function getEndpointTelemetry() {
  try {
    if (fs.existsSync(ENDPOINT_FILE)) {
      return JSON.parse(fs.readFileSync(ENDPOINT_FILE, 'utf8') || '{}');
    }
  } catch (_) {}
  return {};
}

export async function recordEndpointTelemetry(clientInfo) {
  if (!clientInfo || !clientInfo.ip) return null;

  const ip = String(clientInfo.ip).trim();
  const hostname = String(clientInfo.hostname || '').trim();
  const activeUser = String(clientInfo.activeUser || '').trim();
  const userDomain = String(clientInfo.userDomain || '').trim();
  const sessionState = String(clientInfo.sessionState || 'Active').trim();
  const pingHealth = clientInfo.pingHealth || null;
  const nowIso = new Date().toISOString();

  // 1. Persist to endpoint_telemetry.json
  let endpointMap = {};
  try {
    if (fs.existsSync(ENDPOINT_FILE)) {
      endpointMap = JSON.parse(fs.readFileSync(ENDPOINT_FILE, 'utf8') || '{}');
    }
  } catch (_) {
    endpointMap = {};
  }

  // Normalize pingHealth recentSamples to always be an array
  if (pingHealth && typeof pingHealth === 'object') {
    if (pingHealth.recentSamples && !Array.isArray(pingHealth.recentSamples)) {
      pingHealth.recentSamples = [pingHealth.recentSamples];
    } else if (!pingHealth.recentSamples) {
      pingHealth.recentSamples = [];
    }
  }

  const existingEntry = endpointMap[ip] || {};
  const updatedEntry = {
    ip,
    hostname: hostname || existingEntry.hostname || ip,
    activeUser: activeUser || existingEntry.activeUser || 'Unknown',
    userDomain: userDomain || existingEntry.userDomain || '',
    sessionState: sessionState || existingEntry.sessionState || 'Active',
    pingHealth: pingHealth || existingEntry.pingHealth || null,
    lastSeen: nowIso
  };

  endpointMap[ip] = updatedEntry;
  try {
    fs.writeFileSync(ENDPOINT_FILE, JSON.stringify(endpointMap, null, 2));
  } catch (e) {
    console.error('Failed to write endpoint_telemetry.json:', e.message);
  }

  // 1b. Persist dedicated individual endpoint JSON: data/endpoints/<ip>.json
  try {
    if (!fs.existsSync(ENDPOINTS_DIR)) {
      fs.mkdirSync(ENDPOINTS_DIR, { recursive: true });
    }
    const epFile = path.join(ENDPOINTS_DIR, `${sanitizeEndpointKey(ip)}.json`);
    let epData = {};
    if (fs.existsSync(epFile)) {
      try {
        epData = JSON.parse(fs.readFileSync(epFile, 'utf8') || '{}');
      } catch (_) {
        epData = {};
      }
    }
    epData.ip = ip;
    epData.hostname = hostname || epData.hostname || ip;
    epData.activeUser = activeUser || epData.activeUser || 'Active User';
    epData.userDomain = userDomain || epData.userDomain || '';
    epData.sessionState = sessionState || epData.sessionState || 'Active';
    epData.pingHealth = pingHealth || epData.pingHealth || null;
    epData.lastSeen = nowIso;

    if (!Array.isArray(epData.pingProbes)) epData.pingProbes = [];
    if (!Array.isArray(epData.searches)) epData.searches = [];
    if (!Array.isArray(epData.webActivity)) epData.webActivity = [];

    // Ingest new ping probes from pingHealth.recentSamples
    const samples = Array.isArray(pingHealth?.recentSamples) ? pingHealth.recentSamples : [];
    if (samples.length > 0) {
      const probeTimes = new Set(epData.pingProbes.map((p) => String(p.timestamp || p.time)));
      samples.forEach((s) => {
        const timeKey = String(s.time || s.timestamp || '');
        if (timeKey && !probeTimes.has(timeKey)) {
          probeTimes.add(timeKey);
          const loss = typeof s.loss === 'number' ? s.loss : 0;
          const isDown = loss >= 50;
          const isDeg = !isDown && loss > 0;
          epData.pingProbes.push({
            id: epData.pingProbes.length + 1,
            timestamp: s.time || s.timestamp || new Date().toLocaleTimeString(),
            user: activeUser || epData.activeUser,
            googlePing: s.google !== undefined && s.google !== null ? `${s.google}ms` : '—',
            cloudflarePing: s.cloudflare !== undefined && s.cloudflare !== null ? `${s.cloudflare}ms` : '—',
            jitter: s.jitter !== undefined ? `${s.jitter}ms` : '0ms',
            packetLoss: `${loss}%`,
            status: isDown ? 'DOWN / OUTAGE' : isDeg ? 'DEGRADED' : 'ONLINE / UP',
            isOutage: isDown,
            quality: pingHealth.qualityScore || 'Optimal (Grade A+)'
          });
        }
      });
    } else if (pingHealth?.google || pingHealth?.cloudflare) {
      const g = pingHealth.google || {};
      const cf = pingHealth.cloudflare || {};
      const loss = typeof pingHealth.packetLoss === 'number' ? pingHealth.packetLoss : 0;
      const isDown = loss >= 50 || g.status === 'DOWN';
      const isDeg = !isDown && loss > 0;
      const probeTime = pingHealth.testedAt ? new Date(pingHealth.testedAt).toLocaleTimeString() : new Date().toLocaleTimeString();
      const lastProbe = epData.pingProbes[epData.pingProbes.length - 1];
      if (!lastProbe || lastProbe.timestamp !== probeTime) {
        epData.pingProbes.push({
          id: epData.pingProbes.length + 1,
          timestamp: probeTime,
          user: activeUser || epData.activeUser,
          googlePing: g.latency !== undefined ? `${g.latency}ms` : '—',
          cloudflarePing: cf.latency !== undefined ? `${cf.latency}ms` : '—',
          jitter: pingHealth.jitter !== undefined ? `${pingHealth.jitter}ms` : '0ms',
          packetLoss: `${loss}%`,
          status: isDown ? 'DOWN / OUTAGE' : isDeg ? 'DEGRADED' : 'ONLINE / UP',
          isOutage: isDown,
          quality: pingHealth.qualityScore || 'Optimal (Grade A+)'
        });
      }
    }

    // Keep latest 250 probes per endpoint
    epData.pingProbes = epData.pingProbes.slice(-250);

    const total = epData.pingProbes.length;
    const outages = epData.pingProbes.filter((p) => p.isOutage).length;
    const degraded = epData.pingProbes.filter((p) => p.status === 'DEGRADED').length;
    const uptimePct = total > 0 ? (((total - outages) / total) * 100).toFixed(1) + '%' : '100.0%';

    epData.summary = {
      ...(epData.summary || {}),
      totalProbes: total,
      uptimePercentage: uptimePct,
      outages,
      degraded
    };

    fs.writeFileSync(epFile, JSON.stringify(epData, null, 2));
  } catch (epErr) {
    console.error(`Failed to update individual endpoint JSON for ${ip}:`, epErr.message);
  }

  // 2. Cross-Update Device Records in dataStore (Identify PC Name & Active User)
  try {
    const devices = await dataStore.getDevices();
    const matched = devices.find((d) => {
      const dIp = String(d.ip || '').toLowerCase().trim();
      const targetIp = ip.toLowerCase();
      return (
        dIp === targetIp ||
        dIp === `${targetIp}:80` ||
        dIp === `${targetIp}:443` ||
        (hostname && d.name && d.name.toLowerCase() === hostname.toLowerCase())
      );
    });

    if (matched) {
      const updateData = {
        activeUser: activeUser || matched.activeUser || null,
        userDomain: userDomain || matched.userDomain || null,
        sessionState: sessionState || matched.sessionState || 'Active',
        endpointPing: pingHealth || matched.endpointPing || null,
        lastAgentSync: nowIso
      };

      // If current device name is generic (e.g. "LAN Device (172.18.1.11)"), update to real computer name
      if (
        hostname &&
        (matched.name.startsWith('LAN Device') ||
          matched.name.startsWith('Device (') ||
          matched.name.includes('('))
      ) {
        updateData.name = hostname;
      }

      await dataStore.updateDevice(matched.id, updateData);
      console.log(`[EndpointTelemetry] 👤 Device ${matched.id} (${ip}) updated with Active User: ${activeUser} [${hostname}]`);
    } else if (hostname) {
      // Auto-register new workstation device if not already in monitoring
      const added = await dataStore.addDevice({
        name: hostname,
        ip,
        type: 'workstation',
        group: 'Local Network',
        monitoring: true,
        interval: 15,
        activeUser,
        userDomain,
        sessionState,
        endpointPing: pingHealth,
        lastAgentSync: nowIso
      });
      console.log(`[EndpointTelemetry] 🟢 New Device Auto-Registered from Agent: ${hostname} (${ip}) User: ${activeUser}`);
    }

    // Broadcast live WebSocket update so UI cards refresh immediately
    try {
      broadcastDeviceStatus();
    } catch (_) {}
  } catch (err) {
    console.error('[EndpointTelemetry] Failed to update device in dataStore:', err.message);
  }

  return updatedEntry;
}

// Capture Live Browser Searches (Chrome, Edge, Brave, Firefox) + Windows DNS Cache
export async function harvestLiveDnsCache() {
  const recorded = [];

  // Step 1: Run Layer-2 Python Browser Search & History Harvester
  try {
    const scriptPath = path.resolve(__dirname, '../../python-monitor/search_activity_agent.py');
    if (fs.existsSync(scriptPath)) {
      const pythonCandidates = [
        path.resolve(__dirname, '../../.venv/Scripts/python.exe'),
        'C:\\Users\\Ability\\AppData\\Local\\Programs\\Python\\Python312\\python.exe',
        'python'
      ];
      let pyCmd = 'python';
      for (const candidate of pythonCandidates) {
        if (candidate === 'python' || fs.existsSync(candidate)) {
          pyCmd = candidate;
          break;
        }
      }

      const { stdout } = await execFileAsync(pyCmd, [scriptPath, '--json'], {
        timeout: 8000,
        maxBuffer: 10 * 1024 * 1024
      });

      if (stdout && stdout.trim()) {
        const parsed = JSON.parse(stdout.trim());
        if (Array.isArray(parsed) && parsed.length > 0) {
          const batchRes = logDnsTrafficBatch(parsed);
          return batchRes.added;
        }
      }
    }
  } catch (pyErr) {
    // Fallback to PowerShell DNS cache below if Python script fails
  }

  // Step 2: Fallback PowerShell DNS Resolver Cache
  try {
    const psCommand = `Get-DnsClientCache | Where-Object { $_.Entry -ne "" -and $_.Entry -notmatch "^_|^localhost" } | Select-Object -First 30 Entry, Type, Status | ConvertTo-Json`;
    const { stdout } = await execFileAsync('powershell', ['-NoProfile', '-Command', psCommand], { timeout: 4000 });

    if (!stdout || !stdout.trim()) return recorded;

    let entries = [];
    try {
      const parsed = JSON.parse(stdout);
      entries = Array.isArray(parsed) ? parsed : [parsed];
    } catch (e) {
      return recorded;
    }

    const batchItems = entries
      .filter((item) => item && item.Entry)
      .map((item) => ({
        domain: item.Entry,
        clientIp: 'Local Machine',
        hostname: 'Server Host',
        browser: 'DNS Cache',
        queryType: 'DNS'
      }));

    const batchRes = logDnsTrafficBatch(batchItems);
    return batchRes.added;
  } catch (err) {
    return recorded;
  }
}

// Generate Standalone Layer-2 Client Search Agent Installer (.bat) with 30-Min Task Scheduler & Multi-User Support
// Uses 100% Built-in Windows PowerShell + winsqlite3.dll (NO Python or Admin rights required on Client PCs!)
export function generateClientSearchAgentScript(serverHost = '') {
  const lanIp = getServerLanIp();
  const defaultLanUrl = `http://${lanIp}:${process.env.PORT || 5000}`;
  let rawServer = String(serverHost || defaultLanUrl).replace(/\/+$/, '');
  if (rawServer.includes('localhost') || rawServer.includes('127.0.0.1')) {
    rawServer = rawServer.replace(/localhost|127\.0\.0\.1/gi, lanIp);
  }
  const cleanServer = rawServer;

  const psAgentPath = path.resolve(__dirname, '../../python-monitor/native_search_agent.ps1');
  let psSource = '';
  try {
    psSource = fs.readFileSync(psAgentPath, 'utf8');
  } catch (e) {
    psSource = '# Agent source not found';
  }

  // Format Base64 in 72-character lines for certutil self-extraction from %~f0
  const base64Ps = Buffer.from(psSource, 'utf8').toString('base64');
  const b64Chunks = base64Ps.match(/.{1,72}/g) || [];

  const batContent = [
    '@echo off',
    'title NetPulse NOC - Layer-2 Multi-User Search Agent Installer',
    'color 0B',
    '',
    'echo ==============================================================================',
    'echo    NETPULSE NOC - MULTI-USER SEARCH ^& WEB ACTIVITY AGENT INSTALLER',
    `echo    Target NetPulse Server : ${cleanServer}`,
    'echo    Engine                 : Native Windows SQLite + PowerShell (No Python Needed)',
    'echo    Auto-Sync Schedule     : Every 30 Minutes (Windows Task Scheduler)',
    'echo    Multi-User Scope       : All Windows User Accounts ^& Browser Profiles',
    'echo ==============================================================================',
    'echo.',
    '',
    'set "AGENT_DIR=%LOCALAPPDATA%\\NetPulseAgent"',
    'if not exist "%AGENT_DIR%" mkdir "%AGENT_DIR%"',
    'set "AGENT_PS1=%AGENT_DIR%\\native_search_agent.ps1"',
    'set "SYNC_BAT=%AGENT_DIR%\\sync_once.bat"',
    'set "SILENT_VBS=%AGENT_DIR%\\silent_runner.vbs"',
    'set "START_PING_BAT=%AGENT_DIR%\\start_continuous_ping.bat"',
    'set "STOP_PING_BAT=%AGENT_DIR%\\stop_continuous_ping.bat"',
    'set "UNINSTALL_BAT=%AGENT_DIR%\\Uninstall_NetPulse_Agent.bat"',
    '',
    'echo [1/4] Extracting Zero-Dependency Native Search Agent to %AGENT_DIR%...',
    'certutil -f -decode "%~f0" "%AGENT_PS1%" >nul 2>&1',
    'if not exist "%AGENT_PS1%" (',
    '    echo [ERROR] Failed to extract agent script!',
    '    pause',
    '    exit /b 1',
    ')',
    'echo       [OK] Agent extracted successfully.',
    '',
    'echo [2/4] Creating background sync and continuous WAN ping runners...',
    'echo @echo off > "%SYNC_BAT%"',
    `echo powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%AGENT_PS1%" -ServerUrl "${cleanServer}" ^> "%AGENT_DIR%\\agent_sync.log" 2^>^&1 >> "%SYNC_BAT%"`,
    '',
    'echo Set WshShell = CreateObject("WScript.Shell") > "%SILENT_VBS%"',
    'echo WshShell.Run chr(34) ^& "%SYNC_BAT%" ^& chr(34), 0, False >> "%SILENT_VBS%"',
    'echo Set WshShell = Nothing >> "%SILENT_VBS%"',
    '',
    'echo @echo off > "%START_PING_BAT%"',
    'echo title NetPulse Continuous WAN Latency Prober >> "%START_PING_BAT%"',
    'echo echo Starting Continuous WAN Ping Prober (8.8.8.8 and 1.1.1.1)... >> "%START_PING_BAT%"',
    `echo start "NetPulsePing" /B powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%AGENT_PS1%" -ServerUrl "${cleanServer}" -Continuous -IntervalSec 15 >> "%START_PING_BAT%"`,
    'echo echo [OK] Continuous WAN Ping Prober is running in background! >> "%START_PING_BAT%"',
    'echo echo Logging live metrics to: "%AGENT_DIR%\\endpoint_ping_telemetry.log" >> "%START_PING_BAT%"',
    'echo pause >> "%START_PING_BAT%"',
    '',
    'echo @echo off > "%STOP_PING_BAT%"',
    'echo powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like \'*native_search_agent.ps1*Continuous*\' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }" >nul 2>&1 >> "%STOP_PING_BAT%"',
    'echo echo Continuous WAN ping stopped. >> "%STOP_PING_BAT%"',
    'echo pause >> "%STOP_PING_BAT%"',
    '',
    'echo @echo off > "%UNINSTALL_BAT%"',
    'echo powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like \'*native_search_agent.ps1*\' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }" >nul 2>&1 >> "%UNINSTALL_BAT%"',
    'echo schtasks /Delete /TN "NetPulse_UserSearch_Agent" /F >> "%UNINSTALL_BAT%"',
    'echo echo NetPulse Scheduled Task & Background Prober removed successfully. >> "%UNINSTALL_BAT%"',
    'echo pause >> "%UNINSTALL_BAT%"',
    '',
    'echo [3/4] Registering Windows Scheduled Task (Runs every 30 minutes automatically)...',
    'schtasks /Create /SC MINUTE /MO 30 /TN "NetPulse_UserSearch_Agent" /TR "wscript.exe \\"%SILENT_VBS%\\"" /F >nul 2>&1',
    'echo       [OK] Task "NetPulse_UserSearch_Agent" registered in Windows Task Scheduler!',
    '',
    'echo.',
    'echo [4/4] Running initial multi-user search harvest ^& syncing to Server right now...',
    `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%AGENT_PS1%" -ServerUrl "${cleanServer}"`,
    'echo.',
    'echo ==============================================================================',
    'echo  SUCCESS! Agent is now installed in Windows Task Scheduler.',
    'echo  - Automatically syncs every 30 minutes in background.',
    'echo  - Continuous WAN latency prober (8.8.8.8 and 1.1.1.1) logged to:',
    'echo    %AGENT_DIR%\\endpoint_ping_telemetry.log',
    'echo  - Continuous live daemon runner available at: %AGENT_DIR%\\start_continuous_ping.bat',
    'echo  - Works on ANY Windows 10/11 PC (No Python required!).',
    'echo  - Captures searches from ALL logged-in browser profiles & Incognito.',
    'echo  - To uninstall anytime, run: %AGENT_DIR%\\Uninstall_NetPulse_Agent.bat',
    'echo ==============================================================================',
    'pause',
    'exit /b 0',
    '',
    '-----BEGIN CERTIFICATE-----',
    ...b64Chunks,
    '-----END CERTIFICATE-----'
  ].join('\r\n');

  return {
    filename: 'NetPulse_Client_Search_Agent.bat',
    serverUrl: cleanServer,
    script: batContent
  };
}

// Generate Complete Security Overview
export async function getSecurityOverview(devices = []) {
  const audits = getSavedAudits();
  const threats = getThreatAlerts();
  const recentDns = getDnsTrafficRecords(50);

  let totalScore = 0;
  let auditedOnlineCount = 0;
  let offlineCount = 0;
  let onlineCount = 0;
  let totalOpenPorts = 0;
  let criticalCount = 0;
  let highCount = 0;
  let mediumCount = 0;
  let safeCount = 0;

  for (const dev of devices) {
    const audit = audits[dev.id] || audits[dev.ip];
    const isDevOffline =
      dev.status === 'DOWN' ||
      dev.status === 'PAUSED' ||
      dev.monitoring === false ||
      audit?.overallLevel === 'OFFLINE' ||
      audit?.isOnline === false;

    if (isDevOffline) {
      offlineCount++;
    } else {
      onlineCount++;
    }

    if (audit) {
      if (audit.overallLevel === 'OFFLINE' || audit.isOnline === false) {
        continue;
      }
      if (audit.riskScore !== null && audit.riskScore !== undefined) {
        totalScore += audit.riskScore;
        auditedOnlineCount++;
      }
      totalOpenPorts += audit.openPortsCount || 0;
      if (audit.overallLevel === 'CRITICAL') criticalCount++;
      else if (audit.overallLevel === 'HIGH') highCount++;
      else if (audit.overallLevel === 'MEDIUM') mediumCount++;
      else if (audit.overallLevel === 'SAFE') safeCount++;
    }
  }

  const networkScore = auditedOnlineCount > 0 ? Math.round(totalScore / auditedOnlineCount) : 100;
  
  let networkThreatLevel = 'SAFE';
  if (criticalCount > 0 || networkScore < 60) networkThreatLevel = 'CRITICAL';
  else if (highCount > 0 || networkScore < 80) networkThreatLevel = 'HIGH';
  else if (mediumCount > 0 || networkScore < 90) networkThreatLevel = 'ELEVATED';

  return {
    networkScore,
    networkThreatLevel,
    totalDevices: devices.length,
    onlineDevicesCount: onlineCount,
    offlineDevicesCount: offlineCount,
    auditedOnlineCount,
    auditedDevicesCount: auditedOnlineCount,
    totalOpenPorts,
    vulnerableDevicesCount: criticalCount + highCount,
    breakdown: {
      critical: criticalCount,
      high: highCount,
      medium: mediumCount,
      safe: safeCount,
      offline: offlineCount
    },
    threatAlertsCount: threats.length,
    activeThreats: threats.slice(0, 10),
    recentTraffic: recentDns.slice(0, 15)
  };
}

// Common Hardware & Network Manufacturer OUI Database
const KNOWN_OUIS = {
  '00:0c:29': 'VMware ESXi / Workstation',
  '00:50:56': 'VMware vSphere Virtual Host',
  'f4:8e:38': 'Huawei Technologies',
  '48:4d:7e': 'Foxconn / Hon Hai / Realtek',
  '64:00:6a': 'Dell Technologies / Cisco',
  '50:9a:4c': 'Murata Manufacturing / Wi-Fi',
  'a0:29:19': 'Ambit / LiteOn Network',
  '00:a6:ca': 'D-Link Corporation',
  'd0:8e:79': 'Hon Hai Precision (Foxconn)',
  'a4:4c:c8': 'Espressif Systems (IoT / ESP32)',
  '18:66:da': 'TP-Link Technologies',
  '00:17:61': 'Ambit Microsystems',
  '20:4c:9e': 'Realtek Semiconductor',
  'b8:27:eb': 'Raspberry Pi Foundation',
  'dc:a6:32': 'Raspberry Pi Foundation',
  'e4:5f:01': 'Raspberry Pi Foundation',
  '00:1a:11': 'Google LLC',
  'f4:f5:db': 'Google LLC',
  '3c:22:fb': 'Apple Inc.',
  'a8:66:7f': 'Apple Inc.',
  'ac:bc:32': 'Apple Inc.',
  'f0:18:98': 'Apple Inc.',
  '00:1e:67': 'Intel Corporation',
  'a4:bb:6d': 'Intel Mobile Wi-Fi',
  '00:04:96': 'Extreme Networks',
  '00:1c:73': 'Arista Networks',
  '00:24:d7': 'Ubiquiti Networks',
  '78:8a:20': 'Ubiquiti UniFi',
  '24:a4:3c': 'Ubiquiti Networks',
  '00:0e:c6': 'ASUSTeK Computer',
  '1c:87:2c': 'MikroTik RouterOS',
  '48:8f:5a': 'MikroTik RouterOS',
  '6c:3b:6b': 'MikroTik RouterOS',
  'cc:2d:e0': 'MikroTik RouterOS',
  '00:15:5d': 'Microsoft Hyper-V Virtual',
  '52:54:00': 'QEMU / KVM Virtual NIC',
  '08:00:27': 'Oracle VirtualBox'
};

export function lookupMacVendor(mac) {
  if (!mac) return 'Unknown Hardware';
  const clean = mac.toLowerCase().replace(/-/g, ':');
  const prefix = clean.slice(0, 8);
  if (KNOWN_OUIS[prefix]) {
    return KNOWN_OUIS[prefix];
  }
  return `IEEE OUI (${prefix.toUpperCase()})`;
}

// ARP Spoofing / MITM Guard & Layer 2 Reconnaissance
export async function getArpGuardAnalysis() {
  try {
    let rawOutput = '';
    try {
      const { stdout } = await execFileAsync('arp', ['-a'], { timeout: 6000 });
      rawOutput = stdout;
    } catch {
      // Fallback for systems where arp needs full path
      const { stdout } = await execFileAsync('cmd.exe', ['/c', 'arp -a'], { timeout: 6000 });
      rawOutput = stdout;
    }

    const lines = rawOutput.split(/\r?\n/);
    const interfaces = [];
    let currentInterface = null;
    const allEntries = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Match interface header: "Interface: 172.18.1.11 --- 0x3"
      const ifaceMatch = trimmed.match(/^Interface:\s*([0-9.]+)\s*---\s*(\w+)/i);
      if (ifaceMatch) {
        currentInterface = {
          ip: ifaceMatch[1],
          index: ifaceMatch[2],
          entries: []
        };
        interfaces.push(currentInterface);
        continue;
      }

      // Match table entries: "172.18.1.1   00-0c-29-82-bd-9e   dynamic"
      const entryMatch = trimmed.match(/^([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})\s+([0-9a-fA-F]{2}[:-][0-9a-fA-F]{2}[:-][0-9a-fA-F]{2}[:-][0-9a-fA-F]{2}[:-][0-9a-fA-F]{2}[:-][0-9a-fA-F]{2})\s+(\w+)/i);
      if (entryMatch) {
        const ip = entryMatch[1];
        const rawMac = entryMatch[2];
        const type = entryMatch[3].toLowerCase();
        const normalizedMac = rawMac.toLowerCase().replace(/-/g, ':');

        const isBroadcast = normalizedMac === 'ff:ff:ff:ff:ff:ff';
        const isMulticast =
          normalizedMac.startsWith('01:00:5e') ||
          normalizedMac.startsWith('33:33') ||
          normalizedMac.startsWith('01:80:c2');

        const vendor = lookupMacVendor(normalizedMac);

        const entry = {
          ip,
          mac: normalizedMac,
          rawMac,
          type,
          vendor,
          isBroadcast,
          isMulticast,
          interfaceIp: currentInterface ? currentInterface.ip : 'unknown'
        };

        if (currentInterface) {
          currentInterface.entries.push(entry);
        }
        allEntries.push(entry);
      }
    }

    // Heuristics: ARP Poisoning / MITM Spoofing Detection
    // Check if multiple different IP addresses share the same physical MAC
    const macToIps = new Map();
    for (const e of allEntries) {
      if (e.isBroadcast || e.isMulticast) continue;
      if (!macToIps.has(e.mac)) {
        macToIps.set(e.mac, []);
      }
      macToIps.get(e.mac).push(e.ip);
    }

    const mitmSuspects = [];
    for (const [mac, ips] of macToIps.entries()) {
      const uniqueIps = Array.from(new Set(ips));
      if (uniqueIps.length > 1) {
        // Flag duplicate MAC across multiple unicast IPs
        mitmSuspects.push({
          mac,
          vendor: lookupMacVendor(mac),
          conflictingIps: uniqueIps,
          severity: 'CRITICAL',
          type: 'ARP_SPOOFING_OR_MAC_CLONING',
          detail: `Multiple IPs (${uniqueIps.join(', ')}) are claiming the identical physical MAC address ${mac}. This strongly indicates an active ARP Poisoning / Man-In-The-Middle (MITM) attack or a multi-homed rogue bridge.`
        });
      }
    }

    // Guess default gateway IP (first .1 on primary interface)
    let gatewayIp = null;
    let gatewayMac = null;
    let gatewayVendor = null;

    const primaryIface = interfaces[0];
    if (primaryIface && primaryIface.ip) {
      const parts = primaryIface.ip.split('.');
      const expectedGw = `${parts[0]}.${parts[1]}.${parts[2]}.1`;
      const gwEntry = allEntries.find((e) => e.ip === expectedGw);
      if (gwEntry) {
        gatewayIp = gwEntry.ip;
        gatewayMac = gwEntry.mac;
        gatewayVendor = gwEntry.vendor;
      }
    }

    const dynamicCount = allEntries.filter((e) => e.type === 'dynamic').length;
    const staticCount = allEntries.filter((e) => e.type === 'static').length;
    const isPoisoned = mitmSuspects.length > 0;

    let arpSecurityStatus = 'CLEAN';
    let arpRiskScore = 98;

    if (isPoisoned) {
      arpSecurityStatus = 'MITM_ATTACK_DETECTED';
      arpRiskScore = 35;
    } else if (mitmSuspects.length > 0) {
      arpSecurityStatus = 'SUSPICIOUS_DUPLICATES';
      arpRiskScore = 60;
    }

    return {
      status: 'SUCCESS',
      arpSecurityStatus,
      arpRiskScore,
      isPoisoned,
      mitmSuspects,
      gateway: {
        ip: gatewayIp,
        mac: gatewayMac,
        vendor: gatewayVendor,
        status: gatewayMac ? 'VERIFIED_GATEWAY' : 'UNKNOWN'
      },
      stats: {
        totalEntries: allEntries.length,
        dynamicCount,
        staticCount,
        interfacesCount: interfaces.length,
        mitmAlertsCount: mitmSuspects.length
      },
      interfaces,
      entries: allEntries,
      analyzedAt: new Date().toISOString()
    };
  } catch (err) {
    console.error('Error analyzing ARP table:', err);
    return {
      status: 'ERROR',
      error: err.message,
      entries: [],
      interfaces: [],
      mitmSuspects: []
    };
  }
}

// 1-Click Unified Firewall Remediation Script Generator
export function generateRemediationScript(format = 'powershell') {
  const audits = getSavedAudits();
  const exposedPortsMap = new Map();

  for (const [deviceId, audit] of Object.entries(audits)) {
    if (!audit || !audit.openPorts || !Array.isArray(audit.openPorts)) continue;
    const hostIp = audit.deviceIp || audit.ip;
    const hostName = audit.deviceName || hostIp;

    for (const p of audit.openPorts) {
      if (p.risk === 'CRITICAL' || p.risk === 'HIGH' || p.risk === 'MEDIUM') {
        if (!exposedPortsMap.has(p.port)) {
          exposedPortsMap.set(p.port, {
            port: p.port,
            service: p.service,
            risk: p.risk,
            cve: p.cve || 'Perimeter Exposure Vector',
            devices: []
          });
        }
        exposedPortsMap.get(p.port).devices.push({
          deviceId,
          name: hostName,
          ip: hostIp
        });
      }
    }
  }

  // If no ports were audited yet, include baseline protection ports
  if (exposedPortsMap.size === 0) {
    exposedPortsMap.set(445, {
      port: 445,
      service: 'SMB / CIFS',
      risk: 'CRITICAL',
      cve: 'CVE-2017-0144 (EternalBlue)',
      devices: [{ ip: 'Local Network Subnet', name: 'Baseline Hardening' }]
    });
    exposedPortsMap.set(23, {
      port: 23,
      service: 'Telnet',
      risk: 'CRITICAL',
      cve: 'CWE-319 (Cleartext Credential Sniffing)',
      devices: [{ ip: 'Local Network Subnet', name: 'Baseline Hardening' }]
    });
    exposedPortsMap.set(3389, {
      port: 3389,
      service: 'RDP (Remote Desktop)',
      risk: 'HIGH',
      cve: 'CVE-2019-0708 (BlueKeep)',
      devices: [{ ip: 'Local Network Subnet', name: 'Baseline Hardening' }]
    });
  }

  const portList = Array.from(exposedPortsMap.values());
  const nowStr = new Date().toISOString();

  if (format === 'bash' || format === 'sh' || format === 'linux') {
    let script = `#!/usr/bin/env bash\n`;
    script += `# ==============================================================================\n`;
    script += `# NetPulse Autonomous Cyber SOC - Unified Linux Firewall Lockdown Script\n`;
    script += `# Generated: ${nowStr}\n`;
    script += `# Targets Audited: ${portList.length} vulnerable port vectors\n`;
    script += `# ==============================================================================\n\n`;
    script += `set -e\n`;
    script += `echo "🛡️ [NetPulse CyberSOC] Applying hardened iptables & UFW firewall lockdown rules..."\n\n`;

    for (const item of portList) {
      const devNames = item.devices.map((d) => `${d.name} (${d.ip})`).join(', ');
      script += `# Vector: Port ${item.port} (${item.service}) - ${item.risk} Risk\n`;
      script += `# CVE / Threat: ${item.cve}\n`;
      script += `# Affected Hosts: ${devNames}\n`;
      script += `sudo ufw deny ${item.port}/tcp comment 'NetPulse SOC: Block ${item.service} (${item.cve})' || true\n`;
      script += `sudo iptables -C INPUT -p tcp --dport ${item.port} -j DROP 2>/dev/null || sudo iptables -A INPUT -p tcp --dport ${item.port} -j DROP\n\n`;
    }

    script += `echo "✅ [NetPulse CyberSOC] All ${portList.length} perimeter firewall blocking rules applied successfully!"\n`;
    script += `sudo ufw status verbose\n`;

    return {
      format: 'bash',
      filename: `netpulse_remediation_${Date.now()}.sh`,
      contentType: 'application/x-sh',
      rulesCount: portList.length,
      script
    };
  }

  // Default: Windows PowerShell (.ps1)
  let script = `<#\n`;
  script += `================================================================================\n`;
  script += ` NetPulse Autonomous Cyber SOC - Unified Windows Firewall Remediation Script\n`;
  script += ` Generated: ${nowStr}\n`;
  script += ` High-Risk Ports Targetted: ${portList.length} vectors\n`;
  script += `================================================================================\n`;
  script += ` INSTRUCTIONS: Run this script in an Elevated Administrator PowerShell prompt.\n`;
  script += ` It configures Windows Defender Advanced Firewall to strictly block all\n`;
  script += ` detected exposed exploit ports.\n`;
  script += `#>\n\n`;
  script += `$ErrorActionPreference = "SilentlyContinue"\n`;
  script += `Write-Host "🛡️ [NetPulse CyberSOC] Deploying Autonomous Perimeter Firewall Lockdown..." -ForegroundColor Cyan\n\n`;

  for (const item of portList) {
    const devNames = item.devices.map((d) => `${d.name} (${d.ip})`).join(', ');
    const ruleName = `NetPulse-SOC-Block-Port-${item.port}-${item.service.replace(/[^a-zA-Z0-9]/g, '')}`;

    script += `# Vector: Port ${item.port} (${item.service}) - ${item.risk} Risk\n`;
    script += `# CVE: ${item.cve}\n`;
    script += `# Monitored Hosts Exposed: ${devNames}\n`;
    script += `Remove-NetFirewallRule -DisplayName "${ruleName}" 2>$null\n`;
    script += `New-NetFirewallRule -DisplayName "${ruleName}" ` +
      `-Direction Inbound ` +
      `-LocalPort ${item.port} ` +
      `-Protocol TCP ` +
      `-Action Block ` +
      `-Description "NetPulse CyberSOC Automated Defense: Mitigates ${item.cve} on Port ${item.port}."\n`;
    script += `Write-Host "  ✓ Blocked Port ${item.port} (${item.service})" -ForegroundColor Yellow\n\n`;
  }

  script += `Write-Host "✅ [NetPulse CyberSOC] All ${portList.length} firewall defense rules successfully activated!" -ForegroundColor Green\n`;
  script += `Get-NetFirewallRule -DisplayName "NetPulse-SOC-Block-Port-*" | Select-Object DisplayName, Action, Direction | Format-Table -AutoSize\n`;

  return {
    format: 'powershell',
    filename: `netpulse_remediation_${Date.now()}.ps1`,
    contentType: 'text/plain',
    rulesCount: portList.length,
    script
  };
}

export default {
  PORT_CATALOG,
  probePort,
  auditDevicePorts,
  getSavedAudits,
  getThreatAlerts,
  resolveThreatAlert,
  classifyDomain,
  logDnsTrafficRecord,
  getDnsTrafficRecords,
  clearDnsTrafficLog,
  harvestLiveDnsCache,
  getSecurityOverview,
  lookupMacVendor,
  getArpGuardAnalysis,
  generateRemediationScript
};
