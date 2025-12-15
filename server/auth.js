// ============================================
// AUTH.JS - Módulo de Autenticação
// ============================================
// Gere a criação de utilizadores, encriptação de palavras-passe
// e verificação de credenciais. Utiliza encriptação forte (PBKDF2).
// ============================================

const crypto = require('crypto');
const Storage = require('./storage');

/**
 * Classe responsável pela gestão de identidades e segurança.
 * Mantém os dados dos utilizadores em memória e sincroniza com o disco.
 */
class AuthModule {
  constructor() {
    this.storage = new Storage('users.json');
    // Carrega utilizadores para memória RAM na inicialização
    this.users = this.storage.load() || {};
  }

  /**
   * Gera um hash seguro da palavra-passe utilizando PBKDF2.
   * Utiliza um 'salt' para proteger contra ataques de Rainbow Table.
   * * @param {string} password - A senha em texto plano.
   * @param {string|null} [salt=null] - Salt existente (para verificação) ou null (para gerar novo).
   * @returns {object} - Objeto contendo { hash, salt }.
   */
  hashPassword(password, salt = null) {
    if (!salt) {
      // Gera um salt aleatório de 16 bytes se for um novo registo
      salt = crypto.randomBytes(16).toString('hex');
    }
    
    // PBKDF2: Password-Based Key Derivation Function 2
    // 10000 iterações com SHA-512 torna o processo lento propositadamente para dificultar brute-force
    const hash = crypto
      .pbkdf2Sync(password, salt, 10000, 64, 'sha512')
      .toString('hex');
    
    return { hash, salt };
  }

  /**
   * Verifica se uma palavra-passe corresponde ao hash armazenado.
   * Recria o hash usando o mesmo salt e compara os resultados.
   * * @param {string} password - Senha fornecida pelo utilizador.
   * @param {string} hash - Hash armazenado.
   * @param {string} salt - Salt armazenado.
   * @returns {boolean} - true se a senha estiver correta.
   */
  verifyPassword(password, hash, salt) {
    const { hash: newHash } = this.hashPassword(password, salt);
    return hash === newHash;
  }

  /**
   * Função híbrida: Regista um novo utilizador OU autentica um existente.
   * Se o nick já existe, tenta fazer login. Se não, cria conta.
   * * @param {string} nick - Identificador do utilizador.
   * @param {string} password - Password.
   * @returns {object} - { success: true } ou { error: string }.
   */
  register(nick, password) {
    // Cenário 1: Utilizador já existe (Tentativa de Login)
    if (this.users[nick]) {
      const user = this.users[nick];
      
      // Verifica se a password coincide
      if (this.verifyPassword(password, user.hash, user.salt)) {
        console.log(`[AUTH] User ${nick} verified successfully`);
        return { success: true };
      } else {
        console.log(`[AUTH] User ${nick} failed verification - wrong password`);
        // Erro específico para impedir roubo de nicks
        return { error: 'User registered with a different password' };
      }
    }
    
    // Cenário 2: Novo Utilizador (Registo)
    const { hash, salt } = this.hashPassword(password);
    
    this.users[nick] = {
      nick,
      hash,
      salt,
      registeredAt: new Date().toISOString()
    };
    
    // Persistir imediatamente no disco
    this.storage.save(this.users);
    
    console.log(`[AUTH] New user ${nick} registered`);
    return { success: true };
  }

  /**
   * Verifica estritamente as credenciais de um utilizador.
   * Usado para validar ações sensíveis (ex: entrar em jogos, jogar dados).
   * * @param {string} nick - Identificador.
   * @param {string} password - Password.
   * @returns {boolean} - true se as credenciais forem válidas.
   */
  authenticate(nick, password) {
    const user = this.users[nick];
    
    if (!user) {
      console.log(`[AUTH] Authentication failed - user ${nick} not found`);
      return false;
    }
    
    const valid = this.verifyPassword(password, user.hash, user.salt);
    
    if (valid) {
      console.log(`[AUTH] User ${nick} authenticated`);
    } else {
      console.log(`[AUTH] User ${nick} authentication failed - wrong password`);
    }
    
    return valid;
  }

  /**
   * Verifica simplesmente se um nome de utilizador já está registado.
   * @param {string} nick - Nick a verificar.
   * @returns {boolean}
   */
  userExists(nick) {
    return this.users[nick] !== undefined;
  }

  /**
   * Retorna dados públicos do utilizador (sanitize).
   * Remove dados sensíveis como hash e salt antes de enviar para o cliente.
   * * @param {string} nick - Nick do utilizador.
   * @returns {object|null} - Objeto seguro ou null.
   */
  getUserInfo(nick) {
    const user = this.users[nick];
    
    if (!user) return null;
    
    return {
      nick: user.nick,
      registeredAt: user.registeredAt
    };
  }

  /**
   * Lista todos os utilizadores registados (apenas dados públicos).
   * @returns {Array<object>} - Lista de utilizadores.
   */
  listUsers() {
    return Object.keys(this.users).map(nick => this.getUserInfo(nick));
  }
}

module.exports = AuthModule;