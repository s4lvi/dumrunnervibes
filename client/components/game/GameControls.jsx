"use client";

import { useGameContext } from "./GameContext";
import { useState, useEffect } from "react";
import Link from "next/link";
import audioManager from "@/lib/game/audioManager";
import MapSelector from "./MapSelector";

const GameControls = () => {
  const { gameState, setGameState } = useGameContext();
  const [showSettings, setShowSettings] = useState(false);
  const [showMapSelector, setShowMapSelector] = useState(false);
  const [currentWave, setCurrentWave] = useState(0);
  // New state to track if mode switching is allowed
  const [canSwitchMode, setCanSwitchMode] = useState(true);

  // Audio settings state
  const [musicVolume, setMusicVolume] = useState(
    audioManager.getMusicVolume() * 100
  );
  const [sfxVolume, setSfxVolume] = useState(audioManager.getSfxVolume() * 100);
  const [masterVolume, setMasterVolume] = useState(
    audioManager.getMasterVolume() * 100
  );
  const [isMuted, setIsMuted] = useState(audioManager.isMuted());

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

  // Toggle settings menu
  const toggleSettings = () => {
    audioManager.playUI("click");
    setShowSettings((prev) => !prev);
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

  // Handle volume changes
  const handleMusicVolumeChange = (e) => {
    const value = parseInt(e.target.value);
    setMusicVolume(value);
    audioManager.setMusicVolume(value / 100);
  };

  const handleSfxVolumeChange = (e) => {
    const value = parseInt(e.target.value);
    setSfxVolume(value);
    audioManager.setSfxVolume(value / 100);

    // Play sample sound to test volume
    if (value % 10 === 0) {
      audioManager.playUI("click");
    }
  };

  const handleMasterVolumeChange = (e) => {
    const value = parseInt(e.target.value);
    setMasterVolume(value);
    audioManager.setMasterVolume(value / 100);
  };

  const handleToggleMute = () => {
    const newMuted = audioManager.toggleMute();
    setIsMuted(newMuted);
    audioManager.playUI("click");
  };

  // Apply audio settings
  const applySettings = () => {
    audioManager.playUI("click");
    toggleSettings();
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
      {/* Mode switcher */}
      <div id="mode-switcher">
        <button
          onClick={switchToGridMode}
          className={gameState === "dungeon" ? "active" : ""}
          onMouseEnter={() => audioManager.playUI("hover")}
          disabled={gameState === "dungeon" || !canSwitchMode}
        >
          Grid Mode
        </button>
        <button
          onClick={switchToMainframeMode}
          className={gameState === "defense" ? "active" : ""}
          onMouseEnter={() => audioManager.playUI("hover")}
          disabled={gameState === "defense" || !canSwitchMode}
        >
          Mainframe Mode
        </button>
        {gameState === "defense" && (
          <>
            <button
              onClick={startNextWave}
              onMouseEnter={() => audioManager.playUI("hover")}
            >
              Start Wave {currentWave + 1}
            </button>
            <button
              onClick={toggleMapSelector}
              onMouseEnter={() => audioManager.playUI("hover")}
              disabled={!canSwitchMode}
            >
              🗺️ Maps
            </button>
          </>
        )}
        <button
          onClick={toggleSettings}
          onMouseEnter={() => audioManager.playUI("hover")}
        >
          ⚙️ Settings
        </button>
      </div>

      {/* Settings menu (shown when toggleSettings is true) */}
      {showSettings && (
        <div className="settings-menu">
          <div className="settings-content">
            <h3>Settings</h3>

            {/* Master Volume */}
            <div className="setting-option">
              <label>Master Volume</label>
              <input
                type="range"
                min="0"
                max="100"
                value={masterVolume}
                onChange={handleMasterVolumeChange}
              />
              <span>{masterVolume}%</span>
            </div>

            {/* Music Volume */}
            <div className="setting-option">
              <label>Music Volume</label>
              <input
                type="range"
                min="0"
                max="100"
                value={musicVolume}
                onChange={handleMusicVolumeChange}
              />
              <span>{musicVolume}%</span>
            </div>

            {/* SFX Volume */}
            <div className="setting-option">
              <label>SFX Volume</label>
              <input
                type="range"
                min="0"
                max="100"
                value={sfxVolume}
                onChange={handleSfxVolumeChange}
              />
              <span>{sfxVolume}%</span>
            </div>

            {/* Mute Toggle */}
            <div className="setting-option">
              <label>Mute All Sound</label>
              <input
                type="checkbox"
                checked={isMuted}
                onChange={handleToggleMute}
              />
            </div>

            <div className="setting-option">
              <label>Graphics Quality</label>
              <select defaultValue="medium">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            <div className="setting-buttons">
              <button
                onClick={applySettings}
                onMouseEnter={() => audioManager.playUI("hover")}
              >
                Apply
              </button>
              <Link href="/">
                <button
                  className="exit-button"
                  onMouseEnter={() => audioManager.playUI("hover")}
                  onClick={() => audioManager.playUI("back")}
                >
                  Exit to Menu
                </button>
              </Link>
            </div>
          </div>
        </div>
      )}

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
