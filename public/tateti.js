// tateti.js (cliente) — usa ES module (type=module in <script>)
/*
  Cliente Tateti:
  - Se conecta al socket.io del mismo dominio
  - Parámetros por URL: ?sala=ID&player=JID
  - Maneja UI, turnos, animaciones, resalta victoria
  - Llama a /tateti-winner?sala=...&winner=... al terminar (opcional)
*/

const socket = io(); // se conecta al mismo origen
const params = new URLSearchParams(location.search);
const sala = params.get('sala') || 'local-' + Math.random().toString(36).slice(2,8);
const playerJid = params.get('player') || 'guest-' + Math.random().toString(36).slice(2,6);

const boardEl = document.getElementById('board');
const statusEl = document.getElementById('status');
const playersEl = document.getElementById('players');
const msgEl = document.getElementById('msg');
const btnReset = document.getElementById('btn-reset');

let mySymbol = null;
let myTurn = false;
let localBoard = Array(9).fill('');
let started = false;

// build board cells
for (let i=0;i<9;i++){
  const cell = document.createElement('div');
  cell.className = 'cell';
  cell.dataset.index = i;
  cell.addEventListener('click', () => {
    if (!started) return;
    if (!myTurn) return;
    if (localBoard[i] !== '') return;
    // emitimos acción
    socket.emit('move', { sala, index: i, symbol: mySymbol });
  });
  boardEl.appendChild(cell);
}

function setStatus(text){
  statusEl.textContent = text;
}
function setPlayersText(p1, p2){
  playersEl.textContent = `Jugador 1: ${short(p1)} ${p1 === playerJid ? '(tú)' : ''} · Jugador 2: ${short(p2) || '—'}`;
}
function short(jid){
  if (!jid) return '';
  try { return decodeURIComponent(jid).split('@')[0]; } catch(e){ return jid.split('@')[0]; }
}
function renderBoard(){
  const cells = boardEl.children;
  for (let i=0;i<9;i++){
    cells[i].textContent = localBoard[i] || '';
    cells[i].classList.toggle('disabled', !!localBoard[i]);
    cells[i].classList.remove('win','x','o');
    if (localBoard[i]) cells[i].classList.add(localBoard[i] === 'X' ? 'x' : 'o');
  }
}

// socket events
socket.on('connect', () => {
  setStatus('Conectado. Solicitando unión a sala...');
  socket.emit('join', { sala, playerJid });
});

socket.on('start', data => {
  // data: { symbol: 'X'|'O', turn: boolean, players: {p1,p2} }
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
  // data: { index, symbol, turn }
  localBoard[data.index] = data.symbol;
  myTurn = !!data.turn;
  setStatus(myTurn ? 'Tu turno' : 'Turno rival');
  renderBoard();
});

socket.on('end', data => {
  // data: { winnerSymbol, winnerJid, winLine? }
  started = false;
  myTurn = false;
  setStatus(`Partida terminada — Ganador: ${data.winnerSymbol}`);
  msgEl.textContent = `Ganó ${short(data.winnerJid)}`;
  btnReset.classList.remove('hidden');

  // resaltar línea si viene
  if (data.winLine && Array.isArray(data.winLine)){
    highlightWin(data.winLine);
  }

  // Notificar al endpoint (opcional): servidor ya puede notificar al bot, pero este fetch da una capa extra
  try {
    fetch(`/tateti-winner?sala=${encodeURIComponent(sala)}&winner=${encodeURIComponent(data.winnerJid)}`)
      .catch(()=>{/* no bloquear UI */});
  } catch(e){}
});

socket.on('players', data => {
  // data: { player1, player2 }
  setPlayersText(data.player1, data.player2);
  if (!data.player2) {
    msgEl.textContent = 'Esperando segundo jugador...';
  } else {
    msgEl.textContent = 'Rival conectado — partida lista';
  }
});

socket.on('error', e => {
  setStatus('Error: ' + e);
});

// Helpers
function highlightWin(line){
  for (const idx of line){
    const el = boardEl.children[idx];
    if (el) el.classList.add('win');
  }
}

btnReset.addEventListener('click', () => {
  // pedir reinicio al servidor (si quieres que servidor reinicie logica)
  socket.emit('reset', { sala });
  btnReset.classList.add('hidden');
  setStatus('Solicitando reinicio...');
});

// small safety: reconnect UX
socket.on('disconnect', () => {
  setStatus('Conexión perdida — reconectando…');
});

// render initial (empty)
renderBoard();
setStatus('Conectando al servidor…');
