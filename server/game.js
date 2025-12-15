// ============================================
// GAME.JS - Módulo de Lógica do Jogo
// ============================================
// Implementa as regras oficiais do jogo Tâb, incluindo:
// - Matchmaking (Emparelhamento)
// - Lógica de Dados (Probabilidades)
// - Movimentação e Captura de Peças
// - Gestão de Turnos e Condições de Vitória
// ============================================

const crypto = require('crypto');
const Storage = require('./storage');

/**
 * Classe principal que gere o estado de todos os jogos ativos.
 * Mantém os jogos em memória e persiste dados históricos via Storage.
 */
class GameModule {
  constructor() {
    this.storage = new Storage('games.json');
    this.games = {}; // Jogos ativos em memória (RAM) para acesso rápido
    this.queue = {}; // Fila de espera para matchmaking: { 'group-size': [{nick, gameId}] }
    this.TIMEOUT = 120000; // Timeout de inatividade (2 minutos)
  }

  /**
   * Gera um ID único e determinístico para um jogo (Hash MD5).
   * Garante que dois jogadores não colidem acidentalmente.
   */
  generateGameId(group, size, player1, player2, timestamp) {
    const value = `${group}-${size}-${player1}-${player2}-${timestamp}`;
    return crypto.createHash('md5').update(value).digest('hex');
  }

  /**
   * Simula o lançamento dos 4 paus binários (dados).
   * Segue as probabilidades reais do jogo Tâb.
   * * Valores possíveis:
   * - 0 brancos = 6 (Sitteh) - Joga de novo
   * - 1 branco = 1 (Tâb) - Joga de novo
   * - 2 brancos = 2 (Itneyn)
   * - 3 brancos = 3 (Teláteh)
   * - 4 brancos = 4 (Arba'ah) - Joga de novo
   * * @returns {object} - Objeto com valor, representação visual e flag de repetição.
   */
  rollDice() {
    const rand = Math.random();
    let value;
    
    // Probabilidades baseadas na distribuição binomial (1/16, 4/16, 6/16, 4/16, 1/16)
    if (rand < 0.06) value = 6;
    else if (rand < 0.31) value = 1;
    else if (rand < 0.69) value = 2;
    else if (rand < 0.94) value = 3;
    else value = 4;
    
    // Gerar representação visual (quais paus estão virados)
    const stickValues = [];
    for (let i = 0; i < 4; i++) {
      stickValues.push(false);
    }
    
    // Determinar quantos paus ficam "brancos" (ativos)
    const trueNeeded = value === 6 ? 0 : value === 1 ? 1 : value === 2 ? 2 : value === 3 ? 3 : 4;
    for (let i = 0; i < trueNeeded; i++) {
      stickValues[i] = true;
    }
    
    // Baralhar o array visual para parecer aleatório
    for (let i = stickValues.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [stickValues[i], stickValues[j]] = [stickValues[j], stickValues[i]];
    }
    
    return {
      stickValues,
      value,
      keepPlaying: [1, 4, 6].includes(value) // Regra de jogar novamente
    };
  }

  /**
   * Cria o estado inicial do tabuleiro.
   * Coloca as peças nas linhas base (0 e 3).
   * * @param {number} size - Tamanho do tabuleiro (largura).
   * @returns {Array} - Array linear representando o tabuleiro.
   */
  initializeBoard(size, player1, player2) {
    const pieces = [];
    const totalCells = size * 4;
    
    for (let i = 0; i < totalCells; i++) {
      pieces.push(null);
    }
    
    // Peças do Jogador 1 (Blue) - Linha 0 (Base inferior)
    for (let i = 0; i < size; i++) {
      pieces[i] = {
        color: 'Blue',
        inMotion: false,      // Ainda não saiu da base
        reachedLastRow: false // Objetivo secundário
      };
    }
    
    // Peças do Jogador 2 (Red) - Linha 3 (Base superior)
    // Preenche da direita para a esquerda visualmente
    for (let i = 0; i < size; i++) {
      const index = 3 * size + (size - 1 - i);
      pieces[index] = {
        color: 'Red',
        inMotion: false,
        reachedLastRow: false
      };
    }
    
    return pieces;
  }

  /**
   * Gere a entrada de jogadores na fila de espera (Matchmaking).
   * - Se houver alguém na fila, cria o jogo imediatamente.
   * - Se não, coloca o jogador na fila à espera.
   * * @param {number} group - ID do grupo.
   * @param {string} nick - Nome do jogador.
   * @param {number} size - Tamanho do tabuleiro desejado.
   */
  join(group, nick, size) {
    const queueKey = `${group}-${size}`;
    
    if (!this.queue[queueKey]) {
      this.queue[queueKey] = [];
    }
    
    // Evitar duplicados na fila
    const existing = this.queue[queueKey].find(p => p.nick === nick);
    if (existing) {
      console.log(`[GAME] ${nick} already in queue, returning ${existing.gameId}`);
      return { game: existing.gameId, matched: false };
    }
    
    // Verificar se há oponente disponível
    if (this.queue[queueKey].length > 0) {
      // Remover oponente da fila (FIFO)
      const player1Data = this.queue[queueKey].shift();
      const player1 = player1Data.nick;
      const player2 = nick;
      const gameId = player1Data.gameId; // Usar ID gerado para o primeiro jogador
      
      // Decidir aleatoriamente quem começa
      const initial = Math.random() < 0.5 ? player1 : player2;
      
      // Criar instância do jogo
      this.games[gameId] = {
        id: gameId,
        group,
        size,
        player1,
        player2,
        initial,
        turn: initial,
        pieces: this.initializeBoard(size, player1, player2),
        dice: null,
        step: 'from',  // Estado da jogada: selecionar origem
        selected: [],
        winner: null,
        startedAt: Date.now(),
        lastMoveAt: Date.now()
      };
      
      console.log(`[GAME] ✅ Match created: ${gameId}`);
      console.log(`[GAME]    Player1: ${player1} (had gameId already)`);
      console.log(`[GAME]    Player2: ${player2} (joining with same gameId)`);
      
      return {
        game: gameId,
        matched: true
      };
    }
    
    // Ninguém na fila: Criar ticket de espera
    const gameId = this.generateGameId(group, size, nick, 'waiting', Date.now());
    
    this.queue[queueKey].push({
      nick,
      gameId,
      joinedAt: Date.now()
    });
    
    console.log(`[GAME] ${nick} waiting in queue with gameId: ${gameId}`);
    
    return {
      game: gameId,
      matched: false
    };
  }

  /**
   * Remove um jogador do jogo.
   * Se o jogo estiver em curso, o outro jogador vence automaticamente por desistência.
   */
  leave(nick, gameId) {
    const game = this.games[gameId];
    
    // Se o jogo não existe, apenas limpa das filas
    if (!game) {
      for (const queueKey in this.queue) {
        this.queue[queueKey] = this.queue[queueKey].filter(p => p.nick !== nick);
      }
      return { success: true };
    }
    
    if (game.player1 !== nick && game.player2 !== nick) {
      return { error: 'Not a player in this game' };
    }
    
    if (game.winner) {
      delete this.games[gameId];
      return { success: true };
    }
    
    // Determinar vencedor por W.O.
    const winner = game.player1 === nick ? game.player2 : game.player1;
    game.winner = winner;
    
    console.log(`[GAME] ${nick} left game ${gameId}, winner: ${winner}`);
    
    return { success: true, winner };
  }

  /**
   * Processa o lançamento de dados num jogo ativo.
   * Verifica permissões de turno e regras de repetição.
   */
  roll(nick, gameId) {
    const game = this.games[gameId];
    
    if (!game) return { error: 'Invalid game reference' };
    if (game.turn !== nick) return { error: 'Not your turn to play' };
    
    // Validação: Se já lançou o dado
    if (game.dice !== null) {
      const validMoves = this.getValidMoves(game, nick);
      
      // Se tem movimentos possíveis, é obrigado a jogar (não pode relançar)
      if (validMoves.length > 0) {
        return { error: 'You already rolled the dice and have valid moves' };
      }
      
      // Se NÃO tem movimentos:
      // - Se o dado permite jogar de novo (1, 4, 6), pode relançar
      // - Se não (2, 3), é obrigado a passar a vez
      if (!game.dice.keepPlaying) {
        return { error: 'You already rolled the dice and cannot roll it again' };
      }
      
      console.log(`[GAME] ${nick} re-rolling (no moves, keepPlaying=true)`);
    }
    
    // Lançamento efetivo
    const dice = this.rollDice();
    game.dice = dice;
    game.lastMoveAt = Date.now();
    
    console.log(`[GAME] ${nick} rolled ${dice.value} (keepPlaying=${dice.keepPlaying})`);
    
    // Recalcular movimentos após novo lançamento
    const validMoves = this.getValidMoves(game, nick);
    
    // Flag 'mustPass': Indica ao frontend se o jogador deve passar a vez forçosamente.
    // Ocorre APENAS quando não há movimentos E o dado é 2 ou 3.
    const mustPass = (validMoves.length === 0 && !dice.keepPlaying) ? nick : null;
    
    console.log(`[GAME] Valid moves: ${validMoves.length}, mustPass: ${mustPass}`);
    
    return {
      success: true,
      update: {
        dice,
        turn: game.turn,
        mustPass,
        pieces: game.pieces
      }
    };
  }

  /**
   * Calcula todos os índices de peças que o jogador pode mover legalmente
   * com o valor do dado atual.
   */
  getValidMoves(game, nick) {
    if (!game.dice) return [];
    
    const diceValue = game.dice.value;
    const playerColor = game.player1 === nick ? 'Blue' : 'Red';
    const validMoves = [];
    
    for (let i = 0; i < game.pieces.length; i++) {
      const piece = game.pieces[i];
      
      if (piece && piece.color === playerColor) {
        // Regra Especial: Peças na base (inMotion=false) só saem com Tâb (1)
        const row = Math.floor(i / game.size);
        const isInBase = playerColor === 'Blue' ? row === 0 : row === 3;
        
        if (!piece.inMotion && isInBase && diceValue !== 1) {
          continue; 
        }
        
        // Simular movimento para verificar validade
        if (this.isValidMove(game, i, diceValue, playerColor)) {
          validMoves.push(i);
        }
      }
    }
    
    return validMoves;
  }

  /**
   * Verifica se um movimento específico é válido.
   * Inclui verificação de barreiras, destino ocupado e caminho.
   */
  isValidMove(game, cellIndex, steps, playerColor) {
    const piece = game.pieces[cellIndex];
    
    if (!piece || piece.color !== playerColor) return false;
    
    // Validação redundante da regra de saída da base
    if (!piece.inMotion) {
      const row = Math.floor(cellIndex / game.size);
      const isInBase = playerColor === 'Blue' ? row === 0 : row === 3;
      
      if (isInBase && steps !== 1) return false;
    }
    
    const newIndex = this.calculateNewPosition(game, cellIndex, steps, playerColor);
    
    // Destino fora do tabuleiro
    if (newIndex === null) return false;
    
    // Destino ocupado por peça própria (Auto-bloqueio)
    const targetPiece = game.pieces[newIndex];
    if (targetPiece && targetPiece.color === playerColor) return false;
    
    // Regra: Peça que já atingiu a última fila não pode "re-entrar" nela se sair
    if (piece.reachedLastRow) {
      const topRow = playerColor === 'Blue' ? 3 : 0;
      const newRow = Math.floor(newIndex / game.size);
      
      if (newRow === topRow) return false;
    }
    
    return true;
  }

  /**
   * Algoritmo de Movimento Boustrophedon ("Caminho da Serpente").
   * Calcula o índice de destino passo a passo.
   * * Caminho Azul: 0(Dir) -> 1(Esq) -> 2(Dir) -> 3(Esq)
   * Caminho Vermelho: 3(Esq) -> 2(Dir) -> 1(Esq) -> 0(Dir)
   */
  calculateNewPosition(game, cellIndex, steps, playerColor) {
    const size = game.size;
    let row = Math.floor(cellIndex / size);
    let col = cellIndex % size;
    let remaining = steps;
    
    // Helper: Verifica se existem peças aliadas na linha de base
    // (Impede entrada na última linha se ainda houver peças por sair)
    const hasBasePieces = (color) => {
      const baseRow = color === 'Blue' ? 0 : 3;
      return game.pieces.some((p, idx) => {
        if (!p || p.color !== color) return false;
        return Math.floor(idx / size) === baseRow;
      });
    };
    
    while (remaining > 0) {
      if (playerColor === 'Blue') {
        // === LÓGICA DE MOVIMENTO AZUL ===
        if (row === 0 || row === 2) {
          // Linhas Pares (0, 2): Movem para a Direita
          col++;
          if (col >= size) { // Atingiu a borda direita
            if (row === 0) {
              // Sobe para linha 1, entra pela direita
              row = 1;
              col = size - 1;
            } else if (row === 2) {
              // Tenta subir para linha 3
              if (!hasBasePieces('Blue')) {
                // Caminho livre para o céu (Linha 3)
                row = 3;
                col = size - 1;
              } else {
                // Base ocupada: Loop de volta para linha 1
                row = 1;
                col = size - 1;
              }
            }
          }
        } else {
          // Linhas Ímpares (1, 3): Movem para a Esquerda
          col--;
          if (col < 0) { // Atingiu a borda esquerda
            if (row === 1) {
              // Sobe para linha 2, entra pela esquerda
              row = 2;
              col = 0;
            } else if (row === 3) {
              // Fim do tabuleiro: Loop de volta para linha 2
              row = 2;
              col = 0;
            }
          }
        }
      } else {
        // === LÓGICA DE MOVIMENTO VERMELHO (Espelhado) ===
        // Vermelho vê o tabuleiro "de cima para baixo".
        // A sua "direita" é a nossa esquerda visual na linha 3.
        
        if (row === 3 || row === 1) {
          // Linhas 3 e 1: Movem para Esquerda (sua "direita")
          col--;
          if (col < 0) {
            if (row === 3) {
              row = 2; // Desce para linha 2
              col = 0;
            } else if (row === 1) {
              if (!hasBasePieces('Red')) {
                row = 0; // Desce para linha 0 (sua meta)
                col = 0;
              } else {
                row = 2; // Loop de volta para linha 2
                col = 0;
              }
            }
          }
        } else {
          // Linhas 2 e 0: Movem para Direita (sua "esquerda")
          col++;
          if (col >= size) {
            if (row === 2) {
              row = 1; // Desce para linha 1
              col = size - 1;
            } else if (row === 0) {
              row = 1; // Loop de volta para linha 1
              col = size - 1;
            }
          }
        }
      }
      
      // Safety check: Se sair dos limites do array
      if (row < 0 || row >= 4 || col < 0 || col >= size) {
        return null;
      }
      
      remaining--;
    }
    
    return row * size + col;
  }

  /**
   * Processa a notificação de movimento do cliente.
   * Valida, executa o movimento, captura peças e verifica vitória.
   */
  notify(nick, gameId, cell) {
    const game = this.games[gameId];
    
    if (!game) return { error: 'Invalid game reference' };
    if (game.turn !== nick) return { error: 'Not your turn to play' };
    if (!game.dice) return { error: 'You must roll the dice first' };
    
    const playerColor = game.player1 === nick ? 'Blue' : 'Red';
    const piece = game.pieces[cell];
    
    if (!piece || piece.color !== playerColor) return { error: 'Invalid move: not your piece' };
    if (!this.isValidMove(game, cell, game.dice.value, playerColor)) return { error: 'Invalid move: must play the dice\'s value' };
    
    // Calcular destino final
    const newIndex = this.calculateNewPosition(game, cell, game.dice.value, playerColor);
    
    // Lógica de Captura
    const targetPiece = game.pieces[newIndex];
    if (targetPiece && targetPiece.color !== playerColor) {
      console.log(`[GAME] ${nick} captured opponent piece at ${newIndex}`);
      // Peça inimiga é simplesmente substituída (removida do jogo)
    }
    
    // Atualizar estado da peça
    game.pieces[newIndex] = {
      color: playerColor,
      inMotion: true, // Já não está na base
      // Marca se atingiu a última fila (para regras de loop)
      reachedLastRow: piece.reachedLastRow || Math.floor(newIndex / game.size) === (playerColor === 'Blue' ? 3 : 0)
    };
    game.pieces[cell] = null; // Limpar origem
    
    // Registar metadados para animação no frontend
    game.selected = [cell, newIndex];
    game.lastMoveAt = Date.now();
    
    // Verificar Vitória
    const winner = this.checkWinner(game);
    
    if (winner) {
      game.winner = winner;
      console.log(`[GAME] Game ${gameId} won by ${winner}`);
      
      return {
        success: true,
        winner,
        update: {
          pieces: game.pieces,
          selected: game.selected,
          turn: game.turn,
          dice: null,
          winner
        }
      };
    }
    
    // Gestão de Turno Pós-Movimento
    // Se o dado foi 1, 4 ou 6, o jogador mantém a vez
    if (game.dice.keepPlaying) {
      game.dice = null; // Limpa dado para permitir novo lançamento
      
      return {
        success: true,
        update: {
          pieces: game.pieces,
          selected: game.selected,
          turn: game.turn,
          dice: null
        }
      };
    }
    
    // Se foi 2 ou 3, passa a vez
    game.turn = game.player1 === nick ? game.player2 : game.player1;
    game.dice = null;
    game.step = 'from';
    game.selected = [];
    
    return {
      success: true,
      update: {
        pieces: game.pieces,
        selected: game.selected,
        turn: game.turn,
        dice: null
      }
    };
  }

  /**
   * Permite ao jogador passar a vez.
   * Só é permitido se:
   * 1. Rolou 2 ou 3
   * 2. NÃO tem movimentos válidos
   */
  pass(nick, gameId) {
    const game = this.games[gameId];
    
    if (!game) return { error: 'Invalid game reference' };
    if (game.turn !== nick) return { error: 'Not your turn to play' };
    if (!game.dice) return { error: 'You must roll the dice first' };
    
    const validMoves = this.getValidMoves(game, nick);
    
    // Validação estrita: Não pode passar se puder jogar
    if (validMoves.length > 0) {
      return { error: 'You already rolled the dice and have valid moves' };
    }
    
    // Validação estrita: 1, 4, 6 OBRIGAM a relançar, não a passar
    if (game.dice.keepPlaying) {
      return { 
        error: 'You rolled 1, 4 or 6 with no valid moves - you must roll again, not pass' 
      };
    }
    
    // Passar a vez efetivamente
    const diceValue = game.dice.value;
    
    game.turn = game.player1 === nick ? game.player2 : game.player1;
    game.dice = null;
    game.step = 'from';
    game.selected = [];
    game.lastMoveAt = Date.now();
    
    console.log(`[GAME] ${nick} passed turn (rolled ${diceValue} with no moves)`);
    
    return {
      success: true,
      update: {
        turn: game.turn,
        dice: null,
        pieces: game.pieces
      }
    };
  }

  /**
   * Verifica se alguém ganhou (adversário sem peças).
   */
  checkWinner(game) {
    let bluePieces = 0;
    let redPieces = 0;
    
    for (const piece of game.pieces) {
      if (piece) {
        if (piece.color === 'Blue') bluePieces++;
        if (piece.color === 'Red') redPieces++;
      }
    }
    
    if (bluePieces === 0) return game.player2; // Vermelho ganha
    if (redPieces === 0) return game.player1;  // Azul ganha
    
    return null; // Jogo continua
  }

  /**
   * Retorna o objeto de estado completo para sincronização inicial.
   */
  getGameState(gameId) {
    const game = this.games[gameId];
    if (!game) return null;
    
    return {
      pieces: game.pieces,
      initial: game.initial,
      turn: game.turn,
      dice: game.dice,
      step: game.step,
      selected: game.selected,
      players: {
        [game.player1]: 'Blue',
        [game.player2]: 'Red'
      },
      winner: game.winner,
      mustPass: null
    };
  }

  getGame(gameId) {
    return this.games[gameId] || null;
  }

  /**
   * Tarefa de limpeza (Garbage Collection).
   * Remove jogos inativos há mais de 2 minutos para libertar memória.
   * Atribui vitória por abandono se o jogo ainda não terminou.
   */
  cleanupOldGames() {
    const now = Date.now();
    
    for (const gameId in this.games) {
      const game = this.games[gameId];
      
      if (now - game.lastMoveAt > this.TIMEOUT) {
        console.log(`[GAME] Game ${gameId} timed out`);
        
        if (!game.winner) {
          game.winner = game.turn === game.player1 ? game.player2 : game.player1;
        }
        
        delete this.games[gameId];
      }
    }
  }
}

module.exports = GameModule;