import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import { setupWebSocket } from './websocket/socketHandler.js';
import deviceRoutes from './routes/deviceRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import alertRoutes from './routes/alertRoutes.js';
import logRoutes from './routes/logRoutes.js';
import monitoringRoutes from './routes/monitoringRoutes.js';
import settingRoutes from './routes/settingRoutes.js';
import diagnosticRoutes from './routes/diagnosticRoutes.js';
import dnsRoutes from './routes/dnsRoutes.js';
import domainRoutes from './routes/domainRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import securityRoutes from './routes/securityRoutes.js';
import telemetryRoutes from './routes/telemetryRoutes.js';
import discoveryRoutes from './routes/discoveryRoutes.js';
import { startBackgroundMonitor } from './services/backgroundMonitor.js';
import { startTelemetryCollector } from './services/telemetryService.js';
import { startNetworkWatchdog } from './services/discovery/networkWatchdog.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

// Setup CORS
const allowedOrigins = [CLIENT_ORIGIN, 'http://localhost:5173', 'http://127.0.0.1:5173'];
app.use(cors({
  origin: (origin, callback) => {
    // allow requests with no origin (like mobile apps, curl, python workers)
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, true); // Permissive in dev to avoid CORS blocking
  },
  credentials: true
}));

app.use(express.json());

// Setup Socket.IO
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});
setupWebSocket(io);
startBackgroundMonitor(5000);
startTelemetryCollector();
startNetworkWatchdog(60);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API Routes
app.use('/api/devices', deviceRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/diagnostics', diagnosticRoutes);
app.use('/api/dns', dnsRoutes);
app.use('/api/domains', domainRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/security', securityRoutes);
app.use('/api/telemetry', telemetryRoutes);
app.use('/api/discovery', discoveryRoutes);

// Serve static client build if available (Unified Single Server deployment)
const clientDistPath = path.resolve(__dirname, '../client/dist');
app.use(express.static(clientDistPath));

// SPA Fallback Route for direct browser refresh on routes like /settings
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
    return next();
  }
  const indexPath = path.join(clientDistPath, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) next();
  });
});

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error'
  });
});

server.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`🚀 Network Monitoring Server running on port ${PORT}`);
  console.log(`📡 WebSocket ready`);
  console.log(`🌐 Client Origin: ${CLIENT_ORIGIN}`);
  console.log(`📁 Data Directory: ${process.env.DATA_DIR || './data'}`);
  console.log(`===============================================`);
});

export { app, server };
