"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { getDefaultMap, getAllMaps } from "@/lib/game/mapConfig";

// Create a base AI core that players start with

const BASE_AI_CORE = {
  type: "Basic",
  value: "power",
  power: 1,
};

// Create context with default values
const GameContext = createContext({
  gameState: "dungeon",
  setGameState: () => {},
  capturedCores: [BASE_AI_CORE], // Start with a base core
  setCapturedCores: () => {},
  playerHealth: 100,
  setPlayerHealth: () => {},
  inventory: { total: 0, electronic: 0, metal: 0, energy: 0 },
  setInventory: () => {},
  placedTurrets: [], // Track placed turrets for persistence
  setPlacedTurrets: () => {},
  currentMap: getDefaultMap(), // Current map configuration
  setCurrentMap: () => {},
  unlockedMaps: [getDefaultMap().id], // Tracks which maps are unlocked
  setUnlockedMaps: () => {},
  purchaseMap: () => {}, // Function to purchase new maps
});

// Provider component
export function GameProvider({ children }) {
  const [gameState, setGameState] = useState("dungeon");
  const [capturedCores, setCapturedCores] = useState([BASE_AI_CORE]); // Start with base core
  const [playerHealth, setPlayerHealth] = useState(100);
  const [inventory, setInventory] = useState({
    total: 0,
    electronic: 0,
    metal: 0,
    energy: 0,
  });

  // New state for turrets and maps
  const [placedTurrets, setPlacedTurrets] = useState([]);
  const [currentMap, setCurrentMap] = useState(getDefaultMap());
  const [unlockedMaps, setUnlockedMaps] = useState([getDefaultMap().id]);

  // Convert default unlocked maps in the config
  useEffect(() => {
    // Initialize with all maps that should be unlocked by default
    const defaultUnlocked = getAllMaps()
      .filter((map) => map.unlocked)
      .map((map) => map.id);

    setUnlockedMaps(defaultUnlocked);
  }, []);

  // Function to purchase new maps with scrap
  const purchaseMap = (mapId) => {
    // Find the map in the config
    const mapToPurchase = getAllMaps().find((map) => map.id === mapId);

    if (!mapToPurchase) {
      console.error(`Map with ID ${mapId} not found`);
      return false;
    }

    // Check if already unlocked
    if (unlockedMaps.includes(mapId)) {
      console.log(`Map ${mapId} already unlocked`);
      return true;
    }

    // Check if player has enough scrap
    if (inventory.total >= mapToPurchase.price) {
      // Deduct scrap
      const newInventory = { ...inventory };

      // Distribute the cost across different scrap types proportionally
      const totalScrap = inventory.total;
      const proportion = mapToPurchase.price / totalScrap;

      // Calculate deductions for each type, ensuring we don't go below 0
      const electronicsDeduction = Math.min(
        Math.floor(inventory.electronic * proportion),
        inventory.electronic
      );
      const metalDeduction = Math.min(
        Math.floor(inventory.metal * proportion),
        inventory.metal
      );
      const energyDeduction = Math.min(
        Math.floor(inventory.energy * proportion),
        inventory.energy
      );

      // If the proportional deductions don't add up to the full price, adjust the difference
      let remaining =
        mapToPurchase.price -
        (electronicsDeduction + metalDeduction + energyDeduction);

      // Distribute the remaining amount across types that still have enough
      if (remaining > 0 && inventory.electronic > electronicsDeduction) {
        const additional = Math.min(
          remaining,
          inventory.electronic - electronicsDeduction
        );
        newInventory.electronic -= additional;
        remaining -= additional;
      }

      if (remaining > 0 && inventory.metal > metalDeduction) {
        const additional = Math.min(
          remaining,
          inventory.metal - metalDeduction
        );
        newInventory.metal -= additional;
        remaining -= additional;
      }

      if (remaining > 0 && inventory.energy > energyDeduction) {
        const additional = Math.min(
          remaining,
          inventory.energy - energyDeduction
        );
        newInventory.energy -= additional;
        remaining -= additional;
      }

      // Apply the deductions
      newInventory.electronic -= electronicsDeduction;
      newInventory.metal -= metalDeduction;
      newInventory.energy -= energyDeduction;
      newInventory.total =
        newInventory.electronic + newInventory.metal + newInventory.energy;

      // Update inventory state
      setInventory(newInventory);

      // Unlock the map
      setUnlockedMaps([...unlockedMaps, mapId]);
      return true;
    } else {
      console.log(`Not enough scrap to purchase map ${mapId}`);
      return false;
    }
  };

  // Values to be provided to consuming components
  const value = {
    gameState,
    setGameState,
    capturedCores,
    setCapturedCores,
    playerHealth,
    setPlayerHealth,
    inventory,
    setInventory,
    placedTurrets,
    setPlacedTurrets,
    currentMap,
    setCurrentMap,
    unlockedMaps,
    setUnlockedMaps,
    purchaseMap,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

// Custom hook for using the game context
export function useGameContext() {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error("useGameContext must be used within a GameProvider");
  }
  return context;
}
