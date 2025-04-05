"use client";

import { useEffect, useState, useRef } from "react";
import GameCanvas from "./GameCanvas";
import GameControls from "./GameControls";
import GameEvents from "./GameEvents";
import TowerPlacementMenu from "./TowerPlacementMenu";
import WaveNotification from "./WaveNotification";
import Notification from "./Notification";
import { useGameContext } from "./GameContext";
import audioManager from "@/lib/game/audioManager";
import Minimap from "./Minimap";

const Game = () => {
  const { gameState, playerHealth, capturedCores, inventory } =
    useGameContext();
  // Initialize the ref here
  const sceneRef = useRef(null);
  const prevGameStateRef = useRef(gameState);

  // Handle escape key to show/hide instructions
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Handle game state changes to play appropriate music
  useEffect(() => {
    // Play appropriate music when game state changes
    if (gameState !== prevGameStateRef.current) {
      // Play transition sound
      audioManager.playGameSound("mode-switch");

      // Change background music based on game mode
      if (gameState === "dungeon") {
        audioManager.playDungeonMusic();
      } else if (gameState === "defense") {
        audioManager.playDefenseMusic();
      }

      prevGameStateRef.current = gameState;
    }
  }, [gameState]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const isFromPortal = urlParams.get("portal") === "true";

    if (isFromPortal) {
      // Switch to dungeon mode for portals
      setGameState("dungeon");

      // Play dungeon music immediately
      audioManager.playDungeonMusic();

      // Display welcome notification
      document.dispatchEvent(
        new CustomEvent("displayNotification", {
          detail: {
            message: "Welcome to DUM RUNNER!",
            type: "success",
          },
        })
      );

      // Get username if provided
      const username = urlParams.get("username");
      if (username) {
        document.dispatchEvent(
          new CustomEvent("displayNotification", {
            detail: {
              message: `Player ${username} has entered the grid!`,
              type: "info",
            },
          })
        );
      }
    }
  }, [gameState]);

  // Initialize audio when component mounts
  useEffect(() => {
    // Play menu music when game first loads
    handleStartGame();

    return () => {
      // Clean up audio when component unmounts
      audioManager.stopMusic();
    };
  }, []);

  // Hide instructions and start game
  const handleStartGame = () => {
    audioManager.playUI("click");

    // Switch to dungeon music when game starts
    audioManager.playDungeonMusic();
  };

  return (
    <div className="game-wrapper">
      {/* Main game canvas */}
      <GameCanvas sceneRef={sceneRef} />

      {/* Game events handler (no visible UI) */}
      <GameEvents />

      {/* Tower placement menu for defense mode */}
      <TowerPlacementMenu sceneRef={sceneRef} />

      {/* Wave notifications for defense mode */}
      <WaveNotification />

      {/* Game controls */}
      <GameControls />

      {/* Notifications */}
      <Notification />

      <Minimap />

      {/* Game status display */}
      <div id="info">
        <h1>DUM RUNNER</h1>
        <div id="gameState">
          Mode: {gameState === "dungeon" ? "Dum Run" : "Mainframe Defense"}
        </div>
        <div id="health">Health: {Math.floor(playerHealth)}</div>
        <div id="inventory">
          Cores: {capturedCores.length} | Scrap: {inventory.total}
          (E:{inventory.electronic} M:{inventory.metal} P:{inventory.energy})
        </div>
      </div>
    </div>
  );
};

export default Game;
