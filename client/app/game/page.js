"use client";

import Game from "@/components/game/Game";
import { GameProvider } from "@/components/game/GameContext";

export default function GamePage() {
  return (
    <main className="game-page">
      <GameProvider>
        <Game />
      </GameProvider>
      {/* Added external link */}
      <a
        target="_blank"
        href="https://jam.pieter.com"
        style={{
          fontFamily: "system-ui, sans-serif",
          position: "fixed",
          bottom: "-1px",
          right: "-1px",
          padding: "7px",
          fontSize: "14px",
          fontWeight: "bold",
          background: "#fff",
          color: "#000",
          textDecoration: "none",
          zIndex: 10000,
          borderTopLeftRadius: "12px",
          border: "1px solid #fff",
        }}
      >
        🕹️ Vibe Jam 2025
      </a>
    </main>
  );
}
