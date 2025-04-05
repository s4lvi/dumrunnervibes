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
import ESCOverlay from "./ESCOverlay"; // Import the new ESC overlay component
import "./CRTStyle.css"; // Import the CRT style

const Game = () => {
  const { gameState, playerHealth, capturedCores, inventory } =
    useGameContext();
  // Initialize the ref here
  const sceneRef = useRef(null);
  const prevGameStateRef = useRef(gameState);

  // Add state for ESC overlay
  const [showEscOverlay, setShowEscOverlay] = useState(false);

  // Init global escMenuOpen
  useEffect(() => {
    window.escMenuOpen = false;
  }, []);

  const openEscMenu = () => {
    setShowEscOverlay(true);
    window.escMenuOpen = true;

    // Dispatch pause event
    document.dispatchEvent(
      new CustomEvent("pauseGame", {
        detail: { paused: true },
      })
    );

    // Pause music
    audioManager.pauseMusic();
  };

  // Handle escape key to show/hide settings
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();

        if (showEscOverlay) {
          handleResumeGame();
        } else {
          openEscMenu();
        }
      }
    };

    const handlePointerUnlockForMenu = () => {
      openEscMenu();
    };

    document.addEventListener("openEscMenu", handlePointerUnlockForMenu);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener(
        "pointerlockchange",
        handlePointerUnlockForMenu
      );
    };
  }, [showEscOverlay]);

  const handleResumeGame = () => {
    setShowEscOverlay(false);
    window.escMenuOpen = false;

    // Dispatch unpause event
    document.dispatchEvent(
      new CustomEvent("pauseGame", {
        detail: { paused: false },
      })
    );

    // Resume music
    if (gameState === "dungeon") {
      audioManager.playDungeonMusic();
    } else if (gameState === "defense") {
      audioManager.playDefenseMusic();
    }

    // Add a slight delay before trying to re-lock pointer to avoid race conditions
    setTimeout(() => {
      // Try to re-lock pointer if we're in dungeon mode
      if (gameState === "dungeon") {
        const dungeonControls = window.dungeonController?.getControls();
        if (dungeonControls && !dungeonControls.isLocked) {
          dungeonControls.lock();
        }
      }
    }, 100);
  };
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
            message: "Welcome to DūM RUNNER!",
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
      {/* CRT Overlay effects - applies to the entire game */}
      <div className="crt-overlay">
        <div className="scan-line"></div>
        <div className="glow"></div>
      </div>

      {/* Main game canvas */}
      <GameCanvas sceneRef={sceneRef} escOverlayVisible={showEscOverlay} />

      {/* Game events handler (no visible UI) */}
      <GameEvents />

      {/* Tower placement menu for defense mode */}
      <TowerPlacementMenu sceneRef={sceneRef} />

      {/* Wave notifications for defense mode */}
      <WaveNotification />

      {/* Game controls */}
      <GameControls showSettings={() => setShowEscOverlay(true)} />

      {/* Notifications */}
      <Notification />

      <Minimap />

      {/* ESC Overlay */}
      <ESCOverlay isVisible={showEscOverlay} onClose={handleResumeGame} />

      {/* Game status display */}
      <div id="info">
        <h1>DūM RUNNER</h1>

        {gameState === "dungeon" ? (
          <>
            <div id="health">HEALTH: {Math.floor(playerHealth)}</div>
            <div id="shield">SHIELD: 0</div>
            <div id="weapon">WEAPON: BASIC LASER</div>
            <div id="ammo">AMMO: ∞</div>
            <div id="cores">CORES: {capturedCores.length}</div>
            <div id="scrap">
              SCRAP: {inventory.total} (E:{inventory.electronic} M:
              {inventory.metal} P:{inventory.energy})
            </div>
          </>
        ) : (
          <>
            <div id="health">MAINFRAME HEALTH: {Math.floor(playerHealth)}</div>
            <div id="cores">CORES: {capturedCores.length}</div>
            <div id="scrap">
              SCRAP: {inventory.total} (E:{inventory.electronic} M:
              {inventory.metal} P:{inventory.energy})
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Game;
