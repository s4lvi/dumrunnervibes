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
    speed: 0.3,
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
    speed: 0.1,
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
    speed: 0.2,
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
    speed: 0.2,
    coreValue: "healing",
    description: "Support robot that can repair other units",
    scrapValue: 5,
    scrapType: "energy",
    coreDropChance: 0.2,
  },
];

// Define robot AI states
export const ROBOT_STATES = {
  IDLE: "idle",
  PATROLLING: "patrolling",
  SEARCHING: "searching",
  CHASING: "chasing",
  SHOOTING: "shooting",
  HIDING: "hiding",
  FLEEING: "fleeing",
};

// Define behavior profiles for different robot types
export const ROBOT_BEHAVIORS = {
  scout: {
    defaultState: ROBOT_STATES.PATROLLING,
    detectionRange: 15,
    attackRange: 10,
    fleeHealthThreshold: 0.3, // Flee when health below 30%
    hideChance: 0.2, // 20% chance to hide when damaged
    searchDuration: 5, // Seconds to search before returning to patrol
    // State transition weights (higher = more likely)
    stateWeights: {
      [ROBOT_STATES.IDLE]: 0.1,
      [ROBOT_STATES.PATROLLING]: 0.6,
      [ROBOT_STATES.SEARCHING]: 0.8,
      [ROBOT_STATES.CHASING]: 0.9,
      [ROBOT_STATES.SHOOTING]: 0.7,
      [ROBOT_STATES.HIDING]: 0.3,
      [ROBOT_STATES.FLEEING]: 0.5,
    },
  },
  tank: {
    defaultState: ROBOT_STATES.PATROLLING,
    detectionRange: 12,
    attackRange: 8,
    fleeHealthThreshold: 0.15, // Hardly ever flees
    hideChance: 0.05, // Rarely hides
    searchDuration: 8, // Searches longer
    // State transition weights
    stateWeights: {
      [ROBOT_STATES.IDLE]: 0.2,
      [ROBOT_STATES.PATROLLING]: 0.5,
      [ROBOT_STATES.SEARCHING]: 0.7,
      [ROBOT_STATES.CHASING]: 1.0, // Very aggressive
      [ROBOT_STATES.SHOOTING]: 0.9,
      [ROBOT_STATES.HIDING]: 0.1, // Unlikely to hide
      [ROBOT_STATES.FLEEING]: 0.1, // Unlikely to flee
    },
  },
  sniper: {
    defaultState: ROBOT_STATES.HIDING,
    detectionRange: 18, // Longer detection range
    attackRange: 16, // Much longer attack range
    fleeHealthThreshold: 0.4, // Flees at higher health threshold
    hideChance: 0.6, // Often hides
    searchDuration: 4,
    // State transition weights
    stateWeights: {
      [ROBOT_STATES.IDLE]: 0.2,
      [ROBOT_STATES.PATROLLING]: 0.3,
      [ROBOT_STATES.SEARCHING]: 0.5,
      [ROBOT_STATES.CHASING]: 0.2, // Prefers to keep distance
      [ROBOT_STATES.SHOOTING]: 0.8,
      [ROBOT_STATES.HIDING]: 0.7, // Prefers to hide and snipe
      [ROBOT_STATES.FLEEING]: 0.6, // More likely to flee
    },
  },
  healer: {
    defaultState: ROBOT_STATES.HIDING,
    detectionRange: 14,
    attackRange: 9,
    fleeHealthThreshold: 0.5, // Flees easily
    hideChance: 0.7, // Often hides
    searchDuration: 3,
    // State transition weights
    stateWeights: {
      [ROBOT_STATES.IDLE]: 0.3,
      [ROBOT_STATES.PATROLLING]: 0.4,
      [ROBOT_STATES.SEARCHING]: 0.6,
      [ROBOT_STATES.CHASING]: 0.2, // Avoids chasing
      [ROBOT_STATES.SHOOTING]: 0.5,
      [ROBOT_STATES.HIDING]: 0.8, // Prefers to hide
      [ROBOT_STATES.FLEEING]: 0.7, // Often flees
    },
  },
};

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
