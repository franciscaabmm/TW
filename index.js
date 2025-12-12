// ============================================
// INDEX.JS - SERVIDOR NODE.JS PRINCIPAL
// ============================================

const http = require('http');
const url = require('url');
const crypto = require('crypto');

// Importar módulos
const { UserManager } = require('./user-manager');
const { GameManager } = require('./game-manager');
const { RankingManager } = require('./ranking-manager');
const { SSEManager } = require('./sse-manager');

const PORT = 8137; // Alterar para 81XX onde XX é o número do grupo

class TabServer {
  constructor() {
    this.userManager = new UserManager();
    this.gameManager = new GameManager();
    this.rankingManager = new RankingManager();
    this.sseManager = new SSEManager();
    
    // Carregar dados persistidos
    this.loadData();
  }

  loadData() {
    this.userManager.load();
    this.rankingManager.load();
  }

  saveData() {
    this.userManager.save();
    this.rankingManager.save();
  }

  handleRequest(req, res) {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    // GET - Update (Server-Sent Events)
    if (req.method === 'GET' && pathname === '/update') {
      this.handleUpdate(req, res, parsedUrl.query);
      return;
    }

    // POST endpoints
    if (req.method === 'POST') {
      let body = '';
      
      req.on('data', chunk => {
        body += chunk.toString();
      });

      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          this.handlePost(pathname, data, res);
        } catch (error) {
          this.sendError(res, 400, 'Invalid JSON');
        }
      });
      return;
    }

    this.sendError(res, 404, 'Endpoint not found');
  }

  handlePost(pathname, data, res) {
    try {
      switch (pathname) {
        case '/register':
          this.handleRegister(data, res);
          break;
        case '/join':
          this.handleJoin(data, res);
          break;
        case '/leave':
          this.handleLeave(data, res);
          break;
        case '/roll':
          this.handleRoll(data, res);
          break;
        case '/pass':
          this.handlePass(data, res);
          break;
        case '/notify':
          this.handleNotify(data, res);
          break;
        case '/ranking':
          this.handleRanking(data, res);
          break;
        default:
          this.sendError(res, 404, 'Unknown endpoint');
      }
    } catch (error) {
      console.error('Error handling request:', error);
      this.sendError(res, 500, 'Internal server error');
    }
  }

  // ============================================
  // REGISTER
  // ============================================
  handleRegister(data, res) {
    const { nick, password } = data;

    if (!nick || !password) {
      this.sendError(res, 400, 'Missing nick or password');
      return;
    }

    if (typeof nick !== 'string' || typeof password !== 'string') {
      this.sendError(res, 400, 'Nick and password must be strings');
      return;
    }

    try {
      this.userManager.register(nick, password);
      this.saveData();
      this.sendSuccess(res, {});
    } catch (error) {
      this.sendError(res, 400, error.message);
    }
  }

  // ============================================
  // JOIN
  // ============================================
 handleJoin(data, res) {
  const { group, nick, password, size } = data;

  if (!group || !nick || !password || !size) {
    this.sendError(res, 400, 'Missing required arguments');
    return;
  }

  if (typeof group !== 'number' || typeof nick !== 'string' || typeof password !== 'string') {
    this.sendError(res, 400, 'Invalid argument types');
    return;
  }

  if (typeof size !== 'number' || size < 7 || size > 15 || size % 2 === 0) {
    this.sendError(res, 400, `Invalid size '${size}'`);
    return;
  }

  if (!this.userManager.authenticate(nick, password)) {
    this.sendError(res, 401, 'Authentication failed');
    return;
  }

  try {
    const game = this.gameManager.joinGame(group, nick, size);
    
    // Enviar resposta primeiro
    this.sendSuccess(res, { game: game.id });
    
    // Se o jogo ficou completo, dar tempo para ambos conectarem ao SSE
    if (game.players.length === 2) {
      setTimeout(() => {
        const update = {
          pieces: game.getPieces(),
          initial: game.players[0],
          step: 'from',
          turn: game.players[0],
          players: {
            [game.players[0]]: 'Blue',
            [game.players[1]]: 'Red'
          }
        };

        console.log('🎮 Jogo completo! Enviando notificação inicial...');
        this.sseManager.broadcast(game.id, update);
      }, 1000); // Esperar 1 segundo para ambos conectarem
    }
  } catch (error) {
    this.sendError(res, 400, error.message);
  }
}

  // ============================================
  // LEAVE
  // ============================================
  handleLeave(data, res) {
    const { nick, password, game } = data;

    if (!nick || !password || !game) {
      this.sendError(res, 400, 'Missing required arguments');
      return;
    }

    if (!this.userManager.authenticate(nick, password)) {
      this.sendError(res, 401, 'Authentication failed');
      return;
    }

    try {
      const gameObj = this.gameManager.getGame(game);
      if (!gameObj) {
        this.sendError(res, 400, 'Invalid game reference');
        return;
      }

      const winner = gameObj.leave(nick);
      
      // Notificar jogadores
      this.sseManager.broadcast(game, { winner });

      // Atualizar ranking se houver vencedor
      if (winner) {
        this.rankingManager.addResult(gameObj.group, gameObj.size, winner, gameObj.getOpponent(winner));
        this.saveData();
      }

      this.sendSuccess(res, {});
    } catch (error) {
      this.sendError(res, 400, error.message);
    }
  }

  // ============================================
  // ROLL
  // ============================================
  handleRoll(data, res) {
    const { nick, password, game } = data;

    if (!nick || !password || !game) {
      this.sendError(res, 400, 'Missing required arguments');
      return;
    }

    if (!this.userManager.authenticate(nick, password)) {
      this.sendError(res, 401, 'Authentication failed');
      return;
    }

    try {
      const gameObj = this.gameManager.getGame(game);
      if (!gameObj) {
        this.sendError(res, 400, 'Invalid game reference');
        return;
      }

      const dice = gameObj.rollDice(nick);
      
      // Verificar se pode jogar
      const validMoves = gameObj.getValidMoves(nick);
      const mustPass = validMoves.length === 0 && !dice.keepPlaying;

      // Notificar ambos jogadores
      this.sseManager.broadcast(game, {
        dice,
        turn: nick,
        mustPass: mustPass ? nick : null
      });

      this.sendSuccess(res, {});
    } catch (error) {
      this.sendError(res, 400, error.message);
    }
  }

  // ============================================
  // PASS
  // ============================================
  handlePass(data, res) {
    const { nick, password, game } = data;

    if (!nick || !password || !game) {
      this.sendError(res, 400, 'Missing required arguments');
      return;
    }

    if (!this.userManager.authenticate(nick, password)) {
      this.sendError(res, 401, 'Authentication failed');
      return;
    }

    try {
      const gameObj = this.gameManager.getGame(game);
      if (!gameObj) {
        this.sendError(res, 400, 'Invalid game reference');
        return;
      }

      gameObj.pass(nick);
      
      const opponent = gameObj.getOpponent(nick);
      
      // Notificar mudança de turno
      this.sseManager.broadcast(game, {
        turn: opponent,
        dice: null,
        step: 'from'
      });

      this.sendSuccess(res, {});
    } catch (error) {
      this.sendError(res, 400, error.message);
    }
  }

  // ============================================
  // NOTIFY
  // ============================================
  handleNotify(data, res) {
    const { nick, password, game, cell } = data;

    if (!nick || !password || !game || cell === undefined) {
      this.sendError(res, 400, 'Missing required arguments');
      return;
    }

    if (typeof cell !== 'number') {
      this.sendError(res, 400, 'Cell is not an integer');
      return;
    }

    if (cell < 0) {
      this.sendError(res, 400, 'Cell is negative');
      return;
    }

    if (!this.userManager.authenticate(nick, password)) {
      this.sendError(res, 401, 'Authentication failed');
      return;
    }

    try {
      const gameObj = this.gameManager.getGame(game);
      if (!gameObj) {
        this.sendError(res, 400, 'Invalid game reference');
        return;
      }

      const result = gameObj.makeMove(nick, cell);
      
      // Verificar vencedor
      const winner = gameObj.checkWinner();
      if (winner) {
        this.rankingManager.addResult(
          gameObj.group,
          gameObj.size,
          winner,
          gameObj.getOpponent(winner)
        );
        this.saveData();
        
        this.sseManager.broadcast(game, {
          pieces: gameObj.getPieces(),
          winner,
          cell: result.cell
        });
      } else {
        // Notificar jogada
        const update = {
          pieces: gameObj.getPieces(),
          cell: result.cell,
          selected: result.selected,
          step: result.step,
          turn: result.turn,
          dice: result.dice
        };

        this.sseManager.broadcast(game, update);
      }

      this.sendSuccess(res, {});
    } catch (error) {
      this.sendError(res, 400, error.message);
    }
  }

  // ============================================
  // RANKING
  // ============================================
  handleRanking(data, res) {
    const { group, size } = data;

    if (!group) {
      this.sendError(res, 400, 'Undefined group');
      return;
    }

    if (!size) {
      this.sendError(res, 400, "Invalid size 'undefined'");
      return;
    }

    if (typeof size !== 'number' || size < 7 || size > 15 || size % 2 === 0) {
      this.sendError(res, 400, `Invalid size '${size}'`);
      return;
    }

    if (typeof group !== 'number') {
      this.sendError(res, 400, `Invalid group '${group}'`);
      return;
    }

    const ranking = this.rankingManager.getRanking(group, size);
    this.sendSuccess(res, { ranking });
  }

  // ============================================
  // UPDATE (SSE)
  // ============================================
  handleUpdate(req, res, query) {
    const { nick, game } = query;

    if (!game) {
      this.sendError(res, 400, 'Invalid game reference');
      return;
    }

    const gameObj = this.gameManager.getGame(game);
    if (!gameObj) {
      this.sendError(res, 400, 'Invalid game reference');
      return;
    }

    // Configurar SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });

    this.sseManager.addClient(game, nick, res);

    req.on('close', () => {
      this.sseManager.removeClient(game, nick);
    });
  }

  // ============================================
  // HELPERS
  // ============================================
  sendSuccess(res, data) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  }

  sendError(res, code, message) {
    res.writeHead(code, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: message }));
  }
}

// ============================================
// INICIAR SERVIDOR
// ============================================

const server = new TabServer();

const httpServer = http.createServer((req, res) => {
  server.handleRequest(req, res);
});

httpServer.listen(PORT, () => {
  console.log(`🎮 Servidor Tâb a correr na porta ${PORT}`);
  console.log(`🌐 http://localhost:${PORT}`);
});

// Guardar dados periodicamente
setInterval(() => {
  server.saveData();
}, 60000); // A cada minuto

// Guardar dados ao sair
process.on('SIGINT', () => {
  console.log('\n💾 A guardar dados...');
  server.saveData();
  process.exit(0);
});
