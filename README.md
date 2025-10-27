# 🎮 Game-Tab

**Game-Tab** is a modular web application built with HTML, CSS, and modern JavaScript (ES6 Modules).  
It provides an interactive game interface featuring a main game panel, rules, leaderboard, login box, and modular game logic separated across dedicated JS files.

---

## 📁 Project Structure

/project-root
├── index.html
├── style.css
├── /images
│ └── avatar.jpg
└── /js
├── app.js ← entry point (event listeners & initialization)
├── board.js ← board representation and game logic
├── ui.js ← UI rendering and DOM interaction
├── dice.js ← dice logic and visuals
├── ai.js ← AI logic (levels: random, capture-first, optional minimax)
└── storage.js ← localStorage management for leaderboard


---

## 🚀 How to Run

1. **Clone this repository** or copy the files to your local directory:
   ```bash
   git clone https://github.com/your-username/game-tab.git
   cd game-tab

2. Open the project in your browser:

Simply open the index.html file directly.

Make sure all folders (/js, /images, etc.) are in the same directory level as index.html.

3. (Recommended) Run a local server to use ES6 modules properly:

# Python 3
python3 -m http.server 8000

# or Node.js
npx serve .


Then open: http://localhost:8000

🧠 Module Overview
Module	Description
app.js	Main entry point. Initializes the game and sets up event listeners.
board.js	Manages the board data structure and game state.
ui.js	Handles DOM rendering, button actions, and visual updates.
dice.js	Controls dice logic and visual behavior.
ai.js	Provides different levels of AI (random, capture-first, minimax).
storage.js	Manages leaderboard persistence using the browser’s localStorage.
🖌️ User Interface

Responsive layout with animated background gradients.

Smooth CSS transitions and blur-glass panels.

Leaderboard and control panels styled with soft neon effects.

Retro console-inspired typography.

🧩 Features

✅ Animated gradient background

✅ Login and interactive control box

✅ Game panel ready for logic integration

✅ Local leaderboard with persistent storage

✅ Modular architecture for scalability (AI, board, dice, etc.)

🧱 Technologies Used

HTML5 – page structure

CSS3 – animations and visual styling

JavaScript (ES6 Modules) – modular game logic

LocalStorage API – persistent leaderboard storage

💡 Future Improvements

Implement full board rendering and dynamic piece placement

Add 3D or canvas-based dice animations

Introduce AI levels (random, capture-first, minimax)

Support local multiplayer mode

Save game history in localStorage

👨‍💻 Authors

Developers / Students – FCUP 2025

⚖️ License

This project is released under the MIT License, allowing free use, modification, and distribution with proper attribution.


---

Would you like me to make a **version adapted for academic submission** (with title page, authors, course name, etc.), or keep it purely **GitHub-style technical** like this one?
