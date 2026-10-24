let ioInstance = null;

export function setupWebSocket(io) {
  ioInstance = io;

  io.on('connection', (socket) => {
    console.log(`[WebSocket] Client connected: ${socket.id}`);

    socket.on('disconnect', () => {
      console.log(`[WebSocket] Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function broadcastDeviceStatus(statusPayload) {
  if (ioInstance) {
    ioInstance.emit('device:status', statusPayload);
  }
}

export function broadcastNewAlert(alertPayload) {
  if (ioInstance) {
    ioInstance.emit('alert:new', alertPayload);
  }
}

export function broadcastAlertResolved(alertPayload) {
  if (ioInstance) {
    ioInstance.emit('alert:resolved', alertPayload);
  }
}

export function broadcastDnsUpdated(dnsPayload) {
  if (ioInstance) {
    ioInstance.emit('dns:updated', dnsPayload);
  }
}

export function broadcastDomainHealthUpdated(domainPayload) {
  if (ioInstance) {
    ioInstance.emit('domain:health:updated', domainPayload);
  }
}

export function broadcastBandwidth(bandwidthPayload) {
  if (ioInstance) {
    ioInstance.emit('telemetry:bandwidth', bandwidthPayload);
  }
}

export function getIO() {
  return ioInstance;
}

