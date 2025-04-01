"use client";

import { useEffect } from "react";
import { useGameContext } from "./GameContext";
import { useRouter } from "next/navigation";
import audioManager from "@/lib/game/audioManager";
// GameEvents.jsx update
const GameEvents = () => {
  const {
    setGameState,
    setCapturedCores,
    setPlayerHealth,
    setInventory,
    setPlacedTurrets,
    placedTurrets,
    gameState,
  } = useGameContext();

  const router = useRouter();

  useEffect(() => {
    // Handle dungeon mode events
    const handleUpdateDungeonUI = (event) => {
      const { health, inventory, cores } = event.detail;

      if (health) setPlayerHealth(health);
      if (inventory) setInventory(inventory);
      if (cores) setCapturedCores(cores);
    };

    const handleUpdateHealth = (event) => {
      const prevHealth = event.detail.prevHealth || 100;
      const newHealth = event.detail.health;

      // Play damage sound if health decreased significantly
      if (newHealth < prevHealth - 5) {
        audioManager.playPlayerSound("hit");
      }

      setPlayerHealth(newHealth);
    };

    const handleUpdateInventory = (event) => {
      setInventory(event.detail.inventory);
    };

    const handleRobotCaptured = (event) => {
      const { cores } = event.detail;

      // Play core collection sound
      audioManager.playCollectSound("core");

      setCapturedCores(cores);
    };

    const handleAllRobotsDefeated = () => {
      // Play victory sound
      audioManager.playGameSound("wave-complete");

      // Create a custom dialog instead of using native confirm
      document.dispatchEvent(
        new CustomEvent("displayNotification", {
          detail: {
            message:
              "All robots defeated! Option to return to Mainframe unlocked.",
            type: "success",
            duration: 5000,
          },
        })
      );

      // Display a modal/button for the player to return to Mainframe (defense mode)
      document.dispatchEvent(
        new CustomEvent("showModeTransitionButton", {
          detail: {
            targetMode: "defense",
            buttonText: "Return to Mainframe",
          },
        })
      );
    };

    // Handle defense mode events
    const handleUpdateDefenseUI = (event) => {
      const { baseHealth, coresCount } = event.detail;

      if (baseHealth) setPlayerHealth(baseHealth);
    };

    const handleUpdateBaseHealth = (event) => {
      const { health, prevHealth } = event.detail;

      // Play base hit sound if health decreased
      if (prevHealth && health < prevHealth) {
        audioManager.playGameSound("base-hit");
      }

      setPlayerHealth(health);
    };

    const handleUpdateCores = (event) => {
      setCapturedCores(event.detail);
    };

    const handleUpdatePlacedTurrets = (event) => {
      setPlacedTurrets(event.detail);
    };

    const handleWaveStarted = (event) => {
      console.log(`Wave ${event.detail.waveNumber} started!`);

      // Play wave start sound
      audioManager.playGameSound("wave-start");
    };

    const handleWaveComplete = (event) => {
      console.log(`Wave ${event.detail.waveNumber} completed!`);

      // Play wave complete sound
      audioManager.playGameSound("wave-complete");

      // Display a notification that the player can now enter the Grid
      document.dispatchEvent(
        new CustomEvent("displayNotification", {
          detail: {
            message: "Wave completed! Option to enter the Grid unlocked.",
            type: "success",
            duration: 5000,
          },
        })
      );
    };

    const handleSwitchMode = (event) => {
      const { mode } = event.detail;
      setGameState(mode);
    };

    const handleGameOver = (event) => {
      // Play game over sound
      audioManager.playGameSound("game-over");

      alert(`Game Over! ${event.detail.reason}`);

      // After user acknowledges, switch back to grid mode
      setTimeout(() => {
        setGameState("dungeon");
      }, 500);
    };

    // Handle returned cores from map changes
    const handleReturnedCores = (event) => {
      const { returnedCores } = event.detail;

      if (returnedCores && returnedCores.length > 0) {
        // Add the returned cores to the existing cores
        setCapturedCores((prevCores) => [...prevCores, ...returnedCores]);

        // Show notification
        document.dispatchEvent(
          new CustomEvent("displayNotification", {
            detail: {
              message: `${returnedCores.length} tower cores have been returned to your inventory.`,
              type: "info",
            },
          })
        );
      }
    };

    // Register event listeners
    document.addEventListener("updateDungeonUI", handleUpdateDungeonUI);
    document.addEventListener("updateHealth", handleUpdateHealth);
    document.addEventListener("updateInventory", handleUpdateInventory);
    document.addEventListener("robotCaptured", handleRobotCaptured);
    document.addEventListener("allRobotsDefeated", handleAllRobotsDefeated);
    document.addEventListener("updateDefenseUI", handleUpdateDefenseUI);
    document.addEventListener("updateBaseHealth", handleUpdateBaseHealth);
    document.addEventListener("updateCores", handleUpdateCores);
    document.addEventListener("updatePlacedTurrets", handleUpdatePlacedTurrets);
    document.addEventListener("waveStarted", handleWaveStarted);
    document.addEventListener("waveComplete", handleWaveComplete);
    document.addEventListener("switchMode", handleSwitchMode);
    document.addEventListener("gameOver", handleGameOver);
    document.addEventListener("returnedCores", handleReturnedCores);

    // Clean up event listeners
    return () => {
      document.removeEventListener("updateDungeonUI", handleUpdateDungeonUI);
      document.removeEventListener("updateHealth", handleUpdateHealth);
      document.removeEventListener("updateInventory", handleUpdateInventory);
      document.removeEventListener("robotCaptured", handleRobotCaptured);
      document.removeEventListener(
        "allRobotsDefeated",
        handleAllRobotsDefeated
      );
      document.removeEventListener("updateDefenseUI", handleUpdateDefenseUI);
      document.removeEventListener("updateBaseHealth", handleUpdateBaseHealth);
      document.removeEventListener("updateCores", handleUpdateCores);
      document.removeEventListener(
        "updatePlacedTurrets",
        handleUpdatePlacedTurrets
      );
      document.removeEventListener("waveStarted", handleWaveStarted);
      document.removeEventListener("waveComplete", handleWaveComplete);
      document.removeEventListener("switchMode", handleSwitchMode);
      document.removeEventListener("gameOver", handleGameOver);
      document.removeEventListener("returnedCores", handleReturnedCores);
    };
  }, [
    setGameState,
    setCapturedCores,
    setPlayerHealth,
    setInventory,
    setPlacedTurrets,
  ]);

  // This component doesn't render anything
  return null;
};

export default GameEvents;
