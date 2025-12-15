// ============================================
// SSE.JS - Módulo Server-Sent Events
// ============================================
// Este módulo gere as conexões HTTP persistentes (streams) para
// comunicação em tempo real unidirecional (Servidor -> Cliente).
// ============================================

/**
 * Classe responsável pela gestão de conexões SSE.
 * Mantém um registo de clientes ativos por jogo e distribui atualizações.
 */
class SSEModule {
  /**
   * @param {object} gameModule - Referência ao módulo de lógica do jogo (para aceder ao estado).
   */
  constructor(gameModule) {
    this.gameModule = gameModule;
    
    // Estrutura de armazenamento de conexões:
    // { 
    //   "gameId_123": { 
    //     "jogadorA": <ResponseObject>, 
    //     "jogadorB": <ResponseObject> 
    //   } 
    // }
    this.clients = {}; 
  }

  /**
   * Regista uma nova conexão SSE ativa para um jogo específico.
   * O objeto 'res' é mantido aberto para permitir o envio contínuo de dados.
   * * @param {string} gameId - ID do jogo.
   * @param {string} nick - Nick do jogador que se está a conectar.
   * @param {object} res - Objeto de resposta HTTP (Express/Node.js).
   */
  addClient(gameId, nick, res) {
    if (!this.clients[gameId]) {
      this.clients[gameId] = {};
    }
    
    this.clients[gameId][nick] = res;
    
    console.log(`[SSE] Client added: ${nick} to game ${gameId}`);
    console.log(`[SSE] Total clients in game ${gameId}: ${Object.keys(this.clients[gameId]).length}`);
  }

  /**
   * Remove a conexão de um cliente e limpa o registo do jogo se ficar vazio.
   * Geralmente chamado quando a conexão cai ou o jogo termina.
   * * @param {string} gameId - ID do jogo.
   * @param {string} nick - Nick do jogador.
   */
  removeClient(gameId, nick) {
    if (this.clients[gameId] && this.clients[gameId][nick]) {
      delete this.clients[gameId][nick];
      
      console.log(`[SSE] Client removed: ${nick} from game ${gameId}`);
      
      // Se não há mais clientes conectados neste ID, remove o objeto do jogo para poupar memória
      if (Object.keys(this.clients[gameId]).length === 0) {
        delete this.clients[gameId];
        console.log(`[SSE] No more clients in game ${gameId}, removed from tracking`);
      }
    }
  }

  /**
   * Método de baixo nível para escrever na stream HTTP.
   * Formata os dados de acordo com a especificação SSE (`data: ...\n\n`).
   * * @param {object} res - Objeto de resposta HTTP onde escrever.
   * @param {object} data - Payload JSON a enviar.
   * @returns {boolean} - Retorna true se enviado com sucesso, false em caso de erro.
   */
  sendMessage(res, data) {
    try {
      const message = `data: ${JSON.stringify(data)}\n\n`;
      res.write(message);
      return true;
    } catch (error) {
      console.error('[SSE] Error sending message:', error.message);
      return false;
    }
  }

  /**
   * Broadcast: Notifica TODOS os jogadores conectados a um jogo específico.
   * Itera sobre os clientes e remove automaticamente conexões mortas.
   * * @param {string} gameId - ID do jogo alvo.
   * @param {object} data - Objeto com os dados da atualização.
   */
  notifyGame(gameId, data) {
    if (!this.clients[gameId]) {
      console.log(`[SSE] No clients connected to game ${gameId}`);
      return;
    }
    
    const clients = this.clients[gameId];
    const clientCount = Object.keys(clients).length;
    
    console.log(`[SSE] Notifying ${clientCount} client(s) in game ${gameId}`);
    
    for (const nick in clients) {
      const res = clients[nick];
      const success = this.sendMessage(res, data);
      
      // Se falhar o envio (socket fechado), remove o cliente imediatamente
      if (!success) {
        console.error(`[SSE] Failed to send to ${nick}, removing client`);
        this.removeClient(gameId, nick);
      }
    }
  }

  /**
   * Envia o estado inicial completo do jogo após o emparelhamento (matchmaking).
   * * @param {string} gameId - ID do jogo.
   */
  notifyGameStart(gameId) {
    // Obtém o estado atual da lógica do jogo
    const gameState = this.gameModule.getGameState(gameId);
    
    if (!gameState) {
      console.error(`[SSE] Cannot notify game start - game ${gameId} not found`);
      return;
    }
    
    console.log(`[SSE] Notifying game start for ${gameId}`);
    
    this.notifyGame(gameId, gameState);
  }

  /**
   * Envia uma atualização incremental ou total durante o decorrer do jogo
   * (ex: peça movida, dado lançado, mudança de turno).
   * * @param {string} gameId - ID do jogo.
   * @param {object} update - Objeto contendo as alterações de estado.
   */
  notifyUpdate(gameId, update) {
    console.log(`[SSE] Notifying update for game ${gameId}:`, Object.keys(update));
    
    this.notifyGame(gameId, update);
  }

  /**
   * Notifica o vencedor e inicia a sequência de encerramento.
   * Mantém a conexão aberta brevemente para garantir a entrega da mensagem.
   * * @param {string} gameId - ID do jogo.
   * @param {string} winner - Nick do jogador vencedor.
   */
  notifyGameEnd(gameId, winner) {
    console.log(`[SSE] Notifying game end for ${gameId}, winner: ${winner}`);
    
    const gameState = this.gameModule.getGameState(gameId);
    
    if (gameState) {
      gameState.winner = winner;
      this.notifyGame(gameId, gameState);
    } else {
      // Fallback: Se o jogo já foi limpo da memória, envia apenas o vencedor
      this.notifyGame(gameId, { winner });
    }
    
    // Aguarda 2 segundos antes de cortar as conexões para dar tempo ao cliente de processar a vitória
    setTimeout(() => {
      this.closeGameConnections(gameId);
    }, 2000);
  }

  /**
   * Força o encerramento de todas as conexões HTTP associadas a um jogo.
   * Deve ser chamado ao fim do jogo ou para limpeza de recursos.
   * * @param {string} gameId - ID do jogo.
   */
  closeGameConnections(gameId) {
    if (!this.clients[gameId]) {
      return;
    }
    
    console.log(`[SSE] Closing all connections for game ${gameId}`);
    
    const clients = this.clients[gameId];
    
    for (const nick in clients) {
      const res = clients[nick];
      
      try {
        res.end(); // Fecha o stream HTTP corretamente
      } catch (error) {
        console.error(`[SSE] Error closing connection for ${nick}:`, error.message);
      }
    }
    
    // Remove a entrada do jogo da memória deste módulo
    delete this.clients[gameId];
  }

  /**
   * Utilitário: Conta o número total de clientes ou clientes num jogo específico.
   * * @param {string} [gameId=null] - ID do jogo (opcional).
   * @returns {number} - Contagem de clientes.
   */
  getClientCount(gameId = null) {
    if (gameId) {
      return this.clients[gameId] ? Object.keys(this.clients[gameId]).length : 0;
    }
    
    let total = 0;
    for (const gId in this.clients) {
      total += Object.keys(this.clients[gId]).length;
    }
    
    return total;
  }

  /**
   * Obtém a lista de IDs de jogos que têm conexões SSE ativas.
   * @returns {Array<string>} - Lista de Game IDs.
   */
  getActiveGames() {
    return Object.keys(this.clients);
  }

  /**
   * Verifica se um jogador específico tem uma conexão ativa.
   * * @param {string} gameId - ID do jogo.
   * @param {string} nick - Nick do jogador.
   * @returns {boolean} - true se conectado.
   */
  isClientConnected(gameId, nick) {
    return !!(this.clients[gameId] && this.clients[gameId][nick]);
  }

  /**
   * Garbage Collection: Remove conexões de jogos que já não existem no GameModule.
   * Útil para prevenir fugas de memória se o GameModule eliminar jogos por timeout.
   * * @returns {number} - Número de jogos limpos.
   */
  cleanupInactive() {
    const activeGames = this.getActiveGames();
    let cleaned = 0;
    
    for (const gameId of activeGames) {
      // Verifica se o jogo ainda existe na lógica principal
      const game = this.gameModule.getGame(gameId);
      
      // Se o jogo não existe mais, fechar conexões órfãs
      if (!game) {
        console.log(`[SSE] Cleaning up connections for non-existent game ${gameId}`);
        this.closeGameConnections(gameId);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`[SSE] Cleaned ${cleaned} inactive game connection(s)`);
    }
    
    return cleaned;
  }

  /**
   * Retorna um objeto com estatísticas para monitorização/debug.
   */
  getStats() {
    const stats = {
      totalGames: Object.keys(this.clients).length,
      totalClients: this.getClientCount(),
      games: {}
    };
    
    for (const gameId in this.clients) {
      stats.games[gameId] = Object.keys(this.clients[gameId]);
    }
    
    return stats;
  }
}

module.exports = SSEModule;