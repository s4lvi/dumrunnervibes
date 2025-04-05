"use client";

import { useGameContext } from "./GameContext";
import { useState, useEffect } from "react";
import audioManager from "@/lib/game/audioManager";
import MapSelector from "./MapSelector";

const GameControls = ({ showSettings }) => {
  const { gameState, setGameState } = useGameContext();
  const [showMapSelector, setShowMapSelector] = useState(false);
  const [currentWave, setCurrentWave] = useState(0);
  // New state to track if mode switching is allowed
  const [canSwitchMode, setCanSwitchMode] = useState(true);

  // Subscribe to wave updates
  useEffect(() => {
    const handleWaveStarted = (event) => {
      setCurrentWave(event.detail.waveNumber);
      // Disable mode switching when wave starts
      setCanSwitchMode(false);
    };

    const handleWaveComplete = () => {
      // Enable mode switching when wave completes
      setCanSwitchMode(true);
    };

    const handleAllRobotsDefeated = () => {
      // Enable mode switching when all robots are defeated
      setCanSwitchMode(true);
    };

    document.addEventListener("waveStarted", handleWaveStarted);
    document.addEventListener("waveComplete", handleWaveComplete);
    document.addEventListener("allRobotsDefeated", handleAllRobotsDefeated);

    return () => {
      document.removeEventListener("waveStarted", handleWaveStarted);
      document.removeEventListener("waveComplete", handleWaveComplete);
      document.removeEventListener(
        "allRobotsDefeated",
        handleAllRobotsDefeated
      );
    };
  }, []);

  // Switch to dungeon mode
  const switchToGridMode = () => {
    if (gameState === "defense" && canSwitchMode) {
      // Play UI sound
      audioManager.playUI("click");

      // Dispatch a custom event that our game modules will listen for
      document.dispatchEvent(
        new CustomEvent("switchMode", {
          detail: { mode: "dungeon" },
        })
      );
      setGameState("dungeon");

      // Show notification
      document.dispatchEvent(
        new CustomEvent("displayNotification", {
          detail: {
            message: "Entering the Grid...",
            type: "info",
          },
        })
      );
    } else if (!canSwitchMode) {
      // Play error sound
      audioManager.playUI("back");

      // Show notification
      document.dispatchEvent(
        new CustomEvent("displayNotification", {
          detail: {
            message: "Cannot switch modes during active wave!",
            type: "error",
          },
        })
      );
    }
  };

  // Switch to defense mode
  const switchToMainframeMode = () => {
    if (gameState === "dungeon" && canSwitchMode) {
      // Play UI sound
      audioManager.playUI("click");

      // Dispatch a custom event that our game modules will listen for
      document.dispatchEvent(
        new CustomEvent("switchMode", {
          detail: { mode: "defense" },
        })
      );
      setGameState("defense");

      // Show notification
      document.dispatchEvent(
        new CustomEvent("displayNotification", {
          detail: {
            message: "Returning to Mainframe...",
            type: "info",
          },
        })
      );
    } else if (!canSwitchMode) {
      // Play error sound
      audioManager.playUI("back");

      // Show notification
      document.dispatchEvent(
        new CustomEvent("displayNotification", {
          detail: {
            message: "Defeat all robots before returning to Mainframe!",
            type: "error",
          },
        })
      );
    }
  };

  // Start next wave (defense mode)
  const startNextWave = () => {
    if (gameState === "defense") {
      audioManager.playGameSound("wave-start");
      document.dispatchEvent(
        new CustomEvent("startNextWave", {
          detail: { waveNumber: currentWave + 1 },
        })
      );
    }
  };

  // Toggle map selector
  const toggleMapSelector = () => {
    audioManager.playUI("click");
    setShowMapSelector((prev) => !prev);
  };

  // Handle map selection
  const handleMapSelected = (map) => {
    // Dispatch event for defense mode to handle map change
    document.dispatchEvent(
      new CustomEvent("changeMap", {
        detail: { mapId: map.id },
      })
    );
  };

  return (
    <>
      {/* Map selector */}
      {showMapSelector && gameState === "defense" && (
        <MapSelector
          onMapSelected={handleMapSelected}
          onClose={toggleMapSelector}
        />
      )}
    </>
  );
};

export default GameControls;
