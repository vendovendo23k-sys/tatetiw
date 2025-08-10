// tateti-server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fetch = require('node-fetch');
const { v4: uuidv4 } = require('uuid');

function iniciarServidorJuego() {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: '*' } });

  app.use(express.json());
  app.use(express.static(__dirname + '/public'));

  // In-memory storage de salas y boards
  const salas = {};   // { salaId: { player1, player2, groupId } }
  const boards = {};  // { salaId: Array(9) }

  // Endpoint para crear sala (lo llama el bot)
  app.post('/api/create-sala', (req, res) => {
    const { player1, groupId } = req.body;
    if (!player1 || !groupId) return res.status(400).json({ error: 'player1 y groupId son requeridos' });

    const sala = uuidv4().slice(0,6);
    salas[sala] = { player1, player2: null, groupId };
    boards[sala] = Array(9).fill('');
    const base = process.env.GAME_URL || `${req.protocol}://${req.get('host')}`;
    const linkPlayer1 = `${base}/tateti.html?sala=${sala}&player=${encodeURIComponent(player1)}`;
    return res.json({ sala, link: linkPlayer1 });
  });

  // Endpoint para unirse a sala (lo llama el bot cuando responde /unirse)
  app.post('/api/join-sala', (req, res) => {
    const { sala, player2 } = req.body;
    if (!sala || !player2) return res.status(400).json({ error: 'sala y player2 son requeridos' });
    const s = salas[sala];
    if (!s) return res.status(404).json({ error: 'Sala no encontrada' });
    if (s.player2) return res.status(409).json({ error: 'Sala llena' });
    s.player2 = player2;
    const base = process.env.GAME_URL || `${req.protocol}://${req.get('host')}`;
    const linkPlayer2 = `${base}/tateti.html?sala=${sala}&player=${encodeURIComponent(player2)}`;
    return res.json({ sala, link: linkPlayer2 });
  });

  // Socket.IO
  io.on('connection', (socket) => {
    socket.on('join', ({ sala, playerJid }) => {
      const s = salas[sala];
      if (!s) return socket.emit('error', 'Sala no existe');
      socket.join(sala);
      if (!boards[sala]) boards[sala] = Array(9).fill('');

      const symbol = (playerJid === s.player1) ? 'X' : 'O';
      const turn = symbol === 'X'; // X siempre inicia
      socket.emit('start', { symbol, turn });
    });

    socket.on('move', ({ sala, index, symbol }) => {
      if (!boards[sala] || boards[sala][index] !== '') return;
      boards[sala][index] = symbol;
      io.to(sala).emit('update', { index, symbol, turn: symbol === 'O' });

      // comprobación de ganador
      const winPatterns = [
        [0,1,2],[3,4,5],[6,7,8],
        [0,3,6],[1,4,7],[2,5,8],
        [0,4,8],[2,4,6]
      ];
      for (let pattern of winPatterns) {
        const [a,b,c] = pattern;
        if (boards[sala][a] && boards[sala][a] === boards[sala][b] && boards[sala][a] === boards[sala][c]) {
          const winnerSymbol = boards[sala][a];
          const winnerJid = (winnerSymbol === 'X') ? salas[sala].player1 : salas[sala].player2;
          io.to(sala).emit('end', { winnerSymbol, winnerJid });

          // notificar al bot (BOT_NOTIFY_URL debe ser público o ngrok)
          const botUrl = process.env.BOT_NOTIFY_URL;
          if (botUrl) {
            // usamos GET por simplicidad
            fetch(`${botUrl.replace(/\/$/, '')}/tateti-winner?sala=${sala}&winner=${encodeURIComponent(winnerJid)}`)
              .catch(err => console.error('Error notificando al bot:', err));
          } else {
            console.log('[tateti-server] BOT_NOTIFY_URL no configurada, ganador:', winnerJid);
          }

          delete boards[sala];
          delete salas[sala];
          break;
        }
      }
    });
  });

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => console.log(`🎮 Tateti server corriendo en puerto ${PORT}`));
}

module.exports = { iniciarServidorJuego };
