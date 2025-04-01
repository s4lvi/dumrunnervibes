"use client";

import React, { useEffect, useState } from "react";
import audioManager from "@/lib/game/audioManager";
import { useGameContext } from "./GameContext";

const WaveNotification = () => {
  const { gameState, setGameState } = useGameContext();
  const [showCountdown, setShowCountdown] = useState(false);
  const [countdownValue, setCountdownValue] = useState(3);
  const [showComplete, setShowComplete] = useState(false);
  const [completedWave, setCompletedWave] = useState(0);
  const [showModeTransition, setShowModeTransition] = useState(false);
  const [transitionTarget, setTransitionTarget] = useState(null);
  const [transitionButtonText, setTransitionButtonText] = useState("");
  const [waveInProgress, setWaveInProgress] = useState(false);

  useEffect(() => {
    // Handle wave countdown event
    const handleWaveCountdown = (event) => {
      const { seconds } = event.detail;
      setCountdownValue(seconds);
      setShowCountdown(true);

      // Play countdown start sound
      audioManager.playGameSound("wave-start");

      // Create a countdown timer
      let timeLeft = seconds;
      const countdownInterval = setInterval(() => {
        timeLeft -= 1;
        setCountdownValue(timeLeft);

        // Play tick sound for each second
        if (timeLeft > 0) {
          audioManager.playUI("click");
        } else {
          // Play "GO!" sound when countdown reaches zero
          audioManager.playGameSound("wave-start");
        }

        if (timeLeft <= 0) {
          clearInterval(countdownInterval);
          // Show "GO!" for half a second before hiding
          setTimeout(() => {
            setShowCountdown(false);
          }, 500);
        }
      }, 1000);

      // Cleanup interval if component unmounts during countdown
      return () => clearInterval(countdownInterval);
    };

    // Handle wave started event
    const handleWaveStarted = (event) => {
      setWaveInProgress(true);
    };

    // Handle wave complete event
    const handleWaveComplete = (event) => {
      const { waveNumber } = event.detail;
      setCompletedWave(waveNumber);
      setShowComplete(true);
      setWaveInProgress(false);

      // Play wave complete sound
      audioManager.playGameSound("wave-complete");

      // Hide any active mode transition notification
      setShowModeTransition(false);

      // Auto-hide after 30 seconds (increased for better user experience)
      setTimeout(() => {
        if (showComplete) {
          setShowComplete(false);
        }
      }, 30000);
    };

    // Handle mode transition button events
    const handleShowModeTransitionButton = (event) => {
      const { targetMode, buttonText } = event.detail;

      // If wave complete notification is showing, don't show this separate notification
      if (showComplete) {
        return;
      }

      setTransitionTarget(targetMode);
      setTransitionButtonText(
        buttonText ||
          (targetMode === "dungeon" ? "Enter the Grid" : "Return to Mainframe")
      );
      setShowModeTransition(true);

      // Auto-hide after 15 seconds if not clicked
      setTimeout(() => {
        setShowModeTransition(false);
      }, 15000);
    };

    document.addEventListener("waveCountdown", handleWaveCountdown);
    document.addEventListener("waveStarted", handleWaveStarted);
    document.addEventListener("waveComplete", handleWaveComplete);
    document.addEventListener(
      "showModeTransitionButton",
      handleShowModeTransitionButton
    );

    return () => {
      document.removeEventListener("waveCountdown", handleWaveCountdown);
      document.removeEventListener("waveStarted", handleWaveStarted);
      document.removeEventListener("waveComplete", handleWaveComplete);
      document.removeEventListener(
        "showModeTransitionButton",
        handleShowModeTransitionButton
      );
    };
  }, [showComplete]);

  // Handle starting the next wave after completion
  const handleStartNextWave = () => {
    // Cannot start a wave if one is already in progress
    if (waveInProgress) {
      // Display notification
      document.dispatchEvent(
        new CustomEvent("displayNotification", {
          detail: {
            message: "Cannot start wave: A wave is already in progress!",
            type: "error",
          },
        })
      );
      return;
    }

    // Play UI click sound
    audioManager.playUI("click");

    // Hide the completed wave notification
    setShowComplete(false);

    // Dispatch event to start the next wave
    document.dispatchEvent(
      new CustomEvent("startNextWave", {
        detail: { waveNumber: completedWave + 1 },
      })
    );

    // Set the wave in progress state
    setWaveInProgress(true);
  };

  // Handle entering the grid
  const handleEnterGrid = () => {
    // Play UI click sound
    audioManager.playUI("click");

    // Hide the notification
    setShowComplete(false);

    // Switch to dungeon mode
    document.dispatchEvent(
      new CustomEvent("switchMode", {
        detail: { mode: "dungeon" },
      })
    );
  };

  // Handle mode transition
  const handleModeTransition = () => {
    // Play UI click sound
    audioManager.playUI("click");

    // Hide the notification
    setShowModeTransition(false);
    setShowComplete(false);

    // Switch to the target mode
    document.dispatchEvent(
      new CustomEvent("switchMode", {
        detail: { mode: transitionTarget },
      })
    );
  };

  return (
    <>
      {showCountdown && (
        <div className="wave-notification">
          {countdownValue > 0 ? countdownValue : "GO!"}
        </div>
      )}

      {showComplete && (
        <div className="wave-notification wave-complete">
          <div>Wave {completedWave} Complete!</div>
          <div className="wave-buttons">
            <button
              onClick={handleStartNextWave}
              className="next-wave-button"
              onMouseEnter={() => audioManager.playUI("hover")}
              disabled={waveInProgress}
            >
              Start Next Wave
            </button>

            <button
              onClick={handleEnterGrid}
              className="grid-transition-button"
              onMouseEnter={() => audioManager.playUI("hover")}
            >
              Enter the Grid
            </button>
          </div>
        </div>
      )}

      {showModeTransition && !showComplete && (
        <div className="mode-transition-notification">
          <div className="transition-content">
            <button
              onClick={handleModeTransition}
              className="mode-transition-button"
              onMouseEnter={() => audioManager.playUI("hover")}
            >
              {transitionButtonText}
            </button>

            <button
              onClick={() => setShowModeTransition(false)}
              className="cancel-button"
              onMouseEnter={() => audioManager.playUI("hover")}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default WaveNotification;
