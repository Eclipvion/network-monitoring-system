import express from 'express';
import assetGuard from '../services/assetGuardService.js';

const router = express.Router();

// GET /api/security/asset-guard - Audit all current LAN assets vs whitelist
router.get('/', async (req, res) => {
  try {
    const audit = await assetGuard.auditLanAssets();
    res.json(audit);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/security/asset-guard/authorize - Add or update whitelist entry
router.post('/authorize', (req, res) => {
  try {
    const { mac, ip, name, type, notes } = req.body;
    const asset = assetGuard.authorizeDevice({ mac, ip, name, type, notes });
    res.json({ success: true, asset });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/security/asset-guard/authorize-all - Baseline authorize all currently active assets
router.post('/authorize-all', async (req, res) => {
  try {
    const { assets } = req.body;
    let listToAuthorize = assets;
    if (!listToAuthorize || listToAuthorize.length === 0) {
      const audit = await assetGuard.auditLanAssets();
      listToAuthorize = audit.assets;
    }
    const result = assetGuard.authorizeAllCurrent(listToAuthorize);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/security/asset-guard/revoke - Remove asset from whitelist
router.post('/revoke', (req, res) => {
  try {
    const { mac } = req.body;
    const result = assetGuard.revokeDevice(mac);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/security/asset-guard/mode - Toggle Zero-Trust enforcement
router.post('/mode', (req, res) => {
  try {
    const { zeroTrustMode } = req.body;
    const config = assetGuard.saveConfig({ zeroTrustMode: Boolean(zeroTrustMode) });
    res.json(config);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
