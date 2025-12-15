// ============================================
// RANKING.JS - Módulo de Classificações
// ============================================
// Módulo responsável pela gestão das tabelas de classificação (Leaderboards).
// Gere a persistência de dados (leitura/escrita em JSON) e a lógica de pontuação.
// ============================================

const Storage = require('./storage');

/**
 * Classe RankingModule
 * Gerencia a lógica de pontuações e persistência dos rankings do jogo.
 * Atua como uma camada de abstração sobre o sistema de ficheiros (Storage).
 */
class RankingModule {
  /**
   * Inicializa o módulo e carrega os dados existentes.
   */
  constructor() {
    this.storage = new Storage('rankings.json');
    
    // Carrega rankings existentes na inicialização (síncrono).
    // Isto é crítico para garantir que o servidor não subscreve
    // o histórico anterior com um objeto vazio ao reiniciar.
    this.rankings = this.storage.load() || {};
    
    console.log(`[RANKING] Loaded ${Object.keys(this.rankings).length} ranking tables`);
  }

  /**
   * Gera uma chave composta única para identificar o ranking.
   * Permite ter rankings separados para diferentes configurações de jogo.
   * * @param {number|string} group - ID do grupo (ex: 37).
   * @param {number} size - Tamanho do tabuleiro (ex: 9).
   * @returns {string} - Chave no formato "GRUPO-TAMANHO" (ex: "37-9").
   */
  getRankingKey(group, size) {
    return `${group}-${size}`;
  }

  /**
   * Atualiza as estatísticas dos jogadores após o término de uma partida.
   * Regista jogos jogados e vitórias, persistindo os dados imediatamente.
   * * @param {number|string} group - ID do grupo.
   * @param {number} size - Tamanho do tabuleiro.
   * @param {string} player1 - Nick do jogador 1 (Azul).
   * @param {string} player2 - Nick do jogador 2 (Vermelho).
   * @param {string} winner - Nick do vencedor.
   */
  updateRanking(group, size, player1, player2, winner) {
    const key = this.getRankingKey(group, size);
    
    // Recarrega os dados do disco antes de atualizar.
    // Essencial em ambientes onde múltiplos processos podem escrever no ficheiro,
    // garantindo que não perdemos dados gravados recentemente.
    const currentData = this.storage.load() || {};
    this.rankings = currentData;
    
    // Inicializar tabela para este grupo/tamanho se não existir
    if (!this.rankings[key]) {
      this.rankings[key] = {};
    }
    
    const ranking = this.rankings[key];
    
    // Inicializar estrutura do Jogador 1 se for a primeira vez
    if (!ranking[player1]) {
      ranking[player1] = {
        nick: player1,
        games: 0,
        victories: 0
      };
    }
    
    // Inicializar estrutura do Jogador 2 se for a primeira vez
    if (!ranking[player2]) {
      ranking[player2] = {
        nick: player2,
        games: 0,
        victories: 0
      };
    }
    
    // Incrementar contadores de participação
    ranking[player1].games++;
    ranking[player2].games++;
    
    // Atribuir vitória
    if (winner === player1) {
      ranking[player1].victories++;
    } else if (winner === player2) {
      ranking[player2].victories++;
    }
    
    // Persistir alterações imediatamente no disco (commit).
    this.storage.save(this.rankings);
    
    console.log(`[RANKING] Updated ${key}: ${winner} won (${player1} vs ${player2})`);
    console.log(`[RANKING] ${player1}: ${ranking[player1].victories}V/${ranking[player1].games}J`);
    console.log(`[RANKING] ${player2}: ${ranking[player2].victories}V/${ranking[player2].games}J`);
  }

  /**
   * Obtém o Top 10 de jogadores para uma configuração específica.
   * * @param {number|string} group - ID do grupo.
   * @param {number} size - Tamanho do tabuleiro.
   * @returns {Array<object>} - Lista ordenada dos 10 melhores jogadores.
   */
  getRanking(group, size) {
    const key = this.getRankingKey(group, size);
    
    // Force reload para garantir dados frescos
    const currentData = this.storage.load() || {};
    this.rankings = currentData;
    
    const ranking = this.rankings[key];
    
    if (!ranking) {
      console.log(`[RANKING] No ranking found for ${key}`);
      return [];
    }
    
    // Converte o objeto { nick: stats } num array [ stats ] para ordenação
    const rankingArray = Object.values(ranking);
    
    // Lógica de Ordenação:
    // 1º Critério: Número de vitórias (Decrescente)
    // 2º Critério: Número de jogos (Crescente) - Desempate por eficiência/menos tentativas
    rankingArray.sort((a, b) => {
      if (b.victories !== a.victories) {
        return b.victories - a.victories;
      }
      return a.games - b.games;
    });
    
    // Retorna apenas os 10 primeiros (Top 10)
    const top10 = rankingArray.slice(0, 10);
    
    console.log(`[RANKING] Retrieved ${key}: ${top10.length} players`);
    
    return top10;
  }

  /**
   * Obtém estatísticas detalhadas e calculadas (win rate) de um jogador.
   * * @param {number|string} group - ID do grupo.
   * @param {number} size - Tamanho do tabuleiro.
   * @param {string} nick - Nome do jogador.
   * @returns {object|null} - Objeto com stats ou null se não encontrado.
   */
  getPlayerStats(group, size, nick) {
    const key = this.getRankingKey(group, size);
    
    // Reload dados
    const currentData = this.storage.load() || {};
    this.rankings = currentData;
    
    const ranking = this.rankings[key];
    
    if (!ranking || !ranking[nick]) {
      return null;
    }
    
    const stats = ranking[nick];
    // Calcula a taxa de vitória (0-100) com uma casa decimal
    const winRate = stats.games > 0 ? (stats.victories / stats.games * 100).toFixed(1) : 0;
    
    return {
      ...stats,
      losses: stats.games - stats.victories,
      winRate: parseFloat(winRate)
    };
  }

  /**
   * Calcula a posição atual (rank) de um jogador na tabela.
   * * @returns {number|null} - Posição (começando em 1) ou null se não classificado.
   */
  getPlayerRank(group, size, nick) {
    // Reutiliza a lógica de ordenação do getRanking para consistência
    const rankingArray = this.getRanking(group, size);
    const position = rankingArray.findIndex(p => p.nick === nick);
    
    return position >= 0 ? position + 1 : null;
  }

  /**
   * Apaga/Reseta o ranking de um grupo específico.
   * Útil para administração ou reinício de temporada.
   */
  clearRanking(group, size) {
    const key = this.getRankingKey(group, size);
    
    const currentData = this.storage.load() || {};
    this.rankings = currentData;
    
    if (this.rankings[key]) {
      delete this.rankings[key];
      this.storage.save(this.rankings);
      
      console.log(`[RANKING] Cleared ranking for ${key}`);
      return true;
    }
    
    return false;
  }

  /**
   * Retorna todos os rankings em memória bruta.
   * Útil para debug ou backup global.
   */
  getAllRankings() {
    const currentData = this.storage.load() || {};
    this.rankings = currentData;
    
    return this.rankings;
  }

  /**
   * Gera um relatório estatístico global do servidor.
   * @returns {object} - Contagens totais de jogadores, jogos e tabelas.
   */
  getStats() {
    const currentData = this.storage.load() || {};
    this.rankings = currentData;
    
    const stats = {
      totalRankings: Object.keys(this.rankings).length,
      totalPlayers: 0,
      totalGames: 0
    };
    
    for (const key in this.rankings) {
      const ranking = this.rankings[key];
      stats.totalPlayers += Object.keys(ranking).length;
      
      for (const nick in ranking) {
        stats.totalGames += ranking[nick].games;
      }
    }
    
    // Dividir por 2 pois cada jogo é registado para ambos os jogadores
    // (Aproximação, assume jogos de 2 jogadores sempre)
    stats.totalGames = Math.floor(stats.totalGames / 2);
    
    return stats;
  }
}

module.exports = RankingModule;