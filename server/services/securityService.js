import net from 'net';
import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = process.env.DATA_DIR || path.resolve(__dirname, '../../data');

const AUDITS_FILE = path.join(DATA_DIR, 'security_audits.json');
const TRAFFIC_FILE = path.join(DATA_DIR, 'dns_traffic.json');
const THREATS_FILE = path.join(DATA_DIR, 'threat_alerts.json');

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
    const existingKeys = new Set(threats.map((t) => `${t.deviceIp}:${t.port}`));
    const fresh = newThreats.filter((t) => !existingKeys.has(`${t.deviceIp}:${t.port}`));
    threats = [...fresh, ...threats].slice(0, 100); // keep recent 100
    fs.writeFileSync(THREATS_FILE, JSON.stringify(threats, null, 2));
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

// Classify domain threat & category
export function classifyDomain(domain) {
  const d = (domain || '').toLowerCase().trim();

  // Known Search Engines
  if (/(google|bing|yahoo|duckduckgo|baidu|yandex|ecosia|startpage)\./.test(d)) {
    return {
      category: 'Search Engine',
      threatLevel: 'SAFE',
      flagReason: 'Verified Public Search Provider'
    };
  }

  // Known Social Media & Streaming
  if (/(facebook|instagram|whatsapp|tiktok|youtube|netflix|twitter|x\.com|twitch|reddit|linkedin|spotify)\./.test(d)) {
    return {
      category: 'Social / Media Streaming',
      threatLevel: 'SAFE',
      flagReason: 'Standard Social & Media Platform'
    };
  }

  // Development & Enterprise Infrastructure
  if (/(github|gitlab|stackoverflow|npm|npmjs|python|microsoft|apple|amazon|cloudflare|aws|azure)\./.test(d)) {
    return {
      category: 'Developer & Cloud Infra',
      threatLevel: 'SAFE',
      flagReason: 'Trusted Enterprise & Developer Service'
    };
  }

  // Suspicious TLDs or Crypto Mining / Malware patterns
  if (/(coinhive|xmrig|pool\.mine|cryptonight|nanopool|monero|stratum|f2pool|2miners)\./.test(d)) {
    return {
      category: 'Crypto Mining & Botnet',
      threatLevel: 'MALICIOUS',
      flagReason: 'Potential Unauthorized Cryptocurrency Miner Activity'
    };
  }

  if (/(malware|phish|exploit|ransom|payload|c2-server|ddos-guard|darkweb|onion|tor2web)\./.test(d) ||
      /\.(xyz|top|work|click|country|kim|stream|gq|cf|tk)$/.test(d)) {
    return {
      category: 'Suspicious / Untrusted TLD',
      threatLevel: 'SUSPICIOUS',
      flagReason: 'High-entropy or commonly abused threat extension'
    };
  }

  // General Web
  return {
    category: 'General Web Traffic',
    threatLevel: 'SAFE',
    flagReason: 'Normal Outbound Resolution'
  };
}

// Ingest DNS Traffic Record
export function logDnsTrafficRecord(record) {
  try {
    let traffic = JSON.parse(fs.readFileSync(TRAFFIC_FILE, 'utf8') || '[]');
    const classification = classifyDomain(record.domain);

    const enriched = {
      id: `dns-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: record.timestamp || new Date().toISOString(),
      clientIp: record.clientIp || '127.0.0.1',
      domain: record.domain,
      queryType: record.queryType || 'A',
      category: classification.category,
      threatLevel: classification.threatLevel,
      flagReason: classification.flagReason
    };

    // Prepend to list (max 500 entries)
    traffic = [enriched, ...traffic].slice(0, 500);
    fs.writeFileSync(TRAFFIC_FILE, JSON.stringify(traffic, null, 2));

    // If malicious, add threat alert
    if (enriched.threatLevel === 'MALICIOUS') {
      appendThreatAlerts([{
        id: `threat-dns-${Date.now()}`,
        deviceIp: enriched.clientIp,
        deviceName: `Host (${enriched.clientIp})`,
        port: 53,
        service: 'DNS Query',
        severity: 'CRITICAL',
        title: `Suspicious Domain Request: ${enriched.domain}`,
        description: `Host requested suspicious or threat-flagged destination: ${enriched.flagReason}`,
        recommendation: `Isolate device ${enriched.clientIp} and inspect active running processes for background malware.`,
        timestamp: enriched.timestamp
      }]);
    }

    return enriched;
  } catch (err) {
    console.error('Error logging DNS traffic:', err);
    return null;
  }
}

// Get recent DNS Traffic Records
export function getDnsTrafficRecords(limit = 100) {
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

// Capture Live Windows DNS Client Cache
export async function harvestLiveDnsCache() {
  try {
    const psCommand = `Get-DnsClientCache | Where-Object { $_.Entry -ne "" -and $_.Entry -notmatch "^_|^localhost" } | Select-Object -First 30 Entry, Type, Status | ConvertTo-Json`;
    const { stdout } = await execFileAsync('powershell', ['-NoProfile', '-Command', psCommand], { timeout: 4000 });
    
    if (!stdout || !stdout.trim()) return [];

    let entries = [];
    try {
      const parsed = JSON.parse(stdout);
      entries = Array.isArray(parsed) ? parsed : [parsed];
    } catch (e) {
      return [];
    }

    const recorded = [];
    for (const item of entries) {
      if (!item || !item.Entry) continue;
      const rec = logDnsTrafficRecord({
        domain: item.Entry,
        clientIp: 'Local Machine',
        queryType: item.Type === 1 ? 'A' : item.Type === 28 ? 'AAAA' : 'DNS'
      });
      if (rec) recorded.push(rec);
    }

    return recorded;
  } catch (err) {
    // Non-fatal if PowerShell command restricted
    return [];
  }
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
