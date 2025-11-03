# Jogo Tâb - Primeira Entrega

Implementação completa do jogo tradicional Tâb em JavaScript vanilla, HTML e CSS, seguindo o enunciado da primeira entrega.

## 📁 Estrutura de Ficheiros

A estrutura de ficheiros real do projeto é a seguinte:

projeto/ ├── index.html (O HTML principal da aplicação) ├── style.css (A folha de estilos principal) ├── js/ │ └── app.js (JavaScript principal com a lógica do jogo) └── images/ └── tab.jpg (Imagem do logotipo usada no header)


## 🚀 Instalação

1.  **Cria a estrutura de pastas** conforme indicado acima.
2.  **Guarda os ficheiros** `index.html`, `style.css`, `js/app.js` e `images/tab.jpg` nas suas respetivas localizações.
3.  **Abre o `index.html`** num navegador moderno (Chrome, Firefox, Edge, Safari).

## ✅ Funcionalidades Implementadas

### Áreas da Interface (Conforme Código)

-   ✅ **Logotipo**: Título destacado (`.animated-title`) no `index.html`.
-   ✅ **Configuração**: Opções estáticas no `index.html` (Tamanho, Nível IA, Primeiro Jogador) que são lidas e tratadas pela classe `GameUI` em `app.js`.
-   ✅ **Comandos**: Botões estáticos (Escolher modo, Desistir, Ver classificações) e dinâmicos (Iniciar, Passar, Novo Jogo) gerados pelo `app.js`.
-   ✅ **Identificação**: Formulário de login estático no `index.html`. O `app.js` interceta o clique e mostra uma mensagem (pronto para 2ª entrega).
-   ✅ **Dado de Paus**: Com probabilidades corretas (implementado em `TabGame.rollDice()`) e visualização no painel de jogo.
-   ✅ **Tabuleiro**: Gerado dinamicamente via JavaScript/DOM (método `GameUI.renderBoardGrid()`).
-   ✅ **Instruções**: Regras estáticas do jogo visíveis no `index.html`.
-   ✅ **Classificações**: Sistema de rankings dinâmico (`GameUI.showRankings()`) que usa `localStorage` (o leaderboard estático no `index.html` é apenas um placeholder).
-   ✅ **Mensagens**: Feedback constante via `GameUI.showMessage()` (notificações "toast").

### Mecânicas do Jogo

-   ✅ **Movimento das Peças**:
    -   Linhas 0 e 2: esquerda → direita
    -   Linhas 1 e 3: direita → esquerda
    -   (Isto aplica-se de forma oposta para o Jogador 2, conforme `calculateNewPosition`).
    -   Primeira jogada só com valor 1 (implementado em `isValidMove`).
    -   Progressão correta entre filas.

-   ✅ **Dado de Paus**:
    -   Valor 1 (Tâb): 25% - Repete jogada
    -   Valor 2 (Itneyn): 38% - Normal
    -   Valor 3 (Teláteh): 25% - Normal
    -   Valor 4 (Arba'ah): 6% - Repete jogada
    -   Valor 6 (Sitteh): 6% - Repete jogada

-   ✅ **Restrições**:
    -   Uma peça por casa.
    -   Captura de peças adversárias (removendo-as do array `playerPieces`).
    -   Peças dão a volta ao tabuleiro (loop contínuo) quando chegam ao fim da linha 3 (P1) ou linha 0 (P2).

-   ✅ **Fim de Jogo**:
    -   Vitória ao capturar todas as peças adversárias (`player1Pieces.length === 0`).
    -   Vitória ao ter todas as peças na linha "topo" (`every(piece => piece.reachedTop)`).
    -   Opção de desistir (`forfeitGame`).
    -   Passar vez quando não há jogadas válidas.

### Modos de Jogo

-   ✅ **Jogador vs Computador (IA)**: Modo 'ai' funcional.
-   ✅ **Jogador vs Jogador (Local)**: Modo 'pvp' funcional (o jogo simplesmente troca de turno sem chamar `aiTurn()`).

### Inteligência Artificial

-   ✅ **Nível Fácil**: Escolha totalmente aleatória.
-   ✅ **Nível Médio**: 50% aleatório, 50% preferência por capturas.
-   ✅ **Nível Difícil**: Sempre prefere capturas quando possível.

### Estrutura Orientada a Objetos

O `app.js` está estruturado em classes:

```javascript
// Classe Piece - Representa uma peça
class Piece {
  constructor(id, player, row, col)
  // Propriedades: moved, reachedTop
}

// Classe TabGame - Lógica principal do jogo
class TabGame {
  initializeBoard()
  rollDice()
  calculateNewPosition()
  isValidMove()
  movePiece()
  makeAIMove()
  checkWinner()
  saveRanking()
  // ...
}

// Classe GameUI - Gestão da Interface
class GameUI {
  renderBoard()
  handleCellClick()
  showMessage()
  aiTurn()
  switchTurn()
  showRankings()
  // ...
}
🎮 Como Jogar
Configurar o Jogo:

Na coluna da esquerda ("⚙️ Settings"), clica nas opções para definir o Tamanho do Tabuleiro (7, 9, 11), Nível da IA e Quem Joga Primeiro.

Iniciar o Jogo:

Na coluna da direita ("🕹️ Commands"), clica em "📖 Choose a mode".

No painel central, seleciona "Player vs Computer" ou "Player vs Player".

Clica em "▶️ Start Game".

Jogar:

Clica no dado (🎲) para lançar.

Clica na tua peça que queres mover.

A peça move-se automaticamente.

Se saíres 1, 4 ou 6, jogas novamente.

Objetivo:

Captura todas as peças do adversário OU leva todas as tuas peças até à linha oposta.

🔧 Validações HTML e CSS
Para validar os ficheiros:

HTML: W3C HTML Validator

CSS: W3C CSS Validator

💾 Armazenamento Local
O jogo usa localStorage (chave tabRankings) para guardar:

Histórico dos últimos 10 jogos (vencedor, modo, data, tamanho).

📱 Responsividade
O style.css inclui media queries para adaptar o layout:

Desktop: Layout completo com colunas laterais (left-column e right-column).

Tablet/Mobile (max-width: 768px): As colunas passam para flex-direction: column, ocupando 100% da largura (layout em coluna única).

🐛 Debugging
O jogo inclui logs no console para monitorização:

JavaScript

console.log('🎮 Tâb game loaded!');
console.log('[TAB GAME] Mensagens do jogo...'); // (Exibido por showMessage)
Abre as Ferramentas de Programador (F12) para ver os logs.

📋 Checklist do Enunciado
[x] Aplicação de página única (SPA)

[x] CSS em ficheiro separado (style.css)

[x] JavaScript em ficheiro separado (js/app.js)

[x] Logotipo destacado

[x] Área de configuração (via cliques em li estáticos)

[x] Comandos (iniciar, passar, desistir, ver classificações)

[x] Área de identificação (formulário HTML pronto)

[x] Dado de paus funcional

[x] Tabuleiro gerado via JavaScript/DOM

[x] Diferentes modos de interação (PvP e PvC implementados)

[x] Instruções das regras

[x] Sistema de classificações (com localStorage)

[x] Mensagens durante o jogo

[x] IA com diferentes níveis

[x] Abordagem orientada a objetos (Classes Piece, TabGame, GameUI)

🎯 Próximos Passos (2ª Entrega)
[ ] Autenticação de utilizadores (ligar o formulário a um backend)

[ ] Comunicação com servidor

[ ] Rankings online (substituir localStorage por fetch/API)

[ ] Histórico de jogos (guardar no servidor)

📝 Notas Técnicas
JavaScript: ES6+ (Classes, Arrow Functions, Template Literals)

DOM: Manipulação dinâmica do .game-panel

Event Listeners: Gestão de cliques (delegação e adição dinâmica)

LocalStorage: Persistência de dados de ranking

CSS: Animações, transições e layout responsivo com Flexbox

⚠️ Requisitos
Navegador moderno com suporte a ES6

JavaScript ativado

LocalStorage disponível
