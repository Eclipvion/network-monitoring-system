import express from 'express';
import dataStore from '../services/dataStore.js';
import { broadcastDomainHealthUpdated } from '../websocket/socketHandler.js';

const router = express.Router();

// POST /api/domain-health/result - Worker posts check result
router.post('/result', async (req, res) => {
  try {
    const { domainId, timestamp, httpStatus, responseTimeMs, sslValid, sslExpiresAt, sslDaysRemaining, dnsResolved, resolvedIp } = req.body;

    if (domainId === undefined) {
      return res.status(400).json({ error: 'domainId is required' });
    }

    const saved = await dataStore.saveDomainHealthResult({
      domainId: Number(domainId),
      timestamp,
      httpStatus,
      responseTimeMs,
      sslValid,
      sslExpiresAt,
      sslDaysRemaining,
      dnsResolved,
      resolvedIp
    });

    broadcastDomainHealthUpdated(saved);

    res.status(201).json(saved);
  } catch (err) {
    console.error('Error saving domain health result:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
