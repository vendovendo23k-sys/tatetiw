// tateti.js (cliente) — corregido y robusto

document.addEventListener('DOMContentLoaded', () => {
  const socket = io(); // se conecta al mismo origen
  const params = new URLSearchParams(location.search);
  const sala = params.get('sala') || 'local-' + Math.random().toString(36).slice(2, 8);
  const playerJid = params.get('player') || 'guest-' + Math.random().toString(36).slice(2, 6);

  const boardEl = document.getElementById('board');
  const statusEl = document.getElementById('status');
  const playersEl = document.getElementById('players');
  const msgEl = document.getElementById('msg');
  const btnReset = document.getElementById('btn-reset');

  let mySymbol = null;
  let myTurn = false;
  let localBoard = Array(9).fill('');
  let started = false;

  // Crear tablero inicial (vacío)
  function buildBoard() {
    if (!boardEl) return;
    boardEl.innerHTML = '';
    for (let i = 0; i < 9; i++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.index = i;
      cell.addEventListener('click', () => {
        if (!started) return;
        if (!myTurn) return;
        if (localBoard[i] !== '') return;
        socket.emit('move', { sala, index: i, symbol: mySymbol });
      });
      boardEl.appendChild(cell);
    }
  }

  function setStatus(text) {
    if (statusEl) statusEl.textContent = text;
  }

  function setPlayersText(p1, p2) {
    if (!playersEl) return;
    playersEl.textContent = `Jugador 1: ${short(p1)} ${p1 === playerJid ? '(tú)' : ''} · Jugador 2: ${short(p2) || '—'}`;
  }

  function short(jid) {
    if (!jid) return '';
    try {
      return decodeURIComponent(jid).split('@')[0];
    } catch (e) {
      return jid.split('@')[0];
    }
  }

  function renderBoard() {
    if (!boardEl) return;
    const cells = boardEl.children;
    for (let i = 0; i < 9; i++) {
      cells[i].textContent = localBoard[i] || '';
      cells[i].classList.toggle('disabled', !!localBoard[i]);
      cells[i].classList.remove('win', 'x', 'o');
      if (localBoard[i]) cells[i].classList.add(localBoard[i] === 'X' ? 'x' : 'o');
    }
  }

  function highlightWin(line) {
    if (!boardEl) return;
    for (const idx of line) {
      const el = boardEl.children[idx];
      if (el) el.classList.add('win');
    }
  }

  // Inicializar tablero vacío desde el inicio
  buildBoard();
  setStatus('Conectando al servidor…');

  // Eventos socket
  socket.on('connect', () => {
    setStatus('Conectado. Solicitando unión a sala...');
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
    if (msgEl) msgEl.textContent = data.players?.player2 ? 'Partida iniciada' : 'Esperando rival';
    if (btnReset) btnReset.classList.add('hidden');
  });

  socket.on('update', data => {
    localBoard[data.index] = data.symbol;
    myTurn = !!data.turn;
    setStatus(myTurn ? 'Tu turno' : 'Turno rival');
    renderBoard();
  });

  socket.on('end', data => {
    started = false;
    myTurn = false;
    setStatus(`Partida terminada — Ganador: ${data.winnerSymbol}`);
    if (msgEl) msgEl.textContent = `Ganó ${short(data.winnerJid)}`;
    if (btnReset) btnReset.classList.remove('hidden');

    if (data.winLine && Array.isArray(data.winLine)) {
      highlightWin(data.winLine);
    }

    try {
      fetch(`/tateti-winner?sala=${encodeURIComponent(sala)}&winner=${encodeURIComponent(data.winnerJid)}`)
        .catch(() => { });
    } catch (e) { }
  });

  socket.on('players', data => {
    setPlayersText(data.player1, data.player2);
    if (!data.player2) {
      if (msgEl) msgEl.textContent = 'Esperando segundo jugador...';
    } else {
      if (msgEl) msgEl.textContent = 'Rival conectado — partida lista';
    }
  });

  socket.on('error', e => {
    setStatus('Error: ' + e);
  });

  socket.on('disconnect', () => {
    setStatus('Conexión perdida — reconectando…');
  });

  if (btnReset) {
    btnReset.addEventListener('click', () => {
      socket.emit('reset', { sala });
      btnReset.classList.add('hidden');
      setStatus('Solicitando reinicio...');
    });
  }
});
