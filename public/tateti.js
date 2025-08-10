// tateti.js (cliente) — usa ES module
/*
  Cliente Tateti:
  - Se conecta a socket.io en el mismo dominio
  - Parámetros por URL: ?sala=ID&player=JID
  - Maneja UI, turnos, animaciones y resalta victoria
  - Puede notificar al servidor el ganador (opcional)
*/

const socket = io(); // mismo origen
const params = new URLSearchParams(location.search);
const sala = params.get('sala') || 'local-' + Math.random().toString(36).slice(2, 8);
const playerJid = params.get('player') || 'guest-' + Math.random().toString(36).slice(2, 6);

// UI elements
const boardEl = document.getElementById('board');
const statusEl = document.getElementById('status');
const playersEl = document.getElementById('players');
const msgEl = document.getElementById('msg');
const btnReset = document.getElementById('btn-reset');

let mySymbol = null;
let myTurn = false;
let localBoard = Array(9).fill('');
let started = false;

// crear tablero dinámicamente
for (let i = 0; i < 9; i++) {
  const cell = document.createElement('div');
  cell.className = 'cell';
  cell.dataset.index = i;
  cell.addEventListener('click', () => {
    if (!started || !myTurn || localBoard[i] !== '') return;
    socket.emit('move', { sala, index: i, symbol: mySymbol });
  });
  boardEl.appendChild(cell);
}

// helpers de UI
function setStatus(text) {
  statusEl.textContent = text;
}

function setPlayersText(p1, p2) {
  playersEl.textContent = `Jugador 1: ${short(p1)} ${p1 === playerJid ? '(tú)' : ''} · Jugador 2: ${short(p2) || '—'}`;
}

function short(jid) {
  if (!jid) return '';
  try {
    return decodeURIComponent(jid).split('@')[0];
  } catch {
    return jid.split('@')[0];
  }
}

function renderBoard() {
  const cells = boardEl.children;
  for (let i = 0; i < 9; i++) {
    cells[i].textContent = localBoard[i] || '';
    cells[i].classList.remove('win', 'x', 'o', 'disabled');
    if (localBoard[i]) {
      cells[i].classList.add(localBoard[i] === 'X' ? 'x' : 'o', 'disabled');
    }
  }
}

function highlightWin(line) {
  for (const idx of line) {
    const el = boardEl.children[idx];
    if (el) el.classList.add('win');
  }
}

// Eventos socket
socket.on('connect', () => {
  setStatus('Conectado. Entrando a la sala...');
  socket.emit('join', { sala, playerJid });
});

socket.on('start', data => {
  mySymbol = data.symbol;
  myTurn = !!data.turn;
  started = true;
  localBoard = Array(9).fill('');
  renderBoard();
  setStatus(`Eres ${mySymbol}. ${myTurn ? 'Tu turno' : 'Turno rival'}`);
  setPlayersText(data.players?.player1, data.players?.player2);
  msgEl.textContent = data.players?.player2 ? 'Partida iniciada' : 'Esperando rival';
  btnReset.classList.add('hidden');
});

socket.on('update', data => {
  localBoard[data.index] = data.symbol;
  myTurn = !!data.turn;
  renderBoard();
  setStatus(myTurn ? 'Tu turno' : 'Turno rival');
});

socket.on('end', data => {
  started = false;
  myTurn = false;

  if (data.winnerSymbol) {
    setStatus(`Ganó ${data.winnerSymbol}`);
    msgEl.textContent = `Ganador: ${short(data.winnerJid)}`;
  } else {
    setStatus('Empate');
    msgEl.textContent = 'Nadie ganó 😅';
  }

  btnReset.classList.remove('hidden');

  if (data.winLine && Array.isArray(data.winLine)) {
    highlightWin(data.winLine);
  }

  // opcional: notificar al backend
  try {
    fetch(`/tateti-winner?sala=${encodeURIComponent(sala)}&winner=${encodeURIComponent(data.winnerJid || '')}`);
  } catch {}
});

socket.on('players', data => {
  setPlayersText(data.player1, data.player2);
  msgEl.textContent = !data.player2 ? 'Esperando segundo jugador...' : 'Rival conectado — listo para jugar';
});

socket.on('error', e => {
  setStatus('Error: ' + e);
});

socket.on('disconnect', () => {
  setStatus('Conexión perdida — reconectando…');
});

// Botón reiniciar
btnReset.addEventListener('click', () => {
  socket.emit('reset', { sala });
  btnReset.classList.add('hidden');
  setStatus('Esperando reinicio...');
});

// render inicial
renderBoard();
setStatus('Conectando...');
