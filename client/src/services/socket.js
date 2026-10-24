import { io } from 'socket.io-client';

let socketInstance = null;

export function getSocket() {
  if (!socketInstance) {
    const isViteDev = window.location.port === '5173';
    const serverUrl = isViteDev
      ? `${window.location.protocol}//${window.location.hostname}:5000`
      : window.location.origin;

    socketInstance = io(serverUrl, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      timeout: 10000
    });
  }
  return socketInstance;
}

export default getSocket;
