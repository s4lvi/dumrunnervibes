"use client";

import React, { useEffect, useState } from "react";
import { useGameContext } from "./GameContext";
import { createTower } from "@/lib/game/defenseMode";
import audioManager from "@/lib/game/audioManager";

const TowerPlacementMenu = ({ sceneRef }) => {
  const { capturedCores, setCapturedCores } = useGameContext();
  const [showMenu, setShowMenu] = useState(false);
  const [selectedMarker, setSelectedMarker] = useState(null);

  // Listen for tower placement events
  useEffect(() => {
    const handleShowTowerMenu = (event) => {
      setSelectedMarker(event.detail.marker);
      setShowMenu(true);

      // Play menu open sound
      audioManager.playUI("click");
    };

    const handleNoAICores = () => {
      // Play error sound
      audioManager.playUI("back");
      alert("No AI cores available! Capture more robots in dungeon mode.");
    };

    document.addEventListener("showTowerMenu", handleShowTowerMenu);
    document.addEventListener("noAICores", handleNoAICores);

    return () => {
      document.removeEventListener("showTowerMenu", handleShowTowerMenu);
      document.removeEventListener("noAICores", handleNoAICores);
    };
  }, []);

  // Handle core selection for tower placement
  const handleCoreSelection = (coreIndex) => {
    if (selectedMarker && sceneRef && sceneRef.current) {
      // Play selection sound
      audioManager.playUI("click");

      // Use the imported function from defenseMode
      createTower(selectedMarker.position, coreIndex, sceneRef.current);

      // Update cores in context
      const updatedCores = [...capturedCores];
      updatedCores.splice(coreIndex, 1);
      setCapturedCores(updatedCores);

      // Close the menu
      setShowMenu(false);
      setSelectedMarker(null);
    }
  };

  // Close the menu without selecting a core
  const handleCancel = () => {
    // Play cancel sound
    audioManager.playUI("back");

    setShowMenu(false);
    setSelectedMarker(null);
  };

  if (!showMenu) return null;

  return (
    <div className="tower-placement-menu">
      <div className="menu-content">
        <h3>Select AI Core</h3>

        <div className="cores-list">
          {capturedCores.map((core, index) => (
            <button
              key={index}
              className="core-button"
              onClick={() => handleCoreSelection(index)}
              onMouseEnter={() => audioManager.playUI("hover")}
            >
              {core.type} ({core.value} - Power: {core.power})
            </button>
          ))}
        </div>

        <button
          className="cancel-button"
          onClick={handleCancel}
          onMouseEnter={() => audioManager.playUI("hover")}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default TowerPlacementMenu;
