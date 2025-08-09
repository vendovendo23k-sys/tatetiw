// tateti-server.js
const express = require('express');
const { Server } = require('socket.io');
const http = require('http');
const { notificarResultado, salasTateti } = require('./tateti.js');

function iniciarServidorJuego(sock) {
    const app = express();
    const server = http.createServer(app);
    const io = new Server(server, { cors: { origin: '*' } });

    app.use(express.static(__dirname + '/public')); // carpeta donde va tateti.html

    let boards = {};

    io.on('connection', socket => {
        socket.on('join', ({ sala, playerJid }) => {
            const salaInfo = salasTateti[sala];
            if (!salaInfo) return;
            socket.join(sala);
            if (!boards[sala]) boards[sala] = Array(9).fill('');

            let symbol = (playerJid === salaInfo.player1) ? 'X' : 'O';
            let turn = (symbol === 'X');
            socket.emit('start', { symbol, turn });
        });

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
                    let ganadorJid = (boards[sala][a] === 'X') ? salasTateti[sala].player1 : salasTateti[sala].player2;
                    io.to(sala).emit('end', { winnerSymbol: boards[sala][a], winnerJid: ganadorJid });

                    // 🔹 Notificar al grupo usando sock
                    notificarResultado(sock, sala, ganadorJid);

                    delete boards[sala];
                    break;
                }
            }
        });
    });

    app.get('/tateti-winner', (req, res) => {
        const { sala, winner } = req.query;
        notificarResultado(sock, sala, winner);
        res.send('OK');
    });

    server.listen(process.env.PORT || 3000, () => {
        console.log('Servidor Tateti activo');
    });
}

module.exports = { iniciarServidorJuego };
