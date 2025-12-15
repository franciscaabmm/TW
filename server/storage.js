// ============================================
// STORAGE.JS - Módulo de Persistência
// ============================================
// Este módulo encapsula as operações de sistema de ficheiros (fs)
// para salvar e carregar dados em formato JSON de forma síncrona.
// ============================================

const fs = require('fs');
const path = require('path');

/**
 * Classe responsável pela gestão de persistência de dados em ficheiro.
 */
class Storage {
  /**
   * Inicializa a instância de armazenamento.
   * Define o caminho do ficheiro e garante que o diretório de dados existe.
   * * @param {string} filename - O nome do ficheiro (ex: 'users.json').
   */
  constructor(filename) {
    // Define o diretório '../data' relativo à localização deste script
    this.dataDir = path.join(__dirname, '..', 'data');
    this.filepath = path.join(this.dataDir, filename);
    
    // Criar diretório 'data' se não existir (evita erros ao tentar escrever o ficheiro)
    if (!fs.existsSync(this.dataDir)) {
      // 'recursive: true' permite criar subdiretórios se necessário
      fs.mkdirSync(this.dataDir, { recursive: true });
      console.log(`[STORAGE] Created data directory: ${this.dataDir}`);
    }
  }

  /**
   * Carrega e converte os dados do ficheiro JSON para um objeto JavaScript.
   * Utiliza leitura síncrona.
   * * @returns {object|null} - O objeto com os dados carregados ou null se o ficheiro não existir ou ocorrer erro.
   */
  load() {
    try {
      // Verifica a existência antes de tentar ler para evitar lançar exceção imediata
      if (!fs.existsSync(this.filepath)) {
        console.log(`[STORAGE] File ${this.filepath} does not exist, returning null`);
        return null;
      }
      
      // Lê o ficheiro com codificação UTF-8
      const data = fs.readFileSync(this.filepath, 'utf8');
      
      // Faz o parsing da string JSON para objeto
      const parsed = JSON.parse(data);
      
      console.log(`[STORAGE] Loaded data from ${this.filepath}`);
      return parsed;
      
    } catch (error) {
      // Captura erros de leitura (IO) ou de parsing (JSON inválido)
      console.error(`[STORAGE] Error loading ${this.filepath}:`, error.message);
      return null;
    }
  }

  /**
   * Guarda um objeto JavaScript no ficheiro em formato JSON.
   * Sobrescreve o conteúdo anterior.
   * * @param {object} data - O objeto ou dados a persistir.
   * @returns {boolean} - Retorna true se a operação for bem-sucedida, false em caso de erro.
   */
  save(data) {
    try {
      // Serializa o objeto para string JSON com indentação de 2 espaços (pretty print)
      const json = JSON.stringify(data, null, 2);
      
      // Escreve no disco (flag 'w' padrão para sobrescrever)
      fs.writeFileSync(this.filepath, json, 'utf8');
      
      console.log(`[STORAGE] Saved data to ${this.filepath}`);
      return true;
      
    } catch (error) {
      console.error(`[STORAGE] Error saving ${this.filepath}:`, error.message);
      return false;
    }
  }

  /**
   * Verifica se o ficheiro de armazenamento já existe no disco.
   * * @returns {boolean} - true se existir, false caso contrário.
   */
  exists() {
    return fs.existsSync(this.filepath);
  }

  /**
   * Apaga o ficheiro de armazenamento permanentemente.
   * * @returns {boolean} - true se apagado com sucesso, false se não existir ou ocorrer erro.
   */
  delete() {
    try {
      if (fs.existsSync(this.filepath)) {
        fs.unlinkSync(this.filepath);
        console.log(`[STORAGE] Deleted ${this.filepath}`);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`[STORAGE] Error deleting ${this.filepath}:`, error.message);
      return false;
    }
  }

  /**
   * Cria uma cópia de segurança do ficheiro atual.
   * O nome do backup inclui um carimbo de data/hora (timestamp).
   * * @returns {boolean} - true se o backup for criado com sucesso.
   */
  backup() {
    try {
      if (!fs.existsSync(this.filepath)) {
        return false;
      }
      
      // Gera timestamp seguro para nomes de ficheiros (substitui ':' por '-')
      const timestamp = new Date().toISOString().replace(/:/g, '-');
      const backupPath = `${this.filepath}.${timestamp}.backup`;
      
      // Copia o ficheiro
      fs.copyFileSync(this.filepath, backupPath);
      console.log(`[STORAGE] Backup created: ${backupPath}`);
      
      return true;
    } catch (error) {
      console.error(`[STORAGE] Error creating backup:`, error.message);
      return false;
    }
  }

  /**
   * Obtém o caminho absoluto do ficheiro gerido por esta instância.
   * * @returns {string} - O caminho completo do ficheiro.
   */
  getPath() {
    return this.filepath;
  }
}

module.exports = Storage;