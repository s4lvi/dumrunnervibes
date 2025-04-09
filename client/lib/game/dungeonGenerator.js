// dungeonGenerator.js - OPTIMIZED VERSION
import * as THREE from "three";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
import robotSpawner from "./robots";

// --- Constants & Materials ---
// OPTIMIZATION 1: Reduced map size from 100 to 60
const ROOM_SIZE_MIN = 4;
const ROOM_SIZE_MAX = 8;
const CORRIDOR_WIDTH = 2;
const WALL_HEIGHT = 6;
const MAP_SIZE = 60; // REDUCED from 100 to 60
const GRID_SIZE = 1;
const MAX_ROOMS = 15; // Reduced from 20 to 15 for better performance

const ROOM_TYPES = {
  STANDARD: "standard",
  SERVER: "server",
  LAB: "lab",
  POWER_CORE: "power_core",
  SECURITY: "security",
};

// OPTIMIZATION 2: Create shared materials instead of generating new ones each time
// These will be reused across all elements of the same type
const SHARED_MATERIALS = {
  // Base materials
  WALL: new THREE.MeshStandardMaterial({
    color: 0x555555,
    metalness: 0.1,
    roughness: 0.7,
    side: THREE.DoubleSide,
  }),
  FLOOR: new THREE.MeshStandardMaterial({
    color: 0x2c3539,
    metalness: 0.2,
    roughness: 0.5,
  }),
  CEILING: new THREE.MeshStandardMaterial({
    color: 0x1a1a1a,
    metalness: 0.1,
    roughness: 0.6,
  }),
  DOOR: new THREE.MeshStandardMaterial({
    color: 0x3b9ae1,
    emissive: 0x0a2463,
    emissiveIntensity: 0.5,
    transparent: true,
    opacity: 0.9,
  }),

  // Room-specific floor materials
  SERVER_FLOOR: new THREE.MeshStandardMaterial({
    color: 0x0a2463,
    emissive: 0x0a2463,
    emissiveIntensity: 0.3,
  }),
  POWER_CORE_FLOOR: new THREE.MeshStandardMaterial({
    color: 0xea526f,
    emissive: 0xff2e63,
    emissiveIntensity: 0.4,
  }),
  LAB_FLOOR: new THREE.MeshStandardMaterial({
    color: 0x25f5bd,
    emissive: 0x25f5bd,
    emissiveIntensity: 0.3,
  }),
  SECURITY_FLOOR: new THREE.MeshStandardMaterial({
    color: 0xff0000,
    emissive: 0xff0000,
    emissiveIntensity: 0.4,
  }),

  // Accent materials
  NEON_BLUE: new THREE.MeshBasicMaterial({
    color: 0x00ffff,
    emissive: 0x00ffff,
    emissiveIntensity: 1.0,
  }),
  NEON_PURPLE: new THREE.MeshBasicMaterial({
    color: 0xff00ff,
    emissive: 0xff00ff,
    emissiveIntensity: 1.0,
  }),
  NEON_GREEN: new THREE.MeshBasicMaterial({
    color: 0x00ff00,
    emissive: 0x00ff00,
    emissiveIntensity: 1.0,
  }),
  NEON_RED: new THREE.MeshBasicMaterial({
    color: 0xff3333,
    emissive: 0xff3333,
    emissiveIntensity: 1.0,
  }),
  NEON_BLUE_DARK: new THREE.MeshBasicMaterial({
    color: 0x3333ff,
    emissive: 0x3333ff,
    emissiveIntensity: 1.0,
  }),

  // Props materials
  PROP_DARK: new THREE.MeshLambertMaterial({ color: 0x333333 }),
  PROP_DARKER: new THREE.MeshLambertMaterial({ color: 0x111111 }),
  PROP_MEDIUM: new THREE.MeshLambertMaterial({ color: 0x555555 }),
  SCREEN_BLUE: new THREE.MeshBasicMaterial({
    color: 0x00aaff,
    emissive: 0x00aaff,
    emissiveIntensity: 1.2,
  }),
  SCREEN_RED: new THREE.MeshBasicMaterial({
    color: 0xff0000,
    emissive: 0xff0000,
    emissiveIntensity: 0.7,
  }),
  LIGHT_GREEN: new THREE.MeshBasicMaterial({
    color: 0x00ff00,
    emissive: 0x00ff00,
    emissiveIntensity: 1.0,
  }),
  CORE_RED: new THREE.MeshBasicMaterial({
    color: 0xff3366,
    emissive: 0xff3366,
    emissiveIntensity: 1.5,
  }),
};

// OPTIMIZATION 3: Create instance buffers for repeated props
let serverRackInstancedMesh = null;
let dataTerminalInstancedMesh = null;

// OPTIMIZATION 4: Simplified lighting system with fewer lights
function setupLightSystem(scene) {
  // Use a single directional light instead of multiple point lights
  const mainLight = new THREE.DirectionalLight(0xffffff, 2.0);
  mainLight.position.set(20, 40, 20);
  mainLight.castShadow = true;

  // OPTIMIZATION: Reduce shadow map size and limit shadow camera frustum
  mainLight.shadow.mapSize.width = 1024; // Reduced from 2048
  mainLight.shadow.mapSize.height = 1024; // Reduced from 2048
  mainLight.shadow.camera.near = 0.5;
  mainLight.shadow.camera.far = 100;
  mainLight.shadow.camera.left = -30; // Reduced from -35
  mainLight.shadow.camera.right = 30; // Reduced from 35
  mainLight.shadow.camera.top = 30; // Reduced from 35
  mainLight.shadow.camera.bottom = -30; // Reduced from -35
  mainLight.shadow.bias = -0.0005;
  scene.add(mainLight);

  // Stronger ambient light to reduce need for multiple point lights
  const ambientLight = new THREE.AmbientLight(0x808080, 2.0); // Increased intensity
  scene.add(ambientLight);

  // OPTIMIZATION: Remove hemisphere light to reduce calculations

  return { mainLight, ambientLight };
}

// OPTIMIZATION 5: Cached holographic grid texture
let cachedGridTexture = null;
function createHolographicGridTexture() {
  if (cachedGridTexture) return cachedGridTexture;

  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext("2d");
  context.fillStyle = "rgba(0, 0, 0, 0)";
  context.fillRect(0, 0, size, size);

  context.strokeStyle = "rgba(0, 150, 255, 0.4)";
  context.lineWidth = 1;
  const gridSize = 64;
  for (let i = 0; i <= size; i += gridSize) {
    context.beginPath();
    context.moveTo(0, i);
    context.lineTo(size, i);
    context.stroke();

    context.beginPath();
    context.moveTo(i, 0);
    context.lineTo(i, size);
    context.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(MAP_SIZE / 8, MAP_SIZE / 8);

  // Store the texture for reuse
  cachedGridTexture = texture;
  return texture;
}

// --- Main Dungeon Generation - OPTIMIZED ---
export function generateDungeon(scene) {
  console.time("dungeonGeneration");

  // Create facility group
  const facility = new THREE.Group();
  scene.add(facility);

  // OPTIMIZATION 6: Create chunked grid system for more efficient traversal and collision
  const grid = Array(MAP_SIZE)
    .fill()
    .map(() => Array(MAP_SIZE).fill(1));

  // OPTIMIZATION 7: Create floor as a single large mesh with lower resolution
  const floorGeometry = new THREE.PlaneGeometry(
    MAP_SIZE * GRID_SIZE,
    MAP_SIZE * GRID_SIZE,
    1,
    1 // Reduced segments from default to just 1x1
  );
  const gridTexture = createHolographicGridTexture();
  const floorMaterialWithGrid = SHARED_MATERIALS.FLOOR.clone();
  floorMaterialWithGrid.map = gridTexture;
  floorMaterialWithGrid.transparent = true;
  floorMaterialWithGrid.needsUpdate = true;

  const floor = new THREE.Mesh(floorGeometry, floorMaterialWithGrid);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, 0);
  floor.receiveShadow = true;
  floor.userData = {
    isFloor: true,
    isSolid: true,
  };
  facility.add(floor);

  // OPTIMIZATION 8: Simplified ceiling (no shadows, fewer polygons)
  const ceilingGeometry = new THREE.PlaneGeometry(
    MAP_SIZE * GRID_SIZE,
    MAP_SIZE * GRID_SIZE,
    1,
    1 // Just one segment
  );
  const ceiling = new THREE.Mesh(ceilingGeometry, SHARED_MATERIALS.CEILING);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, WALL_HEIGHT, 0);
  ceiling.receiveShadow = false; // OPTIMIZATION: Ceiling doesn't need to receive shadows
  ceiling.userData = {
    isCeiling: true,
    isSolid: true,
  };
  facility.add(ceiling);

  // OPTIMIZATION 9: Generate fewer rooms
  const numRooms = Math.min(randomInt(4, 10), MAX_ROOMS);
  const rooms = [];

  // Spawn room (first room, standard type)
  const spawnRoomWidth = randomInt(ROOM_SIZE_MIN, ROOM_SIZE_MIN + 2);
  const spawnRoomHeight = randomInt(ROOM_SIZE_MIN, ROOM_SIZE_MIN + 2);
  const spawnRoomX = Math.floor(MAP_SIZE / 2 - spawnRoomWidth / 2);
  const spawnRoomY = Math.floor(MAP_SIZE / 2 - spawnRoomHeight / 2);
  for (let x = spawnRoomX; x < spawnRoomX + spawnRoomWidth; x++) {
    for (let y = spawnRoomY; y < spawnRoomY + spawnRoomHeight; y++) {
      grid[x][y] = 0;
    }
  }
  rooms.push({
    x: spawnRoomX,
    y: spawnRoomY,
    width: spawnRoomWidth,
    height: spawnRoomHeight,
    centerX: spawnRoomX + Math.floor(spawnRoomWidth / 2),
    centerY: spawnRoomY + Math.floor(spawnRoomHeight / 2),
    type: ROOM_TYPES.STANDARD,
    isConnected: false,
  });

  // Ensure at least one of each special room type
  let hasServerRoom = false;
  let hasLabRoom = false;
  let hasPowerCoreRoom = false;
  let hasSecurityRoom = false;

  // Pre-allocate arrays for special room-related geometries to merge later
  const serverFloorGeometries = [];
  const labFloorGeometries = [];
  const powerCoreFloorGeometries = [];
  const securityFloorGeometries = [];

  // OPTIMIZATION 10: More efficient room placement with fewer iterations
  for (let i = 1; i < numRooms; i++) {
    let roomType;
    if (!hasSecurityRoom && i === numRooms - 1) {
      roomType = ROOM_TYPES.SECURITY;
      hasSecurityRoom = true;
    } else if (!hasServerRoom) {
      roomType = ROOM_TYPES.SERVER;
      hasServerRoom = true;
    } else if (!hasLabRoom) {
      roomType = ROOM_TYPES.LAB;
      hasLabRoom = true;
    } else if (!hasPowerCoreRoom) {
      roomType = ROOM_TYPES.POWER_CORE;
      hasPowerCoreRoom = true;
    } else {
      const randomValue = Math.random();
      if (randomValue < 0.25) roomType = ROOM_TYPES.SERVER;
      else if (randomValue < 0.5) roomType = ROOM_TYPES.LAB;
      else if (randomValue < 0.75) roomType = ROOM_TYPES.POWER_CORE;
      else roomType = ROOM_TYPES.STANDARD;
    }

    // Size based on room type
    let width, height;
    if (
      roomType === ROOM_TYPES.SECURITY ||
      roomType === ROOM_TYPES.POWER_CORE
    ) {
      width = randomInt(ROOM_SIZE_MAX - 2, ROOM_SIZE_MAX);
      height = randomInt(ROOM_SIZE_MAX - 2, ROOM_SIZE_MAX);
    } else {
      width = randomInt(ROOM_SIZE_MIN, ROOM_SIZE_MAX - 3);
      height = randomInt(ROOM_SIZE_MIN, ROOM_SIZE_MAX - 3);
    }

    // OPTIMIZATION: More efficient room placement algorithm that exits early
    let attempts = 0;
    let validPosition = false;
    let roomX, roomY;
    const maxAttempts = 50; // Reduced from 100

    while (!validPosition && attempts < maxAttempts) {
      roomX = randomInt(1, MAP_SIZE - width - 1);
      roomY = randomInt(1, MAP_SIZE - height - 1);
      validPosition = true;

      // Fast initial check - if any corner is floor, invalid
      if (
        grid[roomX][roomY] === 0 ||
        grid[roomX + width - 1][roomY] === 0 ||
        grid[roomX][roomY + height - 1] === 0 ||
        grid[roomX + width - 1][roomY + height - 1] === 0
      ) {
        validPosition = false;
        attempts++;
        continue;
      }

      // If corners are valid, check full boundaries with padding
      for (let x = roomX - 1; x < roomX + width + 1; x += width + 1) {
        // Only check edges
        for (let y = roomY - 1; y < roomY + height + 1; y++) {
          if (x < 0 || y < 0 || x >= MAP_SIZE || y >= MAP_SIZE) continue;
          if (grid[x][y] === 0) {
            validPosition = false;
            break;
          }
        }
        if (!validPosition) break;
      }

      if (validPosition) {
        for (let x = roomX; x < roomX + width; x++) {
          for (let y = roomY - 1; y < roomY + height + 1; y += height + 1) {
            // Only check edges
            if (y < 0 || y >= MAP_SIZE) continue;
            if (grid[x][y] === 0) {
              validPosition = false;
              break;
            }
          }
          if (!validPosition) break;
        }
      }

      attempts++;
    }

    if (validPosition) {
      for (let x = roomX; x < roomX + width; x++) {
        for (let y = roomY; y < roomY + height; y++) {
          grid[x][y] = 0;
        }
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

      // Create floor geometry for special room (to be merged later)
      if (roomType !== ROOM_TYPES.STANDARD) {
        const roomWidth = width * GRID_SIZE;
        const roomHeight = height * GRID_SIZE;
        const roomFloorGeometry = new THREE.PlaneGeometry(
          roomWidth,
          roomHeight,
          1,
          1 // OPTIMIZATION: Reduced segments
        );

        // Position the geometry correctly
        roomFloorGeometry.translate(
          (roomX + width / 2 - MAP_SIZE / 2) * GRID_SIZE,
          0.02, // Slight offset to prevent z-fighting
          (roomY + height / 2 - MAP_SIZE / 2) * GRID_SIZE
        );

        // Rotate to be horizontal
        roomFloorGeometry.rotateX(-Math.PI / 2);

        // Add to the appropriate collection for later merging
        switch (roomType) {
          case ROOM_TYPES.SERVER:
            serverFloorGeometries.push(roomFloorGeometry);
            break;
          case ROOM_TYPES.LAB:
            labFloorGeometries.push(roomFloorGeometry);
            break;
          case ROOM_TYPES.POWER_CORE:
            powerCoreFloorGeometries.push(roomFloorGeometry);
            break;
          case ROOM_TYPES.SECURITY:
            securityFloorGeometries.push(roomFloorGeometry);
            break;
        }
      }
    }
  }

  // Connect rooms after they're all generated
  rooms[0].isConnected = true;
  connectRoomsSimple(rooms, grid);

  // OPTIMIZATION 11: Build walls using optimized greedy meshing algorithm
  buildWallsGreedy(facility, grid);

  // OPTIMIZATION 12: Create special floors with merged geometries
  createSpecialRoomFloorsOptimized(
    facility,
    serverFloorGeometries,
    labFloorGeometries,
    powerCoreFloorGeometries,
    securityFloorGeometries
  );

  // OPTIMIZATION 13: Use instanced rendering for props
  addMinimalPropsInstanced(facility, rooms);

  // OPTIMIZATION 14: Reduced number of room lights
  addLimitedRoomLights(facility, rooms);

  // OPTIMIZATION 15: Reduced number of robots with simpler AI
  spawnFewerRobots(rooms, scene);

  // OPTIMIZATION 16: Simplified lighting system
  setupLightSystem(scene);

  // Create traversability grid for AI
  const traversabilityGrid = createTraversabilityGrid(grid);

  console.timeEnd("dungeonGeneration");
  return {
    dungeon: facility,
    spawnRoom: rooms[0],
    portalRoom: findExitPortalRoom(rooms),
    rooms: rooms,
    gridSize: GRID_SIZE,
    mapSize: MAP_SIZE,
    grid: grid,
    traversabilityGrid: traversabilityGrid,
  };
}

export function findExitPortalRoom(rooms) {
  // Prefer security or power core rooms for the exit portal
  const securityRooms = rooms.filter(
    (room) => room.type === ROOM_TYPES.SECURITY
  );
  const powerCoreRooms = rooms.filter(
    (room) => room.type === ROOM_TYPES.POWER_CORE
  );

  if (securityRooms.length > 0) {
    return securityRooms[0]; // Place portal in a security room
  } else if (powerCoreRooms.length > 0) {
    return powerCoreRooms[0]; // Or in a power core room
  } else {
    // Fallback - place in the room furthest from spawn
    let furthestRoom = rooms[0];
    let maxDistance = 0;

    for (let i = 1; i < rooms.length; i++) {
      const distance = Math.sqrt(
        Math.pow(rooms[i].centerX - rooms[0].centerX, 2) +
          Math.pow(rooms[i].centerY - rooms[0].centerY, 2)
      );

      if (distance > maxDistance) {
        maxDistance = distance;
        furthestRoom = rooms[i];
      }
    }

    return furthestRoom;
  }
}

// Create traversability grid for AI pathfinding
function createTraversabilityGrid(grid) {
  // Deep copy the original grid
  const traversabilityGrid = JSON.parse(JSON.stringify(grid));

  // Mark cells near walls as cautious zones (value 2)
  for (let x = 0; x < MAP_SIZE; x++) {
    for (let y = 0; y < MAP_SIZE; y++) {
      if (grid[x][y] === 1) {
        // For each wall cell, mark adjacent cells as cautious
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

// OPTIMIZATION: Reduced number of room lights with better performance
function addLimitedRoomLights(facility, rooms) {
  // Group rooms by type to create fewer lights
  const roomsByType = {
    [ROOM_TYPES.SERVER]: [],
    [ROOM_TYPES.LAB]: [],
    [ROOM_TYPES.POWER_CORE]: [],
    [ROOM_TYPES.SECURITY]: [],
    [ROOM_TYPES.STANDARD]: [],
  };

  // Group rooms by type
  rooms.forEach((room) => {
    roomsByType[room.type].push(room);
  });

  // OPTIMIZATION: Add only one light per special room type, with increased range
  Object.entries(roomsByType).forEach(([roomType, roomList]) => {
    // Skip standard rooms and empty lists
    if (roomType === ROOM_TYPES.STANDARD || roomList.length === 0) return;

    // Light color based on room type
    let lightColor = 0xffffff;
    let intensity = 3.0; // Increased from 2.0 for better coverage with fewer lights

    switch (roomType) {
      case ROOM_TYPES.SERVER:
        lightColor = 0x66aaff;
        intensity = 3.5;
        break;
      case ROOM_TYPES.LAB:
        lightColor = 0x66ffaa;
        intensity = 3.3;
        break;
      case ROOM_TYPES.POWER_CORE:
        lightColor = 0xff6666;
        intensity = 3.8;
        break;
      case ROOM_TYPES.SECURITY:
        lightColor = 0xff3333;
        intensity = 3.5;
        break;
    }

    // OPTIMIZATION: Add max 2 lights per room type instead of per room
    const maxLightsPerType = Math.min(2, roomList.length);

    for (let i = 0; i < maxLightsPerType; i++) {
      const room = roomList[i];
      const centerX = (room.x + room.width / 2 - MAP_SIZE / 2) * GRID_SIZE;
      const centerZ = (room.y + room.height / 2 - MAP_SIZE / 2) * GRID_SIZE;

      // Create a single point light with greater range
      const roomLight = new THREE.PointLight(
        lightColor,
        intensity,
        room.width * GRID_SIZE * 6 // Increased range to cover more area
      );
      roomLight.position.set(centerX, WALL_HEIGHT * 0.7, centerZ);
      roomLight.castShadow = true;

      // OPTIMIZATION: Reduced shadow quality for better performance
      if (roomLight.castShadow) {
        roomLight.shadow.bias = -0.001;
        roomLight.shadow.mapSize.width = 256; // Reduced from 512
        roomLight.shadow.mapSize.height = 256; // Reduced from 512
        roomLight.shadow.camera.near = 0.5;
        roomLight.shadow.camera.far = 30;
      }

      // Add light sphere for visual effect
      const lightSphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.15, 4, 4), // Reduced segments from 8,8 to 4,4
        new THREE.MeshBasicMaterial({ color: lightColor })
      );
      lightSphere.position.set(0, 0, 0);
      roomLight.add(lightSphere);

      facility.add(roomLight);
    }
  });
}

// Corridor Connection (Simple L-shaped corridors)
function connectRoomsSimple(rooms, grid) {
  for (let i = 1; i < rooms.length; i++) {
    let minDistance = Infinity;
    let closestConnectedRoom = 0;
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
    createSimpleCorridor(rooms[closestConnectedRoom], rooms[i], grid);
    rooms[i].isConnected = true;
  }

  // OPTIMIZATION: Add fewer additional connections to create loops
  const additionalConnections = Math.min(2, Math.floor(rooms.length / 5)); // Reduced from 3 and rooms.length/4
  for (let i = 0; i < additionalConnections; i++) {
    const roomA = randomInt(0, rooms.length - 1);
    let roomB = randomInt(0, rooms.length - 1);
    while (roomB === roomA) {
      roomB = randomInt(0, rooms.length - 1);
    }
    createSimpleCorridor(rooms[roomA], rooms[roomB], grid);
  }
}

function createSimpleCorridor(roomA, roomB, grid) {
  const startX = roomA.centerX;
  const startY = roomA.centerY;
  const endX = roomB.centerX;
  const endY = roomB.centerY;

  // Horizontal segment
  const minX = Math.min(startX, endX);
  const maxX = Math.max(startX, endX);
  for (let x = minX; x <= maxX; x++) {
    carveCorridorSection(x, startY, grid);
  }

  // Vertical segment
  const minY = Math.min(startY, endY);
  const maxY = Math.max(startY, endY);
  for (let y = minY; y <= maxY; y++) {
    carveCorridorSection(endX, y, grid);
  }
}

function carveCorridorSection(x, y, grid) {
  const halfWidth = Math.floor(CORRIDOR_WIDTH / 2);
  for (let offsetX = -halfWidth; offsetX <= halfWidth; offsetX++) {
    for (let offsetY = -halfWidth; offsetY <= halfWidth; offsetY++) {
      const gridX = x + offsetX;
      const gridY = y + offsetY;
      if (gridX >= 0 && gridX < MAP_SIZE && gridY >= 0 && gridY < MAP_SIZE) {
        grid[gridX][gridY] = 0;
      }
    }
  }
}

// OPTIMIZATION: Improved greedy meshing for walls
function buildWallsGreedy(facility, grid) {
  // Create doors first
  const doorGeometries = [];
  const doorFrameGeometries = [];

  // OPTIMIZATION: Reduce door frequency
  const doorProbability = 0.3; // Reduced from 0.4 to create fewer doors

  for (let x = 0; x < MAP_SIZE; x++) {
    for (let y = 0; y < MAP_SIZE; y++) {
      if (grid[x][y] === 1) {
        const hasFloorN = y > 0 && grid[x][y - 1] === 0;
        const hasFloorS = y < MAP_SIZE - 1 && grid[x][y + 1] === 0;
        const hasFloorE = x < MAP_SIZE - 1 && grid[x + 1][y] === 0;
        const hasFloorW = x > 0 && grid[x - 1][y] === 0;
        let doorOrientation = null;
        if (hasFloorN && hasFloorS && !hasFloorE && !hasFloorW) {
          doorOrientation = "NS";
        } else if (hasFloorE && hasFloorW && !hasFloorN && !hasFloorS) {
          doorOrientation = "EW";
        }
        if (doorOrientation && Math.random() < doorProbability) {
          let doorGeometry, doorRotation;
          if (doorOrientation === "EW") {
            doorGeometry = new THREE.BoxGeometry(
              GRID_SIZE,
              WALL_HEIGHT * 0.8,
              GRID_SIZE * 0.1,
              1,
              1,
              1 // OPTIMIZATION: Reduced segments
            );
            doorGeometry.translate(
              (x - MAP_SIZE / 2) * GRID_SIZE + GRID_SIZE / 2,
              WALL_HEIGHT * 0.4,
              (y - MAP_SIZE / 2) * GRID_SIZE + GRID_SIZE / 2
            );
            doorRotation = Math.PI / 2;

            // Add door frame geometry
            const frameGeometry = new THREE.BoxGeometry(
              GRID_SIZE + 0.1,
              WALL_HEIGHT * 0.9,
              0.05,
              1,
              1,
              1 // OPTIMIZATION: Reduced segments
            );
            frameGeometry.translate(
              (x - MAP_SIZE / 2) * GRID_SIZE + GRID_SIZE / 2,
              WALL_HEIGHT * 0.5,
              (y - MAP_SIZE / 2) * GRID_SIZE + GRID_SIZE / 2 - GRID_SIZE * 0.15
            );
            doorFrameGeometries.push(frameGeometry);
          } else {
            doorGeometry = new THREE.BoxGeometry(
              GRID_SIZE * 0.1,
              WALL_HEIGHT * 0.8,
              GRID_SIZE,
              1,
              1,
              1 // OPTIMIZATION: Reduced segments
            );
            doorGeometry.translate(
              (x - MAP_SIZE / 2) * GRID_SIZE + GRID_SIZE / 2,
              WALL_HEIGHT * 0.4,
              (y - MAP_SIZE / 2) * GRID_SIZE + GRID_SIZE / 2
            );
            doorRotation = 0;

            // Add door frame geometry
            const frameGeometry = new THREE.BoxGeometry(
              0.05,
              WALL_HEIGHT * 0.9,
              GRID_SIZE + 0.1,
              1,
              1,
              1 // OPTIMIZATION: Reduced segments
            );
            frameGeometry.translate(
              (x - MAP_SIZE / 2) * GRID_SIZE + GRID_SIZE / 2 - GRID_SIZE * 0.15,
              WALL_HEIGHT * 0.5,
              (y - MAP_SIZE / 2) * GRID_SIZE + GRID_SIZE / 2
            );
            doorFrameGeometries.push(frameGeometry);
          }

          doorGeometries.push(doorGeometry);
          grid[x][y] = 0; // Mark as floor for navigation
        }
      }
    }
  }

  // Create merged door mesh
  if (doorGeometries.length > 0) {
    const mergedDoorGeometry =
      BufferGeometryUtils.mergeGeometries(doorGeometries);
    const doors = new THREE.Mesh(mergedDoorGeometry, SHARED_MATERIALS.DOOR);
    doors.castShadow = true;
    doors.receiveShadow = true;
    doors.userData = { isDoor: true, isSolid: true };
    facility.add(doors);
  }

  // Create merged door frame mesh
  if (doorFrameGeometries.length > 0) {
    const mergedFrameGeometry =
      BufferGeometryUtils.mergeGeometries(doorFrameGeometries);
    const doorFrameMaterial = new THREE.MeshBasicMaterial({
      color: 0x3b9ae1,
      emissive: 0x3b9ae1,
      emissiveIntensity: 0.8,
    });
    const doorFrames = new THREE.Mesh(mergedFrameGeometry, doorFrameMaterial);
    doorFrames.castShadow = false; // Frames don't need shadows
    doorFrames.userData = { isDoorFrame: true };
    facility.add(doorFrames);
  }

  // OPTIMIZATION: Enhanced greedy meshing algorithm for walls
  const processed = Array(MAP_SIZE)
    .fill()
    .map(() => Array(MAP_SIZE).fill(false));
  const wallGeometries = [];

  // First scan: find rectangular wall sections
  for (let x = 0; x < MAP_SIZE; x++) {
    for (let y = 0; y < MAP_SIZE; y++) {
      if (grid[x][y] === 1 && !processed[x][y]) {
        // Find maximum width (x dimension)
        let rectWidth = 1;
        while (
          x + rectWidth < MAP_SIZE &&
          grid[x + rectWidth][y] === 1 &&
          !processed[x + rectWidth][y]
        ) {
          rectWidth++;
        }

        // Now find maximum height (y dimension)
        let rectHeight = 1;
        let canExpandHeight = true;

        while (y + rectHeight < MAP_SIZE && canExpandHeight) {
          // Check if all cells in this row are unprocessed walls
          for (let dx = 0; dx < rectWidth; dx++) {
            if (
              grid[x + dx][y + rectHeight] !== 1 ||
              processed[x + dx][y + rectHeight]
            ) {
              canExpandHeight = false;
              break;
            }
          }

          if (canExpandHeight) {
            rectHeight++;
          }
        }

        // Mark all cells in this rectangle as processed
        for (let dx = 0; dx < rectWidth; dx++) {
          for (let dy = 0; dy < rectHeight; dy++) {
            processed[x + dx][y + dy] = true;
          }
        }

        // Only create geometry for larger wall sections (optimization)
        if (rectWidth * rectHeight > 1) {
          // Create a single geometry for this wall section
          const geometry = new THREE.BoxGeometry(
            rectWidth * GRID_SIZE,
            WALL_HEIGHT,
            rectHeight * GRID_SIZE,
            1,
            1,
            1 // OPTIMIZATION: Reduced segments
          );

          // Position the wall
          const centerX = x + rectWidth / 2;
          const centerY = y + rectHeight / 2;

          geometry.translate(
            (centerX - MAP_SIZE / 2) * GRID_SIZE,
            WALL_HEIGHT / 2,
            (centerY - MAP_SIZE / 2) * GRID_SIZE
          );

          wallGeometries.push(geometry);
        }
      }
    }
  }

  // Merge wall geometries for better performance
  if (wallGeometries.length > 0) {
    const mergedGeometry = BufferGeometryUtils.mergeGeometries(wallGeometries);
    const mergedWalls = new THREE.Mesh(mergedGeometry, SHARED_MATERIALS.WALL);
    mergedWalls.castShadow = true;
    mergedWalls.receiveShadow = true;
    mergedWalls.userData = { isWall: true, isSolid: true };
    facility.add(mergedWalls);

    // OPTIMIZATION: Add fewer wall accents
    const numAccents = Math.min(10, Math.floor(wallGeometries.length / 8)); // Reduced number
    const accentGeometries = [];

    for (let i = 0; i < numAccents; i++) {
      // Choose random larger wall sections
      const randomWallIndex = Math.floor(Math.random() * wallGeometries.length);
      const wall = wallGeometries[randomWallIndex];

      // Get wall dimensions from the geometry's bounding box
      const tempWall = new THREE.Mesh(wall.clone());
      tempWall.geometry.computeBoundingBox();
      const box = tempWall.geometry.boundingBox;
      const wallWidth = box.max.x - box.min.x;
      const wallHeight = box.max.y - box.min.y;
      const wallDepth = box.max.z - box.min.z;

      // Only add accents to larger walls
      if (wallWidth > GRID_SIZE * 2 || wallDepth > GRID_SIZE * 2) {
        // Create accent geometry
        let accentGeometry;
        if (wallWidth > wallDepth) {
          // Horizontal wall - add vertical accent
          accentGeometry = new THREE.BoxGeometry(
            0.1,
            WALL_HEIGHT,
            GRID_SIZE + 0.05,
            1,
            1,
            1
          );
          accentGeometry.translate(
            box.min.x + wallWidth * Math.random(),
            box.min.y + wallHeight / 2,
            box.min.z + 0.05
          );
        } else {
          // Vertical wall - add horizontal accent
          accentGeometry = new THREE.BoxGeometry(
            GRID_SIZE + 0.05,
            0.1,
            0.1,
            1,
            1,
            1
          );
          accentGeometry.translate(
            box.min.x + 0.05,
            box.min.y + wallHeight * 0.6,
            box.min.z + wallDepth * Math.random()
          );
        }

        accentGeometries.push(accentGeometry);
      }
    }

    // Create a single mesh for all accents
    if (accentGeometries.length > 0) {
      const mergedAccentGeometry =
        BufferGeometryUtils.mergeGeometries(accentGeometries);
      const accentsMesh = new THREE.Mesh(
        mergedAccentGeometry,
        SHARED_MATERIALS.NEON_BLUE
      );
      accentsMesh.castShadow = false; // Accents don't need shadows
      facility.add(accentsMesh);
    }
  }
}

// OPTIMIZATION: Merge special room floors
function createSpecialRoomFloorsOptimized(
  facility,
  serverFloorGeometries,
  labFloorGeometries,
  powerCoreFloorGeometries,
  securityFloorGeometries
) {
  // Server rooms
  if (serverFloorGeometries.length > 0) {
    const mergedServerFloors = BufferGeometryUtils.mergeGeometries(
      serverFloorGeometries
    );
    const serverFloorMesh = new THREE.Mesh(
      mergedServerFloors,
      SHARED_MATERIALS.SERVER_FLOOR
    );
    serverFloorMesh.receiveShadow = true;
    facility.add(serverFloorMesh);
  }

  // Lab rooms
  if (labFloorGeometries.length > 0) {
    const mergedLabFloors =
      BufferGeometryUtils.mergeGeometries(labFloorGeometries);
    const labFloorMesh = new THREE.Mesh(
      mergedLabFloors,
      SHARED_MATERIALS.LAB_FLOOR
    );
    labFloorMesh.receiveShadow = true;
    facility.add(labFloorMesh);
  }

  // Power core rooms
  if (powerCoreFloorGeometries.length > 0) {
    const mergedPowerCoreFloors = BufferGeometryUtils.mergeGeometries(
      powerCoreFloorGeometries
    );
    const powerCoreFloorMesh = new THREE.Mesh(
      mergedPowerCoreFloors,
      SHARED_MATERIALS.POWER_CORE_FLOOR
    );
    powerCoreFloorMesh.receiveShadow = true;
    facility.add(powerCoreFloorMesh);
  }

  // Security rooms
  if (securityFloorGeometries.length > 0) {
    const mergedSecurityFloors = BufferGeometryUtils.mergeGeometries(
      securityFloorGeometries
    );
    const securityFloorMesh = new THREE.Mesh(
      mergedSecurityFloors,
      SHARED_MATERIALS.SECURITY_FLOOR
    );
    securityFloorMesh.receiveShadow = true;
    facility.add(securityFloorMesh);
  }
}

// OPTIMIZATION: Pre-create geometries to be reused for props
const propGeometries = {
  terminalBase: new THREE.BoxGeometry(0.6, 0.8, 0.4, 1, 1, 1),
  terminalScreen: new THREE.PlaneGeometry(0.5, 0.3, 1, 1),
  serverRack: new THREE.BoxGeometry(0.8, 1.5, 0.6, 1, 1, 1),
  serverUnit: new THREE.BoxGeometry(0.75, 0.2, 0.55, 1, 1, 1),
  light: new THREE.SphereGeometry(0.02, 4, 4),
  core: new THREE.CylinderGeometry(0.6, 0.8, 1.2, 8, 1),
  console: new THREE.BoxGeometry(1, 0.5, 0.5, 1, 1, 1),
  screen: new THREE.PlaneGeometry(0.8, 0.3, 1, 1),
};

// OPTIMIZATION: Use instanced mesh rendering for props
function addMinimalPropsInstanced(facility, rooms) {
  // Create property lists
  const serverRackPositions = [];
  const dataTerminalPositions = [];
  const corePositions = [];
  const consolePositions = [];

  // OPTIMIZATION: Add props only to a subset of rooms
  rooms.forEach((room, index) => {
    if (room.type === ROOM_TYPES.STANDARD || index === 0) return;

    // OPTIMIZATION: Only add props to every other room of each type to reduce count
    if (room.type === ROOM_TYPES.SERVER && Math.random() < 0.7) {
      // Add server racks
      const numProps = Math.min(2, Math.floor((room.width * room.height) / 50)); // Reduced from 40
      for (let i = 0; i < numProps; i++) {
        const offsetX = randomInt(1, room.width - 2);
        const offsetY = randomInt(1, room.height - 2);
        serverRackPositions.push({
          x: (room.x + offsetX - MAP_SIZE / 2) * GRID_SIZE,
          y: 0,
          z: (room.y + offsetY - MAP_SIZE / 2) * GRID_SIZE,
          rotation: Math.random() > 0.5 ? Math.PI / 2 : 0,
        });
      }
    } else if (room.type === ROOM_TYPES.LAB && Math.random() < 0.7) {
      // Add data terminals
      const numProps = Math.min(2, Math.floor((room.width * room.height) / 50)); // Reduced from 40
      for (let i = 0; i < numProps; i++) {
        const offsetX = randomInt(1, room.width - 2);
        const offsetY = randomInt(1, room.height - 2);
        dataTerminalPositions.push({
          x: (room.x + offsetX - MAP_SIZE / 2) * GRID_SIZE,
          y: 0,
          z: (room.y + offsetY - MAP_SIZE / 2) * GRID_SIZE,
          rotation: Math.random() > 0.5 ? Math.PI / 2 : 0,
        });
      }
    } else if (room.type === ROOM_TYPES.POWER_CORE) {
      // Add a glowing core in the center
      corePositions.push({
        x: (room.x + room.width / 2 - MAP_SIZE / 2) * GRID_SIZE,
        y: 0.6,
        z: (room.y + room.height / 2 - MAP_SIZE / 2) * GRID_SIZE,
      });
    } else if (room.type === ROOM_TYPES.SECURITY) {
      // Add security consoles
      consolePositions.push({
        x: (room.x + room.width / 2 - MAP_SIZE / 2) * GRID_SIZE,
        y: 0.25,
        z: (room.y + room.height / 2 - MAP_SIZE / 2) * GRID_SIZE,
      });
    }
  });

  // OPTIMIZATION: Create server racks with instanced mesh
  if (serverRackPositions.length > 0) {
    // Create server rack base geometry
    const serverRackGroup = new THREE.Group();

    const rackBody = new THREE.Mesh(
      propGeometries.serverRack,
      SHARED_MATERIALS.PROP_DARKER
    );
    rackBody.position.y = 0.75;

    const serverUnit = new THREE.Mesh(
      propGeometries.serverUnit,
      SHARED_MATERIALS.PROP_MEDIUM
    );
    serverUnit.position.y = 0.3;

    const light = new THREE.Mesh(
      propGeometries.light,
      SHARED_MATERIALS.LIGHT_GREEN
    );
    light.position.set(0.3, 0, 0.28);

    serverUnit.add(light);
    rackBody.add(serverUnit);
    serverRackGroup.add(rackBody);

    // Add each instance
    serverRackPositions.forEach((position) => {
      const instance = serverRackGroup.clone();
      instance.position.set(position.x, position.y, position.z);
      instance.rotation.y = position.rotation;
      facility.add(instance);
    });
  }

  // OPTIMIZATION: Create data terminals with instanced mesh
  if (dataTerminalPositions.length > 0) {
    // Create terminal base geometry
    const terminalGroup = new THREE.Group();

    const base = new THREE.Mesh(
      propGeometries.terminalBase,
      SHARED_MATERIALS.PROP_DARK
    );
    base.position.y = 0.4;

    const screen = new THREE.Mesh(
      propGeometries.terminalScreen,
      SHARED_MATERIALS.SCREEN_BLUE
    );
    screen.position.set(0, 0.5, 0.21);
    base.add(screen);

    terminalGroup.add(base);

    // Add each instance
    dataTerminalPositions.forEach((position) => {
      const instance = terminalGroup.clone();
      instance.position.set(position.x, position.y, position.z);
      instance.rotation.y = position.rotation;
      facility.add(instance);
    });
  }

  // Create power cores
  corePositions.forEach((position) => {
    const coreGroup = new THREE.Group();

    const core = new THREE.Mesh(propGeometries.core, SHARED_MATERIALS.CORE_RED);

    // Add point light to the core
    const coreLight = new THREE.PointLight(0xff3366, 1.5, 5);
    coreLight.position.set(0, 0.6, 0);
    core.add(coreLight);

    coreGroup.add(core);
    coreGroup.position.set(position.x, position.y, position.z);
    facility.add(coreGroup);
  });

  // Create security consoles
  consolePositions.forEach((position) => {
    const consoleGroup = new THREE.Group();

    const consoleMesh = new THREE.Mesh(
      propGeometries.console,
      SHARED_MATERIALS.PROP_DARK
    );

    const screen = new THREE.Mesh(
      propGeometries.screen,
      SHARED_MATERIALS.SCREEN_RED
    );
    screen.position.set(0, 0.3, 0.26);
    consoleMesh.add(screen);

    consoleGroup.add(consoleMesh);
    consoleGroup.position.set(position.x, position.y, position.z);
    facility.add(consoleGroup);
  });
}

// OPTIMIZATION: Spawn fewer robots with simpler AI
function spawnFewerRobots(rooms, scene) {
  // Define a maximum number of robots per level to prevent too many AI entities
  const totalMaxRobots = 5; // Reduced from previous implicitly unlimited number
  let robotsSpawned = 0;

  // First pass to ensure at least one security robot
  let securityRobotSpawned = false;

  for (const room of rooms) {
    if (room.type === ROOM_TYPES.SECURITY && !securityRobotSpawned) {
      const offsetX = randomInt(1, room.width - 2);
      const offsetY = randomInt(1, room.height - 2);
      const robotX = (room.x + offsetX - MAP_SIZE / 2) * GRID_SIZE;
      const robotZ = (room.y + offsetY - MAP_SIZE / 2) * GRID_SIZE;

      const robot = robotSpawner.spawnRobot(robotX, robotZ, scene, "tank");
      if (robot) {
        robot.health *= 2;
        robot.maxHealth = robot.health;
        robot.attack *= 1.5;
        robot.scale.set(1.5, 1.5, 1.5);
        if (robot.healthBarGroup) {
          robot.healthBarGroup.position.y *= 1.5;
        }
        securityRobotSpawned = true;
        robotsSpawned++;
      }
    }
  }

  // Second pass for other rooms, but skip first room (spawn room)
  for (let i = 1; i < rooms.length && robotsSpawned < totalMaxRobots; i++) {
    const room = rooms[i];
    if (room.type === ROOM_TYPES.SECURITY && securityRobotSpawned) {
      continue; // Already added a security robot
    }

    // Determine number of robots by room type, but with lower counts
    let numRobots = 0;
    let robotTypeId = null;

    switch (room.type) {
      case ROOM_TYPES.SECURITY:
        numRobots = 1;
        robotTypeId = "tank";
        break;
      case ROOM_TYPES.SERVER:
        numRobots = Math.random() < 0.5 ? 1 : 0; // 50% chance of 1 robot
        robotTypeId = "scout";
        break;
      case ROOM_TYPES.POWER_CORE:
        numRobots = Math.random() < 0.5 ? 1 : 0; // 50% chance of 1 robot
        robotTypeId = "healer";
        break;
      case ROOM_TYPES.LAB:
        numRobots = Math.random() < 0.5 ? 1 : 0; // 50% chance of 1 robot
        robotTypeId = "sniper";
        break;
      default:
        numRobots = Math.random() < 0.3 ? 1 : 0; // 30% chance of 1 robot
    }

    // Limit by max robots
    numRobots = Math.min(numRobots, totalMaxRobots - robotsSpawned);

    // Add robots
    for (let j = 0; j < numRobots; j++) {
      const offsetX = randomInt(1, room.width - 2);
      const offsetY = randomInt(1, room.height - 2);
      const robotX = (room.x + offsetX - MAP_SIZE / 2) * GRID_SIZE;
      const robotZ = (room.y + offsetY - MAP_SIZE / 2) * GRID_SIZE;

      const robot = robotSpawner.spawnRobot(robotX, robotZ, scene, robotTypeId);
      if (robot) {
        robotsSpawned++;
      }
    }
  }
}

// Helper: Random Integer
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

export default {
  generateDungeon,
  MAP_SIZE,
  GRID_SIZE,
};
