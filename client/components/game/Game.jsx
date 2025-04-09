"use client";

import { useEffect, useState, useRef } from "react";
import GameCanvas from "./GameCanvas";
import GameEvents from "./GameEvents";
import TowerPlacementMenu from "./TowerPlacementMenu";
import WaveNotification from "./WaveNotification";
import Notification from "./Notification";
import { useGameContext } from "./GameContext";
import audioManager from "@/lib/game/audioManager";
import ESCOverlay from "./ESCOverlay";
import CustomGameUI from "./CustomGameUI"; // Import our new UI component
import "./CRTStyle.css";

const Game = () => {
  const { gameState } = useGameContext();
  const sceneRef = useRef(null);
  const prevGameStateRef = useRef(gameState);
  const [showEscOverlay, setShowEscOverlay] = useState(false);

  // Init global escMenuOpen
  useEffect(() => {
    window.escMenuOpen = false;
  }, []);

  const openEscMenu = () => {
    // First, ensure pointer is unlocked if it's currently locked
    const dungeonControls = window.dungeonController?.getControls();
    if (dungeonControls && dungeonControls.isLocked) {
      dungeonControls.unlock();
    }

    setShowEscOverlay(true);
    window.escMenuOpen = true;

    // Dispatch pause event
    document.dispatchEvent(
      new CustomEvent("pauseGame", {
        detail: { paused: true },
      })
    );
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
    console.log("Resume game clicked - closing overlay");

    // First update state and global flag
    setShowEscOverlay(false);
    window.escMenuOpen = false;

    // Dispatch unpause event
    document.dispatchEvent(
      new CustomEvent("pauseGame", {
        detail: { paused: false },
      })
    );

    // Resume music based on game state
    if (gameState === "dungeon") {
      audioManager.playDungeonMusic();
    } else if (gameState === "defense") {
      audioManager.playDefenseMusic();
    }

    // Add a slightly longer delay before trying to re-lock pointer
    setTimeout(() => {
      console.log("Attempting to re-lock pointer after menu close");
      // Try to re-lock pointer if we're in dungeon mode
      if (gameState === "dungeon") {
        const dungeonControls = window.dungeonController?.getControls();
        if (dungeonControls && !dungeonControls.isLocked) {
          console.log("Calling lock() on dungeonControls");
          dungeonControls.lock();
        } else {
          console.log(
            "dungeonControls not available or already locked:",
            dungeonControls?.isLocked
          );
        }
      }
    }, 200); // Slightly longer delay to ensure menu is fully closed
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

      {/* Custom Game UI according to the new layout */}
      <CustomGameUI />

      {/* Notifications */}
      <Notification />

      {/* ESC Overlay */}
      <ESCOverlay isVisible={showEscOverlay} onClose={handleResumeGame} />
    </div>
  );
};

export default Game;
