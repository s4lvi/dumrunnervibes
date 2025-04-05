"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import audioManager from "@/lib/game/audioManager";

const ESCOverlay = ({ isVisible, onClose }) => {
  // Stop mouse/keyboard events from reaching the game
  useEffect(() => {
    const preventDefaultForEvents = (e) => {
      if (isVisible) {
        if (e.key !== "Escape") {
          e.stopPropagation();
        }
      }
    };

    // Function to prevent clicks when overlay is visible
    const handleSceneClick = (e) => {
      if (isVisible) {
        e.stopPropagation();
        e.preventDefault();
      }
    };

    // Add event listeners to prevent events reaching the game while overlay is visible
    window.addEventListener("mousedown", handleSceneClick, true);
    window.addEventListener("mouseup", handleSceneClick, true);
    window.addEventListener("keydown", preventDefaultForEvents, true);
    window.addEventListener("keyup", preventDefaultForEvents, true);

    return () => {
      window.removeEventListener("mousedown", handleSceneClick, true);
      window.removeEventListener("mouseup", handleSceneClick, true);
      window.removeEventListener("keydown", preventDefaultForEvents, true);
      window.removeEventListener("keyup", preventDefaultForEvents, true);
    };
  }, [isVisible]);

  // Audio settings state
  const [musicVolume, setMusicVolume] = useState(
    audioManager.getMusicVolume() * 100
  );
  const [sfxVolume, setSfxVolume] = useState(audioManager.getSfxVolume() * 100);
  const [masterVolume, setMasterVolume] = useState(
    audioManager.getMasterVolume() * 100
  );
  const [isMuted, setIsMuted] = useState(audioManager.isMuted());

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

  // Apply audio settings and close
  const handleResumeGame = () => {
    audioManager.playUI("click");
    onClose();
  };

  if (!isVisible) return null;

  return (
    <div className="esc-overlay" onClick={(e) => e.stopPropagation()}>
      <div className="esc-content" onClick={(e) => e.stopPropagation()}>
        <h2>DūM RUNNER - PAUSED</h2>

        <div className="settings-section">
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
        </div>

        <div className="esc-buttons">
          <button
            onClick={handleResumeGame}
            onMouseEnter={() => audioManager.playUI("hover")}
          >
            Resume Game
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
  );
};

export default ESCOverlay;
