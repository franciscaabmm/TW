/**
 * SERVER-API.JS - Módulo de Comunicação com Servidor
 * * Este módulo centraliza toda a lógica de rede e gestão de estado do utilizador (sessão).
 * Atua como uma camada de abstração entre a interface do jogo (Frontend) e o Backend.
 * * Versão Corrigida - Compatível com app.js
 */

/**
 * Configurações globais de conexão.
 * Define o URL base e os endpoints da API REST.
 */
const CONFIG = {
  SERVER_URL: 'http://twserver.alunos.dcc.fc.up.pt:8137',
  ENDPOINTS: {
    register: '/register', // Registo de utilizador
    join: '/join',         // Entrada em sala/jogo
    leave: '/leave',       // Desistência/Saída
    ranking: '/ranking',   // Obtenção de pontuações
    roll: '/roll',         // Lançar dados
    notify: '/notify',     // Notificar movimento de peça
    pass: '/pass',         // Passar a vez
    update: '/update'      // Long-polling / Server Sent Events (se aplicável)
  }
};

/**
 * Gerencia a sessão do utilizador no navegador.
 * Responsável por persistir as credenciais (nick e password)
 * utilizando o sessionStorage para que sobrevivam a recarregamentos de página.
 */
export class SessionManager {
  /**
   * Inicializa o gestor e tenta restaurar uma sessão existente.
   */
  constructor() {
    this.nick = null;
    this.password = null;
    this.restoreSession();
  }

  /**
   * Verifica se existem credenciais válidas carregadas.
   * @returns {boolean} True se o utilizador estiver logado.
   */
  get isAuthenticated() {
    return this.nick !== null && this.password !== null;
  }

  /**
   * Guarda as credenciais na memória e no armazenamento do navegador.
   * @param {string} nick - O nome do utilizador.
   * @param {string} password - A senha (hash) do utilizador.
   */
  saveSession(nick, password) {
    this.nick = nick;
    this.password = password;
    sessionStorage.setItem('tab_nick', nick);
    sessionStorage.setItem('tab_password', password);
  }

  /**
   * Limpa as credenciais da memória e do armazenamento, efetuando logout.
   */
  logout() {
    this.nick = null;
    this.password = null;
    sessionStorage.removeItem('tab_nick');
    sessionStorage.removeItem('tab_password');
  }

  /**
   * Alias para isAuthenticated.
   * @returns {boolean} True se logado.
   */
  isLoggedIn() {
    return this.nick !== null && this.password !== null;
  }

  /**
   * Recupera as credenciais do sessionStorage, se existirem.
   * Chamado automaticamente no construtor.
   */
  restoreSession() {
    this.nick = sessionStorage.getItem('tab_nick');
    this.password = sessionStorage.getItem('tab_password');
  }
}

/**
 * Classe principal da API.
 * Encapsula todas as chamadas HTTP (fetch) para o servidor do jogo.
 */
export class ServerAPI {
  /**
   * @param {string} baseURL - URL base do servidor (padrão definido em CONFIG).
   */
  constructor(baseURL = CONFIG.SERVER_URL) {
    this.baseURL = baseURL;
  }

  /**
   * Método genérico para realizar requisições HTTP POST.
   * Trata a conversão para JSON e gestão básica de erros HTTP.
   * * @param {string} endpoint - O caminho do recurso (ex: '/register').
   * @param {object} data - O corpo da requisição (payload) a enviar.
   * @returns {Promise<object>} A resposta do servidor em formato JSON.
   * @throws {Error} Lança erro se o servidor retornar status diferente de 200 ou erro de rede.
   */
  async request(endpoint, data = {}) {
    try {
      const response = await fetch(this.baseURL + endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      const result = await response.json();

      // Verifica se a resposta HTTP indica sucesso (status 200-299)
      if (!response.ok) {
        throw new Error(result.error || `HTTP ${response.status}`);
      }

      return result;
    } catch (error) {
      console.error(`[API] Error on ${endpoint}:`, error);
      throw error; // Re-lança o erro para ser tratado pelo chamador (UI)
    }
  }

  /**
   * Regista um novo utilizador no servidor.
   * @param {string} nick - Nome do utilizador.
   * @param {string} password - Senha do utilizador.
   */
  async register(nick, password) {
    return await this.request(CONFIG.ENDPOINTS.register, {
      nick,
      password
    });
  }

  /**
   * Método obsoleto/placeholder.
   * @deprecated Deve usar joinWithCredentials para garantir autenticação.
   */
  async join(group, size) {
    // Esta função precisa receber nick e password do SessionManager
    throw new Error('Use joinWithCredentials instead');
  }

  /**
   * Entra numa fila de espera (matchmaking) para iniciar um jogo.
   * * @param {string} group - ID do grupo (turma/sala).
   * @param {string} nick - Nome do utilizador.
   * @param {string} password - Senha.
   * @param {number} size - Tamanho do tabuleiro (número de casas/buracos).
   * @returns {Promise<object>} Objeto contendo o gameId e estado inicial.
   */
  async joinWithCredentials(group, nick, password, size) {
    const result = await this.request(CONFIG.ENDPOINTS.join, {
      group,
      nick,
      password,
      size
    });

    return result;
  }

  /**
   * Abandona o jogo atual. Conta como derrota.
   * @param {string} nick - Credencial.
   * @param {string} password - Credencial.
   * @param {string} gameId - Hash identificador do jogo atual.
   */
  async leave(nick, password, gameId) {
    return await this.request(CONFIG.ENDPOINTS.leave, {
      nick,
      password,
      game: gameId
    });
  }

  /**
   * Obtém a tabela de classificações.
   * @param {string} group - ID do grupo.
   * @param {number} size - Tamanho do tabuleiro.
   */
  async ranking(group, size) {
    return await this.request(CONFIG.ENDPOINTS.ranking, {
      group,
      size
    });
  }

  /**
   * Realiza a ação de lançar os "dados" (paus) no jogo.
   * @param {string} nick - Credencial.
   * @param {string} password - Credencial.
   * @param {string} gameId - ID do jogo.
   * @returns {Promise<object>} Resultado do lançamento (valor do dado).
   */
  async roll(nick, password, gameId) {
    return await this.request(CONFIG.ENDPOINTS.roll, {
      nick,
      password,
      game: gameId
    });
  }

  /**
   * Notifica o servidor que o jogador quer mover uma peça.
   * * @param {string} nick - Credencial.
   * @param {string} password - Credencial.
   * @param {string} gameId - ID do jogo.
   * @param {number} cell - Índice da casa/célula de onde a peça será movida.
   */
  async notify(nick, password, gameId, cell) {
    return await this.request(CONFIG.ENDPOINTS.notify, {
      nick,
      password,
      game: gameId,
      cell
    });
  }

  /**
   * Passa a vez voluntariamente (quando não há movimentos possíveis ou por estratégia).
   * @param {string} nick - Credencial.
   * @param {string} password - Credencial.
   * @param {string} gameId - ID do jogo.
   */
  async pass(nick, password, gameId) {
    return await this.request(CONFIG.ENDPOINTS.pass, {
      nick,
      password,
      game: gameId
    });
  }
}

export default ServerAPI;