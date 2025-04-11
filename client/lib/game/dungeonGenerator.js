// dungeonGenerator.js - Grid-based dungeon generator with 90s FPS style
import * as THREE from "three";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
import robotSpawner from "./robots";

// --- Constants & Materials ---
const ROOM_SIZE_MIN = 6;
const ROOM_SIZE_MAX = 10;
const CORRIDOR_WIDTH = 2;
const WALL_HEIGHT = 4;
const MAP_SIZE = 50;
const GRID_SIZE = 1;
const MAX_ROOMS = 10;

// Simple room types to match the classic FPS style
const ROOM_TYPES = {
  START: "start", // Where the player spawns
  EXIT: "exit", // Exit portal room
  ENEMY: "enemy", // Room with enemies
  EMPTY: "empty", // Empty room
  HEALTH: "health", // Health pickup room
};

// Texture loading with fallbacks
const textureLoader = new THREE.TextureLoader();
const texturePaths = {
  START: "/images/wall_basic.png",
  EXIT: "/images/wall_red.png",
  ENEMY: "/images/wall_server.png",
  EMPTY: "/images/wall_basic.png",
  HEALTH: "/images/wall_green.png",
  CORRIDOR: "/images/wall_corridor.png",
  DEFAULT: "/images/wall_basic.png",
};

// Colors for backup if textures aren't available
const roomColors = {
  START: 0x0044aa, // Blue for start rooms
  EXIT: 0xaa0000, // Red for exit rooms
  ENEMY: 0xaa5500, // Orange for enemy rooms
  HEALTH: 0x00aa00, // Green for health rooms
  EMPTY: 0x444444, // Gray for empty rooms
  CORRIDOR: 0x333333, // Dark gray for corridors
  DEFAULT: 0x555555, // Medium gray for fallback
};

// Load textures with error handling
function loadTextureWithFallback(path, roomType) {
  try {
    // Pre-configure texture settings
    const texture = textureLoader.load(
      path,
      // Success callback
      (loadedTexture) => {
        console.log(`Loaded texture for ${roomType}`);
      },
      // Progress callback
      undefined,
      // Error callback
      (error) => {
        console.warn(`Failed to load texture for ${roomType}:`, error);
      }
    );

    // Apply settings immediately to the texture object
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(0.5, 0.5);
    texture.anisotropy = 4;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;

    // Force texture to update
    texture.needsUpdate = true;

    return texture;
  } catch (error) {
    console.warn(`Error loading texture for ${roomType}:`, error);
    return null;
  }
}

// Try to load textures but don't break if they're missing
const WALL_TEXTURES = {
  START: loadTextureWithFallback(texturePaths.START, "START"),
  EXIT: loadTextureWithFallback(texturePaths.EXIT, "EXIT"),
  ENEMY: loadTextureWithFallback(texturePaths.ENEMY, "ENEMY"),
  EMPTY: loadTextureWithFallback(texturePaths.EMPTY, "EMPTY"),
  HEALTH: loadTextureWithFallback(texturePaths.HEALTH, "HEALTH"),
  CORRIDOR: loadTextureWithFallback(texturePaths.CORRIDOR, "CORRIDOR"),
  DEFAULT: loadTextureWithFallback(texturePaths.DEFAULT, "DEFAULT"),
};

// Create materials with textures, but fallback to colors if textures are missing
function createMaterial(roomType) {
  const texture = WALL_TEXTURES[roomType];
  const color = roomColors[roomType] || roomColors.DEFAULT;

  return new THREE.MeshStandardMaterial({
    color: color,
    map: texture, // Will be null if texture failed to load
    side: THREE.DoubleSide,
    roughness: 0.8,
    metalness: 0.2,
  });
}

// Create shared materials for all room types
const SHARED_MATERIALS = {
  // Base materials
  WALL: createMaterial("DEFAULT"),
  FLOOR: new THREE.MeshStandardMaterial({
    color: 0x333333,
    roughness: 0.9,
  }),
  CEILING: new THREE.MeshStandardMaterial({
    color: 0x222222,
    roughness: 0.9,
  }),

  // Room-specific wall materials
  START_WALL: createMaterial("START"),
  EXIT_WALL: createMaterial("EXIT"),
  ENEMY_WALL: createMaterial("ENEMY"),
  HEALTH_WALL: createMaterial("HEALTH"),
  EMPTY_WALL: createMaterial("EMPTY"),
  CORRIDOR_WALL: createMaterial("CORRIDOR"),

  // Room-specific floor materials
  START_FLOOR: new THREE.MeshStandardMaterial({
    color: 0x0000ff,
    roughness: 0.8,
  }),
  EXIT_FLOOR: new THREE.MeshStandardMaterial({
    color: 0xff0000,
    roughness: 0.8,
  }),
  ENEMY_FLOOR: new THREE.MeshStandardMaterial({
    color: 0xaa5500,
    roughness: 0.8,
  }),
  HEALTH_FLOOR: new THREE.MeshStandardMaterial({
    color: 0x00aa00,
    roughness: 0.8,
  }),
};

// Material lookup helper
function getMaterial(type, roomType = null) {
  if (type === "WALL" && roomType) {
    switch (roomType) {
      case ROOM_TYPES.START:
        return SHARED_MATERIALS.START_WALL;
      case ROOM_TYPES.EXIT:
        return SHARED_MATERIALS.EXIT_WALL;
      case ROOM_TYPES.ENEMY:
        return SHARED_MATERIALS.ENEMY_WALL;
      case ROOM_TYPES.HEALTH:
        return SHARED_MATERIALS.HEALTH_WALL;
      case ROOM_TYPES.EMPTY:
        return SHARED_MATERIALS.EMPTY_WALL;
      case "CORRIDOR":
        return SHARED_MATERIALS.CORRIDOR_WALL;
      default:
        return SHARED_MATERIALS.WALL;
    }
  }
  return SHARED_MATERIALS[type] || SHARED_MATERIALS.WALL;
}

// --- Main Dungeon Generation ---
export function generateDungeon(scene) {
  console.time("dungeonGeneration");

  // Create facility group
  const facility = new THREE.Group();
  facility.name = "DungeonFacility";
  scene.add(facility);

  // Create grid system
  const grid = Array(MAP_SIZE)
    .fill()
    .map(() => Array(MAP_SIZE).fill(1)); // 1 = wall, 0 = floor

  // Create grid to track room types for wall texturing
  const roomTypeGrid = Array(MAP_SIZE)
    .fill()
    .map(() => Array(MAP_SIZE).fill(null));

  // Create simple floor
  createSimpleFloor(facility);

  // Create simple ceiling
  createSimpleCeiling(facility);

  // Generate rooms
  const rooms = generateRooms(grid, roomTypeGrid);

  // Connect rooms with corridors
  connectRooms(rooms, grid, roomTypeGrid);

  // Build walls based on the grid and room types
  buildWalls(facility, grid, roomTypeGrid);

  // Spawn enemies in enemy rooms
  spawnEnemies(rooms, scene);

  // Add health pickups in health rooms
  addHealthPickups(facility, rooms);

  // Create traversability grid for AI pathfinding
  const traversabilityGrid = createTraversabilityGrid(grid);

  console.timeEnd("dungeonGeneration");

  return {
    dungeon: facility,
    spawnRoom: findRoomByType(rooms, ROOM_TYPES.START),
    exitRoom: findRoomByType(rooms, ROOM_TYPES.EXIT),
    rooms: rooms,
    gridSize: GRID_SIZE,
    mapSize: MAP_SIZE,
    grid: grid,
    traversabilityGrid: traversabilityGrid,
  };
}

// Helper function to find a room by type
function findRoomByType(rooms, type) {
  return rooms.find((room) => room.type === type) || rooms[0];
}

// Create a simple floor for the entire map
function createSimpleFloor(facility) {
  const floorGeometry = new THREE.PlaneGeometry(
    MAP_SIZE * GRID_SIZE,
    MAP_SIZE * GRID_SIZE,
    1,
    1
  );
  const floor = new THREE.Mesh(floorGeometry, SHARED_MATERIALS.FLOOR);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, 0);
  floor.userData = {
    isFloor: true,
    isSolid: true,
  };
  facility.add(floor);
}

// Create a simple ceiling for the entire map
function createSimpleCeiling(facility) {
  const ceilingGeometry = new THREE.PlaneGeometry(
    MAP_SIZE * GRID_SIZE,
    MAP_SIZE * GRID_SIZE,
    1,
    1
  );
  const ceiling = new THREE.Mesh(ceilingGeometry, SHARED_MATERIALS.CEILING);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, WALL_HEIGHT, 0);
  ceiling.userData = {
    isCeiling: true,
    isSolid: true,
  };
  facility.add(ceiling);
}

// Generate rooms with different types
function generateRooms(grid, roomTypeGrid) {
  const numRooms = randomInt(5, MAX_ROOMS);
  const rooms = [];

  // Create spawn room (first room)
  const spawnRoomWidth = randomInt(ROOM_SIZE_MIN, ROOM_SIZE_MIN + 2);
  const spawnRoomHeight = randomInt(ROOM_SIZE_MIN, ROOM_SIZE_MIN + 2);
  const spawnRoomX = Math.floor(MAP_SIZE / 2 - spawnRoomWidth / 2);
  const spawnRoomY = Math.floor(MAP_SIZE / 2 - spawnRoomHeight / 2);

  for (let x = spawnRoomX; x < spawnRoomX + spawnRoomWidth; x++) {
    for (let y = spawnRoomY; y < spawnRoomY + spawnRoomHeight; y++) {
      grid[x][y] = 0; // Mark as floor
      roomTypeGrid[x][y] = ROOM_TYPES.START; // Mark as START room
    }
  }

  rooms.push({
    x: spawnRoomX,
    y: spawnRoomY,
    width: spawnRoomWidth,
    height: spawnRoomHeight,
    centerX: spawnRoomX + Math.floor(spawnRoomWidth / 2),
    centerY: spawnRoomY + Math.floor(spawnRoomHeight / 2),
    type: ROOM_TYPES.START,
    isConnected: false,
  });

  // Ensure we have one exit room
  let hasExitRoom = false;
  let hasSpecialRoom = false;

  // Create additional rooms
  for (let i = 1; i < numRooms; i++) {
    let roomType;

    // Determine room type
    if (!hasExitRoom && i === numRooms - 1) {
      roomType = ROOM_TYPES.EXIT;
      hasExitRoom = true;
    } else {
      // Random room type distribution
      const randomValue = Math.random();
      if (randomValue < 0.6) {
        roomType = ROOM_TYPES.ENEMY;
      } else if (randomValue < 0.8) {
        roomType = ROOM_TYPES.EMPTY;
      } else {
        if (!hasSpecialRoom) {
          roomType = ROOM_TYPES.HEALTH;
          hasSpecialRoom = true;
        } else {
          roomType = ROOM_TYPES.EMPTY;
        }
      }
    }

    // Determine room size
    let width, height;
    width = randomInt(ROOM_SIZE_MIN, ROOM_SIZE_MAX);
    height = randomInt(ROOM_SIZE_MIN, ROOM_SIZE_MAX);

    // Try to find a valid position for the room
    let attempts = 0;
    let validPosition = false;
    let roomX, roomY;
    const maxAttempts = 50;

    while (!validPosition && attempts < maxAttempts) {
      roomX = randomInt(1, MAP_SIZE - width - 1);
      roomY = randomInt(1, MAP_SIZE - height - 1);
      validPosition = true;

      // Check if this position overlaps with existing rooms (including padding)
      for (let x = roomX - 1; x < roomX + width + 1; x++) {
        for (let y = roomY - 1; y < roomY + height + 1; y++) {
          if (x < 0 || y < 0 || x >= MAP_SIZE || y >= MAP_SIZE) continue;
          if (grid[x][y] === 0) {
            validPosition = false;
            break;
          }
        }
        if (!validPosition) break;
      }

      attempts++;
    }

    if (validPosition) {
      // Carve out the room in the grid
      for (let x = roomX; x < roomX + width; x++) {
        for (let y = roomY; y < roomY + height; y++) {
          grid[x][y] = 0; // Mark as floor
          roomTypeGrid[x][y] = roomType; // Mark with room type
        }
      }

      // Add inner walls for more interesting layout (except in small or special rooms)
      if (
        width >= ROOM_SIZE_MIN + 3 &&
        height >= ROOM_SIZE_MIN + 3 &&
        roomType !== ROOM_TYPES.START &&
        roomType !== ROOM_TYPES.EXIT &&
        Math.random() > 0.5
      ) {
        addInnerWalls(
          grid,
          roomTypeGrid,
          roomX,
          roomY,
          width,
          height,
          roomType
        );
      }

      rooms.push({
        x: roomX,
        y: roomY,
        width: width,
        height: height,
        centerX: roomX + Math.floor(width / 2),
        centerY: roomY + Math.floor(height / 2),
        type: roomType,
        isConnected: false,
      });
    }
  }

  // Make sure the first room is connected
  rooms[0].isConnected = true;

  return rooms;
}

// Add some inner walls to make rooms more interesting
function addInnerWalls(
  grid,
  roomTypeGrid,
  roomX,
  roomY,
  width,
  height,
  roomType
) {
  // Decide on inner wall style
  const style = Math.floor(Math.random() * 3);

  switch (style) {
    case 0: // Pillars
      for (let x = roomX + 2; x < roomX + width - 2; x += 3) {
        for (let y = roomY + 2; y < roomY + height - 2; y += 3) {
          grid[x][y] = 1; // Add pillar
          roomTypeGrid[x][y] = roomType; // Keep room type for wall texture
        }
      }
      break;

    case 1: // Partial wall
      const isHorizontal = Math.random() > 0.5;
      const position = isHorizontal
        ? roomY + Math.floor(height / 2)
        : roomX + Math.floor(width / 2);

      const doorPos = isHorizontal
        ? roomX + randomInt(2, width - 3)
        : roomY + randomInt(2, height - 3);

      if (isHorizontal) {
        // Horizontal wall with a door
        for (let x = roomX + 1; x < roomX + width - 1; x++) {
          if (Math.abs(x - doorPos) > 1) {
            // Leave a door gap
            grid[x][position] = 1;
            roomTypeGrid[x][position] = roomType; // Keep room type for wall texture
          }
        }
      } else {
        // Vertical wall with a door
        for (let y = roomY + 1; y < roomY + height - 1; y++) {
          if (Math.abs(y - doorPos) > 1) {
            // Leave a door gap
            grid[position][y] = 1;
            roomTypeGrid[position][y] = roomType; // Keep room type for wall texture
          }
        }
      }
      break;

    case 2: // Corner walls
      const cornerSize = Math.min(3, Math.min(width, height) / 4);

      // Top-left corner
      for (let x = roomX + 1; x < roomX + cornerSize; x++) {
        for (let y = roomY + 1; y < roomY + cornerSize; y++) {
          grid[x][y] = 1;
          roomTypeGrid[x][y] = roomType; // Keep room type for wall texture
        }
      }

      // Top-right corner
      for (let x = roomX + width - cornerSize; x < roomX + width - 1; x++) {
        for (let y = roomY + 1; y < roomY + cornerSize; y++) {
          grid[x][y] = 1;
          roomTypeGrid[x][y] = roomType; // Keep room type for wall texture
        }
      }

      // Bottom-left corner
      for (let x = roomX + 1; x < roomX + cornerSize; x++) {
        for (let y = roomY + height - cornerSize; y < roomY + height - 1; y++) {
          grid[x][y] = 1;
          roomTypeGrid[x][y] = roomType; // Keep room type for wall texture
        }
      }

      // Bottom-right corner
      for (let x = roomX + width - cornerSize; x < roomX + width - 1; x++) {
        for (let y = roomY + height - cornerSize; y < roomY + height - 1; y++) {
          grid[x][y] = 1;
          roomTypeGrid[x][y] = roomType; // Keep room type for wall texture
        }
      }
      break;
  }
}

// Connect rooms with simple L-shaped corridors
function connectRooms(rooms, grid, roomTypeGrid) {
  for (let i = 1; i < rooms.length; i++) {
    let minDistance = Infinity;
    let closestConnectedRoom = 0;

    // Find the closest connected room
    for (let j = 0; j < i; j++) {
      if (rooms[j].isConnected) {
        const distance = Math.sqrt(
          Math.pow(rooms[i].centerX - rooms[j].centerX, 2) +
            Math.pow(rooms[i].centerY - rooms[j].centerY, 2)
        );
        if (distance < minDistance) {
          minDistance = distance;
          closestConnectedRoom = j;
        }
      }
    }

    // Create corridor between rooms
    createCorridor(rooms[closestConnectedRoom], rooms[i], grid, roomTypeGrid);
    rooms[i].isConnected = true;
  }

  // Add a few extra corridors to create loops
  const additionalConnections = Math.min(2, Math.floor(rooms.length / 5));
  for (let i = 0; i < additionalConnections; i++) {
    const roomA = randomInt(0, rooms.length - 1);
    let roomB = randomInt(0, rooms.length - 1);
    while (roomB === roomA) {
      roomB = randomInt(0, rooms.length - 1);
    }
    createCorridor(rooms[roomA], rooms[roomB], grid, roomTypeGrid);
  }
}

// Create a simple L-shaped corridor between two rooms
function createCorridor(roomA, roomB, grid, roomTypeGrid) {
  const startX = roomA.centerX;
  const startY = roomA.centerY;
  const endX = roomB.centerX;
  const endY = roomB.centerY;

  // Carve horizontal segment
  const minX = Math.min(startX, endX);
  const maxX = Math.max(startX, endX);
  for (let x = minX; x <= maxX; x++) {
    carveCorridorSection(x, startY, grid, roomTypeGrid);
  }

  // Carve vertical segment
  const minY = Math.min(startY, endY);
  const maxY = Math.max(startY, endY);
  for (let y = minY; y <= maxY; y++) {
    carveCorridorSection(endX, y, grid, roomTypeGrid);
  }
}

// Carve a section of corridor
function carveCorridorSection(x, y, grid, roomTypeGrid) {
  const halfWidth = Math.floor(CORRIDOR_WIDTH / 2);
  for (let offsetX = -halfWidth; offsetX <= halfWidth; offsetX++) {
    for (let offsetY = -halfWidth; offsetY <= halfWidth; offsetY++) {
      const gridX = x + offsetX;
      const gridY = y + offsetY;
      if (gridX >= 0 && gridX < MAP_SIZE && gridY >= 0 && gridY < MAP_SIZE) {
        grid[gridX][gridY] = 0; // Mark as floor

        // Only set corridor type if not already part of a room
        if (!roomTypeGrid[gridX][gridY]) {
          roomTypeGrid[gridX][gridY] = "CORRIDOR"; // Mark as corridor for wall texturing
        }
      }
    }
  }
}

// Build walls based on the grid and room types
function buildWalls(facility, grid, roomTypeGrid) {
  // PERFORMANCE: Group walls by material type for better rendering
  const wallGeometriesByType = {
    [ROOM_TYPES.START]: [],
    [ROOM_TYPES.EXIT]: [],
    [ROOM_TYPES.ENEMY]: [],
    [ROOM_TYPES.HEALTH]: [],
    [ROOM_TYPES.EMPTY]: [],
    CORRIDOR: [],
    DEFAULT: [],
  };

  // Check each cell in the grid
  for (let x = 0; x < MAP_SIZE; x++) {
    for (let y = 0; y < MAP_SIZE; y++) {
      if (grid[x][y] === 1) {
        // This is a wall
        // Check if this wall should be visible (adjacent to a floor)
        const hasFloorN = y > 0 && grid[x][y - 1] === 0;
        const hasFloorS = y < MAP_SIZE - 1 && grid[x][y + 1] === 0;
        const hasFloorE = x < MAP_SIZE - 1 && grid[x + 1][y] === 0;
        const hasFloorW = x > 0 && grid[x - 1][y] === 0;

        if (hasFloorN || hasFloorS || hasFloorE || hasFloorW) {
          // Determine the room type for this wall
          let wallType = roomTypeGrid[x][y] || "DEFAULT";

          // If this wall doesn't have a type, check neighboring floor cells
          if (wallType === null) {
            if (hasFloorN && roomTypeGrid[x][y - 1])
              wallType = roomTypeGrid[x][y - 1];
            else if (hasFloorS && roomTypeGrid[x][y + 1])
              wallType = roomTypeGrid[x][y + 1];
            else if (hasFloorE && roomTypeGrid[x + 1][y])
              wallType = roomTypeGrid[x + 1][y];
            else if (hasFloorW && roomTypeGrid[x - 1][y])
              wallType = roomTypeGrid[x - 1][y];
            else wallType = "DEFAULT";
          }

          // Create a wall geometry
          const wallGeometry = new THREE.BoxGeometry(
            GRID_SIZE,
            WALL_HEIGHT,
            GRID_SIZE
          );

          // Position the wall
          wallGeometry.translate(
            (x - MAP_SIZE / 2) * GRID_SIZE + GRID_SIZE / 2,
            WALL_HEIGHT / 2,
            (y - MAP_SIZE / 2) * GRID_SIZE + GRID_SIZE / 2
          );

          // Add to appropriate array based on type
          if (wallGeometriesByType[wallType]) {
            wallGeometriesByType[wallType].push(wallGeometry);
          } else {
            wallGeometriesByType["DEFAULT"].push(wallGeometry);
          }
        }
      }
    }
  }

  // Create merged meshes for each room type
  Object.entries(wallGeometriesByType).forEach(([type, geometries]) => {
    if (geometries.length > 0) {
      try {
        // PERFORMANCE: Try to merge geometries for better rendering performance
        const mergedGeometry = BufferGeometryUtils.mergeGeometries(geometries);

        // Get material for this wall type
        const material = getMaterial("WALL", type);

        const walls = new THREE.Mesh(mergedGeometry, material);
        walls.castShadow = true;
        walls.receiveShadow = true;
        walls.userData = { isWall: true, isSolid: true, wallType: type };
        facility.add(walls);
      } catch (err) {
        console.error("Error creating merged walls:", err);

        // FALLBACK: Create individual wall meshes if merging fails
        geometries.forEach((geometry) => {
          const material = getMaterial("WALL", type);
          const wall = new THREE.Mesh(geometry, material);
          wall.castShadow = true;
          wall.receiveShadow = true;
          wall.userData = { isWall: true, isSolid: true, wallType: type };
          facility.add(wall);
        });
      }
    }
  });
}

// Add health pickups in health rooms
function addHealthPickups(facility, rooms) {
  const healthRooms = rooms.filter((room) => room.type === ROOM_TYPES.HEALTH);

  healthRooms.forEach((room) => {
    // Create a floating health pickup
    const centerX = (room.x + room.width / 2 - MAP_SIZE / 2) * GRID_SIZE;
    const centerZ = (room.y + room.height / 2 - MAP_SIZE / 2) * GRID_SIZE;

    // Create a group for the health pickup
    const healthGroup = new THREE.Group();
    healthGroup.position.set(centerX, 1.2, centerZ);
    healthGroup.name = "HealthPickup";

    // Create a simple cross shape for the health pickup
    const healthMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });

    // Horizontal part of cross
    const horizontalGeometry = new THREE.BoxGeometry(0.8, 0.2, 0.2);
    const horizontalMesh = new THREE.Mesh(horizontalGeometry, healthMaterial);
    healthGroup.add(horizontalMesh);

    // Vertical part of cross
    const verticalGeometry = new THREE.BoxGeometry(0.2, 0.2, 0.8);
    const verticalMesh = new THREE.Mesh(verticalGeometry, healthMaterial);
    healthGroup.add(verticalMesh);

    // Add point light
    const light = new THREE.PointLight(0x00ff00, 1, 3);
    light.position.set(0, 0, 0);
    healthGroup.add(light);

    // Add animation data
    healthGroup.userData = {
      isHealthPickup: true,
      healAmount: 50,
      rotationSpeed: 1,
      bobSpeed: 1,
      originalY: 1.2,
    };

    facility.add(healthGroup);
  });
}

// Spawn enemies in enemy rooms
function spawnEnemies(rooms, scene) {
  const enemyRooms = rooms.filter((room) => room.type === ROOM_TYPES.ENEMY);

  enemyRooms.forEach((room) => {
    // Determine number of enemies based on room size
    const roomArea = room.width * room.height;
    const maxEnemies = Math.min(3, Math.floor(roomArea / 30));
    const numEnemies = randomInt(1, maxEnemies);

    // Spawn enemies
    for (let i = 0; i < numEnemies; i++) {
      // Find a valid position for the enemy
      const offsetX = randomInt(1, room.width - 2);
      const offsetY = randomInt(1, room.height - 2);
      const enemyX = (room.x + offsetX - MAP_SIZE / 2) * GRID_SIZE;
      const enemyZ = (room.y + offsetY - MAP_SIZE / 2) * GRID_SIZE;

      // Choose a random enemy type
      const enemyTypes = ["scout", "tank", "sniper", "healer"];
      const randomTypeIndex = randomInt(0, enemyTypes.length - 1);
      const enemyType = enemyTypes[randomTypeIndex];

      // Spawn the enemy
      robotSpawner.spawnRobot(enemyX, enemyZ, scene, enemyType);
    }
  });
}

// Create traversability grid for AI pathfinding
function createTraversabilityGrid(grid) {
  // Create a deep copy of the grid
  const traversabilityGrid = JSON.parse(JSON.stringify(grid));

  // Mark cells near walls as cautious zones (value 2)
  for (let x = 0; x < MAP_SIZE; x++) {
    for (let y = 0; y < MAP_SIZE; y++) {
      if (grid[x][y] === 1) {
        // If this is a wall
        // Mark adjacent cells as cautious
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            const nx = x + dx;
            const ny = y + dy;
            if (
              nx >= 0 &&
              nx < MAP_SIZE &&
              ny >= 0 &&
              ny < MAP_SIZE &&
              traversabilityGrid[nx][ny] === 0
            ) {
              traversabilityGrid[nx][ny] = 2; // 2 = near wall (cautious zone)
            }
          }
        }
      }
    }
  }

  return traversabilityGrid;
}

// Helper function: Random Integer
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

export default {
  generateDungeon,
  MAP_SIZE,
  GRID_SIZE,
  ROOM_TYPES,
};
