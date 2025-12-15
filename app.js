// ============================================================================
// APP.JS - Controlador Principal da Aplicação (Frontend)
// ============================================================================
// Este ficheiro orquestra toda a lógica do jogo, renderização no Canvas,
// comunicação com o servidor e manipulação do DOM.
// ============================================================================

import { ServerAPI, SessionManager } from './server-api.js';

// ============================================
// 1. Configurações e Constantes Visuais
// ============================================
const CONFIG = {
  // Endereço base da API (ajustar conforme ambiente)
  SERVER_URL: 'http://twserver.alunos.dcc.fc.up.pt:8137',
  GROUP_ID: 37,  // ID padrão para matchmaking
  
  // Configurações de Dimensão e Renderização
  CELL_SIZE: 60,         // Tamanho de cada casa em pixels
  PIECE_RADIUS: 22,      // Raio da peça
  ANIMATION_DURATION: 300, // Duração do movimento (ms)
  
  // Paleta de Cores
  COLORS: {
    board: '#2d1810',          // Fundo do tabuleiro (madeira escura)
    cell: '#d4a574',           // Casa clara
    cellAlt: '#c49464',        // Casa escura
    cellHighlight: 'rgba(255, 215, 0, 0.4)', // Seleção (Dourado)
    cellValid: 'rgba(76, 175, 80, 0.4)',     // Movimento válido (Verde)
    blue: '#4a9eff',           // Cor Jogador 1
    red: '#ff4a4a',            // Cor Jogador 2
    blueShadow: 'rgba(74, 158, 255, 0.5)',
    redShadow: 'rgba(255, 74, 74, 0.5)'
  }
};

// ============================================
// 2. Gestão de Estado (Game State)
// ============================================
/**
 * Armazena a "verdade" sobre o jogo atual.
 * Sincroniza dados entre o servidor e a visualização local.
 */
class GameState {
  constructor() {
    this.reset();
  }

  /**
   * Reinicia o estado para os valores padrão.
   */
  reset() {
    this.boardSize = 9;
    this.pieces = [];  // Array linear recebido do servidor
    this.gameId = null;
    this.myNick = null;
    this.myColor = null;       // 'Blue' ou 'Red'
    this.opponentNick = null;
    this.turn = null;          // Nick de quem joga agora
    this.step = 'from';        // Estado da jogada: selecionar peça ('from') ou destino ('to')
    this.dice = null;          // Valor e estado do dado
    this.selected = [];        // Índices das peças selecionadas
    this.winner = null;
    this.isOnline = false;     // Flag para modo Multiplayer vs Local
    this.isStarted = false;
    this.isOver = false;
    this.mustPass = null;      // Flag se o jogador é obrigado a passar
  }

  /**
   * Converte o array linear (servidor) numa matriz 2D para facilitar lógica visual.
   * Estrutura: 4 linhas x N colunas.
   */
  get board() {
    const board = Array(4).fill(null).map(() => Array(this.boardSize).fill(null));
    if (!this.pieces) return board;
    
    for (let i = 0; i < this.pieces.length; i++) {
      const piece = this.pieces[i];
      if (piece) {
        const row = Math.floor(i / this.boardSize);
        const col = i % this.boardSize;
        board[row][col] = piece;
      }
    }
    return board;
  }

  /**
   * Utilitário: Converte coordenadas Matriz (Linha, Coluna) -> Índice Linear.
   */
  toIndex(row, col) {
    return row * this.boardSize + col;
  }

  /**
   * Utilitário: Converte Índice Linear -> Coordenadas Matriz.
   */
  fromIndex(index) {
    return {
      row: Math.floor(index / this.boardSize),
      col: index % this.boardSize
    };
  }

  /**
   * Verifica se é a vez do utilizador local.
   */
  isMyTurn() {
    return this.turn === this.myNick;
  }

  /**
   * Conta quantas peças de uma cor ainda restam no tabuleiro.
   */
  getPieceCount(color) {
    if (!this.pieces) return 0;
    return this.pieces.filter(p => p && p.color === color).length;
  }
}

// ============================================
// 3. Renderização (Canvas API)
// ============================================
/**
 * Responsável por desenhar o jogo.
 * Separa a lógica de dados (GameState) da lógica visual.
 */
class GameRenderer {
  constructor(canvas, state) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.state = state;
    this.animatingPieces = new Map();  // Guarda peças em movimento para interpolação
    this.hoveredCell = null;           // Célula sob o rato
    this.validMoves = [];              // Lista de destinos válidos para destacar
  }

  /**
   * Determina se o tabuleiro deve ser invertido.
   * O jogador Vermelho vê o tabuleiro "de cima para baixo".
   */
  shouldFlip() {
    return this.state.myColor === 'Red';
  }

  /**
   * Converte Coordenadas Lógicas (0-3) para Coordenadas de Ecrã.
   * Aplica a inversão (flip) se necessário.
   */
  toDisplayCoords(row, col) {
    if (this.shouldFlip()) {
      return {
        displayRow: 3 - row,
        displayCol: this.state.boardSize - 1 - col
      };
    }
    return { displayRow: row, displayCol: col };
  }

  /**
   * Converte Coordenadas de Ecrã (clique do rato) para Lógicas.
   */
  fromDisplayCoords(displayRow, displayCol) {
    if (this.shouldFlip()) {
      return {
        row: 3 - displayRow,
        col: this.state.boardSize - 1 - displayCol
      };
    }
    return { row: displayRow, col: displayCol };
  }

  /**
   * Ajusta o tamanho do canvas dinamicamente com base no tamanho do tabuleiro.
   */
  resize() {
    const size = this.state.boardSize;
    const width = size * CONFIG.CELL_SIZE + 40; // +40 para margens
    const height = 4 * CONFIG.CELL_SIZE + 40;
    this.canvas.width = width;
    this.canvas.height = height;
  }

  /**
   * Loop principal de desenho (chamado a cada frame ou atualização).
   */
  render() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawBoard();
    this.drawPieces();
    this.drawHighlights();
  }

  drawBoard() {
    const ctx = this.ctx;
    const size = this.state.boardSize;
    const cellSize = CONFIG.CELL_SIZE;
    const offsetX = 20;
    const offsetY = 20;

    // Fundo do tabuleiro
    ctx.fillStyle = CONFIG.COLORS.board;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Desenhar grelha de células
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < size; col++) {
        const x = offsetX + col * cellSize;
        const y = offsetY + (3 - row) * cellSize;  // Inverte Y pois canvas 0,0 é topo-esquerda
        
        // Padrão xadrez subtil
        ctx.fillStyle = (row + col) % 2 === 0 ? CONFIG.COLORS.cell : CONFIG.COLORS.cellAlt;
        ctx.fillRect(x, y, cellSize, cellSize);
        
        // Borda da célula
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, cellSize, cellSize);
      }
    }

    // Etiquetas de linha (0-3) na margem esquerda
    ctx.fillStyle = '#888';
    ctx.font = '12px Arial';
    for (let displayRow = 0; displayRow < 4; displayRow++) {
      const { row } = this.fromDisplayCoords(displayRow, 0);
      const y = offsetY + (3 - displayRow) * cellSize + cellSize / 2 + 4;
      ctx.fillText(row.toString(), 5, y);
    }
  }

  drawPieces() {
    const board = this.state.board;
    const cellSize = CONFIG.CELL_SIZE;
    const offsetX = 20;
    const offsetY = 20;

    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < this.state.boardSize; col++) {
        const piece = board[row][col];
        if (!piece) continue;

        const { displayRow, displayCol } = this.toDisplayCoords(row, col);

        // Verificar se esta peça está a ser animada neste momento
        const animKey = `${row}-${col}`;
        const anim = this.animatingPieces.get(animKey);
        
        let x, y;
        if (anim) {
          // Usar coordenadas interpoladas da animação
          x = anim.currentX;
          y = anim.currentY;
        } else {
          // Usar coordenadas estáticas da grelha
          x = offsetX + displayCol * cellSize + cellSize / 2;
          y = offsetY + (3 - displayRow) * cellSize + cellSize / 2;
        }

        this.drawPiece(x, y, piece);
      }
    }
  }

  /**
   * Desenha uma única peça com efeitos de gradiente e sombra.
   */
  drawPiece(x, y, piece) {
    const ctx = this.ctx;
    const radius = CONFIG.PIECE_RADIUS;
    const isBlue = piece.color === 'Blue';
    const color = isBlue ? CONFIG.COLORS.blue : CONFIG.COLORS.red;
    const shadow = isBlue ? CONFIG.COLORS.blueShadow : CONFIG.COLORS.redShadow;

    // Sombra projetada
    ctx.beginPath();
    ctx.arc(x + 3, y + 3, radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fill();

    // Corpo da peça (Gradiente Radial para efeito 3D)
    const gradient = ctx.createRadialGradient(x - 5, y - 5, 0, x, y, radius);
    gradient.addColorStop(0, isBlue ? '#7ac4ff' : '#ff7a7a'); // Brilho
    gradient.addColorStop(1, color); // Cor base
    
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();

    // Borda da peça
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Indicador: Peça já se moveu? (Ponto branco central)
    if (piece.inMotion) {
      ctx.beginPath();
      ctx.arc(x, y, radius - 8, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fill();
    }

    // Indicador: Chegou ao fim? (Estrela ou texto)
    if (piece.reachedLastRow) {
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('★', x, y);
    }
  }

  drawHighlights() {
    const ctx = this.ctx;
    const cellSize = CONFIG.CELL_SIZE;
    const offsetX = 20;
    const offsetY = 20;

    // 1. Destacar peça selecionada (Origem)
    for (const index of this.state.selected) {
      const { row, col } = this.state.fromIndex(index);
      const { displayRow, displayCol } = this.toDisplayCoords(row, col);
      const x = offsetX + displayCol * cellSize;
      const y = offsetY + (3 - displayRow) * cellSize;
      
      ctx.fillStyle = CONFIG.COLORS.cellHighlight;
      ctx.fillRect(x, y, cellSize, cellSize);
      
      // Borda dourada
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 3;
      ctx.strokeRect(x + 2, y + 2, cellSize - 4, cellSize - 4);
    }

    // 2. Destacar destinos válidos (Verde)
    for (const index of this.validMoves) {
      const { row, col } = this.state.fromIndex(index);
      const { displayRow, displayCol } = this.toDisplayCoords(row, col);
      const x = offsetX + displayCol * cellSize;
      const y = offsetY + (3 - displayRow) * cellSize;
      
      ctx.fillStyle = CONFIG.COLORS.cellValid;
      ctx.fillRect(x, y, cellSize, cellSize);
    }

    // 3. Efeito Hover (Branco subtil ao passar o rato)
    if (this.hoveredCell !== null) {
      const { row, col } = this.state.fromIndex(this.hoveredCell);
      const { displayRow, displayCol } = this.toDisplayCoords(row, col);
      const x = offsetX + displayCol * cellSize;
      const y = offsetY + (3 - displayRow) * cellSize;
      
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, cellSize - 2, cellSize - 2);
    }
  }

  /**
   * Anima o movimento de uma peça de A para B usando requestAnimationFrame.
   */
  animateMove(fromIndex, toIndex, callback) {
    const from = this.state.fromIndex(fromIndex);
    const to = this.state.fromIndex(toIndex);
    const cellSize = CONFIG.CELL_SIZE;
    const offsetX = 20;
    const offsetY = 20;

    // Calcular Pixels de Início e Fim
    const fromDisplay = this.toDisplayCoords(from.row, from.col);
    const toDisplay = this.toDisplayCoords(to.row, to.col);

    const startX = offsetX + fromDisplay.displayCol * cellSize + cellSize / 2;
    const startY = offsetY + (3 - fromDisplay.displayRow) * cellSize + cellSize / 2;
    const endX = offsetX + toDisplay.displayCol * cellSize + cellSize / 2;
    const endY = offsetY + (3 - toDisplay.displayRow) * cellSize + cellSize / 2;

    const animKey = `${to.row}-${to.col}`;
    const startTime = performance.now();
    const duration = CONFIG.ANIMATION_DURATION;

    // Função de passo da animação
    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing (suavização) cúbico para movimento mais natural
      const easeProgress = 1 - Math.pow(1 - progress, 3);

      this.animatingPieces.set(animKey, {
        currentX: startX + (endX - startX) * easeProgress,
        currentY: startY + (endY - startY) * easeProgress
      });

      this.render();

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Fim da animação
        this.animatingPieces.delete(animKey);
        if (callback) callback();
      }
    };

    requestAnimationFrame(animate);
  }

  /**
   * Deteta qual célula foi clicada com base nas coordenadas X,Y do rato.
   */
  getCellFromPoint(x, y) {
    const offsetX = 20;
    const offsetY = 20;
    const cellSize = CONFIG.CELL_SIZE;

    // Cálculo inverso das coordenadas de ecrã para grelha
    const displayCol = Math.floor((x - offsetX) / cellSize);
    const displayRow = 3 - Math.floor((y - offsetY) / cellSize);

    if (displayRow >= 0 && displayRow < 4 && displayCol >= 0 && displayCol < this.state.boardSize) {
      const { row, col } = this.fromDisplayCoords(displayRow, displayCol);
      const index = this.state.toIndex(row, col);
      return index;
    }
    return null;
  }
}

// ============================================
// 4. Animação do Dado (Interface DOM)
// ============================================
class DiceAnimator {
  constructor() {
    this.sticks = document.querySelectorAll('.stick');
    this.valueEl = document.getElementById('dice-value');
    this.nameEl = document.getElementById('dice-name');
  }

  // Nomes tradicionais das jogadas no Tâb
  getDiceName(value) {
    const names = {
      1: 'Tâb',
      2: 'Itneyn',
      3: 'Teláteh',
      4: "Arba'ah",
      6: 'Sitteh'
    };
    return names[value] || '';
  }

  // Simula o lançamento visual dos paus
  animate(dice, callback) {
    const { stickValues, value } = dice;
    
    // Limpar estado anterior
    this.sticks.forEach(stick => {
      stick.classList.remove('light', 'rolling');
    });
    this.valueEl.textContent = '?';
    this.nameEl.textContent = '';

    // Iniciar animação CSS de rotação
    this.sticks.forEach((stick, i) => {
      setTimeout(() => {
        stick.classList.add('rolling');
      }, i * 100);
    });

    // Revelar resultado após delay
    setTimeout(() => {
      this.sticks.forEach((stick, i) => {
        stick.classList.remove('rolling');
        if (stickValues[i]) {
          stick.classList.add('light'); // Face clara (vale ponto)
        }
      });

      this.valueEl.textContent = value;
      this.nameEl.textContent = this.getDiceName(value);

      if (callback) callback();
    }, 800);
  }

  reset() {
    this.sticks.forEach(stick => {
      stick.classList.remove('light', 'rolling');
    });
    this.valueEl.textContent = '-';
    this.nameEl.textContent = '';
  }
}

// ============================================
// 5. Gestor de Mensagens (Log UI)
// ============================================
class MessageManager {
  constructor() {
    this.container = document.getElementById('message-list');
    this.maxMessages = 10;
  }

  add(text, type = 'info') {
    const msg = document.createElement('div');
    msg.className = `message ${type}`;
    msg.textContent = text;
    
    this.container.insertBefore(msg, this.container.firstChild);

    // Manter apenas as últimas X mensagens para não poluir a memória
    while (this.container.children.length > this.maxMessages) {
      this.container.removeChild(this.container.lastChild);
    }

    this.container.scrollTop = 0;
  }

  clear() {
    this.container.innerHTML = '';
  }
}

// ============================================
// 6. Controlador Principal (Game Controller)
// ============================================
/**
 * A classe "Cérebro" da aplicação.
 * Instancia todos os subsistemas e gere o fluxo do jogo.
 */
class GameController {
  constructor() {
    // Subsistemas
    this.state = new GameState();
    this.api = new ServerAPI(CONFIG.SERVER_URL);
    this.session = new SessionManager();
    this.messages = new MessageManager();
    this.dice = new DiceAnimator();
    this.session = new SessionManager();
    this.eventSource = null; // Para Server-Sent Events

    // Inicializar Canvas
    this.canvas = document.getElementById('game-canvas');
    this.renderer = new GameRenderer(this.canvas, this.state);

    this.bindEvents();
    this.updateUI();
  }

  /**
   * Vincula ouvintes de eventos do DOM e do Canvas.
   */
  bindEvents() {
    // Formulário de login
    document.getElementById('login-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleLogin();
    });

    document.getElementById('logout-btn').addEventListener('click', () => {
      this.handleLogout();
    });

    // Botões principais
    document.getElementById('start-game').addEventListener('click', () => {
      this.startGame();
    });

    document.getElementById('forfeit-game').addEventListener('click', () => {
      this.forfeitGame();
    });

    document.getElementById('roll-dice').addEventListener('click', () => {
      this.rollDice();
    });

    document.getElementById('pass-turn').addEventListener('click', () => {
      this.passTurn();
    });

    // UX: Clicar na área visual do dado também o lança
    document.getElementById('sticks-display').addEventListener('click', () => {
      this.rollDice();
    });

    // Gestão do painel de classificações
    document.getElementById('show-rankings').addEventListener('click', () => {
      this.showRankings();
    });

    document.getElementById('close-rankings').addEventListener('click', () => {
      document.getElementById('rankings-panel').classList.add('hidden');
      document.querySelector('.instructions-panel').classList.remove('hidden');
    });

    // UI Dinâmica: Mostrar opções de IA apenas se o modo for PvE
    document.getElementById('game-mode').addEventListener('change', (e) => {
      const aiConfigs = document.querySelectorAll('.ai-config');
      aiConfigs.forEach(el => {
        el.style.display = e.target.value === 'ai' ? 'block' : 'none';
      });
    });
    
    // Inicialização do estado da UI
    const initialMode = document.getElementById('game-mode').value;
    document.querySelectorAll('.ai-config').forEach(el => {
      el.style.display = initialMode === 'ai' ? 'block' : 'none';
    });

    // Eventos do Canvas (Mouse)
    this.canvas.addEventListener('click', (e) => {
      this.handleCanvasClick(e);
    });

    this.canvas.addEventListener('mousemove', (e) => {
      this.handleCanvasHover(e);
    });

    this.canvas.addEventListener('mouseleave', () => {
      this.renderer.hoveredCell = null;
      this.renderer.render();
    });

    // Modais
    document.getElementById('play-again').addEventListener('click', () => {
      document.getElementById('game-over-modal').classList.add('hidden');
      this.resetGame();
    });

    document.getElementById('cancel-waiting').addEventListener('click', () => {
      this.cancelWaiting();
    });
  }

  // ============================================
  // Lógica de Autenticação
  // ============================================
  async handleLogin() {
    const nick = document.getElementById('nick').value.trim();
    const password = document.getElementById('password').value;

    if (!nick || !password) {
      this.messages.add('Por favor, preencha todos os campos', 'warning');
      return;
    }

    try {
      await this.api.register(nick, password);
      this.session.saveSession(nick, password);
      this.state.myNick = nick;
      this.messages.add(`Bem-vindo, ${nick}!`, 'success');
      this.updateUI();
    } catch (error) {
      this.messages.add(`Falha no login: ${error.message}`, 'error');
    }
  }

  handleLogout() {
    this.session.logout();
    this.state.myNick = null;
    this.resetGame();
    this.messages.add('Sessão terminada', 'info');
    this.updateUI();
  }

  // ============================================
  // Inicialização do Jogo
  // ============================================
  async startGame() {
    if (!this.session.isAuthenticated) {
      this.messages.add('Por favor, faça login primeiro', 'warning');
      return;
    }

    const mode = document.getElementById('game-mode').value;
    const size = parseInt(document.getElementById('board-size').value);

    this.state.reset();
    this.state.boardSize = size;
    this.state.myNick = this.session.nick;
    this.renderer.resize();

    if (mode === 'online') {
      await this.startOnlineGame(size);
    } else {
      this.startAIGame(size);
    }
  }

  /**
   * Inicia o fluxo online: Matchmaking e conexão SSE.
   */
  async startOnlineGame(size) {
    this.state.isOnline = true;
    
    const groupId = parseInt(document.getElementById('group-id').value) || CONFIG.GROUP_ID;
    document.getElementById('waiting-group').textContent = groupId;
    document.getElementById('waiting-size').textContent = size;
    document.getElementById('waiting-modal').classList.remove('hidden');

    try {
      // Entrar na fila (Join)
      const result = await this.api.joinWithCredentials(
        groupId, 
        this.session.nick, 
        this.session.password, 
        size
      );

      this.state.gameId = result.game;
      this.messages.add(`Aguardando adversário... (Grupo ${groupId}, ${size} colunas)`, 'info');

      // Estabelecer conexão em tempo real
      this.connectSSE();

    } catch (error) {
      document.getElementById('waiting-modal').classList.add('hidden');
      this.messages.add(`Falha ao entrar no jogo: ${error.message}`, 'error');
    }
  }

  /**
   * Inicia jogo local contra o computador.
   */
  startAIGame(size) {
    this.state.isOnline = false;
    this.state.isStarted = true;
    this.state.myColor = 'Blue';
    this.state.opponentNick = 'AI';
    this.state.turn = this.session.nick;

    // UI: Esconder boas-vindas
    const welcomeScreen = document.getElementById('welcome-screen');
    if (welcomeScreen) {
      welcomeScreen.style.display = 'none';
    }

    // Configurar peças iniciais
    this.initializeLocalBoard(size);
    
    this.messages.add('Jogo iniciado! Você joga com as peças azuis', 'success');
    this.updateUI();
    this.renderer.render();
  }

  initializeLocalBoard(size) {
    this.state.pieces = new Array(4 * size).fill(null);
    
    // Peças azuis (Jogador) na linha inferior
    for (let i = 0; i < size; i++) {
      this.state.pieces[i] = {
        color: 'Blue',
        inMotion: false,
        reachedLastRow: false
      };
    }
    
    // Peças vermelhas (IA) na linha superior
    for (let i = 0; i < size; i++) {
      this.state.pieces[3 * size + (size - 1 - i)] = {
        color: 'Red',
        inMotion: false,
        reachedLastRow: false
      };
    }
  }

  // ============================================
  // Comunicação em Tempo Real (SSE)
  // ============================================
  connectSSE() {
    const url = `${CONFIG.SERVER_URL}/update?nick=${encodeURIComponent(this.session.nick)}&game=${encodeURIComponent(this.state.gameId)}`;
    
    this.eventSource = new EventSource(url);

    this.eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.handleSSEUpdate(data);
    };

    this.eventSource.onerror = (error) => {
      console.error('SSE Error:', error);
      this.messages.add('Conexão perdida', 'error');
    };
  }

  /**
   * Processa atualizações vindas do servidor.
   * Centraliza a sincronização do estado do jogo.
   */
  handleSSEUpdate(data) {
    // Atualizar dados brutos do estado
    if (data.pieces) this.state.pieces = data.pieces;
    if (data.turn) this.state.turn = data.turn;
    if (data.step) this.state.step = data.step;
    
    // Tratamento especial para o dado
    if ('dice' in data) {
      this.state.dice = data.dice;
      if (!data.dice) {
        this.dice.reset();  // Servidor limpou o dado
      }
    }
    
    // Tratamento de seleção e movimentos válidos
    if ('selected' in data) {
      this.state.selected = data.selected || [];
      // Se estamos online e selecionamos algo, calcular visualmente para onde pode ir
      if (this.state.isOnline && this.state.selected.length > 0 && this.state.dice) {
        this.calculateValidMoves(this.state.selected[0]);
      } else {
        this.renderer.validMoves = [];
      }
    }
    
    if (data.mustPass !== undefined) this.state.mustPass = data.mustPass;

    // Detetar início de jogo (Matchmaking concluído)
    if (data.players && !this.state.isStarted) {
      document.getElementById('waiting-modal').classList.add('hidden');
      const welcomeScreen = document.getElementById('welcome-screen');
      if (welcomeScreen) welcomeScreen.style.display = 'none';
      this.state.isStarted = true;
      
      if (!this.state.myNick) {
        this.state.myNick = this.session.nick;
      }
      
      const players = data.players;
      
      // Determinar cores
      for (const [nick, color] of Object.entries(players)) {
        if (nick === this.state.myNick) {
          this.state.myColor = color;
        } else {
          this.state.opponentNick = nick;
        }
      }
      
      this.messages.add(`Adversário: ${this.state.opponentNick}`, 'success');
    }

    // Acionar animação visual do dado se houver novo valor
    if (data.dice) {
      this.dice.animate(data.dice);
    }

    // Verificar fim de jogo
    if (data.winner) {
      this.state.winner = data.winner;
      this.state.isOver = true;
      this.showGameOver(data.winner);
    }

    this.updateUI();
    this.renderer.render();
  }

  disconnectSSE() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  cancelWaiting() {
    document.getElementById('waiting-modal').classList.add('hidden');
    this.disconnectSSE();
    this.resetGame();
  }


  // ============================================
  // Ações de Jogo (Lançar, Passar, Desistir)
  // ============================================
  async rollDice() {
    // Validações básicas
    if (!this.state.isMyTurn() || this.state.dice) {
      return;
    }

    if (this.state.isOnline) {
      try {
        await this.api.roll(
          this.session.nick,
          this.session.password,
          this.state.gameId
        );
      } catch (error) {
        this.messages.add(`Falha ao lançar dado: ${error.message}`, 'error');
      }
    } else {
      // Modo Local/IA: Calcular resultado localmente
      const dice = this.rollLocalDice();
      this.state.dice = dice;
      
      // Animar e verificar movimentos possíveis
      this.dice.animate(dice, () => {
        const canMove = this.checkCanMove();
        this.state.mustPass = !canMove;
        
        if (!canMove) {
          this.messages.add('Nenhuma peça pode mover, passe a vez', 'warning');
        }
        
        this.updateUI();
        this.renderer.render();
      });
    }
  }

  // Verifica se existe algum movimento válido para o resultado do dado atual
  checkCanMove() {
    const myColor = this.state.myColor;
    const diceValue = this.state.dice?.value;
    if (!diceValue) return false;

    for (let i = 0; i < this.state.pieces.length; i++) {
      const piece = this.state.pieces[i];
      if (!piece || piece.color !== myColor) continue;

      // Regra: Peças na base só saem com Tâb (1)
      if (!piece.inMotion && diceValue !== 1) continue;

      // Calcular destino hipotético
      const { row, col } = this.state.fromIndex(i);
      const targetIndex = this.calculateTargetPosition(row, col, diceValue, myColor === 'Blue');

      if (targetIndex !== null) {
        // Verificar se destino é válido (vazio ou peça inimiga)
        const targetPiece = this.state.pieces[targetIndex];
        if (!targetPiece || targetPiece.color !== myColor) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Simula a lógica probabilística dos 4 paus binários.
   * Probabilidades: 0 brancos (Sitteh=6), 1 (Tâb=1), 2 (2), 3 (3), 4 (4).
   */
  rollLocalDice() {
    const rand = Math.random();
    let lightCount;
    
    // Distribuição de probabilidades binomiais
    if (rand < 0.0625) lightCount = 0;      // 1/16
    else if (rand < 0.3125) lightCount = 1; // 4/16
    else if (rand < 0.6875) lightCount = 2; // 6/16
    else if (rand < 0.9375) lightCount = 3; // 4/16
    else lightCount = 4;                    // 1/16

    // Gerar array visual dos paus
    const stickValues = [false, false, false, false];
    const indices = [0, 1, 2, 3];
    for (let i = 0; i < lightCount; i++) {
      const idx = Math.floor(Math.random() * indices.length);
      stickValues[indices[idx]] = true;
      indices.splice(idx, 1);
    }

    const value = lightCount === 0 ? 6 : lightCount;
    // Regra: 1, 4 e 6 dão direito a jogar novamente
    const keepPlaying = [1, 4, 6].includes(value);

    return { stickValues, value, keepPlaying };
  }

  async passTurn() {
    if (!this.state.isMyTurn() || !this.state.mustPass) {
      return;
    }

    if (this.state.isOnline) {
      try {
        await this.api.pass(
          this.session.nick,
          this.session.password,
          this.state.gameId,
          this.state.boardSize
        );
      } catch (error) {
        this.messages.add(`Falha ao passar: ${error.message}`, 'error');
      }
    } else {
      this.switchTurnLocal();
    }
  }

  async forfeitGame() {
    if (!this.state.isStarted || this.state.isOver) {
      return;
    }

    if (this.state.isOnline) {
      try {
        await this.api.leave(
          this.session.nick,
          this.session.password,
          this.state.gameId
        );
        this.disconnectSSE();
      } catch (error) {
        this.messages.add(`Falha ao desistir: ${error.message}`, 'error');
      }
    }

    this.showGameOver(this.state.opponentNick);
  }

  // ============================================
  // Lógica de Movimento e Interação
  // ============================================
  handleCanvasClick(e) {
    if (!this.state.isStarted || this.state.isOver) return;
    if (!this.state.isMyTurn()) {
      this.messages.add('Não é a sua vez', 'warning');
      return;
    }
    if (!this.state.dice) {
      this.messages.add('Lance o dado primeiro', 'warning');
      return;
    }

    // Detetar qual célula foi clicada
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const cellIndex = this.renderer.getCellFromPoint(x, y);

    if (cellIndex === null) return;

    if (this.state.isOnline) {
      // Online: Envia intenção para o servidor (Select ou Move)
      this.sendMove(cellIndex);
    } else {
      // Local: Gere a máquina de estados (Select -> Move) localmente
      this.handleLocalMove(cellIndex);
    }
  }

  handleCanvasHover(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    this.renderer.hoveredCell = this.renderer.getCellFromPoint(x, y);
    this.renderer.render();
  }

  async sendMove(cellIndex) {
    try {
      await this.api.notify(
        this.session.nick,
        this.session.password,
        this.state.gameId,
        cellIndex
      );
    } catch (error) {
      this.messages.add(`Falha ao mover: ${error.message}`, 'error');
    }
  }

  handleLocalMove(cellIndex) {
    const piece = this.state.pieces[cellIndex];
    const myColor = this.state.myColor;

    if (this.state.step === 'from') {
      // === Passo 1: Selecionar Peça ===
      if (!piece || piece.color !== myColor) {
        this.messages.add('Selecione uma peça sua', 'warning');
        return;
      }

      // Validação: Peças na base precisam de Tâb
      if (!piece.inMotion && this.state.dice.value !== 1) {
        this.messages.add('Peças não movidas só podem mover com Tâb (1)', 'warning');
        return;
      }

      // Calcular para onde esta peça pode ir
      this.calculateValidMoves(cellIndex);
      
      if (this.renderer.validMoves.length === 0) {
        this.messages.add('Esta peça não pode mover (destino bloqueado)', 'warning');
        this.renderer.validMoves = [];
        return;
      }

      // Seleção bem sucedida, mudar estado
      this.state.selected = [cellIndex];
      this.state.step = 'to';
      this.messages.add('Selecione o destino (destacado em verde)', 'info');

    } else {
      // === Passo 2: Selecionar Destino ===
      if (this.state.selected[0] === cellIndex) {
        // Clicou na mesma peça: Cancelar seleção
        this.state.selected = [];
        this.state.step = 'from';
        this.renderer.validMoves = [];
      } else if (this.renderer.validMoves.includes(cellIndex)) {
        // Movimento válido: Executar
        this.executeLocalMove(this.state.selected[0], cellIndex);
      } else {
        this.messages.add('Destino inválido', 'warning');
      }
    }

    this.renderer.render();
  }

  /**
   * Calcula destinos válidos para uma peça, baseando-se no valor do dado.
   */
  calculateValidMoves(fromIndex) {
    const { row, col } = this.state.fromIndex(fromIndex);
    const piece = this.state.pieces[fromIndex];
    const steps = this.state.dice.value;
    const isBlue = piece.color === 'Blue';

    // Obter índice linear do destino
    const targetIndex = this.calculateTargetPosition(row, col, steps, isBlue);
    
    this.renderer.validMoves = [];
    if (targetIndex !== null) {
      const targetPiece = this.state.pieces[targetIndex];
      // Regra: Não pode comer peça própria
      if (!targetPiece || targetPiece.color !== piece.color) {
        this.renderer.validMoves.push(targetIndex);
      }
    }
  }

  /**
   * Lógica de caminho ("Cobrinha" / Boustrophedon).
   * Calcula a coordenada final após X passos, seguindo o padrão do tabuleiro.
   */
  calculateTargetPosition(row, col, steps, isBlue) {
    let newRow = row;
    let newCol = col;
    const size = this.state.boardSize;

    for (let i = 0; i < steps; i++) {
      if (isBlue) {
        // Azul: 0 (Dir) -> 1 (Esq) -> 2 (Dir) -> 3 (Esq)
        if (newRow === 0) {
          newCol++;
          if (newCol >= size) { newRow = 1; newCol = size - 1; }
        } else if (newRow === 1) {
          newCol--;
          if (newCol < 0) { newRow = 2; newCol = 0; }
        } else if (newRow === 2) {
          newCol++;
          if (newCol >= size) { newRow = 3; newCol = size - 1; }
        } else if (newRow === 3) {
          newCol--;
          if (newCol < 0) return null; // Saiu do tabuleiro (movimento inválido por excesso)
        }
      } else {
        // Vermelho: 3 (Esq) -> 2 (Dir) -> 1 (Esq) -> 0 (Dir)
        if (newRow === 3) {
          newCol--;
          if (newCol < 0) { newRow = 2; newCol = 0; }
        } else if (newRow === 2) {
          newCol++;
          if (newCol >= size) { newRow = 1; newCol = size - 1; }
        } else if (newRow === 1) {
          newCol--;
          if (newCol < 0) { newRow = 0; newCol = 0; }
        } else if (newRow === 0) {
          newCol++;
          if (newCol >= size) return null; // Saiu do tabuleiro
        }
      }

      if (newRow < 0 || newRow >= 4) return null;
    }

    return this.state.toIndex(newRow, newCol);
  }

  /**
   * Aplica o movimento no estado local e trata capturas/regras.
   */
  executeLocalMove(fromIndex, toIndex) {
    const piece = { ...this.state.pieces[fromIndex] };
    const targetPiece = this.state.pieces[toIndex];
    const { row: toRow } = this.state.fromIndex(toIndex);

    // Captura
    if (targetPiece) {
      this.messages.add('Peça capturada!', 'success');
    }

    // Atualizar flags da peça
    piece.inMotion = true;
    // Verificar se chegou à última linha (objetivo secundário/visual)
    if ((piece.color === 'Blue' && toRow === 3) || 
        (piece.color === 'Red' && toRow === 0)) {
      piece.reachedLastRow = true;
    }

    // Executar animação visual antes de atualizar a lógica final
    this.renderer.animateMove(fromIndex, toIndex, () => {
      // Atualizar tabuleiro lógico
      this.state.pieces[fromIndex] = null;
      this.state.pieces[toIndex] = piece;
      
      // Verificar condição de vitória
      const winner = this.checkWinner();
      if (winner) {
        this.showGameOver(winner === 'Blue' ? this.session.nick : 'AI');
        return;
      }

      // Limpar seleção
      this.state.selected = [];
      this.state.step = 'from';
      this.renderer.validMoves = [];

      // Lógica de "Jogar Novamente" (1, 4, 6)
      const isAITurn = piece.color === 'Red';
      const canKeepPlaying = this.state.dice.keepPlaying;
      
      if (canKeepPlaying) {
        this.state.dice = null;
        this.dice.reset();
        
        if (isAITurn) {
          this.messages.add('IA pode lançar novamente!', 'info');
          this.updateUI();
          this.renderer.render();
          setTimeout(() => this.aiTurn(), 800);
        } else {
          this.messages.add('Pode lançar novamente!', 'info');
          this.updateUI();
          this.renderer.render();
        }
      } else {
        this.switchTurnLocal();
        this.updateUI();
        this.renderer.render();
      }
    });
  }

  switchTurnLocal() {
    this.state.dice = null;
    this.state.mustPass = null;
    this.dice.reset();
    this.state.selected = [];
    this.state.step = 'from';
    this.renderer.validMoves = [];

    if (this.state.turn === this.session.nick) {
      this.state.turn = 'AI';
      this.messages.add('Vez da IA', 'info');
      setTimeout(() => this.aiTurn(), 1000);
    } else {
      this.state.turn = this.session.nick;
      this.messages.add('Sua vez', 'info');
    }

    this.updateUI();
  }

  checkWinner() {
    let blueCount = 0;
    let redCount = 0;
    
    for (const piece of this.state.pieces) {
      if (piece) {
        if (piece.color === 'Blue') blueCount++;
        else redCount++;
      }
    }

    if (blueCount === 0) return 'Red';
    if (redCount === 0) return 'Blue';
    return null;
  }

  // ============================================
  // Lógica da Inteligência Artificial (Local)
  // ============================================
  aiTurn() {
    if (this.state.turn !== 'AI' || this.state.isOver) return;

    // 1. Lançar dado
    const dice = this.rollLocalDice();
    this.state.dice = dice;
    
    this.dice.animate(dice, () => {
      setTimeout(() => {
        this.aiMakeMove();
      }, 500);
    });
  }

  aiMakeMove() {
    const aiLevel = document.getElementById('ai-level').value;
    const validMoves = this.getAIValidMoves();

    // Se não há movimentos, passar ou jogar de novo
    if (validMoves.length === 0) {
      this.messages.add('IA não pode mover', 'info');
      if (this.state.dice.keepPlaying) {
        this.state.dice = null;
        setTimeout(() => this.aiTurn(), 500);
      } else {
        this.switchTurnLocal();
      }
      return;
    }

    // Heurística de escolha
    let move;
    if (aiLevel === 'easy') {
      // Aleatório
      move = validMoves[Math.floor(Math.random() * validMoves.length)];
    } else {
      // Hard: Tenta capturar sempre que possível
      const captureMoves = validMoves.filter(m => 
        this.state.pieces[m.to] && this.state.pieces[m.to].color === 'Blue'
      );
      
      if (captureMoves.length > 0 && (aiLevel === 'hard' || Math.random() > 0.5)) {
        move = captureMoves[Math.floor(Math.random() * captureMoves.length)];
      } else {
        move = validMoves[Math.floor(Math.random() * validMoves.length)];
      }
    }

    this.executeLocalMove(move.from, move.to);
  }

  getAIValidMoves() {
    const moves = [];
    const size = this.state.boardSize;

    for (let i = 0; i < this.state.pieces.length; i++) {
      const piece = this.state.pieces[i];
      if (!piece || piece.color !== 'Red') continue;

      if (!piece.inMotion && this.state.dice.value !== 1) continue;

      const { row, col } = this.state.fromIndex(i);
      const targetIndex = this.calculateTargetPosition(row, col, this.state.dice.value, false);

      if (targetIndex !== null) {
        const targetPiece = this.state.pieces[targetIndex];
        if (!targetPiece || targetPiece.color !== 'Red') {
          moves.push({ from: i, to: targetIndex });
        }
      }
    }

    return moves;
  }

  // ============================================
  // Atualização da UI e DOM
  // ============================================
  updateUI() {
    const isLoggedIn = this.session.isLoggedIn();
    
    // Visibilidade dos painéis
    document.getElementById('login-form').classList.toggle('hidden', isLoggedIn);
    document.getElementById('user-info').classList.toggle('hidden', !isLoggedIn);
    if (isLoggedIn) {
      document.getElementById('user-nick').textContent = this.session.nick;
    }

    // Estado dos botões
    document.getElementById('start-game').disabled = !isLoggedIn || this.state.isStarted;
    document.getElementById('forfeit-game').disabled = !this.state.isStarted || this.state.isOver;
    
    // Habilitar botões de ação apenas se for minha vez e jogo estiver ativo
    const canRoll = this.state.isStarted && !this.state.isOver && 
                    this.state.isMyTurn() && !this.state.dice;
    const canPass = this.state.isStarted && !this.state.isOver && 
                    this.state.isMyTurn() && this.state.mustPass;
    
    document.getElementById('roll-dice').disabled = !canRoll;
    document.getElementById('pass-turn').disabled = !canPass;

    // Atualizar barra de status (Turn Indicator)
    const turnIndicator = document.getElementById('turn-indicator');
    if (!this.state.isStarted) {
      turnIndicator.textContent = 'Aguardando...';
      turnIndicator.className = 'turn-indicator';
    } else if (this.state.isOver) {
      turnIndicator.textContent = 'Jogo Terminado';
      turnIndicator.className = 'turn-indicator';
    } else if (this.state.isMyTurn()) {
      turnIndicator.textContent = 'Sua Vez';
      turnIndicator.className = 'turn-indicator my-turn';
    } else {
      turnIndicator.textContent = `Vez de ${this.state.turn}`;
      turnIndicator.className = 'turn-indicator opponent-turn';
    }

    // Atualizar contadores de peças
    document.getElementById('player1-name').textContent = 
      this.state.myColor === 'Blue' ? (this.state.myNick || 'Você') : (this.state.opponentNick || 'Adversário');
    document.getElementById('player2-name').textContent = 
      this.state.myColor === 'Red' ? (this.state.myNick || 'Você') : (this.state.opponentNick || 'Adversário');
    
    document.getElementById('player1-pieces').textContent = this.state.getPieceCount('Blue');
    document.getElementById('player2-pieces').textContent = this.state.getPieceCount('Red');
  }

  // ============================================
  // Sistema de Classificações
  // ============================================
  async showRankings() {
    const size = parseInt(document.getElementById('board-size').value);
    const groupId = parseInt(document.getElementById('group-id').value) || CONFIG.GROUP_ID;
    
    document.getElementById('ranking-group').textContent = groupId;
    document.getElementById('ranking-size').textContent = size;
    
    try {
      const result = await this.api.ranking(groupId, size);
      this.displayRankings(result.ranking || []);
    } catch (error) {
      this.messages.add('Falha ao obter classificações', 'error');
    }
  }

  displayRankings(rankings) {
    const tbody = document.querySelector('#rankings-table tbody');
    tbody.innerHTML = '';

    if (rankings.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="4" style="text-align:center">Sem dados</td>';
      tbody.appendChild(tr);
    } else {
      rankings.forEach((r, i) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${i + 1}</td>
          <td>${r.nick}</td>
          <td>${r.victories}</td>
          <td>${r.games}</td>
        `;
        tbody.appendChild(tr);
      });
    }

    document.querySelector('.instructions-panel').classList.add('hidden');
    document.getElementById('rankings-panel').classList.remove('hidden');
  }

  // ============================================
  // Finalização
  // ============================================
  showGameOver(winner) {
    this.state.isOver = true;
    this.disconnectSSE();

    const isWinner = winner === this.session.nick;
    document.getElementById('winner-text').textContent = isWinner ? '🏆 Você Ganhou!' : '😢 Você Perdeu';
    document.getElementById('winner-name').textContent = `Vencedor: ${winner}`;
    document.getElementById('game-over-modal').classList.remove('hidden');

    this.updateUI();
  }

  resetGame() {
    this.state.reset();
    this.dice.reset();
    this.renderer.validMoves = [];
    this.renderer.hoveredCell = null;
    this.renderer.resize();
    this.renderer.render();
    this.updateUI();
    
    const welcomeScreen = document.getElementById('welcome-screen');
    if (welcomeScreen) welcomeScreen.style.display = '';
  }
}

// ============================================
// Ponto de Entrada
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  // Expõe a instância para debugging na consola
  window.game = new GameController();
});