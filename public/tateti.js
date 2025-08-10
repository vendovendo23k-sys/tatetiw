// tateti.js (cliente) — robusto y listo para marcador + empates + invitación
document.addEventListener('DOMContentLoaded', () => {
  const socket = io();
  const params = new URLSearchParams(location.search);
  const sala = params.get('sala') || 'local-' + Math.random().toString(36).slice(2, 8);
  const playerJid = params.get('player') || 'guest-' + Math.random().toString(36).slice(2, 6);

  const boardEl = document.getElementById('board');
  const statusEl = document.getElementById('status');
  const playersEl = document.getElementById('players');
  const msgEl = document.getElementById('msg');
  const btnReset = document.getElementById('btn-reset');

  // Crear marcador
  const scoreEl = document.createElement('div');
  scoreEl.id = 'score';
  scoreEl.style.fontSize = '0.9rem';
  scoreEl.style.color = '#ccc';
  scoreEl.textContent = 'Marcador: X 0 — O 0';
  if (playersEl && playersEl.parentElement) {
    playersEl.parentElement.appendChild(scoreEl);
  }

  // Botón de invitación
  const inviteBtn = document.createElement('button');
  inviteBtn.textContent = '🔗 Invitar';
  inviteBtn.classList.add('secondary');
  inviteBtn.addEventListener('click', () => {
    const url = `${location.origin}?sala=${encodeURIComponent(sala)}`;
    navigator.clipboard.writeText(url).then(() => {
      alert('Enlace copiado al portapapeles:\n' + url);
    });
  });
  if (btnReset && btnReset.parentElement) {
    btnReset.parentElement.appendChild(inviteBtn);
  }

  let mySymbol = null;
  let myTurn = false;
  let localBoard = Array(9).fill('');
  let started = false;

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
    playersEl.textContent =
      `Jugador 1: ${short(p1)} ${p1 === playerJid ? '(tú)' : ''} · ` +
      `Jugador 2: ${short(p2) || '—'}`;
  }

  function updateScore(score) {
    if (scoreEl) {
      scoreEl.textContent = `Marcador: X ${score.X} — O ${score.O}`;
    }
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
      if (localBoard[i]) {
        cells[i].classList.add(localBoard[i] === 'X' ? 'x' : 'o');
      }
    }
  }

  function highlightWin(line) {
    if (!boardEl) return;
    for (const idx of line) {
      const el = boardEl.children[idx];
      if (el) el.classList.add('win');
    }
  }

  // Inicial
  buildBoard();
  setStatus('Conectando al servidor…');

  // Eventos de socket
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
    updateScore(data.score || { X: 0, O: 0 });
    msgEl.textContent = data.players?.player2 ? 'Partida iniciada' : 'Esperando rival';
    btnReset.classList.add('hidden');
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
    msgEl.textContent = `Ganó ${short(data.winnerJid)}`;
    btnReset.classList.remove('hidden');
    updateScore(data.score || { X: 0, O: 0 });

    if (data.winLine && Array.isArray(data.winLine)) {
      highlightWin(data.winLine);
    }
  });

  socket.on('draw', data => {
    started = false;
    myTurn = false;
    setStatus('¡Empate!');
    msgEl.textContent = data.message || 'Nadie ganó esta vez';
    btnReset.classList.remove('hidden');
    updateScore(data.score || { X: 0, O: 0 });
  });

  socket.on('resetBoard', data => {
    localBoard = Array(9).fill('');
    started = true;
    myTurn = (mySymbol === 'X');
    renderBoard();
    setStatus(`Eres ${mySymbol}. ${myTurn ? 'Tu turno' : 'Turno rival'}`);
    msgEl.textContent = 'Nueva partida';
    updateScore(data.score || { X: 0, O: 0 });
  });

  socket.on('players', data => {
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

  socket.on('disconnect', () => {
    setStatus('Conexión perdida — reconectando…');
  });

  btnReset.addEventListener('click', () => {
    socket.emit('reset', { sala });
    btnReset.classList.add('hidden');
    setStatus('Solicitando reinicio...');
  });
});

