// mapConfig.js - Configuration for tower defense maps

const DEFENSE_MAPS = [
  {
    id: "basic",
    name: "Basic Path",
    description:
      "A straight path from one end to the base with limited tower spots.",
    price: 0, // Free (default map)
    unlocked: true,
    previewColor: "#8BC34A",
    // Define the path from start to end
    paths: [{ start: { x: -25, z: 0 }, end: { x: 0, z: 0 } }],
    // Define tower placement markers
    towerSpots: [
      { x: -10, z: 4 },
      { x: -10, z: -4 },
      { x: -20, z: 4 },
      { x: -20, z: -4 },
    ],
    // Enemy spawn points
    spawnPoints: [{ x: -25, z: 0 }],
    // Base position (default is center)
    basePosition: { x: 0, z: 0 },
  },
  {
    id: "dual-path",
    name: "Dual Path",
    description: "Two separate paths to the base with multiple tower spots.",
    price: 200,
    unlocked: false,
    previewColor: "#FF9800",
    paths: [
      { start: { x: -25, z: 15 }, end: { x: 0, z: 0 } },
      { start: { x: -25, z: -15 }, end: { x: 0, z: 0 } },
    ],
    towerSpots: [
      { x: -10, z: 10 },
      { x: -10, z: -10 },
      { x: -20, z: 10 },
      { x: -20, z: -10 },
      { x: -15, z: 5 },
      { x: -15, z: -5 },
      { x: -5, z: 5 },
      { x: -5, z: -5 },
    ],
    spawnPoints: [
      { x: -25, z: 15 },
      { x: -25, z: -15 },
    ],
    basePosition: { x: 0, z: 0 },
  },
  {
    id: "quad-path",
    name: "Quad Path",
    description: "Four paths from each corner with multiple tower spots.",
    price: 500,
    unlocked: false,
    previewColor: "#F44336",
    paths: [
      { start: { x: -25, z: -25 }, end: { x: 0, z: 0 } },
      { start: { x: -25, z: 25 }, end: { x: 0, z: 0 } },
      { start: { x: 25, z: -25 }, end: { x: 0, z: 0 } },
      { start: { x: 25, z: 25 }, end: { x: 0, z: 0 } },
    ],
    towerSpots: [
      { x: -10, z: -10 },
      { x: -10, z: 10 },
      { x: 10, z: -10 },
      { x: 10, z: 10 },
      { x: 0, z: -15 },
      { x: 0, z: 15 },
      { x: -15, z: 0 },
      { x: 15, z: 0 },
      { x: -20, z: -20 },
      { x: -20, z: 20 },
      { x: 20, z: -20 },
      { x: 20, z: 20 },
    ],
    spawnPoints: [
      { x: -25, z: -25 },
      { x: -25, z: 25 },
      { x: 25, z: -25 },
      { x: 25, z: 25 },
    ],
    basePosition: { x: 0, z: 0 },
  },
  {
    id: "maze",
    name: "Maze",
    description:
      "Complex maze layout with winding paths and strategic tower spots.",
    price: 800,
    unlocked: false,
    previewColor: "#9C27B0",
    paths: [
      { start: { x: -25, z: 0 }, end: { x: -15, z: 0 } },
      { start: { x: -15, z: 0 }, end: { x: -15, z: 15 } },
      { start: { x: -15, z: 15 }, end: { x: 0, z: 15 } },
      { start: { x: 0, z: 15 }, end: { x: 0, z: -15 } },
      { start: { x: 0, z: -15 }, end: { x: 15, z: -15 } },
      { start: { x: 15, z: -15 }, end: { x: 15, z: 0 } },
      { start: { x: 15, z: 0 }, end: { x: 0, z: 0 } },
    ],
    towerSpots: [
      { x: -10, z: 5 },
      { x: -10, z: 10 },
      { x: -5, z: 10 },
      { x: -5, z: 0 },
      { x: 5, z: 0 },
      { x: 5, z: -10 },
      { x: 10, z: -10 },
      { x: 10, z: -5 },
      { x: -20, z: 5 },
      { x: -5, z: 20 },
      { x: 5, z: -20 },
      { x: 20, z: -5 },
    ],
    spawnPoints: [{ x: -25, z: 0 }],
    basePosition: { x: 0, z: 0 },
  },
];

// Get all maps
export function getAllMaps() {
  return DEFENSE_MAPS;
}

// Get a specific map by ID
export function getMapById(id) {
  return DEFENSE_MAPS.find((map) => map.id === id);
}

// Get the default map
export function getDefaultMap() {
  return DEFENSE_MAPS[0];
}

// Get all unlocked maps
export function getUnlockedMaps() {
  return DEFENSE_MAPS.filter((map) => map.unlocked);
}

export default {
  getAllMaps,
  getMapById,
  getDefaultMap,
  getUnlockedMaps,
};
