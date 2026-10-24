import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getArpGuardAnalysis, appendThreatAlerts } from './securityService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../data');
const WHITELIST_FILE = path.join(DATA_DIR, 'asset_whitelist.json');
const CONFIG_FILE = path.join(DATA_DIR, 'asset_guard_config.json');

function initStorage() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(CONFIG_FILE)) {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify({ zeroTrustMode: true }, null, 2));
  }
  if (!fs.existsSync(WHITELIST_FILE)) {
    fs.writeFileSync(WHITELIST_FILE, JSON.stringify([], null, 2));
  }
}
initStorage();

export class AssetGuardService {
  constructor() {
    this.config = this.loadConfig();
    this.whitelist = this.loadWhitelist();
  }

  loadConfig() {
    try {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    } catch {
      return { zeroTrustMode: true };
    }
  }

  saveConfig(cfg) {
    this.config = { ...this.config, ...cfg };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(this.config, null, 2));
    return this.config;
  }

  loadWhitelist() {
    try {
      return JSON.parse(fs.readFileSync(WHITELIST_FILE, 'utf8'));
    } catch {
      return [];
    }
  }

  saveWhitelist(list) {
    this.whitelist = list;
    fs.writeFileSync(WHITELIST_FILE, JSON.stringify(this.whitelist, null, 2));
    return this.whitelist;
  }

  authorizeDevice({ mac, ip, name, type = 'workstation', notes = '' }) {
    if (!mac) throw new Error('MAC address is required');
    const cleanMac = mac.toLowerCase().trim();
    const existing = this.whitelist.find((a) => a.mac.toLowerCase() === cleanMac);

    const asset = {
      mac: cleanMac,
      ip: ip || existing?.ip || 'N/A',
      name: name || existing?.name || `Host-${cleanMac.slice(-5)}`,
      type,
      notes,
      authorizedAt: existing?.authorizedAt || new Date().toISOString(),
      lastSeenAt: new Date().toISOString()
    };

    const nextList = this.whitelist.filter((a) => a.mac.toLowerCase() !== cleanMac);
    nextList.push(asset);
    this.saveWhitelist(nextList);
    return asset;
  }

  authorizeAllCurrent(currentAssets = []) {
    const nextList = [...this.whitelist];
    const existingMacs = new Set(nextList.map((a) => a.mac.toLowerCase()));

    for (const asset of currentAssets) {
      if (!asset.mac) continue;
      const cleanMac = asset.mac.toLowerCase().trim();
      if (!existingMacs.has(cleanMac)) {
        nextList.push({
          mac: cleanMac,
          ip: asset.ip || 'N/A',
          name: asset.friendlyName && asset.friendlyName !== 'Unapproved LAN Host' ? asset.friendlyName : `Asset ${cleanMac.slice(-5)}`,
          type: asset.isGateway ? 'router' : (asset.vendor?.toLowerCase().includes('apple') ? 'mobile' : 'workstation'),
          notes: `Auto-whitelisted baseline on ${new Date().toLocaleDateString()}`,
          authorizedAt: new Date().toISOString(),
          lastSeenAt: new Date().toISOString()
        });
        existingMacs.add(cleanMac);
      }
    }

    this.saveWhitelist(nextList);
    return { success: true, count: nextList.length };
  }

  revokeDevice(mac) {
    if (!mac) throw new Error('MAC address is required');
    const cleanMac = mac.toLowerCase().trim();
    const nextList = this.whitelist.filter((a) => a.mac.toLowerCase() !== cleanMac);
    this.saveWhitelist(nextList);
    return { success: true, mac: cleanMac };
  }

  async auditLanAssets() {
    const arpAnalysis = await getArpGuardAnalysis().catch(() => ({ entries: [], gateway: null }));
    const arpEntries = arpAnalysis.entries || [];
    const gatewayMac = arpAnalysis.gateway?.mac?.toLowerCase() || '';

    const whitelistMap = new Map(this.whitelist.map((a) => [a.mac.toLowerCase(), a]));
    const assets = [];
    const rogueAssets = [];

    for (const entry of arpEntries) {
      const cleanMac = (entry.mac || '').toLowerCase().trim();
      const isGateway = cleanMac === gatewayMac;
      const isBroadcast = cleanMac === 'ff-ff-ff-ff-ff-ff' || cleanMac === 'ff:ff:ff:ff:ff:ff';
      if (isBroadcast) continue;

      const matchedWhitelist = whitelistMap.get(cleanMac);
      const isApproved = Boolean(matchedWhitelist) || isGateway;

      const item = {
        mac: entry.mac,
        ip: entry.ip,
        vendor: entry.vendor || 'Unknown Vendor',
        type: entry.type || 'dynamic',
        interfaceIp: entry.interfaceIp,
        isGateway,
        isApproved,
        friendlyName: isGateway ? 'Gateway / Router' : (matchedWhitelist?.name || 'Unapproved LAN Host'),
        assetType: matchedWhitelist?.type || (isGateway ? 'router' : 'unknown'),
        authorizedAt: matchedWhitelist?.authorizedAt || null,
        status: isApproved ? 'AUTHORIZED' : 'ROGUE_UNAUTHORIZED',
        firewallBanRule: {
          powershell: `New-NetFirewallRule -DisplayName "NetPulse Ban Rogue ${entry.ip}" -Direction Inbound -RemoteAddress "${entry.ip}" -Action Block`,
          linuxIptables: `sudo iptables -I INPUT -s ${entry.ip} -j DROP`
        }
      };

      assets.push(item);

      if (!isApproved && this.config.zeroTrustMode) {
        rogueAssets.push(item);
      }
    }

    // Auto dispatch threat alert if any rogue asset detected
    if (rogueAssets.length > 0 && this.config.zeroTrustMode) {
      appendThreatAlerts(
        rogueAssets.slice(0, 5).map((rogue) => ({
          id: `threat-rogue-${rogue.mac.replace(/[:-]/g, '')}`,
          severity: 'HIGH',
          service: 'Zero-Trust Asset Guard',
          title: `🚨 Rogue Host Detected on LAN (${rogue.ip})`,
          description: `Unrecognized MAC [${rogue.mac}] (${rogue.vendor}) connected to subnet. Not found in Approved Assets Whitelist.`,
          ip: rogue.ip,
          mac: rogue.mac,
          mitigation: `Authorize device in Asset Guard or apply host isolation rule: ${rogue.firewallBanRule.powershell}`
        }))
      );
    }

    return {
      zeroTrustMode: this.config.zeroTrustMode,
      totalTracked: assets.length,
      approvedCount: assets.filter((a) => a.isApproved).length,
      rogueCount: rogueAssets.length,
      rogueAssets,
      assets,
      whitelist: this.whitelist
    };
  }
}

export default new AssetGuardService();
