// ============================================
// INDEX.JS - Servidor HTTP Principal (Node.js)
// ============================================
// Ponto de entrada da aplicação Backend.
// Configura o servidor HTTP nativo, define rotas da API REST,
// inicializa módulos e gere conexões SSE.
// ============================================

const http = require('http');
const fs = require('fs');
const path = require('path');

// Importação dos Módulos de Lógica
const AuthModule = require('./server/auth');
const GameModule = require('./server/game');
const RankingModule = require('./server/ranking');
const SSEModule = require('./server/sse');

// Configuração da Porta do Servidor
const PORT = 8137;

// Inicialização das Instâncias de Lógica
const authModule = new AuthModule();
const gameModule = new GameModule();
const rankingModule = new RankingModule();
// SSE precisa de acesso ao GameModule para consultar o estado do jogo
const sseModule = new SSEModule(gameModule);

console.log('[SERVER] Starting Tâb Game Server...');

// ============================================
// Helpers e Funções Utilitárias
// ============================================

/**
 * Lê e processa o corpo (payload) de uma requisição HTTP.
 * Converte o stream de dados brutos para um objeto JSON.
 * * @param {http.IncomingMessage} req - Objeto de requisição.
 * @returns {Promise<object>} - Objeto JSON com os dados.
 */
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Envia uma resposta HTTP formatada como JSON com cabeçalhos CORS.
 * * @param {http.ServerResponse} res - Objeto de resposta.
 * @param {number} status - Código de estado HTTP (ex: 200, 400).
 * @param {object} data - Dados a enviar.
 */
function sendJSON(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*', // Permitir requisições de qualquer origem (CORS)
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

/**
 * Atalho para enviar uma resposta de erro JSON padrão.
 */
function sendError(res, status, message) {
  sendJSON(res, status, { error: message });
}

/**
 * Valida se um objeto contém todos os campos obrigatórios.
 * * @param {object} data - Dados a validar.
 * @param {Array<string>} fields - Lista de campos necessários.
 * @returns {string|null} - Mensagem de erro ou null se válido.
 */
function validateRequired(data, fields) {
  for (const field of fields) {
    if (data[field] === undefined || data[field] === null) {
      return `Missing required field: ${field}`;
    }
  }
  return null;
}

// ============================================
// Route Handlers (Controladores de Rotas)
// ============================================

/**
 * POST /register
 * Regista um novo utilizador ou autentica um existente se a password coincidir.
 */
async function handleRegister(req, res) {
  try {
    const data = await parseBody(req);
    
    const error = validateRequired(data, ['nick', 'password']);
    if (error) {
      return sendError(res, 400, error);
    }
    
    const { nick, password } = data;
    const result = authModule.register(nick, password);
    
    if (result.error) {
      return sendError(res, 401, result.error);
    }
    
    console.log(`[REGISTER] User ${nick} registered/authenticated`);
    sendJSON(res, 200, {});
    
  } catch (error) {
    console.error('[REGISTER] Error:', error);
    sendError(res, 500, 'Internal server error');
  }
}

/**
 * POST /join
 * Adiciona um jogador à fila de espera (Matchmaking).
 * Se encontrar par, inicia o jogo e notifica via SSE.
 */
async function handleJoin(req, res) {
  try {
    const data = await parseBody(req);
    
    const error = validateRequired(data, ['group', 'nick', 'password', 'size']);
    if (error) {
      return sendError(res, 400, error);
    }
    
    const { group, nick, password, size } = data;
    
    // Validar credenciais antes de processar
    if (!authModule.authenticate(nick, password)) {
      return sendError(res, 401, 'Invalid credentials');
    }
    
    // Validar parâmetros de jogo
    if (typeof group !== 'number' || group <= 0) {
      return sendError(res, 400, `Invalid group '${group}'`);
    }
    
    if (typeof size !== 'number' || size < 7 || size > 15 || size % 2 === 0) {
      return sendError(res, 400, `Invalid size '${size}'`);
    }
    
    // Tentar entrar na fila
    const result = gameModule.join(group, nick, size);
    
    if (result.error) {
      return sendError(res, 400, result.error);
    }
    
    console.log(`[JOIN] ${nick} joined queue for group ${group}, size ${size}`);
    
    // Se o matchmaking encontrou um oponente, iniciar o jogo
    if (result.matched) {
      console.log(`[JOIN] Match found! Notifying both players for game ${result.game}`);
      // Pequeno delay para garantir que o cliente estabeleceu conexão SSE
      setTimeout(() => {
        sseModule.notifyGameStart(result.game);
      }, 100);
    }
    
    // Retorna o ID do jogo (hash) para o cliente se conectar ao SSE
    sendJSON(res, 200, { game: result.game });
    
  } catch (error) {
    console.error('[JOIN] Error:', error);
    sendError(res, 500, 'Internal server error');
  }
}

/**
 * POST /leave
 * Jogador desiste ou sai do jogo. Conta como derrota.
 * Atualiza o ranking e notifica o outro jogador.
 */
async function handleLeave(req, res) {
  try {
    const data = await parseBody(req);
    
    const error = validateRequired(data, ['nick', 'password', 'game']);
    if (error) {
      return sendError(res, 400, error);
    }
    
    const { nick, password, game } = data;
    
    if (!authModule.authenticate(nick, password)) {
      return sendError(res, 401, 'Invalid credentials');
    }
    
    const result = gameModule.leave(nick, game);
    
    if (result.error) {
      return sendError(res, 400, result.error);
    }
    
    console.log(`[LEAVE] ${nick} left game ${game}`);
    
    // Se a saída resultou num vencedor (por W.O.), atualizar rankings
    if (result.winner) {
      const gameObj = gameModule.getGame(game);
      if (gameObj) {
        rankingModule.updateRanking(
          gameObj.group,
          gameObj.size,
          gameObj.player1,
          gameObj.player2,
          result.winner
        );
      }
      // Notificar fim de jogo aos clientes conectados
      sseModule.notifyGameEnd(game, result.winner);
    }
    
    sendJSON(res, 200, {});
    
  } catch (error) {
    console.error('[LEAVE] Error:', error);
    sendError(res, 500, 'Internal server error');
  }
}

/**
 * POST /ranking
 * Retorna a tabela de classificação para um grupo e tamanho específicos.
 */
async function handleRanking(req, res) {
  try {
    const data = await parseBody(req);
    
    const error = validateRequired(data, ['group', 'size']);
    if (error) {
      return sendError(res, 400, error);
    }
    
    const { group, size } = data;
    
    if (typeof group !== 'number' || group <= 0) {
      return sendError(res, 400, `Invalid group '${group}'`);
    }
    
    if (typeof size !== 'number' || size < 7 || size > 15 || size % 2 === 0) {
      return sendError(res, 400, `Invalid size '${size}'`);
    }
    
    const ranking = rankingModule.getRanking(group, size);
    
    console.log(`[RANKING] Retrieved ranking for group ${group}, size ${size}`);
    sendJSON(res, 200, { ranking });
    
  } catch (error) {
    console.error('[RANKING] Error:', error);
    sendError(res, 500, 'Internal server error');
  }
}

/**
 * POST /roll
 * Processa o lançamento dos dados (paus) pelo jogador.
 */
async function handleRoll(req, res) {
  try {
    const data = await parseBody(req);
    
    const error = validateRequired(data, ['nick', 'password', 'game']);
    if (error) {
      return sendError(res, 400, error);
    }
    
    const { nick, password, game } = data;
    
    if (!authModule.authenticate(nick, password)) {
      return sendError(res, 401, 'Invalid credentials');
    }
    
    const result = gameModule.roll(nick, game);
    
    if (result.error) {
      return sendError(res, 400, result.error);
    }
    
    console.log(`[ROLL] ${nick} rolled dice in game ${game}`);
    
    // Se houver atualização de estado, notificar via SSE
    if (result.update) {
      sseModule.notifyUpdate(game, result.update);
    }
    
    // Retornar resultado do dado na resposta HTTP também
    sendJSON(res, 200, result);
    
  } catch (error) {
    console.error('[ROLL] Error:', error);
    sendError(res, 500, 'Internal server error');
  }
}

/**
 * POST /notify
 * Processa o movimento de uma peça (escolha de origem ou destino).
 * Verifica vitórias e atualiza rankings se necessário.
 */
async function handleNotify(req, res) {
  try {
    const data = await parseBody(req);
    
    const error = validateRequired(data, ['nick', 'password', 'game', 'cell']);
    if (error) {
      return sendError(res, 400, error);
    }
    
    const { nick, password, game, cell } = data;
    
    if (!authModule.authenticate(nick, password)) {
      return sendError(res, 401, 'Invalid credentials');
    }
    
    const result = gameModule.notify(nick, game, cell);
    
    if (result.error) {
      return sendError(res, 400, result.error);
    }
    
    console.log(`[NOTIFY] ${nick} moved piece in game ${game}`);
    
    if (result.winner) {
      // Jogo terminou com vitória
      const gameObj = gameModule.getGame(game);
      if (gameObj) {
        rankingModule.updateRanking(
          gameObj.group,
          gameObj.size,
          gameObj.player1,
          gameObj.player2,
          result.winner
        );
      }
      sseModule.notifyGameEnd(game, result.winner);
    } else if (result.update) {
      // Jogo continua, notificar novo estado
      sseModule.notifyUpdate(game, result.update);
    }
    
    sendJSON(res, 200, result);
    
  } catch (error) {
    console.error('[NOTIFY] Error:', error);
    sendError(res, 500, 'Internal server error');
  }
}

/**
 * POST /pass
 * Jogador passa a vez voluntariamente ou forçadamente.
 */
async function handlePass(req, res) {
  try {
    const data = await parseBody(req);
    
    const error = validateRequired(data, ['nick', 'password', 'game']);
    if (error) {
      return sendError(res, 400, error);
    }
    
    const { nick, password, game } = data;
    
    if (!authModule.authenticate(nick, password)) {
      return sendError(res, 401, 'Invalid credentials');
    }
    
    const result = gameModule.pass(nick, game);
    
    if (result.error) {
      return sendError(res, 400, result.error);
    }
    
    console.log(`[PASS] ${nick} passed turn in game ${game}`);
    
    if (result.update) {
      sseModule.notifyUpdate(game, result.update);
    }
    
    sendJSON(res, 200, result);
    
  } catch (error) {
    console.error('[PASS] Error:', error);
    sendError(res, 500, 'Internal server error');
  }
}

/**
 * GET /update
 * Endpoint para estabelecer conexão Server-Sent Events (SSE).
 * Mantém a conexão aberta para enviar atualizações em tempo real.
 */
function handleUpdate(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const game = url.searchParams.get('game');
  const nick = url.searchParams.get('nick');
  
  if (!game || !nick) {
    return sendError(res, 400, 'Missing game or nick parameter');
  }
  
  // Cabeçalhos específicos para SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });
  
  sseModule.addClient(game, nick, res);
  
  console.log(`[SSE] Client connected: ${nick} to game ${game}`);
  
  // Limpar cliente quando a conexão fecha
  req.on('close', () => {
    sseModule.removeClient(game, nick);
    console.log(`[SSE] Client disconnected: ${nick} from game ${game}`);
  });
}

/**
 * Servir ficheiros estáticos (HTML, CSS, JS, Imagens).
 * Permite que o servidor backend também sirva o frontend.
 */
function serveStaticFile(req, res) {
  // Padrão: servir index.html se raiz
  const filePath = req.url === '/' ? '/index.html' : req.url;
  const extname = path.extname(filePath);
  
  const contentTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml'
  };
  
  const contentType = contentTypes[extname] || 'application/octet-stream';
  const fullPath = path.join(__dirname, '..', filePath);
  
  fs.readFile(fullPath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500);
        res.end('Server Error');
      }
    } else {
      res.writeHead(200, { 
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*'
      });
      res.end(content);
    }
  });
}

// ============================================
// Main Server Loop e Inicialização
// ============================================

const server = http.createServer((req, res) => {
  console.log(`[${req.method}] ${req.url}`);
  
  // Tratamento de CORS Preflight (OPTIONS)
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }
  
  // Encaminhamento de Rotas da API (POST)
  if (req.method === 'POST') {
    if (req.url === '/register') return handleRegister(req, res);
    if (req.url === '/join') return handleJoin(req, res);
    if (req.url === '/leave') return handleLeave(req, res);
    if (req.url === '/ranking') return handleRanking(req, res);
    if (req.url === '/roll') return handleRoll(req, res);
    if (req.url === '/notify') return handleNotify(req, res);
    if (req.url === '/pass') return handlePass(req, res);
  }
  
  // Rota SSE (GET)
  if (req.method === 'GET' && req.url.startsWith('/update')) {
    return handleUpdate(req, res);
  }
  
  // Rotas de Ficheiros Estáticos (Frontend)
  if (req.method === 'GET') {
    return serveStaticFile(req, res);
  }
  
  // Rota não encontrada
  sendError(res, 404, 'Not Found');
});

// Tarefas de Manutenção Periódica
// Limpa jogos antigos e conexões mortas a cada minuto
setInterval(() => {
  gameModule.cleanupOldGames();
  sseModule.cleanupInactive();
}, 60000); // 60 segundos

// Iniciar Servidor
server.listen(PORT, () => {
  console.log(`[SERVER] ✅ Server running on http://localhost:${PORT}`);
  console.log(`[SERVER] Ready to accept connections!`);
});