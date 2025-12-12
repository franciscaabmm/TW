// ============================================
// GAME-MANAGER.JS - GESTÃO DE JOGOS
// ============================================

const crypto = require('crypto');

class Game {
  constructor(id, group, size, firstPlayer) {
    this.id = id;
    this.group = group;
    this.size = size;
    this.players = [firstPlayer];
    this.turn = null;
    this.dice = null;
    this.board = this.initializeBoard();
    this.step = 'from';
    this.selectedCell = null;
    this.gameStarted = false;
    this.lastActivity = Date.now();
  }

  initializeBoard() {
    const board = new Array(4 * this.size).fill(null);
    
    // Jogador 1 (Blue) - posições 0 a size-1
    for (let i = 0; i < this.size; i++) {
      board[i] = {
        color: 'Blue',
        inMotion: false,
        reachedLastRow: false
      };
    }

    // Jogador 2 (Red) - posições 3*size a 4*size-1 (invertido)
    for (let i = 0; i < this.size; i++) {
      board[3 * this.size + i] = {
        color: 'Red',
        inMotion: false,
        reachedLastRow: false
      };
    }

    return board;
  }

  addPlayer(nick) {
    if (this.players.length >= 2) {
      throw new Error('Game is full');
    }
    
    this.players.push(nick);
    
    if (this.players.length === 2) {
      this.gameStarted = true;
      this.turn = this.players[0];
    }
  }

  getOpponent(nick) {
    return this.players.find(p => p !== nick);
  }

  isPlayerTurn(nick) {
    return this.turn === nick;
  }

  getPlayerColor(nick) {
    const index = this.players.indexOf(nick);
    return index === 0 ? 'Blue' : 'Red';
  }

  rollDice(nick) {
    if (!this.isPlayerTurn(nick)) {
      throw new Error('Not your turn to play');
    }

    if (this.dice !== null) {
      const validMoves = this.getValidMoves(nick);
      if (validMoves.length > 0) {
        throw new Error('You already rolled the dice and have valid moves');
      }
      if (this.dice.keepPlaying) {
        throw new Error('You already rolled the dice but can roll it again');
      }
    }

    // Lançar dado de paus
    const stickValues = [
      Math.random() < 0.5,
      Math.random() < 0.5,
      Math.random() < 0.5,
      Math.random() < 0.5
    ];

    const count = stickValues.filter(v => v).length;
    const value = count === 0 ? 6 : count === 4 ? 4 : count;
    const keepPlaying = [1, 4, 6].includes(value);

    this.dice = { stickValues, value, keepPlaying };
    this.lastActivity = Date.now();

    return this.dice;
  }

  getValidMoves(nick) {
    if (!this.dice) return [];

    const color = this.getPlayerColor(nick);
    const validCells = [];

    for (let i = 0; i < this.board.length; i++) {
      const piece = this.board[i];
      if (!piece || piece.color !== color) continue;

      if (this.isValidMove(i, this.dice.value, color)) {
        validCells.push(i);
      }
    }

    return validCells;
  }

  isValidMove(cell, steps, color) {
    const piece = this.board[cell];
    if (!piece || piece.color !== color) return false;

    // Primeira jogada tem de ser com 1
    if (!piece.inMotion && steps !== 1) return false;

    const destCell = this.calculateDestination(cell, steps, color);
    if (destCell === null) return false;

    const dest = this.board[destCell];
    if (dest && dest.color === color) return false;

    // Verificar restrições de linha
    const row = Math.floor(cell / this.size);
    const destRow = Math.floor(destCell / this.size);
    const topRow = color === 'Blue' ? 3 : 0;
    const baseRow = color === 'Blue' ? 0 : 3;

    // Não pode voltar à linha que já esteve no topo
    if (piece.reachedLastRow && destRow === topRow) return false;

    // Só pode mover no topo se não tiver peças na base
    if (row === topRow) {
      const hasBasePieces = this.board.some((p, i) => 
        p && p.color === color && Math.floor(i / this.size) === baseRow
      );
      if (hasBasePieces) return false;
    }

    return true;
  }

  calculateDestination(cell, steps, color) {
    let row = Math.floor(cell / this.size);
    let col = cell % this.size;
    let remaining = steps;

    const isBlue = color === 'Blue';

    while (remaining > 0) {
      if (isBlue) {
        // Jogador Blue
        if (row === 0 || row === 2) {
          col++;
          if (col >= this.size) {
            row++;
            col = this.size - 1;
            if (row > 3) return null;
          }
        } else {
          col--;
          if (col < 0) {
            if (row === 1) {
              row++;
              col = 0;
            } else if (row === 3) {
              row = 2;
              col = this.size - 1;
            }
          }
        }
      } else {
        // Jogador Red
        if (row === 3 || row === 1) {
          col--;
          if (col < 0) {
            row--;
            col = 0;
            if (row < 0) return null;
          }
        } else {
          col++;
          if (col >= this.size) {
            if (row === 2) {
              row--;
              col = this.size - 1;
            } else if (row === 0) {
              row = 1;
              col = 0;
            }
          }
        }
      }
      remaining--;
    }

    if (row < 0 || row >= 4) return null;
    return row * this.size + col;
  }

  makeMove(nick, cell) {
    if (!this.isPlayerTurn(nick)) {
      throw new Error('Not your turn to play');
    }

    if (!this.dice) {
      throw new Error('You must roll the dice first');
    }

    const color = this.getPlayerColor(nick);
    const piece = this.board[cell];

    // Verificar se é seleção de peça ou destino
    if (this.step === 'from') {
      // Selecionar peça
      if (!piece || piece.color !== color) {
        throw new Error('Invalid piece selection');
      }

      if (!this.isValidMove(cell, this.dice.value, color)) {
        throw new Error('Invalid move: cannot move this piece');
      }

      const dest = this.calculateDestination(cell, this.dice.value, color);
      const cellRow = Math.floor(cell / this.size);

      // Se estiver na linha 2 (índice 2), pode escolher ir para linha 3 ou 1
      if (cellRow === 2) {
        // Calcular possíveis destinos
        const destinations = this.getPossibleDestinations(cell, this.dice.value, color);
        
        if (destinations.length > 1) {
          this.step = 'to';
          this.selectedCell = cell;
          
          return {
            cell,
            selected: destinations,
            step: 'to',
            turn: nick,
            dice: this.dice
          };
        }
      }

      // Movimento direto
      this.executeMove(cell, dest, color);
      
      const keepPlaying = this.dice.keepPlaying;
      this.dice = null;
      
      if (!keepPlaying) {
        this.turn = this.getOpponent(nick);
      }
      
      this.step = 'from';
      this.selectedCell = null;

      return {
        cell,
        selected: [cell, dest],
        step: 'from',
        turn: this.turn,
        dice: this.dice
      };

    } else {
      // Selecionar destino
      if (cell === this.selectedCell) {
        // Reverter seleção
        this.step = 'from';
        this.selectedCell = null;
        
        return {
          cell: this.selectedCell,
          selected: [],
          step: 'from',
          turn: nick,
          dice: this.dice
        };
      }

      const dest = cell;
      this.executeMove(this.selectedCell, dest, color);
      
      const keepPlaying = this.dice.keepPlaying;
      this.dice = null;
      
      if (!keepPlaying) {
        this.turn = this.getOpponent(nick);
      }
      
      this.step = 'from';
      const movedCell = this.selectedCell;
      this.selectedCell = null;

      return {
        cell: movedCell,
        selected: [movedCell, dest],
        step: 'from',
        turn: this.turn,
        dice: this.dice
      };
    }
  }

  getPossibleDestinations(cell, steps, color) {
    // Simplificado - retornar apenas destino calculado normal
    const dest = this.calculateDestination(cell, steps, color);
    return dest !== null ? [cell, dest] : [cell];
  }

  executeMove(from, to, color) {
    const piece = this.board[from];
    
    // Capturar se houver peça adversária
    if (this.board[to] && this.board[to].color !== color) {
      this.board[to] = null;
    }

    // Mover peça
    this.board[to] = {
      color: piece.color,
      inMotion: true,
      reachedLastRow: piece.reachedLastRow || Math.floor(to / this.size) === (color === 'Blue' ? 3 : 0)
    };

    this.board[from] = null;
    this.lastActivity = Date.now();
  }

  pass(nick) {
    if (!this.isPlayerTurn(nick)) {
      throw new Error('Not your turn to play');
    }

    const validMoves = this.getValidMoves(nick);
    if (validMoves.length > 0) {
      throw new Error('You have valid moves');
    }

    if (this.dice && this.dice.keepPlaying) {
      throw new Error('You can roll the dice again');
    }

    this.turn = this.getOpponent(nick);
    this.dice = null;
    this.step = 'from';
    this.lastActivity = Date.now();
  }

  leave(nick) {
    if (this.players.indexOf(nick) === -1) {
      throw new Error('Not in this game');
    }

    if (!this.gameStarted) {
      // Ainda não começou - sem penalização
      return null;
    }

    // Oponente ganha
    return this.getOpponent(nick);
  }

  checkWinner() {
    const blueCount = this.board.filter(p => p && p.color === 'Blue').length;
    const redCount = this.board.filter(p => p && p.color === 'Red').length;

    if (blueCount === 0) return this.players[1];
    if (redCount === 0) return this.players[0];
    
    return null;
  }

  getPieces() {
    return this.board;
  }

  isTimedOut() {
    const timeout = 2 * 60 * 1000; // 2 minutos
    return Date.now() - this.lastActivity > timeout;
  }
}

class GameManager {
  constructor() {
    this.games = new Map(); // gameId -> Game
    this.waitingGames = new Map(); // "group-size" -> gameId
    
    // Limpar jogos inativos periodicamente
    setInterval(() => this.cleanupTimedOutGames(), 30000);
  }

  generateGameId(group, size, timestamp) {
    const data = `${group}-${size}-${timestamp}-${Math.random()}`;
    return crypto
      .createHash('md5')
      .update(data)
      .digest('hex');
  }

  joinGame(group, nick, size) {
    const key = `${group}-${size}`;
    
    // Verificar se há jogo à espera
    if (this.waitingGames.has(key)) {
      const gameId = this.waitingGames.get(key);
      const game = this.games.get(gameId);
      
      if (game && game.players.length === 1) {
        game.addPlayer(nick);
        this.waitingGames.delete(key);
        return game;
      }
    }

    // Criar novo jogo
    const gameId = this.generateGameId(group, size, Date.now());
    const game = new Game(gameId, group, size, nick);
    
    this.games.set(gameId, game);
    this.waitingGames.set(key, gameId);
    
    return game;
  }

  getGame(gameId) {
    return this.games.get(gameId);
  }

  cleanupTimedOutGames() {
    const toDelete = [];
    
    this.games.forEach((game, id) => {
      if (game.isTimedOut()) {
        console.log(`⏱️ Jogo ${id} expirou por inatividade`);
        toDelete.push(id);
      }
    });

    toDelete.forEach(id => {
      this.games.delete(id);
      
      // Remover da lista de espera se estiver lá
      this.waitingGames.forEach((gameId, key) => {
        if (gameId === id) {
          this.waitingGames.delete(key);
        }
      });
    });
  }
}

module.exports = { GameManager, Game };
