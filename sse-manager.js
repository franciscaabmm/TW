// ============================================
// SSE-MANAGER.JS - GESTÃO DE SERVER-SENT EVENTS
// ============================================

class SSEManager {
  constructor() {
    this.clients = new Map(); // gameId -> Map(nick -> response)
  }

  addClient(gameId, nick, response) {
    if (!this.clients.has(gameId)) {
      this.clients.set(gameId, new Map());
    }

    const gameClients = this.clients.get(gameId);
    gameClients.set(nick, response);

    console.log(`📡 Cliente conectado: ${nick} no jogo ${gameId}`);
    console.log(`   Total de clientes neste jogo: ${gameClients.size}`);

    // Enviar mensagem inicial de conexão
    this.sendToClient(response, { connected: true });
  }

  removeClient(gameId, nick) {
    if (!this.clients.has(gameId)) {
      return;
    }

    const gameClients = this.clients.get(gameId);
    gameClients.delete(nick);

    console.log(`📡 Cliente desconectado: ${nick} do jogo ${gameId}`);

    // Remover mapa de clientes se estiver vazio
    if (gameClients.size === 0) {
      this.clients.delete(gameId);
      console.log(`   Jogo ${gameId} sem clientes, removido`);
    }
  }

  sendToClient(response, data) {
    try {
      const message = `data: ${JSON.stringify(data)}\n\n`;
      response.write(message);
    } catch (error) {
      console.error('Erro ao enviar para cliente:', error);
    }
  }

  broadcast(gameId, data) {
    if (!this.clients.has(gameId)) {
      console.log(`⚠️ Nenhum cliente conectado ao jogo ${gameId}`);
      return;
    }

    const gameClients = this.clients.get(gameId);
    
    console.log(`📤 Broadcast para jogo ${gameId}: ${gameClients.size} clientes`);
    console.log(`   Dados:`, JSON.stringify(data).substring(0, 100) + '...');

    gameClients.forEach((response, nick) => {
      this.sendToClient(response, data);
    });
  }

  sendToPlayer(gameId, nick, data) {
    if (!this.clients.has(gameId)) {
      return;
    }

    const gameClients = this.clients.get(gameId);
    const response = gameClients.get(nick);

    if (response) {
      console.log(`📤 Enviando para ${nick} no jogo ${gameId}`);
      this.sendToClient(response, data);
    }
  }

  getActiveGames() {
    return Array.from(this.clients.keys());
  }

  getGameClients(gameId) {
    if (!this.clients.has(gameId)) {
      return [];
    }

    return Array.from(this.clients.get(gameId).keys());
  }

  hasClients(gameId) {
    return this.clients.has(gameId) && this.clients.get(gameId).size > 0;
  }

  getClientCount(gameId) {
    if (!this.clients.has(gameId)) {
      return 0;
    }

    return this.clients.get(gameId).size;
  }

  // Limpar conexões mortas
  cleanup() {
    const toRemove = [];

    this.clients.forEach((gameClients, gameId) => {
      const deadClients = [];

      gameClients.forEach((response, nick) => {
        if (response.destroyed || response.writableEnded) {
          deadClients.push(nick);
        }
      });

      deadClients.forEach(nick => {
        gameClients.delete(nick);
        console.log(`🧹 Cliente morto removido: ${nick} do jogo ${gameId}`);
      });

      if (gameClients.size === 0) {
        toRemove.push(gameId);
      }
    });

    toRemove.forEach(gameId => {
      this.clients.delete(gameId);
      console.log(`🧹 Jogo sem clientes removido: ${gameId}`);
    });
  }

  // Estatísticas
  getStats() {
    const stats = {
      totalGames: this.clients.size,
      totalClients: 0,
      games: []
    };

    this.clients.forEach((gameClients, gameId) => {
      stats.totalClients += gameClients.size;
      stats.games.push({
        gameId,
        clientCount: gameClients.size,
        clients: Array.from(gameClients.keys())
      });
    });

    return stats;
  }
}

module.exports = { SSEManager };