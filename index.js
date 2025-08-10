// index.js
const express = require('express');
const { Server } = require('socket.io');
const http = require('http');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Servir archivos estáticos desde /public
app.use(express.static(__dirname + '/public'));

// Tableros de cada sala
let boards = {};
let salas = {}; // { salaId: { player1, player2 } }

// Cuando un cliente se conecta
io.on('connection', socket => {
    console.log('🟢 Usuario conectado');

    // Unirse a sala
    socket.on('join', ({ sala, playerJid }) => {
        if (!salas[sala]) {
            salas[sala] = { player1: playerJid, player2: null };
        } else if (!salas[sala].player2 && salas[sala].player1 !== playerJid) {
            salas[sala].player2 = playerJid;
        }

        socket.join(sala);
        if (!boards[sala]) boards[sala] = Array(9).fill('');

        let symbol = (playerJid === salas[sala].player1) ? 'X' : 'O';
        let turn = (symbol === 'X');
        socket.emit('start', { symbol, turn });
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
        for (let pattern of winPatterns) {
            const [a,b,c] = pattern;
            if (boards[sala][a] && boards[sala][a] === boards[sala][b] && boards[sala][a] === boards[sala][c]) {
                io.to(sala).emit('end', {
                    winnerSymbol: boards[sala][a],
                    winnerJid: (boards[sala][a] === 'X') ? salas[sala].player1 : salas[sala].player2
                });
                delete boards[sala];
                delete salas[sala];
                break;
            }
        }
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
