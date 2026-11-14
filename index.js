const http = require('http');
const net = require('net');
const { WebSocketServer } = require('ws');

const UUID = 'aaaa1111bbbb4ccc8dddeeeeffff0000';
const WS_PATH = '/Telegram/@AM2_D3/@AHMAD3214';
const PORT = process.env.PORT || 8080;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Service actif');
});

const wss = new WebSocketServer({ server, path: WS_PATH });

wss.on('connection', (ws) => {
  let remoteSocket = null;

  ws.once('message', (msg) => {
    const buf = Buffer.from(msg);
    if (buf.length < 24) return ws.close();

    // Vérification de l'UUID (octets 1 à 16)
    const clientUuid = buf.subarray(1, 17).toString('hex');
    if (clientUuid !== UUID) return ws.close();

    const optLen = buf[17];
    const cmd = buf[18 + optLen];
    if (cmd !== 1) return ws.close(); // TCP uniquement

    let offset = 19 + optLen;
    const targetPort = buf.readUInt16BE(offset);
    offset += 2;
    const addrType = buf[offset++];

    let targetHost = '';
    if (addrType === 1) {
      targetHost = `${buf[offset]}.${buf[offset + 1]}.${buf[offset + 2]}.${buf[offset + 3]}`;
      offset += 4;
    } else if (addrType === 2) {
      const domainLen = buf[offset++];
      targetHost = buf.subarray(offset, offset + domainLen).toString('utf8');
      offset += domainLen;
    } else if (addrType === 3) {
      const parts = [];
      for (let i = 0; i < 8; i++) {
        parts.push(buf.readUInt16BE(offset + i * 2).toString(16));
      }
      targetHost = parts.join(':');
      offset += 16;
    } else {
      return ws.close();
    }

    const initialData = buf.subarray(offset);

    remoteSocket = net.connect(targetPort, targetHost, () => {
      // Réponse VLESS valide (version 0, longueur d'options 0)
      ws.send(Buffer.from([0, 0]));
      if (initialData.length > 0) remoteSocket.write(initialData);
    });

    remoteSocket.on('data', (chunk) => {
      if (ws.readyState === ws.OPEN) ws.send(chunk);
    });

    remoteSocket.on('error', () => ws.close());
    remoteSocket.on('close', () => ws.close());

    ws.on('message', (data) => {
      if (remoteSocket && !remoteSocket.destroyed) remoteSocket.write(data);
    });
  });

  ws.on('close', () => {
    if (remoteSocket) remoteSocket.destroy();
  });
  ws.on('error', () => {
    if (remoteSocket) remoteSocket.destroy();
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Serveur VLESS démarré sur le port
  ${PORT}`);
});
