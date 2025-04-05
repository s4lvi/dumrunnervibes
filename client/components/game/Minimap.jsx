"use client";

import React, { useEffect, useRef, useState } from "react";
import { useGameContext } from "./GameContext";

const Minimap = () => {
  const canvasRef = useRef(null);
  const [playerPosition, setPlayerPosition] = useState({ x: 0, z: 0 });
  const [playerRotation, setPlayerRotation] = useState(0);
  const [dungeonData, setDungeonData] = useState(null);
  const [revealedCells, setRevealedCells] = useState({});
  const { gameState } = useGameContext();

  // Constants for minimap rendering
  const MINIMAP_SIZE = 150; // Size of the minimap in pixels
  const CELL_SIZE = 2; // Size of each grid cell in pixels
  const REVEALED_RADIUS = 7; // How many cells around player are revealed
  const PLAYER_SIZE = 3; // Size of the player marker

  useEffect(() => {
    // Only show minimap in dungeon mode
    if (gameState !== "dungeon") return;

    // Listen for dungeon data updates from the game
    const handleDungeonGenerated = (event) => {
      if (event.detail && event.detail.grid) {
        setDungeonData(event.detail);
        // Reset revealed cells when new dungeon is generated
        setRevealedCells({});
      }
    };

    // Listen for player position updates
    const handlePlayerPositionUpdate = (event) => {
      if (event.detail) {
        const { position, rotation } = event.detail;
        setPlayerPosition({ x: position.x, z: position.z });
        setPlayerRotation(rotation.y);

        // Update revealed cells based on player position
        updateRevealedCells(position.x, position.z);
      }
    };

    // Register event listeners
    document.addEventListener("dungeonGenerated", handleDungeonGenerated);
    document.addEventListener(
      "playerPositionUpdate",
      handlePlayerPositionUpdate
    );

    // Clean up event listeners
    return () => {
      document.removeEventListener("dungeonGenerated", handleDungeonGenerated);
      document.removeEventListener(
        "playerPositionUpdate",
        handlePlayerPositionUpdate
      );
    };
  }, [gameState]);

  // Update revealed cells around player position
  const updateRevealedCells = (playerX, playerZ) => {
    if (!dungeonData) return;

    const { grid, mapSize, gridSize } = dungeonData;
    if (!grid) return;

    // Convert world coordinates to grid coordinates
    const gridX = Math.floor(playerX / gridSize + mapSize / 2);
    const gridZ = Math.floor(playerZ / gridSize + mapSize / 2);

    // Create a copy of the current revealed cells
    const newRevealedCells = { ...revealedCells };

    // Reveal cells in a radius around the player
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

    setRevealedCells(newRevealedCells);
  };

  // Render the minimap
  useEffect(() => {
    if (!canvasRef.current || !dungeonData || gameState !== "dungeon") return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const { grid, mapSize, gridSize } = dungeonData;

    if (!grid) return;

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

    // Draw the grid (only revealed cells)
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
            } else {
              // Floor
              ctx.fillStyle = "#aaa";
              ctx.fillRect(
                pixelX - CELL_SIZE / 2,
                pixelZ - CELL_SIZE / 2,
                CELL_SIZE,
                CELL_SIZE
              );
            }
          }
        }
      }
    }

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
  }, [playerPosition, playerRotation, dungeonData, revealedCells, gameState]);

  // Don't render if not in dungeon mode
  if (gameState !== "dungeon") {
    return null;
  }

  return (
    <div
      className="minimap-container"
      style={{
        position: "absolute",
        bottom: "20px",
        right: "20px",
        width: `${MINIMAP_SIZE}px`,
        height: `${MINIMAP_SIZE}px`,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        borderRadius: "50%",
        overflow: "hidden",
        zIndex: 100,
        border: "2px solid #333",
      }}
    >
      <canvas ref={canvasRef} width={MINIMAP_SIZE} height={MINIMAP_SIZE} />
    </div>
  );
};

export default Minimap;
