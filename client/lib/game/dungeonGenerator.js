// dungeonGenerator.js - FIXED VERSION
import * as THREE from "three";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
import robotSpawner from "./robots";

// --- Constants & Materials ---
const ROOM_SIZE_MIN = 4;
const ROOM_SIZE_MAX = 8;
const CORRIDOR_WIDTH = 2;
const WALL_HEIGHT = 6;
const MAP_SIZE = 40;
const GRID_SIZE = 1;

const ROOM_TYPES = {
  STANDARD: "standard",
  SERVER: "server",
  LAB: "lab",
  POWER_CORE: "power_core",
  SECURITY: "security",
};

// Improved materials with better light reflection properties
const WALL_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0x555555,
  metalness: 0.1,
  roughness: 0.7,
  side: THREE.DoubleSide,
});

const FLOOR_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0x2c3539,
  metalness: 0.2,
  roughness: 0.5,
});

const CEILING_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0x1a1a1a,
  metalness: 0.1,
  roughness: 0.6,
});

const DOOR_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0x3b9ae1,
  emissive: 0x0a2463,
  emissiveIntensity: 0.5,
  transparent: true,
  opacity: 0.9,
});

const SERVER_FLOOR_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0x0a2463,
  emissive: 0x0a2463,
  emissiveIntensity: 0.3,
});

const POWER_CORE_FLOOR_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0xea526f,
  emissive: 0xff2e63,
  emissiveIntensity: 0.4,
});

const LAB_FLOOR_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0x25f5bd,
  emissive: 0x25f5bd,
  emissiveIntensity: 0.3,
});

const SECURITY_FLOOR_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0xff0000,
  emissive: 0xff0000,
  emissiveIntensity: 0.4,
});

// --- Enhanced lighting system ---
function setupLightSystem(scene) {
  // Improved directional light with shadow settings
  const mainLight = new THREE.DirectionalLight(0xffffff, 1.5);
  mainLight.position.set(20, 40, 20);
  mainLight.castShadow = true;

  // Configure shadow properties
  mainLight.shadow.mapSize.width = 2048;
  mainLight.shadow.mapSize.height = 2048;
  mainLight.shadow.camera.near = 0.5;
  mainLight.shadow.camera.far = 100;
  mainLight.shadow.camera.left = -30;
  mainLight.shadow.camera.right = 30;
  mainLight.shadow.camera.top = 30;
  mainLight.shadow.camera.bottom = -30;
  mainLight.shadow.bias = -0.0005;
  scene.add(mainLight);

  // Stronger ambient light to reduce darkness
  const ambientLight = new THREE.AmbientLight(0x606060, 1.5);
  scene.add(ambientLight);

  // Hemisphere light for more natural illumination
  const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8);
  hemisphereLight.position.set(0, 50, 0);
  scene.add(hemisphereLight);

  return { mainLight, ambientLight, hemisphereLight };
}

// --- Neon Accent for some walls ---
function addNeonAccent(wall) {
  const neonColors = [0x00ffff, 0xff00ff, 0x00ff00, 0xff3333, 0x3333ff];
  const accentColor = neonColors[Math.floor(Math.random() * neonColors.length)];
  let accentGeometry;
  let accentPosition = new THREE.Vector3(0, 0, 0);

  if (Math.random() < 0.5) {
    accentGeometry = new THREE.BoxGeometry(
      GRID_SIZE + 0.05,
      0.1,
      GRID_SIZE + 0.05
    );
    accentPosition.y = WALL_HEIGHT / 2.5;
  } else {
    accentGeometry = new THREE.BoxGeometry(GRID_SIZE + 0.05, WALL_HEIGHT, 0.1);
    accentPosition.z = GRID_SIZE / 2 + 0.05;
  }

  const accentMaterial = new THREE.MeshBasicMaterial({
    color: accentColor,
    emissive: accentColor,
    emissiveIntensity: 1.0,
  });

  const accent = new THREE.Mesh(accentGeometry, accentMaterial);
  accent.position.copy(accentPosition);
  wall.add(accent);
}

// --- Holographic Grid Texture ---
function createHolographicGridTexture() {
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
  return texture;
}

// --- Main Dungeon Generation ---
export function generateDungeon(scene) {
  console.time("dungeonGeneration");

  // Create facility group
  const facility = new THREE.Group();
  scene.add(facility);

  // Create grid (1 = wall, 0 = floor, for navigation)
  const grid = Array(MAP_SIZE)
    .fill()
    .map(() => Array(MAP_SIZE).fill(1));

  // Create floor
  const floorGeometry = new THREE.PlaneGeometry(
    MAP_SIZE * GRID_SIZE,
    MAP_SIZE * GRID_SIZE
  );
  const gridTexture = createHolographicGridTexture();
  const floorMaterialWithGrid = new THREE.MeshStandardMaterial({
    color: FLOOR_MATERIAL.color,
    map: gridTexture,
    transparent: true,
  });
  // --- Create floor with explicit collision properties ---
  const floor = new THREE.Mesh(floorGeometry, floorMaterialWithGrid);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, 0);
  floor.receiveShadow = true;
  // Add properties for collision detection
  floor.userData = {
    isFloor: true,
    isSolid: true, // Universal collision property
  };
  facility.add(floor);

  // Create ceiling
  const ceilingGeometry = new THREE.PlaneGeometry(
    MAP_SIZE * GRID_SIZE,
    MAP_SIZE * GRID_SIZE
  );
  // --- Create ceiling with explicit collision properties ---
  const ceiling = new THREE.Mesh(ceilingGeometry, CEILING_MATERIAL);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, WALL_HEIGHT, 0);
  ceiling.receiveShadow = true;
  // Add properties for collision detection
  ceiling.userData = {
    isCeiling: true,
    isSolid: true, // Universal collision property
  };
  facility.add(ceiling);

  // --- Room Generation ---
  const numRooms = randomInt(5, 8);
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

    let attempts = 0;
    let validPosition = false;
    let roomX, roomY;
    while (!validPosition && attempts < 100) {
      roomX = randomInt(1, MAP_SIZE - width - 1);
      roomY = randomInt(1, MAP_SIZE - height - 1);
      validPosition = true;
      for (let x = roomX - 2; x < roomX + width + 2; x++) {
        for (let y = roomY - 2; y < roomY + height + 2; y++) {
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
    }
  }

  rooms[0].isConnected = true;
  connectRoomsSimple(rooms, grid);

  // --- Build Walls using Improved Greedy Meshing ---
  buildWallsGreedy(facility, grid);

  // --- Special Floors & Props ---
  createSpecialRoomFloors(facility, rooms);
  addMinimalProps(facility, rooms);

  // --- Add Room Lights ---
  addRoomLights(facility, rooms);

  // --- Spawn Robots ---
  spawnRobotsInRooms(rooms, scene);

  // --- Setup Enhanced Lighting ---
  setupLightSystem(scene);

  // --- Create traversability grid for AI ---
  const traversabilityGrid = createTraversabilityGrid(grid);

  console.timeEnd("dungeonGeneration");
  return {
    dungeon: facility,
    spawnRoom: rooms[0],
    portalRoom: findExitPortalRoom(rooms),
    rooms: rooms,
    gridSize: GRID_SIZE,
    mapSize: MAP_SIZE,
    grid: grid, // Original grid (0 = floor, 1 = wall)
    traversabilityGrid: traversabilityGrid, // Enhanced grid for AI
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

// --- Create traversability grid for AI pathfinding ---
function createTraversabilityGrid(grid) {
  // Deep copy the original grid
  const traversabilityGrid = JSON.parse(JSON.stringify(grid));

  // Mark cells near walls as cautious zones (value 2)
  // These are still traversable but AI might want to avoid them
  for (let x = 0; x < MAP_SIZE; x++) {
    for (let y = 0; y < MAP_SIZE; y++) {
      if (grid[x][y] === 1) {
        // If it's a wall
        // Mark adjacent cells with a proximity value
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

// --- Add room-specific lighting ---
function addRoomLights(facility, rooms) {
  const roomLights = [];

  rooms.forEach((room) => {
    const centerX = (room.x + room.width / 2 - MAP_SIZE / 2) * GRID_SIZE;
    const centerZ = (room.y + room.height / 2 - MAP_SIZE / 2) * GRID_SIZE;

    // Light color based on room type
    let lightColor = 0xffffff;
    let intensity = 1.5;

    switch (room.type) {
      case ROOM_TYPES.SERVER:
        lightColor = 0x66aaff;
        intensity = 1.8;
        break;
      case ROOM_TYPES.LAB:
        lightColor = 0x66ffaa;
        intensity = 1.7;
        break;
      case ROOM_TYPES.POWER_CORE:
        lightColor = 0xff6666;
        intensity = 2.0;
        break;
      case ROOM_TYPES.SECURITY:
        lightColor = 0xff3333;
        intensity = 1.8;
        break;
    }

    // Create point light at center of room
    const roomLight = new THREE.PointLight(
      lightColor,
      intensity,
      room.width * GRID_SIZE * 3
    );
    roomLight.position.set(centerX, WALL_HEIGHT * 0.7, centerZ);
    roomLight.castShadow = true;

    // Add light sphere for visual effect
    if (room.type !== ROOM_TYPES.STANDARD) {
      const lightSphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.15, 8, 8),
        new THREE.MeshBasicMaterial({ color: lightColor })
      );
      lightSphere.position.set(0, 0, 0);
      roomLight.add(lightSphere);
    }

    facility.add(roomLight);
    roomLights.push(roomLight);
  });

  return roomLights;
}

// --- Corridor Connection (Simple L-shaped corridors) ---
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
  const additionalConnections = Math.min(2, Math.floor(rooms.length / 4));
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

// --- Improved Greedy Meshing for Walls using Three.js BufferGeometryUtils ---
function buildWallsGreedy(facility, grid) {
  // --- First pass: Create doors ---
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
        if (doorOrientation && Math.random() < 0.4) {
          let doorGeometry, doorRotation;
          if (doorOrientation === "EW") {
            doorGeometry = new THREE.BoxGeometry(
              GRID_SIZE,
              WALL_HEIGHT * 0.8,
              GRID_SIZE * 0.1
            );
            doorRotation = Math.PI / 2;
          } else {
            doorGeometry = new THREE.BoxGeometry(
              GRID_SIZE * 0.1,
              WALL_HEIGHT * 0.8,
              GRID_SIZE
            );
            doorRotation = 0;
          }
          const door = new THREE.Mesh(doorGeometry, DOOR_MATERIAL);
          door.position.set(
            (x - MAP_SIZE / 2) * GRID_SIZE + GRID_SIZE / 2,
            WALL_HEIGHT * 0.4,
            (y - MAP_SIZE / 2) * GRID_SIZE + GRID_SIZE / 2
          );
          door.rotation.y = doorRotation;
          door.castShadow = true;
          door.receiveShadow = true;
          addDoorFrame(door, doorRotation);
          door.userData = { isDoor: true, isSolid: true };
          facility.add(door);
          grid[x][y] = 0; // Mark as floor for navigation
        }
      }
    }
  }

  // --- Greedy meshing for the remaining wall cells ---
  const processed = Array(MAP_SIZE)
    .fill()
    .map(() => Array(MAP_SIZE).fill(false));
  const wallGeometries = [];

  for (let x = 0; x < MAP_SIZE; x++) {
    for (let y = 0; y < MAP_SIZE; y++) {
      if (grid[x][y] === 1 && !processed[x][y]) {
        // Expand horizontally
        let rectWidth = 1;
        while (x + rectWidth < MAP_SIZE) {
          if (grid[x + rectWidth][y] !== 1 || processed[x + rectWidth][y])
            break;
          rectWidth++;
        }

        // Expand vertically
        let rectHeight = 1;
        let canExpand = true;
        while (y + rectHeight < MAP_SIZE && canExpand) {
          for (let i = 0; i < rectWidth; i++) {
            if (
              grid[x + i][y + rectHeight] !== 1 ||
              processed[x + i][y + rectHeight]
            ) {
              canExpand = false;
              break;
            }
          }
          if (canExpand) rectHeight++;
        }

        // Mark cells as processed
        for (let i = 0; i < rectWidth; i++) {
          for (let j = 0; j < rectHeight; j++) {
            processed[x + i][y + j] = true;
          }
        }

        // Create wall geometry for this section
        const geometry = new THREE.BoxGeometry(
          rectWidth * GRID_SIZE,
          WALL_HEIGHT,
          rectHeight * GRID_SIZE
        );

        const centerX = x + rectWidth / 2;
        const centerY = y + rectHeight / 2;

        // Position the geometry correctly
        geometry.translate(
          (centerX - MAP_SIZE / 2) * GRID_SIZE,
          WALL_HEIGHT / 2,
          (centerY - MAP_SIZE / 2) * GRID_SIZE
        );

        wallGeometries.push(geometry);
      }
    }
  }

  // Merge wall geometries using Three.js BufferGeometryUtils
  if (wallGeometries.length > 0) {
    // Use the official Three.js utility for merging
    const mergedGeometry = BufferGeometryUtils.mergeGeometries(wallGeometries);
    const mergedWalls = new THREE.Mesh(mergedGeometry, WALL_MATERIAL);
    mergedWalls.castShadow = true;
    mergedWalls.receiveShadow = true;
    mergedWalls.userData = { isWall: true, isSolid: true };
    facility.add(mergedWalls);
  }
}

// --- Door Frame Helper ---
function addDoorFrame(door, doorRotation) {
  const frameMaterial = new THREE.MeshBasicMaterial({
    color: 0x3b9ae1,
    emissive: 0x3b9ae1,
    emissiveIntensity: 0.8,
  });
  let frameGeometry;
  if (Math.abs(doorRotation - Math.PI / 2) < 0.1) {
    frameGeometry = new THREE.BoxGeometry(
      GRID_SIZE + 0.1,
      WALL_HEIGHT * 0.9,
      0.05
    );
    const topFrame = new THREE.Mesh(frameGeometry, frameMaterial);
    topFrame.position.set(0, WALL_HEIGHT * 0.1, -GRID_SIZE * 0.15);
    door.add(topFrame);
  } else {
    frameGeometry = new THREE.BoxGeometry(
      0.05,
      WALL_HEIGHT * 0.9,
      GRID_SIZE + 0.1
    );
    const topFrame = new THREE.Mesh(frameGeometry, frameMaterial);
    topFrame.position.set(-GRID_SIZE * 0.15, WALL_HEIGHT * 0.1, 0);
    door.add(topFrame);
  }
}

// --- Special Room Floors ---
function createSpecialRoomFloors(facility, rooms) {
  rooms.forEach((room) => {
    if (room.type === ROOM_TYPES.STANDARD) return;
    const roomWidth = room.width * GRID_SIZE;
    const roomHeight = room.height * GRID_SIZE;
    const floorGeometry = new THREE.PlaneGeometry(roomWidth, roomHeight);
    let floorMaterial;
    switch (room.type) {
      case ROOM_TYPES.SERVER:
        floorMaterial = SERVER_FLOOR_MATERIAL;
        break;
      case ROOM_TYPES.LAB:
        floorMaterial = LAB_FLOOR_MATERIAL;
        break;
      case ROOM_TYPES.POWER_CORE:
        floorMaterial = POWER_CORE_FLOOR_MATERIAL;
        break;
      case ROOM_TYPES.SECURITY:
        floorMaterial = SECURITY_FLOOR_MATERIAL;
        break;
      default:
        floorMaterial = FLOOR_MATERIAL;
    }
    const roomFloor = new THREE.Mesh(floorGeometry, floorMaterial);
    roomFloor.rotation.x = -Math.PI / 2;
    roomFloor.position.set(
      (room.x + room.width / 2 - MAP_SIZE / 2) * GRID_SIZE,
      0.02,
      (room.y + room.height / 2 - MAP_SIZE / 2) * GRID_SIZE
    );
    roomFloor.receiveShadow = true;
    facility.add(roomFloor);
  });
}

// --- Enhanced Props with Emission ---
function addMinimalProps(facility, rooms) {
  const propTypes = {
    dataTerminal: () => {
      const group = new THREE.Group();
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 0.8, 0.4),
        new THREE.MeshLambertMaterial({ color: 0x333333 })
      );
      base.position.y = 0.4;
      const screen = new THREE.Mesh(
        new THREE.PlaneGeometry(0.5, 0.3),
        new THREE.MeshBasicMaterial({
          color: 0x00aaff,
          emissive: 0x00aaff,
          emissiveIntensity: 1.2,
        })
      );
      screen.position.set(0, 0.5, 0.21);
      base.add(screen);
      group.add(base);
      return group;
    },
    serverRack: () => {
      const group = new THREE.Group();
      const rackBody = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 1.5, 0.6),
        new THREE.MeshLambertMaterial({ color: 0x111111 })
      );
      rackBody.position.y = 0.75;
      const serverUnit = new THREE.Mesh(
        new THREE.BoxGeometry(0.75, 0.2, 0.55),
        new THREE.MeshLambertMaterial({ color: 0x333333 })
      );
      serverUnit.position.y = 0.3;
      const light = new THREE.Mesh(
        new THREE.SphereGeometry(0.02, 8, 8),
        new THREE.MeshBasicMaterial({
          color: 0x00ff00,
          emissive: 0x00ff00,
          emissiveIntensity: 1.0,
        })
      );
      light.position.set(0.3, 0, 0.28);
      serverUnit.add(light);
      rackBody.add(serverUnit);
      group.add(rackBody);
      return group;
    },
  };

  rooms.forEach((room, index) => {
    if (room.type === ROOM_TYPES.STANDARD || index === 0) return;
    let numProps = Math.min(2, Math.floor((room.width * room.height) / 50));
    for (let i = 0; i < numProps; i++) {
      const propKeys = Object.keys(propTypes);
      const propType = propKeys[Math.floor(Math.random() * propKeys.length)];
      const prop = propTypes[propType]();
      let offsetX, offsetY;
      const nearWall = randomInt(0, 3);
      switch (nearWall) {
        case 0:
          offsetX = randomInt(1, room.width - 2);
          offsetY = 1;
          break;
        case 1:
          offsetX = room.width - 2;
          offsetY = randomInt(1, room.height - 2);
          break;
        case 2:
          offsetX = randomInt(1, room.width - 2);
          offsetY = room.height - 2;
          break;
        case 3:
          offsetX = 1;
          offsetY = randomInt(1, room.height - 2);
          break;
      }
      prop.position.set(
        (room.x + offsetX - MAP_SIZE / 2) * GRID_SIZE,
        0,
        (room.y + offsetY - MAP_SIZE / 2) * GRID_SIZE
      );
      facility.add(prop);
    }

    // Add special room features
    if (room.type === ROOM_TYPES.POWER_CORE) {
      // Add glowing core with point light
      const coreGroup = new THREE.Group();

      const core = new THREE.Mesh(
        new THREE.CylinderGeometry(0.6, 0.8, 1.2, 12),
        new THREE.MeshBasicMaterial({
          color: 0xff3366,
          emissive: 0xff3366,
          emissiveIntensity: 1.5,
        })
      );

      // Add point light to the core
      const coreLight = new THREE.PointLight(0xff3366, 1.5, 5);
      coreLight.position.set(0, 0.6, 0);
      core.add(coreLight);

      coreGroup.add(core);
      coreGroup.position.set(
        (room.x + room.width / 2 - MAP_SIZE / 2) * GRID_SIZE,
        0.6,
        (room.y + room.height / 2 - MAP_SIZE / 2) * GRID_SIZE
      );
      facility.add(coreGroup);
    } else if (room.type === ROOM_TYPES.SECURITY) {
      // Add security console with monitor
      const consoleGroup = new THREE.Group();

      const consoleMesh = new THREE.Mesh(
        new THREE.BoxGeometry(1, 0.5, 0.5),
        new THREE.MeshLambertMaterial({ color: 0x222222 })
      );

      const screen = new THREE.Mesh(
        new THREE.PlaneGeometry(0.8, 0.3),
        new THREE.MeshBasicMaterial({
          color: 0xff0000,
          emissive: 0xff0000,
          emissiveIntensity: 0.7,
        })
      );
      screen.position.set(0, 0.3, 0.26);
      consoleMesh.add(screen);

      consoleGroup.add(consoleMesh);
      consoleGroup.position.set(
        (room.x + room.width / 2 - MAP_SIZE / 2) * GRID_SIZE,
        0.25,
        (room.y + room.height / 2 - MAP_SIZE / 2) * GRID_SIZE
      );
      facility.add(consoleGroup);
    }
  });
}

// --- Spawn Robots ---
function spawnRobotsInRooms(rooms, scene) {
  rooms.forEach((room, index) => {
    if (index === 0) return;
    let numRobots;
    let robotTypeId = null;
    switch (room.type) {
      case ROOM_TYPES.SECURITY:
        numRobots = 1;
        robotTypeId = "tank";
        break;
      case ROOM_TYPES.SERVER:
        numRobots = randomInt(1, 2);
        robotTypeId = "scout";
        break;
      case ROOM_TYPES.POWER_CORE:
        numRobots = randomInt(1, 2);
        robotTypeId = "healer";
        break;
      case ROOM_TYPES.LAB:
        numRobots = randomInt(1, 2);
        robotTypeId = "sniper";
        break;
      default:
        numRobots = 1;
    }
    for (let i = 0; i < numRobots; i++) {
      const offsetX = randomInt(1, room.width - 2);
      const offsetY = randomInt(1, room.height - 2);
      const robotX = (room.x + offsetX - MAP_SIZE / 2) * GRID_SIZE;
      const robotZ = (room.y + offsetY - MAP_SIZE / 2) * GRID_SIZE;
      const robot = robotSpawner.spawnRobot(robotX, robotZ, scene, robotTypeId);
      if (room.type === ROOM_TYPES.SECURITY && robot) {
        robot.health *= 2;
        robot.maxHealth = robot.health;
        robot.attack *= 1.5;
        robot.scale.set(1.5, 1.5, 1.5);
        if (robot.healthBarGroup) {
          robot.healthBarGroup.position.y *= 1.5;
        }
      }
    }
  });
}

// --- Helper: Random Integer ---
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

export default {
  generateDungeon,
  MAP_SIZE,
  GRID_SIZE,
};
