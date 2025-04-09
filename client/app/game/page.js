"use client";

import Game from "@/components/game/Game";
import { GameProvider } from "@/components/game/GameContext";

export default function GamePage() {
  return (
    <main className="game-page">
      <GameProvider>
        <Game />
      </GameProvider>
    </main>
  );
}
