/**
 * Tâb Game - Local Development Server
 * Servidor de desenvolvimento local, simula a API do servidor oficial
 * 
 * Funcionalidades:
 * - Registo/login de utilizadores (encriptação Hash de password)
 * - Emparelhamento e gestão de jogos
 * - Atualizações em tempo real via SSE
 * - Persistência de dados (ficheiros JSON)
 * - Sistema de classificações
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

const app = express();
const PORT = 8008;

// Caminhos dos ficheiros de dados
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const RANKINGS_FILE = path.join(DATA_DIR, 'rankings.json');

// Garantir que o diretório de dados existe
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ============================================
// Persistência de Dados
// ============================================

// Carregar dados dos utilizadores
function loadUsers() {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const data = fs.readFileSync(USERS_FILE, 'utf8');
      return new Map(JSON.parse(data));
    }
  } catch (err) {
    console.error('Error loading users:', err);
  }
  return new Map();
}

// Guardar dados dos utilizadores
function saveUsers() {
  try {
    const data = JSON.stringify([...users]);
    fs.writeFileSync(USERS_FILE, data, 'utf8');
  } catch (err) {
    console.error('Error saving users:', err);
  }
}

// Carregar dados das classificações
function loadRankings() {
  try {
    if (fs.existsSync(RANKINGS_FILE)) {
      const data = fs.readFileSync(RANKINGS_FILE, 'utf8');
      return new Map(JSON.parse(data));
    }
  } catch (err) {
    console.error('Error loading rankings:', err);
  }
  return new Map();
}

// Guardar dados das classificações
function saveRankings() {
  try {
    const data = JSON.stringify([...rankings]);
    fs.writeFileSync(RANKINGS_FILE, data, 'utf8');
  } catch (err) {
    console.error('Error saving rankings:', err);
  }
}

// ============================================
// Encriptação Hash de Password
// ============================================

// Gerar Hash da password
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Verificar password
function verifyPassword(password, hashedPassword) {
  return hashPassword(password) === hashedPassword;
}

// ============================================
// Middleware
// ============================================

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

// ============================================
// Armazenamento de Dados
// ============================================

const users = loadUsers();           // nick -> hashedPassword
const rankings = loadRankings();     // `${group}-${size}` -> [{nick, games, victories}]
const games = new Map();             // gameId -> jogo
const waitingPlayers = new Map();    // `${group}-${size}` -> { nick, gameId }
const sseClients = new Map();        // `${nick}-${gameId}` -> resposta

// ============================================
// Funções Utilitárias
// ============================================

// Gerar ID do jogo
function generateGameId() {
  return crypto.randomBytes(8).toString('hex');
}

// Lançar dado
function rollDice() {
  const rand = Math.random();
  let lightCount;
  if (rand < 0.0625) lightCount = 0;
  else if (rand < 0.3125) lightCount = 1;
  else if (rand < 0.6875) lightCount = 2;
  else if (rand < 0.9375) lightCount = 3;
  else lightCount = 4;

  const stickValues = [false, false, false, false];
  const indices = [0, 1, 2, 3];
  for (let i = 0; i < lightCount; i++) {
    const idx = Math.floor(Math.random() * indices.length);
    stickValues[indices[idx]] = true;
    indices.splice(idx, 1);
  }

  const value = lightCount === 0 ? 6 : lightCount;
  const keepPlaying = [1, 4, 6].includes(value);

  return { stickValues, value, keepPlaying };
}

// Inicializar tabuleiro
function initializeBoard(size) {
  const pieces = new Array(4 * size).fill(null);
  
  // Peças azuis (parte inferior)
  for (let i = 0; i < size; i++) {
    pieces[i] = { color: 'Blue', inMotion: false, reachedLastRow: false };
  }
  
  // Peças vermelhas (parte superior)
  for (let i = 0; i < size; i++) {
    pieces[3 * size + (size - 1 - i)] = { color: 'Red', inMotion: false, reachedLastRow: false };
  }
  
  return pieces;
}

// Calcular posição de destino
function calculateTarget(row, col, steps, isBlue, size) {
  let newRow = row;
  let newCol = col;

  for (let i = 0; i < steps; i++) {
    if (isBlue) {
      if (newRow === 0 || newRow === 2) {
        newCol++;
        if (newCol >= size) { newRow++; newCol = size - 1; }
      } else {
        newCol--;
        if (newCol < 0) {
          if (newRow === 1) { newRow++; newCol = 0; }
          else if (newRow === 3) return null;
        }
      }
    } else {
      if (newRow === 3 || newRow === 1) {
        newCol--;
        if (newCol < 0) { newRow--; newCol = 0; }
      } else {
        newCol++;
        if (newCol >= size) {
          if (newRow === 2) { newRow--; newCol = size - 1; }
          else if (newRow === 0) return null;
        }
      }
    }
    if (newRow < 0 || newRow >= 4) return null;
  }

  return newRow * size + newCol;
}

// Verificar se pode mover
function canMove(game, nick) {
  const color = game.players[nick];
  const size = game.size;
  
  for (let i = 0; i < game.pieces.length; i++) {
    const piece = game.pieces[i];
    if (!piece || piece.color !== color) continue;
    
    // Peças não movidas só podem mover com Tâb (1)
    if (!piece.inMotion && game.dice.value !== 1) continue;
    
    // Calcular posição de destino
    const row = Math.floor(i / size);
    const col = i % size;
    const target = calculateTarget(row, col, game.dice.value, color === 'Blue', size);
    
    if (target !== null) {
      const targetPiece = game.pieces[target];
      if (!targetPiece || targetPiece.color !== color) {
        return true;
      }
    }
  }
  
  return false;
}

// Enviar atualização SSE
function sendSSEUpdate(gameId, data) {
  const game = games.get(gameId);
  if (!game) return;

  for (const nick of Object.keys(game.players)) {
    const key = `${nick}-${gameId}`;
    const client = sseClients.get(key);
    if (client) {
      client.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  }
}

// Atualizar classificações
function updateRanking(group, size, winnerNick, loserNick) {
  const key = `${group}-${size}`;
  let rankingList = rankings.get(key) || [];
  
  // Atualizar vencedor
  let winner = rankingList.find(r => r.nick === winnerNick);
  if (winner) {
    winner.games++;
    winner.victories++;
  } else {
    rankingList.push({ nick: winnerNick, games: 1, victories: 1 });
  }
  
  // Atualizar perdedor
  let loser = rankingList.find(r => r.nick === loserNick);
  if (loser) {
    loser.games++;
  } else {
    rankingList.push({ nick: loserNick, games: 1, victories: 0 });
  }
  
  // Ordenar por vitórias
  rankingList.sort((a, b) => b.victories - a.victories || a.games - b.games);
  
  rankings.set(key, rankingList);
  saveRankings();
}

// ============================================
// Rotas da API
// ============================================

// Registo/Login
app.post('/register', (req, res) => {
  const { nick, password } = req.body;
  
  if (!nick || !password) {
    return res.json({ error: 'Missing nick or password' });
  }

  const existingHash = users.get(nick);
  if (existingHash) {
    // Utilizador já existe, verificar password
    if (!verifyPassword(password, existingHash)) {
      return res.json({ error: 'User registered with a different password' });
    }
  } else {
    // Novo utilizador, guardar password Hash
    users.set(nick, hashPassword(password));
    saveUsers();
  }

  res.json({});
});

// Validar credenciais do utilizador
function validateCredentials(nick, password) {
  const hashedPassword = users.get(nick);
  if (!hashedPassword) return false;
  return verifyPassword(password, hashedPassword);
}

// Entrar no jogo
app.post('/join', (req, res) => {
  const { group, nick, password, size } = req.body;

  // Validar utilizador
  if (!validateCredentials(nick, password)) {
    return res.json({ error: 'Invalid credentials' });
  }

  // Validar tamanho do tabuleiro
  if (![7, 9, 11, 13, 15].includes(size)) {
    return res.json({ error: `invalid size '${size}'` });
  }

  const waitKey = `${group}-${size}`;
  const waiting = waitingPlayers.get(waitKey);

  if (waiting && waiting.nick !== nick) {
    // Emparelhamento bem-sucedido
    const gameId = waiting.gameId;
    const game = games.get(gameId);
    
    // Atribuir cores aleatoriamente
    const colors = Math.random() > 0.5 ? ['Blue', 'Red'] : ['Red', 'Blue'];
    game.players[waiting.nick] = colors[0];
    game.players[nick] = colors[1];
    game.turn = colors[0] === 'Blue' ? waiting.nick : nick;
    game.initial = game.turn;
    
    waitingPlayers.delete(waitKey);

    // Notificar ambos os jogadores
    setTimeout(() => {
      sendSSEUpdate(gameId, {
        pieces: game.pieces,
        players: game.players,
        turn: game.turn,
        initial: game.initial,
        step: 'from'
      });
    }, 100);

    res.json({ game: gameId });
  } else {
    // Criar novo jogo e aguardar
    const gameId = generateGameId();
    games.set(gameId, {
      id: gameId,
      group,
      size,
      pieces: initializeBoard(size),
      players: {},
      turn: null,
      initial: null,
      step: 'from',
      dice: null,
      selected: [],
      winner: null
    });
    
    waitingPlayers.set(waitKey, { nick, gameId });
    res.json({ game: gameId });
  }
});

// Sair do jogo
app.post('/leave', (req, res) => {
  const { nick, password, game: gameId } = req.body;

  if (!validateCredentials(nick, password)) {
    return res.json({ error: 'Invalid credentials' });
  }

  const game = games.get(gameId);
  if (game) {
    // Adversário vence
    const opponent = Object.keys(game.players).find(n => n !== nick);
    if (opponent) {
      game.winner = opponent;
      // Atualizar classificações
      updateRanking(game.group, game.size, opponent, nick);
      sendSSEUpdate(gameId, { winner: opponent });
    }
    games.delete(gameId);
  }

  res.json({});
});

// Lançar dado
app.post('/roll', (req, res) => {
  const { nick, password, game: gameId, size } = req.body;  // size incluído para compatibilidade

  if (!validateCredentials(nick, password)) {
    return res.json({ error: 'Invalid credentials' });
  }

  const game = games.get(gameId);
  if (!game) {
    return res.json({ error: 'Game not found' });
  }

  if (game.turn !== nick) {
    return res.json({ error: 'Not your turn to play' });
  }

  if (game.dice) {
    return res.json({ error: 'Already rolled' });
  }

  const dice = rollDice();
  game.dice = dice;

  // Verificar se há peças que podem mover
  const mustPass = !canMove(game, nick);
  game.mustPass = mustPass;

  sendSSEUpdate(gameId, {
    dice,
    turn: game.turn,
    mustPass
  });

  res.json({});
});

// Passar turno
app.post('/pass', (req, res) => {
  const { nick, password, game: gameId, size } = req.body;  // size incluído para compatibilidade

  if (!validateCredentials(nick, password)) {
    return res.json({ error: 'Invalid credentials' });
  }

  const game = games.get(gameId);
  if (!game || game.turn !== nick) {
    return res.json({ error: 'Not your turn' });
  }

  // Mudar turno
  const players = Object.keys(game.players);
  game.turn = players.find(n => n !== nick);
  game.dice = null;
  game.step = 'from';
  game.selected = [];
  game.mustPass = null;

  sendSSEUpdate(gameId, {
    turn: game.turn,
    step: 'from',
    dice: null,
    selected: []
  });

  res.json({});
});

// Notificar movimento
app.post('/notify', (req, res) => {
  const { nick, password, game: gameId, move } = req.body;

  if (!validateCredentials(nick, password)) {
    return res.json({ error: 'Invalid credentials' });
  }

  const game = games.get(gameId);
  if (!game || game.turn !== nick) {
    return res.json({ error: 'Not your turn' });
  }

  const color = game.players[nick];
  const size = game.size;

  if (game.step === 'from') {
    // Selecionar peça
    const piece = game.pieces[move];
    if (!piece || piece.color !== color) {
      return res.json({ error: 'Invalid piece selection' });
    }

    if (!piece.inMotion && game.dice.value !== 1) {
      return res.json({ error: 'Piece not in motion, need Tâb (1)' });
    }

    game.selected = [move];
    game.step = 'to';

    sendSSEUpdate(gameId, {
      selected: game.selected,
      step: 'to'
    });

  } else if (game.step === 'to') {
    // Verificar se clicou na peça já selecionada (cancelar seleção)
    if (game.selected.length > 0 && game.selected[0] === move) {
      game.selected = [];
      game.step = 'from';
      
      sendSSEUpdate(gameId, {
        selected: [],
        step: 'from'
      });
      return res.json({});
    }
    
    // Verificar se clicou noutra peça própria (mudar seleção)
    const clickedPiece = game.pieces[move];
    if (clickedPiece && clickedPiece.color === color) {
      // Verificar se a nova peça pode mover
      if (!clickedPiece.inMotion && game.dice.value !== 1) {
        return res.json({ error: 'Piece not in motion, need Tâb (1)' });
      }
      
      game.selected = [move];
      // Manter step como 'to'
      
      sendSSEUpdate(gameId, {
        selected: game.selected,
        step: 'to'
      });
      return res.json({});
    }
    
    // Selecionar posição de destino
    // Selecionar destino
    const fromIndex = game.selected[0];
    const piece = game.pieces[fromIndex];
    const row = Math.floor(fromIndex / size);
    const col = fromIndex % size;
    const targetIndex = calculateTarget(row, col, game.dice.value, color === 'Blue', size);

    if (move !== targetIndex) {
      return res.json({ error: 'Invalid target' });
    }

    // Executar movimento
    game.pieces[fromIndex] = null;
    
    piece.inMotion = true;
    const toRow = Math.floor(move / size);
    if ((color === 'Blue' && toRow === 3) || (color === 'Red' && toRow === 0)) {
      piece.reachedLastRow = true;
    }
    game.pieces[move] = piece;

    // Verificar vitória
    const blueCount = game.pieces.filter(p => p && p.color === 'Blue').length;
    const redCount = game.pieces.filter(p => p && p.color === 'Red').length;

    if (blueCount === 0 || redCount === 0) {
      const winnerColor = blueCount === 0 ? 'Red' : 'Blue';
      game.winner = Object.entries(game.players).find(([n, c]) => c === winnerColor)[0];
      const loser = Object.keys(game.players).find(n => n !== game.winner);
      
      // Atualizar classificações
      updateRanking(game.group, game.size, game.winner, loser);
      
      sendSSEUpdate(gameId, {
        pieces: game.pieces,
        winner: game.winner
      });
      return res.json({});
    }

    // Verificar se pode continuar
    if (game.dice.keepPlaying) {
      game.dice = null;
      game.step = 'from';
      game.selected = [];
    } else {
      // Mudar turno
      const players = Object.keys(game.players);
      game.turn = players.find(n => n !== nick);
      game.dice = null;
      game.step = 'from';
      game.selected = [];
    }

    sendSSEUpdate(gameId, {
      pieces: game.pieces,
      turn: game.turn,
      step: 'from',
      dice: null,
      selected: []
    });
  }

  res.json({});
});

// Atualização SSE
app.get('/update', (req, res) => {
  const { nick, game: gameId } = req.query;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const key = `${nick}-${gameId}`;
  sseClients.set(key, res);

  // Enviar estado inicial
  const game = games.get(gameId);
  if (game && game.turn) {
    res.write(`data: ${JSON.stringify({
      pieces: game.pieces,
      players: game.players,
      turn: game.turn,
      initial: game.initial,
      step: game.step
    })}\n\n`);
  }

  req.on('close', () => {
    sseClients.delete(key);
  });
});

// Classificações
app.post('/ranking', (req, res) => {
  const { group, size } = req.body;
  const key = `${group}-${size}`;
  const ranking = rankings.get(key) || [];
  res.json({ ranking });
});

// ============================================
// Iniciar Servidor
// ============================================

app.listen(PORT, () => {
  console.log(`🎲 Tâb Game Server running at http://localhost:${PORT}`);
  console.log(`📁 Serving static files from parent directory`);
  console.log(`💾 Data directory: ${DATA_DIR}`);
  console.log(`🔐 Password hashing: SHA-256`);
});
