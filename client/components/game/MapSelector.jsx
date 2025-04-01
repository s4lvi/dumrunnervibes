"use client";

import React, { useState, useEffect } from "react";
import { useGameContext } from "./GameContext";
import { getAllMaps, getMapById } from "@/lib/game/mapConfig";
import audioManager from "@/lib/game/audioManager";

const MapSelector = ({ onMapSelected, onClose }) => {
  const { inventory, unlockedMaps, purchaseMap, currentMap, setCurrentMap } =
    useGameContext();

  const [maps, setMaps] = useState([]);
  const [selectedMapId, setSelectedMapId] = useState(currentMap.id);
  const [errorMessage, setErrorMessage] = useState("");

  // Load maps on component mount
  useEffect(() => {
    setMaps(getAllMaps());
  }, []);

  // Handle map selection
  const handleSelectMap = (mapId) => {
    setSelectedMapId(mapId);
    audioManager.playUI("hover");
  };

  // Handle map purchase
  const handlePurchaseMap = (mapId) => {
    const map = getMapById(mapId);
    if (!map) return;

    audioManager.playUI("click");

    if (unlockedMaps.includes(mapId)) {
      setErrorMessage("You already own this map");
      setTimeout(() => setErrorMessage(""), 3000);
      return;
    }

    if (inventory.total < map.price) {
      setErrorMessage("Not enough scrap to purchase this map");
      audioManager.playUI("back");
      setTimeout(() => setErrorMessage(""), 3000);
      return;
    }

    const success = purchaseMap(mapId);
    if (success) {
      audioManager.playCollectSound("core");
      setErrorMessage(`Successfully purchased ${map.name}!`);
      setTimeout(() => setErrorMessage(""), 3000);
    } else {
      audioManager.playUI("back");
      setErrorMessage("Failed to purchase map");
      setTimeout(() => setErrorMessage(""), 3000);
    }
  };

  // Apply selected map
  const handleApplyMap = () => {
    if (!unlockedMaps.includes(selectedMapId)) {
      setErrorMessage("You need to purchase this map first");
      audioManager.playUI("back");
      setTimeout(() => setErrorMessage(""), 3000);
      return;
    }

    const newMap = getMapById(selectedMapId);
    if (newMap) {
      setCurrentMap(newMap);
      audioManager.playUI("click");

      // Call the onMapSelected callback
      if (onMapSelected) {
        onMapSelected(newMap);
      }

      // Close the selector
      if (onClose) {
        onClose();
      }
    }
  };

  return (
    <div className="map-selector">
      <div className="map-selector-content">
        <h2>Select Map Layout</h2>

        {errorMessage && <div className="error-message">{errorMessage}</div>}

        <div className="map-grid">
          {maps.map((map) => (
            <div
              key={map.id}
              className={`map-item ${
                selectedMapId === map.id ? "selected" : ""
              } ${unlockedMaps.includes(map.id) ? "unlocked" : "locked"}`}
              onClick={() => handleSelectMap(map.id)}
            >
              <div
                className="map-preview"
                style={{ backgroundColor: map.previewColor }}
              >
                {!unlockedMaps.includes(map.id) && (
                  <div className="map-locked-overlay">
                    <span>🔒</span>
                  </div>
                )}
              </div>
              <div className="map-info">
                <h3>{map.name}</h3>
                <p>{map.description}</p>

                {!unlockedMaps.includes(map.id) && (
                  <div className="map-price">
                    <span>Price: {map.price} scrap</span>
                    <button
                      className="purchase-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePurchaseMap(map.id);
                      }}
                      disabled={inventory.total < map.price}
                      onMouseEnter={() => audioManager.playUI("hover")}
                    >
                      Purchase
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="map-selector-actions">
          <button
            className="apply-button"
            onClick={handleApplyMap}
            disabled={!unlockedMaps.includes(selectedMapId)}
            onMouseEnter={() => audioManager.playUI("hover")}
          >
            Apply Map
          </button>

          <button
            className="cancel-button"
            onClick={onClose}
            onMouseEnter={() => audioManager.playUI("hover")}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default MapSelector;
