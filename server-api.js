// ============================================
// SERVIDOR API - COMUNICAÇÃO COM SERVIDOR WEB
// ============================================

class ServerAPI {
  constructor() {
    this.baseURL = 'http://localhost:8137';
    this.group = 37; // Alterar para o número do vosso grupo
    this.eventSource = null;
  }

  // Fazer pedido POST ao servidor
  async post(endpoint, data) {
    try {
      const response = await fetch(`${this.baseURL}/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });

      const result = await response.json();

      if (response.status !== 200) {
        throw new Error(result.error || 'Erro no pedido');
      }

      return result;
    } catch (error) {
      console.error(`Erro em ${endpoint}:`, error);
      throw error;
    }
  }

  // Registar utilizador
  async register(nick, password) {
    return await this.post('register', { nick, password });
  }

  // Juntar a um jogo
  async join(nick, password, size) {
    return await this.post('join', {
      group: this.group,
      nick,
      password,
      size
    });
  }

  // Desistir do jogo
  async leave(nick, password, game) {
    return await this.post('leave', { nick, password, game });
  }

  // Lançar dado
  async roll(nick, password, game) {
    return await this.post('roll', { nick, password, game });
  }

  // Passar a vez
  async pass(nick, password, game) {
    return await this.post('pass', { nick, password, game });
  }

  // Notificar jogada
  async notify(nick, password, game, cell) {
    return await this.post('notify', { nick, password, game, cell });
  }

  // Obter ranking
  async ranking(size) {
    return await this.post('ranking', {
      group: this.group,
      size
    });
  }

  // Iniciar escuta de eventos (Server-Sent Events)
  startUpdate(nick, game, onUpdate) {
    if (this.eventSource) {
      this.eventSource.close();
    }

    const url = `${this.baseURL}/update?nick=${encodeURIComponent(nick)}&game=${encodeURIComponent(game)}`;
    this.eventSource = new EventSource(url);

    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onUpdate(data);
      } catch (error) {
        console.error('Erro ao processar update:', error);
      }
    };

    this.eventSource.onerror = (error) => {
      console.error('Erro no EventSource:', error);
      this.eventSource.close();
    };
  }

  // Parar escuta de eventos
  stopUpdate() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }
}

// ============================================
// GESTOR DE SESSÃO
// ============================================

class SessionManager {
  constructor() {
    this.nick = null;
    this.password = null;
    this.gameId = null;
    this.isAuthenticated = false;
    this.loadSession();
  }

  // Carregar sessão do localStorage
  loadSession() {
    const saved = localStorage.getItem('tabSession');
    if (saved) {
      const data = JSON.parse(saved);
      this.nick = data.nick;
      this.password = data.password;
      this.isAuthenticated = true;
    }
  }

  // Guardar sessão
  saveSession(nick, password) {
    this.nick = nick;
    this.password = password;
    this.isAuthenticated = true;
    localStorage.setItem('tabSession', JSON.stringify({ nick, password }));
  }

  // Terminar sessão
  logout() {
    this.nick = null;
    this.password = null;
    this.gameId = null;
    this.isAuthenticated = false;
    localStorage.removeItem('tabSession');
  }

  // Definir jogo atual
  setGame(gameId) {
    this.gameId = gameId;
  }

  // Obter credenciais
  getCredentials() {
    return {
      nick: this.nick,
      password: this.password
    };
  }
}

// ============================================
// CONVERSOR DE DADOS DO SERVIDOR
// ============================================

class DataConverter {
  // Converter peças do servidor para formato local
  static serverToLocalPieces(serverPieces, initialPlayer, boardSize) {
    const board = Array(4).fill(null).map(() => Array(boardSize).fill(null));
    const player1Pieces = [];
    const player2Pieces = [];

    serverPieces.forEach((piece, index) => {
      if (!piece) return;

      const row = Math.floor(index / boardSize);
      const col = index % boardSize;
      
      const isPlayer1 = piece.color === 'Blue';
      const player = isPlayer1 ? 'player1' : 'player2';
      
      // Criar classe Piece - precisa estar definida globalmente ou importada
      const localPiece = {
        id: `${player}-${isPlayer1 ? player1Pieces.length : player2Pieces.length}`,
        player: player,
        row: row,
        col: col,
        moved: piece.inMotion,
        reachedTop: piece.reachedLastRow
      };
      
      board[row][col] = localPiece;
      
      if (isPlayer1) {
        player1Pieces.push(localPiece);
      } else {
        player2Pieces.push(localPiece);
      }
    });

    return { board, player1Pieces, player2Pieces };
  }

  // Converter jogada local para célula do servidor
  static localToServerCell(row, col, boardSize) {
    return row * boardSize + col;
  }

  // Converter célula do servidor para posição local
  static serverToLocalCell(cell, boardSize) {
    return {
      row: Math.floor(cell / boardSize),
      col: cell % boardSize
    };
  }

  // Converter dado do servidor para formato local
  static convertDice(serverDice) {
    if (!serverDice) return null;
    
    return {
      value: serverDice.value,
      keepPlaying: serverDice.keepPlaying,
      stickValues: serverDice.stickValues
    };
  }
}

// ============================================
// GESTOR DE JOGO ONLINE
// ============================================

class OnlineGameManager {
  constructor(game, ui, api, session) {
    this.game = game;
    this.ui = ui;
    this.api = api;
    this.session = session;
    this.isOnlineMode = false;
    this.localPlayerColor = null;
    this.opponentNick = null;
  }

  // Iniciar jogo online
  async startOnlineGame(size) {
    try {
      this.ui.showMessage('🔄 A procurar adversário...');
      
      const { nick, password } = this.session.getCredentials();
      const result = await this.api.join(nick, password, size);
      
      this.session.setGame(result.game);
      this.isOnlineMode = true;
      this.game.boardSize = size;
      
      // Iniciar escuta de eventos
      this.api.startUpdate(nick, result.game, (data) => {
        this.handleUpdate(data);
      });
      
      this.ui.showMessage('✅ Aguardando adversário...');
      
    } catch (error) {
      this.ui.showMessage(`❌ Erro: ${error.message}`);
      this.isOnlineMode = false;
    }
  }

  // Processar atualizações do servidor
  handleUpdate(data) {
    console.log('Update recebido:', data);

    // Jogo iniciado
    if (data.players && !this.game.gameStarted) {
      this.initializeOnlineGame(data);
      return;
    }

    // Garantir que o tabuleiro existe
    if (!this.game.board || this.game.board.length === 0) {
      this.game.initializeBoard();
    }

    // Atualizar tabuleiro
    if (data.pieces) {
      const converted = DataConverter.serverToLocalPieces(
        data.pieces,
        data.initial,
        this.game.boardSize
      );
      this.game.board = converted.board;
      this.game.player1Pieces = converted.player1Pieces;
      this.game.player2Pieces = converted.player2Pieces;
    }

    // Atualizar dado
    if (data.dice !== undefined) {
      const dice = DataConverter.convertDice(data.dice);
      if (dice) {
        this.game.diceValue = dice.value;
        this.game.diceRolled = true;
      } else {
        this.game.diceValue = null;
        this.game.diceRolled = false;
      }
    }

    // Atualizar turno
    if (data.turn) {
      const isMyTurn = data.turn === this.session.nick;
      this.game.currentPlayer = isMyTurn ? 'player1' : 'player2';
    }

    // Verificar fim de jogo
    if (data.winner !== undefined) {
      this.handleGameEnd(data.winner);
      return;
    }

    // Renderizar
    this.ui.renderOnlineBoard(this);
    
    // Mensagem do turno
    if (data.turn) {
      const isMyTurn = data.turn === this.session.nick;
      this.ui.showMessage(isMyTurn ? 'É a sua vez!' : `Vez de ${data.turn}`);
    }
  }

  // Inicializar jogo online
  initializeOnlineGame(data) {
    const { nick } = this.session.getCredentials();
    
    // Determinar cores dos jogadores
    this.localPlayerColor = data.players[nick];
    this.opponentNick = Object.keys(data.players).find(n => n !== nick);
    
    this.game.gameStarted = true;
    this.game.gameOver = false;
    this.game.initializeBoard();
    
    this.ui.showMessage(`🎮 Jogo iniciado! Você é ${this.localPlayerColor}`);
    this.ui.renderOnlineBoard(this);
  }

  // Lançar dado online
  async rollDice() {
    try {
      const { nick, password } = this.session.getCredentials();
      await this.api.roll(nick, password, this.session.gameId);
    } catch (error) {
      this.ui.showMessage(`❌ ${error.message}`);
    }
  }

  // Notificar jogada online
  async notifyMove(row, col) {
    try {
      const { nick, password } = this.session.getCredentials();
      const cell = DataConverter.localToServerCell(row, col, this.game.boardSize);
      await this.api.notify(nick, password, this.session.gameId, cell);
    } catch (error) {
      this.ui.showMessage(`❌ ${error.message}`);
    }
  }

  // Passar vez online
  async passTurn() {
    try {
      const { nick, password } = this.session.getCredentials();
      await this.api.pass(nick, password, this.session.gameId);
    } catch (error) {
      this.ui.showMessage(`❌ ${error.message}`);
    }
  }

  // Desistir online
  async forfeit() {
    try {
      const { nick, password } = this.session.getCredentials();
      await this.api.leave(nick, password, this.session.gameId);
      this.cleanup();
    } catch (error) {
      this.ui.showMessage(`❌ ${error.message}`);
    }
  }

  // Processar fim de jogo
  handleGameEnd(winner) {
    this.game.gameOver = true;
    const { nick } = this.session.getCredentials();
    
    if (winner === null) {
      this.ui.showMessage('🏁 Jogo terminado sem vencedor');
    } else if (winner === nick) {
      this.ui.showMessage('🎉 Você venceu!');
    } else {
      this.ui.showMessage(`😔 ${winner} venceu`);
    }
    
    this.cleanup();
  }

  // Limpar recursos
  cleanup() {
    this.api.stopUpdate();
    this.isOnlineMode = false;
    this.localPlayerColor = null;
    this.opponentNick = null;
  }
}

// Exportar classes
export { ServerAPI, SessionManager, DataConverter, OnlineGameManager };
