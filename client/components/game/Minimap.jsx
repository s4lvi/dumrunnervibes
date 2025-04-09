"use client";

import React, { useEffect, useRef, useState } from "react";
import { useGameContext } from "./GameContext";

const Minimap = () => {
  const canvasRef = useRef(null);
  const [playerPosition, setPlayerPosition] = useState({ x: 0, z: 0 });
  const [playerRotation, setPlayerRotation] = useState(0);
  const [dungeonData, setDungeonData] = useState(null);
  const [revealedCells, setRevealedCells] = useState({});
  const [currentLevel, setCurrentLevel] = useState(1);
  const { gameState } = useGameContext();
  const initializedRef = useRef(false);
  const eventHandlersRegisteredRef = useRef(false);

  // Constants for minimap rendering
  const MINIMAP_SIZE = 150; // Size of the minimap in pixels
  const CELL_SIZE = 2; // Size of each grid cell in pixels
  const REVEALED_RADIUS = 7; // How many cells around player are revealed
  const PLAYER_SIZE = 3; // Size of the player marker

  // Debug - log when component mounts
  useEffect(() => {
    console.log("Minimap component mounted, gameState:", gameState);

    // Try to get dungeon data from global window object if it exists
    if (window.dungeonController && window.dungeonController.getDungeonData) {
      const data = window.dungeonController.getDungeonData();
      if (data && data.grid) {
        console.log("Found dungeon data from controller");
        setDungeonData(data);
        updateRevealedCellsHelper(playerPosition.x, playerPosition.z, data);
      }
    }

    return () => {
      console.log("Minimap component unmounted");
    };
  }, []);

  // Register event listeners once and ensure they're not duplicated
  useEffect(() => {
    if (eventHandlersRegisteredRef.current) return;

    console.log("Setting up minimap event listeners");

    // Listen for dungeon data updates from the game
    const handleDungeonGenerated = (event) => {
      console.log("dungeonGenerated event received:", event.detail);

      if (event.detail && event.detail.grid) {
        console.log("Setting dungeon data in state");

        // Always update the dungeon data
        setDungeonData(event.detail);

        // Get the current level from the controller if available
        if (
          window.dungeonController &&
          window.dungeonController.getCurrentLevel
        ) {
          const newLevel = window.dungeonController.getCurrentLevel();

          // If level changed, reset revealed cells
          if (newLevel !== currentLevel) {
            console.log(
              `Level changed from ${currentLevel} to ${newLevel}, resetting minimap`
            );
            setRevealedCells({});
            setCurrentLevel(newLevel);
          }
        }

        // Immediately reveal cells around player spawn position
        const spawnRoom = event.detail.spawnRoom;
        if (spawnRoom) {
          const spawnX =
            (spawnRoom.centerX - event.detail.mapSize / 2) *
            event.detail.gridSize;
          const spawnZ =
            (spawnRoom.centerY - event.detail.mapSize / 2) *
            event.detail.gridSize;

          // Update player position to match spawn position
          setPlayerPosition({ x: spawnX, z: spawnZ });

          // Reveal cells around spawn position
          updateRevealedCellsHelper(spawnX, spawnZ, event.detail);
        }

        initializedRef.current = true;
      }
    };

    // Listen for player position updates
    const handlePlayerPositionUpdate = (event) => {
      if (event.detail) {
        const { position, rotation } = event.detail;
        setPlayerPosition({ x: position.x, z: position.z });

        if (rotation) {
          setPlayerRotation(rotation.y);
        }

        // Update revealed cells based on player position
        if (dungeonData) {
          updateRevealedCellsHelper(position.x, position.z, dungeonData);
        }
      }
    };

    // Listen for explicit minimap reset events
    const handleResetMinimap = (event) => {
      console.log("Received resetMinimap event:", event.detail);

      // Reset all revealed cells
      setRevealedCells({});

      // Update current level if provided
      if (event.detail && event.detail.level) {
        setCurrentLevel(event.detail.level);
      }
    };

    // Listen for portal entered events to reset the minimap
    const handlePortalEntered = (event) => {
      console.log("Portal entered:", event.detail);

      if (event.detail && event.detail.action === "nextLevel") {
        console.log("Portal to next level entered, resetting minimap");
        setRevealedCells({});
      }
    };

    // Register event listeners
    document.addEventListener("dungeonGenerated", handleDungeonGenerated);
    document.addEventListener(
      "playerPositionUpdate",
      handlePlayerPositionUpdate
    );
    document.addEventListener("resetMinimap", handleResetMinimap);
    document.addEventListener("portalEntered", handlePortalEntered);

    // Mark event handlers as registered
    eventHandlersRegisteredRef.current = true;

    // Clean up event listeners when component unmounts
    return () => {
      console.log("Removing minimap event listeners");
      document.removeEventListener("dungeonGenerated", handleDungeonGenerated);
      document.removeEventListener(
        "playerPositionUpdate",
        handlePlayerPositionUpdate
      );
      document.removeEventListener("resetMinimap", handleResetMinimap);
      document.removeEventListener("portalEntered", handlePortalEntered);
      eventHandlersRegisteredRef.current = false;
    };
  }, [dungeonData, currentLevel]); // Added dependencies

  // Helper function to update revealed cells that can be called from different places
  const updateRevealedCellsHelper = (playerX, playerZ, dungeonDataParam) => {
    if (!dungeonDataParam || !dungeonDataParam.grid) {
      console.log(
        "Cannot update revealed cells - missing dungeon data or grid"
      );
      return;
    }

    const { grid, mapSize, gridSize } = dungeonDataParam;

    // Convert world coordinates to grid coordinates
    const gridX = Math.floor(playerX / gridSize + mapSize / 2);
    const gridZ = Math.floor(playerZ / gridSize + mapSize / 2);

    // Use functional form of setState to ensure we're working with latest state
    // This is critical for persistence of previously revealed cells
    setRevealedCells((prevRevealedCells) => {
      // Create a new object with all previously revealed cells
      const newRevealedCells = { ...prevRevealedCells };

      // Add newly revealed cells in a radius around the player
      for (let x = -REVEALED_RADIUS; x <= REVEALED_RADIUS; x++) {
        for (let z = -REVEALED_RADIUS; z <= REVEALED_RADIUS; z++) {
          const cellX = gridX + x;
          const cellZ = gridZ + z;

          // Check if the cell is within the map bounds
          if (cellX >= 0 && cellX < mapSize && cellZ >= 0 && cellZ < mapSize) {
            // Calculate distance to determine if in reveal radius
            const distance = Math.sqrt(x * x + z * z);
            if (distance <= REVEALED_RADIUS) {
              const key = `${cellX},${cellZ}`;
              newRevealedCells[key] = true;
            }
          }
        }
      }

      return newRevealedCells;
    });
  };

  // Render the minimap
  useEffect(() => {
    console.log(
      "Render effect running, gameState:",
      gameState,
      "dungeonData:",
      dungeonData ? "exists" : "null",
      "canvasRef:",
      canvasRef.current ? "exists" : "null",
      "revealedCells count:",
      Object.keys(revealedCells).length,
      "currentLevel:",
      currentLevel
    );

    if (!canvasRef.current) return;
    if (!dungeonData || !dungeonData.grid) {
      // Draw a placeholder or loading indicator if no data
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");

      // Clear the canvas
      ctx.clearRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);

      // Fill with dark background
      ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
      ctx.fillRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);

      // Draw "Loading" text
      ctx.fillStyle = "#33ff33";
      ctx.font = "12px Arial";
      ctx.textAlign = "center";
      ctx.fillText("Loading Map...", MINIMAP_SIZE / 2, MINIMAP_SIZE / 2);

      // Draw border
      ctx.strokeStyle = "#666";
      ctx.lineWidth = 2;
      ctx.strokeRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const { grid, mapSize, gridSize } = dungeonData;

    // Clear the canvas
    ctx.clearRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);

    // Fill with dark background
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);

    // Calculate the center offset for proper centering on canvas
    const offsetX = MINIMAP_SIZE / 2;
    const offsetZ = MINIMAP_SIZE / 2;

    // Convert world coordinates to grid coordinates
    const playerGridX = Math.floor(playerPosition.x / gridSize + mapSize / 2);
    const playerGridZ = Math.floor(playerPosition.z / gridSize + mapSize / 2);

    // If no cells have been revealed yet, force reveal cells around player
    if (Object.keys(revealedCells).length === 0) {
      console.log("No revealed cells yet, forcing initial reveal");
      updateRevealedCellsHelper(
        playerPosition.x,
        playerPosition.z,
        dungeonData
      );
      // Continue rendering with empty revealed cells for this frame
    }

    // Draw the grid (only revealed cells)
    let cellsDrawn = 0;
    for (let x = 0; x < mapSize; x++) {
      for (let z = 0; z < mapSize; z++) {
        const key = `${x},${z}`;

        // Only draw if cell has been revealed
        if (revealedCells[key]) {
          // Calculate position on minimap (centered on player)
          const pixelX = offsetX + (x - playerGridX) * CELL_SIZE;
          const pixelZ = offsetZ + (z - playerGridZ) * CELL_SIZE;

          // Check if the cell is within the minimap bounds
          if (
            pixelX >= 0 &&
            pixelX < MINIMAP_SIZE &&
            pixelZ >= 0 &&
            pixelZ < MINIMAP_SIZE
          ) {
            try {
              // Draw different colors for walls vs floors
              if (grid[x][z] === 1) {
                // Wall
                ctx.fillStyle = "#555";
                ctx.fillRect(
                  pixelX - CELL_SIZE / 2,
                  pixelZ - CELL_SIZE / 2,
                  CELL_SIZE,
                  CELL_SIZE
                );
                cellsDrawn++;
              } else {
                // Floor
                ctx.fillStyle = "#aaa";
                ctx.fillRect(
                  pixelX - CELL_SIZE / 2,
                  pixelZ - CELL_SIZE / 2,
                  CELL_SIZE,
                  CELL_SIZE
                );
                cellsDrawn++;
              }
            } catch (error) {
              console.error(`Error drawing cell at ${x},${z}:`, error);
            }
          }
        }
      }
    }

    // Draw the level number on the minimap
    ctx.fillStyle = "#00ff00";
    ctx.font = "10px Arial";
    ctx.textAlign = "left";
    ctx.fillText(`Level: ${currentLevel}`, 5, 12);

    console.log(`Drew ${cellsDrawn} cells on minimap`);

    // Draw the player
    ctx.fillStyle = "#00ff00";
    ctx.beginPath();
    ctx.arc(offsetX, offsetZ, PLAYER_SIZE, 0, Math.PI * 2);
    ctx.fill();

    // Draw direction indicator
    ctx.strokeStyle = "#00ff00";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(offsetX, offsetZ);
    ctx.lineTo(
      offsetX + Math.sin(playerRotation) * (PLAYER_SIZE * 2),
      offsetZ + Math.cos(playerRotation) * (PLAYER_SIZE * 2)
    );
    ctx.stroke();

    // Draw border
    ctx.strokeStyle = "#666";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);
  }, [
    playerPosition,
    playerRotation,
    dungeonData,
    revealedCells,
    gameState,
    currentLevel,
  ]);

  // Only render in dungeon mode
  if (gameState !== "dungeon") {
    console.log(
      "Not rendering minimap because gameState is not dungeon:",
      gameState
    );
    return null;
  }

  return (
    <div
      className="minimap-container"
      style={{
        position: "absolute",
        top: "20px",
        right: "20px",
        width: `${MINIMAP_SIZE}px`,
        height: `${MINIMAP_SIZE}px`,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        borderRadius: "50%",
        overflow: "hidden",
        zIndex: 1000, // Increased z-index to ensure visibility
        border: "2px solid #33ff33", // Changed color to make it more visible for debugging
        pointerEvents: "none", // Prevent the minimap from intercepting clicks
      }}
    >
      <canvas ref={canvasRef} width={MINIMAP_SIZE} height={MINIMAP_SIZE} />
    </div>
  );
};

export default Minimap;
