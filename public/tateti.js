// tateti.js (cliente) — mejorado con bienvenida, invitación, empate y contador
document.addEventListener('DOMContentLoaded', () => {
  const socket = io();
  const params = new URLSearchParams(location.search);
  let sala = params.get('sala') || null;
  const playerJid = params.get('player') || 'guest-' + Math.random().toString(36).slice(2, 6);

  const boardEl = document.getElementById('board');
  const statusEl = document.getElementById('status');
  const playersEl = document.getElementById('players');
  const msgEl = document.getElementById('msg');
  const btnReset = document.getElementById('btn-reset');

  // Elementos de bienvenida e invitación
  const welcomeOverlay = document.createElement('div');
  welcomeOverlay.id = 'welcome';
  welcomeOverlay.innerHTML = `
    <div class="welcome-box">
      <h2>🎯 Bienvenido a Tateti — ShelbyCash</h2>
      <p>Juega partidas 1 vs 1 con tus amigos del grupo.</p>
      <button id="start-btn">🎮 Empezar partida</button>
      <div id="invite-box" class="hidden">
        <p>Comparte este enlace para invitar a tu rival:</p>
        <input type="text" id="invite-link" readonly>
        <button id="copy-link">📋 Copiar enlace</button>
        <button id="whatsapp-link">💬 Enviar por WhatsApp</button>
      </div>
    </div>
  `;
  document.body.appendChild(welcomeOverlay);

  let mySymbol = null;
  let myTurn = false;
  let localBoard = Array(9).fill('');
  let started = false;
  let scores = { X: 0, O: 0 };

  // Construir tablero
  function buildBoard() {
    if (!boardEl) return;
    boardEl.innerHTML = '';
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

  function checkDraw() {
    return localBoard.every(cell => cell !== '');
  }

  function updateScore(winnerSymbol) {
    if (winnerSymbol && scores[winnerSymbol] !== undefined) {
      scores[winnerSymbol]++;
    }
    msgEl.textContent = `Marcador → X: ${scores.X} | O: ${scores.O}`;
  }

  // Inicializar tablero vacío
  buildBoard();
  setStatus('Esperando inicio...');

  // Eventos socket
  socket.on('connect', () => {
    console.log('🔌 Conectado al servidor');
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
    setStatus(myTurn ? 'Tu turno' : 'Turno rival');
    renderBoard();

    // Detectar empate
    if (checkDraw()) {
      started = false;
      setStatus('¡Empate!');
      msgEl.textContent = 'Nadie gana esta vez 😅';
      btnReset.classList.remove('hidden');
    }
  });

  socket.on('end', data => {
    started = false;
    myTurn = false;
    setStatus(`Ganador: ${data.winnerSymbol}`);
    msgEl.textContent = `Ganó ${short(data.winnerJid)}`;
    updateScore(data.winnerSymbol);
    btnReset.classList.remove('hidden');

    if (data.winLine) highlightWin(data.winLine);
  });

  socket.on('players', data => {
    setPlayersText(data.player1, data.player2);
  });

  socket.on('disconnect', () => {
    setStatus('Conexión perdida — reconectando…');
  });

  // Botón de reinicio
  btnReset.addEventListener('click', () => {
    socket.emit('reset', { sala });
    btnReset.classList.add('hidden');
    setStatus('Nueva partida iniciada');
  });

  // --- Funciones de bienvenida ---
  document.getElementById('start-btn').addEventListener('click', () => {
    sala = 'sala-' + Math.random().toString(36).slice(2, 8);
    const link = `${location.origin}?sala=${sala}&player=${playerJid}`;
    document.getElementById('invite-link').value = link;
    document.getElementById('invite-box').classList.remove('hidden');
    socket.emit('join', { sala, playerJid });
  });

  document.getElementById('copy-link').addEventListener('click', () => {
    const input = document.getElementById('invite-link');
    input.select();
    document.execCommand('copy');
    alert('Enlace copiado ✅');
  });

  document.getElementById('whatsapp-link').addEventListener('click', () => {
    const link = document.getElementById('invite-link').value;
    const waUrl = `https://wa.me/?text=${encodeURIComponent("Te reto a un Tateti ShelbyCash: " + link)}`;
    window.open(waUrl, '_blank');
  });
});

