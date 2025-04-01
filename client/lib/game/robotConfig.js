// robotConfig.js - Configuration for robot types

const ROBOT_TYPES = [
  {
    id: "scout",
    name: "Scout",
    color: 0xff0000,
    size: 0.8,
    height: 1.2,
    health: 30,
    attack: 5,
    speed: 0.03,
    coreValue: "speed",
    description: "Fast but fragile scouting robot",
    scrapValue: 2,
    scrapType: "electronic",
    coreDropChance: 0.2,
  },
  {
    id: "tank",
    name: "Tank",
    color: 0x0000ff,
    size: 1.2,
    height: 1.8,
    health: 80,
    attack: 10,
    speed: 0.01,
    coreValue: "power",
    description: "Heavy armor, slow movement",
    scrapValue: 4,
    scrapType: "metal",
    coreDropChance: 0.2,
  },
  {
    id: "sniper",
    name: "Sniper",
    color: 0xffff00,
    size: 0.7,
    height: 1.5,
    health: 20,
    attack: 15,
    speed: 0.02,
    coreValue: "range",
    description: "Long-range attacker with high damage",
    scrapValue: 3,
    scrapType: "electronic",
    coreDropChance: 0.2,
  },
  {
    id: "healer",
    name: "Healer",
    color: 0x00ffff,
    size: 0.9,
    height: 1.3,
    health: 40,
    attack: 3,
    speed: 0.02,
    coreValue: "healing",
    description: "Support robot that can repair other units",
    scrapValue: 5,
    scrapType: "energy",
    coreDropChance: 0.2,
  },
];

// Get all robot types
export function getRobotTypes() {
  return ROBOT_TYPES;
}

// Get a specific robot type by ID
export function getRobotType(id) {
  return ROBOT_TYPES.find((type) => type.id === id);
}

// Get a random robot type
export function getRandomRobotType() {
  return ROBOT_TYPES[Math.floor(Math.random() * ROBOT_TYPES.length)];
}
