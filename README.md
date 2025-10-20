<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Game-tab</title>
  <style>
    .main-content {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
}

.left-column {
  width: 60%; /* 可以调整 */
}

.right-column {
  width: 27%; /* 可以调整 */
}
     .img {
    width: 500px;
    height: 300px;
    border: 2px solid white;
    display: block;
  }
    @keyframes gradientAnimation {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

body {
  background: linear-gradient(-45deg, #ee7752, #e73c7e, #23a6d5, #23d5ab);
  background-size: 400% 400%;
  animation: gradientAnimation 15s ease infinite;
  color: white;
  padding: 20px;
}
    

    @keyframes titleAnimation {
      0% {
        color: #ff4d4f;
        font-family: 'Courier New', Courier, monospace;
      }
      25% {
        color: #ffa940;
        font-family: 'Courier New', Courier, monospace;
      }
      50% {
        color: #52c41a;
        font-family: 'Courier New', Courier, monospace;
      }
      75% {
        color: #1890ff;
        font-family: 'Courier New', Courier, monospace;
      }
      100% {
        color: #ff4d4f;
        font-family: 'Courier New', Courier, monospace;
      }
    }

    .animated-title {
      animation: titleAnimation 10s infinite;
      font-size: 48px;
      text-align: center;
      padding: 20px;
      background-color: black;
      color:white;
      margin:0;
    }
    .title-container {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      white-space: nowrap;
    }
    @keyframes flyIn {
      from {
        transform: translateX(-100px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }

    .avatar {
      width: 180px;
      height: 180px;
      border-radius: 50%;
      object-fit: cover;
      animation: flyIn 2s ease-out forwards;
      flex-shrink:0;
    }
     .section {
      width: 30%;
      margin: 20px;
    }

    .rules {
      font-family: 'Courier New', Courier, monospace;
      font-size: 16px;
      font-weight: bold;
      line-height: 1.6;
    }

   
     .comando-box {
      border: 2px solid white;
      border-radius: 10px;
      padding: 20px;
      width: 350px;
      background-color: rgba(0, 0, 0, 0.3);
      color: white;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
      margin-top: 20px;
    }
    .comando-box h2 {
      font-size: 22px;
      margin-bottom: 15px;
    }

    .comando-box ul {
      list-style: none;
      padding: 0;
    }

    .comando-box li {
      background-color: rgba(255, 255, 255, 0.1);
      padding: 10px;
      margin-bottom: 10px;
      border-radius: 5px;
      transition: background 0.3s;
      cursor: pointer;
    }

    .comando-box li:hover {
      background-color: rgba(255, 255, 255, 0.25);
    }
      .game-panel {
  position: absolute; 
  top: 73%; left: 50.2%; 
  transform: translate(-50%, -50%);
  margin: 30px auto;
  width: 590px;
  height: 500px;
  background: rgba(255, 255, 255, 0.1); 
  backdrop-filter: blur(10px); 
  border: 2px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 8px 32px 0 rgba(32, 39, 138, 0.37);
  border-radius: 15px;
  padding: 30px;
  text-align: center;
  color: white;
  font-family: 'Courier New', Courier, monospace;
  z-index: 900;
  animation: fadeIn 2s ease forwards;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translate(-50%, -60%);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -50%);
  }
}
  </style>
</head>

<body>
    <div class="animated-title title-container">
    <span><b>Welcome to the Game-Tâb!</b></span>
    <img class="avatar" src="C:\Users\86133\Desktop\game\微信图片_20251013222604_13_5.jpg" alt="Avatar">
    </div>
<div class="main-content">
   <div class="left-column">
    <!-- Game Rules -->
     <div class="comando-box">
       <h1><b>Game rules</b></h1>
       <ul class="rules">
         <li>🎮 A 2-player game on a 4-column board with 7–15 rows</li>
         <li>🧍 Each player starts with 4 pieces in their row</li>
         <li>🎲 Movement is based on throwing 4 two-sided sticks</li>
         <li>🎯 Goal: move pieces forward and capture opponent’s pieces</li>
       
       </ul>
     </div>

    <!-- Configuração -->
     <div class="comando-box">
       <h1>⚙️ Configuração</h1>
       <p>Aqui você pode definir as opções do jogo, como:</p>
       <ul>
         <li>1.Tamanho do tabuleiro</li>
         <li>2.Nível da inteligência  artificial</li>
         <li>3.⏭️ JOGADOR VS COMPUTADOR</li>
         <li>4.▶️ JOGADOR VS JOGADOR</li>
       </ul>
     </div>
    </div>


    <div class="right-column">
    <!-- Comandos -->
     <div class="comando-box">
       <h2>🕹️ Comandos</h2>
       <ul>
         <li>📖 ESCOLHER UM MODO</li>
         <li>▶️ JOGADOR VS JOGADOR</li>
         <li>⏭️ JOGADOR VS COMPUTADOR</li>
         <li>🏳️ Desistir do jogo</li>
         <li>📊 Visualizar as classificações</li>
       </ul>
     </div>
     <div class="comando-box">
        <input type="text" placeholder="Username">
        <input type="password" placeholder="Password">
        <button>Login</button>
     </div>
    </div>
</div>


<!---the game board part-->
   <div class="game-panel">
     <h1>🧩 Game Panel</h1>
     <p>Prepare to play!</p>
   </div>
