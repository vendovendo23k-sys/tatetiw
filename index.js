// index.js
const express = require('express');
const { Server } = require('socket.io');
const http = require('http');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.static(__dirname + '/public'));

// Estado del juego
let boards = {}; // Tablero de cada sala
let salas = {};  // { salaId: { player1, player2, score: { X:0, O:0 } } }

// --- Notificar al bot (placeholder) ---
async function notificarBot(sala, winnerJid, winnerSymbol) {
  console.log(`📢 Bot: Sala ${sala}, Ganador ${winnerJid} (${winnerSymbol})`);
  // Aquí puedes integrar tu bot de WhatsApp
}

io.on('connection', socket => {
  console.log('🟢 Usuario conectado');

  // Unirse a sala
  socket.on('join', ({ sala, playerJid }) => {
    if (!salas[sala]) {
      salas[sala] = { player1: playerJid, player2: null, score: { X: 0, O: 0 } };
    } else if (!salas[sala].player2 && salas[sala].player1 !== playerJid) {
      salas[sala].player2 = playerJid;
    }

    socket.join(sala);
    if (!boards[sala]) boards[sala] = Array(9).fill('');

    io.to(sala).emit('players', {
      player1: salas[sala].player1,
      player2: salas[sala].player2
    });

    let symbol = (playerJid === salas[sala].player1) ? 'X' : 'O';
    let turn = (symbol === 'X');
    socket.emit('start', {
      symbol,
      turn,
      players: salas[sala],
      score: salas[sala].score
    });
  });

  // Movimiento
  socket.on('move', ({ sala, index, symbol }) => {
    if (!boards[sala] || boards[sala][index] !== '') return;
    boards[sala][index] = symbol;

    io.to(sala).emit('update', { index, symbol, turn: symbol === 'O' });

    const winPatterns = [
      [0,1,2],[3,4,5],[6,7,8],
      [0,3,6],[1,4,7],[2,5,8],
      [0,4,8],[2,4,6]
    ];

    // Revisar si alguien ganó
    for (let pattern of winPatterns) {
      const [a,b,c] = pattern;
      if (boards[sala][a] && boards[sala][a] === boards[sala][b] && boards[sala][a] === boards[sala][c]) {
        const winnerSymbol = boards[sala][a];
        const winnerJid = (winnerSymbol === 'X') ? salas[sala].player1 : salas[sala].player2;

        // Sumar punto al ganador
        if (salas[sala]?.score) {
          salas[sala].score[winnerSymbol]++;
        }

        io.to(sala).emit('end', {
          winnerSymbol,
          winnerJid,
          winLine: pattern,
          score: salas[sala].score
        });

        notificarBot(sala, winnerJid, winnerSymbol);

        boards[sala] = Array(9).fill('');
        return;
      }
    }

    // Detectar empate (si no hay celdas vacías)
    if (!boards[sala].includes('')) {
      io.to(sala).emit('draw', {
        message: '¡Empate!',
        score: salas[sala].score
      });
      boards[sala] = Array(9).fill('');
    }
  });

  // Reinicio manual
  socket.on('reset', ({ sala }) => {
    boards[sala] = Array(9).fill('');
    io.to(sala).emit('resetBoard', {
      score: salas[sala]?.score || { X: 0, O: 0 }
    });
  });

  socket.on('disconnect', () => {
    console.log('🔴 Usuario desconectado');
  });
});

// Ruta principal
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/tateti.html');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Servidor Tateti escuchando en puerto ${PORT}`);
});


