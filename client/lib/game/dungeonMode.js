// dungeonMode.js - First-person dungeon crawler mode with enhanced movement and audio
import * as THREE from "three";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";
import robotSpawner from "./robots";
import dungeonGenerator from "./dungeonGenerator";
import { randomInt } from "./robots";
import audioManager from "./audioManager";
import projectileSystem from "./projectileSystem";
import robotAI from "./robotAI";
import portalSystem from "./portalSystem";

// Mode state
let dungeonControls;
let playerCollider;
let playerVelocity;
let playerHealth = 100;
let playerScrapInventory = {
  total: 0,
  electronic: 0,
  metal: 0,
  energy: 0,
};

// Player weapon
let weaponModel;

// Scene and camera references
let scene;
let camera;

// Movement state
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let isSprinting = false; // New sprinting state
let isJumping = false; // New jumping state
let jumpVelocity = 0; // New jump velocity
let isOnGround = true; // New ground state
let staminaLevel = 100; // New stamina level for sprint
let prevTime = performance.now();
let isGamePaused = false;

let lastDelta = 0;
// Audio state tracking
let footstepTimer = 0;
const FOOTSTEP_INTERVAL = 0.4; // Time between footstep sounds in seconds
const SPRINT_FOOTSTEP_INTERVAL = 0.25; // Faster footsteps when sprinting

// Constants
const PLAYER_HEIGHT = 1.8;
const PLAYER_SPEED = 5.0;
const SPRINT_MULTIPLIER = 1.8; // Sprinting is 80% faster
const STAMINA_DEPLETION_RATE = 15; // Stamina depletes at this rate per second when sprinting
const STAMINA_RECOVERY_RATE = 10; // Stamina recovers at this rate per second when not sprinting
const JUMP_FORCE = 9.0; // Initial velocity for jump
const GRAVITY = 20.0; // Gravity strength
const PLAYER_RADIUS = 0.4; // Player collision radius for more robust collision

// Initialize dungeon mode
export function initDungeonMode(sceneRef, cameraRef, renderer) {
  // Store references
  scene = sceneRef;
  camera = cameraRef;

  // Setup first-person controls with proper cleanup first
  if (dungeonControls) {
    // Clean up old controls
    if (dungeonControls.isLocked) {
      dungeonControls.unlock();
    }
    scene.remove(dungeonControls.object);
  }

  // Create fresh controls
  dungeonControls = new PointerLockControls(camera, document.body);
  document.addEventListener(
    "keydown",
    (event) => {
      if (event.code === "Escape") {
        event.preventDefault();
        event.stopPropagation();

        // Let your game handle it
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      }
    },
    true
  );
  dungeonControls.object.name = "PointerLockControls";
  dungeonControls.object.userData = { isPlayer: true };
  const originalOnKeyDown = dungeonControls.onKeyDown;
  dungeonControls.onKeyDown = function (event) {
    if (event.code === "Escape") {
      // Do nothing - we handle ESC in Game.jsx
      return;
    }
    // Call original handler for other keys if it exists
    if (originalOnKeyDown) {
      originalOnKeyDown.call(this, event);
    }
  };

  scene.add(dungeonControls.object);

  // Setup player collider and stats
  playerCollider = new THREE.Object3D();
  playerCollider.name = "Player";
  playerCollider.userData = { isPlayer: true };
  playerCollider.position.set(0, PLAYER_HEIGHT / 2, 0);
  playerHealth = 100;
  scene.add(playerCollider);

  // Initialize movement
  playerVelocity = new THREE.Vector3();
  staminaLevel = 100;
  isJumping = false;
  isOnGround = true;
  jumpVelocity = 0;
  footstepTimer = 0;

  // Add weapon model visible in first person
  weaponModel = createWeaponModel();
  camera.add(weaponModel);

  // Add a crosshair
  createCrosshair(camera);

  // Setup event listeners for movement and interaction
  setupEventListeners();

  // Reset inventory
  playerScrapInventory = {
    total: 0,
    electronic: 0,
    metal: 0,
    energy: 0,
  };

  // Generate initial dungeon
  const dungeonData = regenerateDungeon(scene);

  // Dispatch event to update UI in React
  updateDungeonUI();

  // Create the controller object with all the methods
  const controller = {
    update: updateDungeonMode,
    getControls: () => dungeonControls,
    getPlayerPosition: () => dungeonControls.object.position.clone(),
    getPlayerHealth: () => playerHealth,
    getInventory: () => playerScrapInventory,
    regenerateDungeon: () => regenerateDungeon(scene),
    cleanup: () => {
      portalSystem.cleanup();
      document.removeEventListener("pauseGame", handlePauseGame);
    },
  };

  // ADDED: Expose dungeon controller globally for minimap integration
  window.dungeonController = controller;

  return controller;
}

// Create weapon model visible in first person
function createWeaponModel() {
  const weaponGroup = new THREE.Group();

  // Gun body
  const gunBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 0.2, 0.5),
    new THREE.MeshLambertMaterial({ color: 0x333333 })
  );

  // Gun barrel
  const gunBarrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 0.3, 8),
    new THREE.MeshLambertMaterial({ color: 0x666666 })
  );
  gunBarrel.rotation.x = Math.PI / 2;
  gunBarrel.position.z = -0.3;

  // Gun handle
  const gunHandle = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.25, 0.15),
    new THREE.MeshLambertMaterial({ color: 0x8b4513 })
  );
  gunHandle.position.y = -0.2;

  // Assemble weapon
  weaponGroup.add(gunBody);
  weaponGroup.add(gunBarrel);
  weaponGroup.add(gunHandle);

  // Position in bottom right of view
  weaponGroup.position.set(0.3, -0.3, -0.5);

  return weaponGroup;
}

// Create a crosshair in the center of the screen
function createCrosshair(camera) {
  const crosshairGeometry = new THREE.RingGeometry(0.01, 0.02, 16);
  const crosshairMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.8,
    depthTest: false, // Always render on top
  });

  const crosshair = new THREE.Mesh(crosshairGeometry, crosshairMaterial);
  crosshair.position.z = -0.5;

  camera.add(crosshair);
  return crosshair;
}

// Setup event listeners for dungeon mode
function setupEventListeners() {
  // Mouse click event listeners
  document.addEventListener("pauseGame", handlePauseGame);
  document.addEventListener("mousedown", function (event) {
    // Only process clicks when controls are locked
    if (dungeonControls.isLocked && !isGamePaused) {
      // Left click = attack
      if (event.button === 0) {
        handleAttack();
      }
      // Right click = attempt to capture robot
      else if (event.button === 2) {
        handleRobotCapture();
      }
    }
  });

  // Prevent context menu from appearing on right click
  document.addEventListener("contextmenu", function (event) {
    if (dungeonControls.isLocked) {
      event.preventDefault();
    }
  });

  // Key events for movement
  document.addEventListener("keydown", function (event) {
    if (isGamePaused) return;
    switch (event.code) {
      case "ArrowUp":
      case "KeyW":
        moveForward = true;
        break;
      case "ArrowLeft":
      case "KeyA":
        moveLeft = true;
        break;
      case "ArrowDown":
      case "KeyS":
        moveBackward = true;
        break;
      case "ArrowRight":
      case "KeyD":
        moveRight = true;
        break;
      case "ShiftLeft":
      case "ShiftRight":
        // Only enable sprint if we have stamina
        if (staminaLevel > 0) {
          isSprinting = true;
          // Play sprint start sound
          audioManager.playPlayerSound("sprint");
        }
        break;
      case "Space":
        // Jump only if we're on the ground
        if (isOnGround && !isJumping) {
          isJumping = true;
          isOnGround = false;
          jumpVelocity = JUMP_FORCE;

          // Play jump sound
          audioManager.playPlayerSound("jump");
          console.log("Jump!");
        }
        break;
      case "KeyG":
        // Debug: Generate new dungeon
        regenerateDungeon(scene);
        break;
    }
  });

  document.addEventListener("keyup", function (event) {
    switch (event.code) {
      case "ArrowUp":
      case "KeyW":
        moveForward = false;
        break;
      case "ArrowLeft":
      case "KeyA":
        moveLeft = false;
        break;
      case "ArrowDown":
      case "KeyS":
        moveBackward = false;
        break;
      case "ArrowRight":
      case "KeyD":
        moveRight = false;
        break;
      case "ShiftLeft":
      case "ShiftRight":
        isSprinting = false;
        break;
    }
  });
}

function handlePauseGame(event) {
  isGamePaused = event.detail.paused;

  console.log("Game paused state updated:", isGamePaused);
}

// Handle robot capture with right click
function handleRobotCapture() {
  // Create a ray from the camera to detect robots
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);

  // Get all intersections
  const intersects = raycaster.intersectObjects(scene.children, true);

  // Find the first robot in the intersections
  for (let i = 0; i < intersects.length; i++) {
    const object = intersects[i].object;

    // Check if this is a robot or part of a robot
    let robot = null;
    if (object.isRobot) {
      robot = object;
    } else if (object.parent && object.parent.isRobot) {
      robot = object.parent;
    }

    if (robot) {
      const distance = intersects[i].distance;

      // Only capture robots within range (closer range than attack)
      if (distance < 5) {
        // Determine if capture is successful - damaged robots are easier to capture
        const healthPercent = robot.health / robot.maxHealth;
        const captureChance = 0.3 + (1 - healthPercent) * 0.5; // 30% base chance, up to 80% for heavily damaged robots

        if (Math.random() < captureChance) {
          console.log(`Captured ${robot.type} robot!`);

          // Play success sound
          audioManager.playCollectSound("core");

          // Create core from robot and add to inventory
          const core = {
            type: robot.type,
            value: robot.coreValue,
            power: randomInt(1, 3), // Random power level
          };

          // Add to global array
          if (!window.capturedCores) {
            window.capturedCores = [];
          }
          window.capturedCores.push(core);

          // Dispatch event to update React state
          document.dispatchEvent(
            new CustomEvent("robotCaptured", {
              detail: {
                robot: {
                  type: robot.type,
                  coreValue: robot.coreValue,
                  power: core.power,
                },
                cores: window.capturedCores,
              },
            })
          );

          // Remove robot from scene and tracking array
          robotSpawner.destroyRobot(robot, scene);

          // Check if all robots are defeated
          if (robotSpawner.getAllRobots().length === 0) {
            document.dispatchEvent(new CustomEvent("allRobotsDefeated"));
          }
        } else {
          console.log(`Failed to capture ${robot.type} robot!`);
          // Play failure sound
          audioManager.playPlayerSound("hit");
        }

        return; // Exit after capture attempt
      }
    }
  }
}

// Generate or regenerate dungeon
function regenerateDungeon(scene) {
  // Play transition sound
  audioManager.playGameSound("mode-switch");

  // Clear existing robots
  robotSpawner.clearAllRobots(scene);

  // Generate new dungeon
  const dungeonData = dungeonGenerator.generateDungeon(scene);

  // Position player at spawn room
  const spawnRoom = dungeonData.spawnRoom;
  const spawnX =
    (spawnRoom.centerX - dungeonData.mapSize / 2) * dungeonData.gridSize;
  const spawnZ =
    (spawnRoom.centerY - dungeonData.mapSize / 2) * dungeonData.gridSize;

  const spawnPosition = { x: spawnX, y: PLAYER_HEIGHT, z: spawnZ };

  const portalRoom = dungeonData.portalRoom;
  const portalX =
    (portalRoom.centerX - dungeonData.mapSize / 2) * dungeonData.gridSize;
  const portalZ =
    (portalRoom.centerY - dungeonData.mapSize / 2) * dungeonData.gridSize;
  const portalPosition = { x: portalX, y: PLAYER_HEIGHT, z: portalZ };

  portalSystem.initialize(scene, spawnPosition, portalPosition);

  // Start checking for portal collisions
  portalSystem.startCollisionChecking(() => {
    return dungeonControls ? dungeonControls.object.position.clone() : null;
  });

  // Position player at spawn point
  if (dungeonControls) {
    dungeonControls.object.position.set(spawnX, PLAYER_HEIGHT, spawnZ);
  }

  // ADDED: Dispatch event with dungeon data for minimap
  document.dispatchEvent(
    new CustomEvent("dungeonGenerated", {
      detail: dungeonData,
    })
  );

  return dungeonData;
}

// Handle player attack
function handleAttack() {
  // Calculate firing direction from camera
  const direction = new THREE.Vector3(0, 0, -1);
  direction.unproject(camera);
  direction.sub(camera.position).normalize();

  // Animate weapon firing
  fireWeapon();

  // Create a projectile in the firing direction
  projectileSystem.createPlayerProjectile(
    camera.position.clone(),
    direction,
    scene
  );

  // Play weapon sound
  audioManager.playPlayerSound("shoot");
}

// Weapon firing animation
function fireWeapon() {
  // Play weapon sound
  audioManager.playPlayerSound("shoot");
  // Store original position
  const originalPosition = weaponModel.position.clone();

  // Create muzzle flash
  const flashGeometry = new THREE.SphereGeometry(0.1, 8, 8);
  const flashMaterial = new THREE.MeshBasicMaterial({
    color: 0x00ff00, // Match player projectile color
    transparent: true,
    opacity: 0.8,
  });
  const muzzleFlash = new THREE.Mesh(flashGeometry, flashMaterial);
  muzzleFlash.position.set(0, 0, -0.5); // Position at the end of the weapon
  weaponModel.add(muzzleFlash);

  // Recoil animation
  weaponModel.position.z += 0.2; // Move weapon back

  // Remove effects after short delay
  setTimeout(() => {
    weaponModel.remove(muzzleFlash);

    // Return weapon to original position
    weaponModel.position.copy(originalPosition);
  }, 100);
}

// Check for scrap collection
function checkScrapCollection() {
  const playerPosition = dungeonControls.object.position;
  const collectedScrap = robotSpawner.checkScrapCollection(
    playerPosition,
    scene,
    2
  );

  collectedScrap.forEach((scrap) => {
    // Add to inventory
    playerScrapInventory.total += scrap.value;

    // Add to specific type
    if (playerScrapInventory[scrap.type] !== undefined) {
      playerScrapInventory[scrap.type] += scrap.value;
    }

    // Play collect sound
    audioManager.playCollectSound("scrap");

    console.log(`Collected ${scrap.value} ${scrap.type} scrap!`);
  });

  // Update UI if scrap was collected
  if (collectedScrap.length > 0) {
    // Dispatch event to update inventory in React
    document.dispatchEvent(
      new CustomEvent("updateInventory", {
        detail: { inventory: playerScrapInventory },
      })
    );
  }
}

function checkCoreCollection() {
  const playerPosition = dungeonControls.object.position;
  const collectedCores = robotSpawner.checkCoreCollection(
    playerPosition,
    scene,
    2
  );

  // Play sound if cores were collected
  if (collectedCores.length > 0) {
    audioManager.playCollectSound("core");
  }

  // Update UI (cores are already in window.capturedCores)
  if (collectedCores.length > 0) {
    console.log(`Collected ${collectedCores.length} cores!`);
    updateDungeonUI();
  }
}

// Update UI through custom events (React will handle the UI)
function updateDungeonUI() {
  // Dispatch event for React to handle UI updates
  document.dispatchEvent(
    new CustomEvent("updateDungeonUI", {
      detail: {
        gameState: "dungeon",
        health: Math.floor(playerHealth),
        inventory: playerScrapInventory,
        cores: window.capturedCores || [],
        stamina: Math.floor(staminaLevel),
      },
    })
  );
}

// Enhanced collision detection using multiple raycasts
function checkWallCollision(position, direction, playerHeight, playerRadius) {
  // Create an array to hold all the ray directions for wall checking
  const rayDirections = [
    new THREE.Vector3(1, 0, 0), // +X
    new THREE.Vector3(-1, 0, 0), // -X
    new THREE.Vector3(0, 0, 1), // +Z
    new THREE.Vector3(0, 0, -1), // -Z
    new THREE.Vector3(0.7, 0, 0.7), // NE
    new THREE.Vector3(-0.7, 0, 0.7), // NW
    new THREE.Vector3(0.7, 0, -0.7), // SE
    new THREE.Vector3(-0.7, 0, -0.7), // SW
  ];

  // Check collisions at different heights
  const heightChecks = [0.1, playerHeight / 2, playerHeight - 0.1];

  // This will hold data about any collisions found
  const collisionData = {
    collision: false,
    pushVector: new THREE.Vector3(0, 0, 0),
    collisionCount: 0,
  };

  // Check for wall collisions in all directions
  for (const dir of rayDirections) {
    for (const heightOffset of heightChecks) {
      const raycaster = new THREE.Raycaster();
      // Set ray origin at current position plus height offset
      const rayOrigin = new THREE.Vector3(
        position.x,
        position.y + heightOffset,
        position.z
      );

      raycaster.set(rayOrigin, dir);
      const intersections = raycaster.intersectObjects(scene.children, true);

      // Check for walls closer than player radius
      for (const intersection of intersections) {
        const object = intersection.object;

        // Check if this is a wall
        if (
          (object.userData && object.userData.isWall) ||
          (object.parent &&
            object.parent.userData &&
            object.parent.userData.isWall) ||
          object.isWall ||
          (object.parent && object.parent.isWall) ||
          (object.userData && object.userData.isDoor) ||
          (object.parent &&
            object.parent.userData &&
            object.parent.userData.isDoor)
        ) {
          // If inside a wall or too close to it
          if (intersection.distance < playerRadius) {
            collisionData.collision = true;
            collisionData.collisionCount++;

            // Calculate push direction (away from wall)
            // Scale by how much the player penetrates the wall
            const pushStrength =
              (playerRadius - intersection.distance) / playerRadius;

            // Add to the accumulating push vector
            const pushDir = dir.clone().negate().multiplyScalar(pushStrength);
            collisionData.pushVector.add(pushDir);

            break; // Only count the closest intersection per ray
          }
        }
      }
    }
  }

  // Normalize the push vector if we have multiple collisions
  if (collisionData.collisionCount > 0) {
    collisionData.pushVector.divideScalar(collisionData.collisionCount);
  }

  return collisionData;
}

// Update player movement with sprinting, jumping, and better collision
function updatePlayerMovement(delta) {
  if (isGamePaused) return;
  // Handle vertical movement (jumping and gravity)
  if (!isOnGround || isJumping) {
    // Apply gravity to jump velocity
    jumpVelocity -= GRAVITY * delta;

    // Update vertical position
    dungeonControls.object.position.y += jumpVelocity * delta;

    // Check if we've hit the ground
    if (dungeonControls.object.position.y <= PLAYER_HEIGHT) {
      dungeonControls.object.position.y = PLAYER_HEIGHT;
      isOnGround = true;
      isJumping = false;
      jumpVelocity = 0;

      // Play landing sound if it was a real jump (not just walking down a step)
      if (jumpVelocity < -4) {
        audioManager.playPlayerSound("footstep");
      }
    }
  }

  // Handle stamina for sprinting
  if (isSprinting && staminaLevel > 0) {
    // Deplete stamina while sprinting
    staminaLevel -= STAMINA_DEPLETION_RATE * delta;
    if (staminaLevel <= 0) {
      staminaLevel = 0;
      isSprinting = false; // Disable sprinting when stamina is depleted
    }
  } else if (!isSprinting && staminaLevel < 100) {
    // Recover stamina when not sprinting
    staminaLevel += STAMINA_RECOVERY_RATE * delta;
    staminaLevel = Math.min(staminaLevel, 100);
  }

  // Calculate speed based on sprint state
  const currentSpeed = isSprinting
    ? PLAYER_SPEED * SPRINT_MULTIPLIER
    : PLAYER_SPEED;
  const speedDelta = delta * currentSpeed;

  // Reset horizontal velocity
  playerVelocity.x = 0;
  playerVelocity.z = 0;

  // Calculate forward/backward direction from camera
  const forward = new THREE.Vector3();
  forward.setFromMatrixColumn(camera.matrix, 0);
  forward.crossVectors(camera.up, forward);

  // Calculate left/right direction from camera
  const right = new THREE.Vector3();
  right.setFromMatrixColumn(camera.matrix, 0);

  // Apply movement in camera-relative directions
  if (moveForward) {
    playerVelocity.add(forward.multiplyScalar(speedDelta));
  }
  if (moveBackward) {
    playerVelocity.add(forward.multiplyScalar(-speedDelta));
  }
  if (moveLeft) {
    playerVelocity.add(right.multiplyScalar(-speedDelta));
  }
  if (moveRight) {
    playerVelocity.add(right.multiplyScalar(speedDelta));
  }

  // Check if player is moving to play footstep sounds
  if (playerVelocity.lengthSq() > 0.001 && isOnGround) {
    footstepTimer += delta;
    const footstepInterval = isSprinting
      ? SPRINT_FOOTSTEP_INTERVAL
      : FOOTSTEP_INTERVAL;

    if (footstepTimer >= footstepInterval) {
      // Play footstep sound
      audioManager.playPlayerSound("footstep");
      footstepTimer = 0;
    }
  } else {
    // Reset footstep timer when not moving
    footstepTimer = 0;
  }

  // First, check for collisions at current position and push player out if inside a wall
  const playerPosition = dungeonControls.object.position.clone();
  const staticCollision = checkWallCollision(
    playerPosition,
    new THREE.Vector3(0, 0, 1), // Direction doesn't matter for checking current position
    PLAYER_HEIGHT,
    PLAYER_RADIUS
  );

  // If player is inside a wall, push them out
  if (staticCollision.collision) {
    // Apply a push force to move player out of the wall
    const pushVector = staticCollision.pushVector.multiplyScalar(5); // Amplify push-out force
    dungeonControls.object.position.add(pushVector);
  }

  // Now check collision for movement
  // Apply movement if there's actual movement
  if (playerVelocity.lengthSq() > 0.001) {
    // Get movement direction for collision check
    const moveDirection = playerVelocity.clone().normalize();

    // Check collision with enhanced detection
    const playerPosition = dungeonControls.object.position.clone();
    const movementCollision = checkWallCollision(
      playerPosition,
      moveDirection,
      PLAYER_HEIGHT,
      PLAYER_RADIUS
    );

    if (!movementCollision.collision) {
      // No collision, apply movement
      dungeonControls.object.position.add(playerVelocity);
    } else {
      // Try to slide along walls by breaking movement into x and z components
      const xMovement = new THREE.Vector3(playerVelocity.x, 0, 0);
      const zMovement = new THREE.Vector3(0, 0, playerVelocity.z);

      // Check X movement
      if (xMovement.lengthSq() > 0.001) {
        const xDirection = xMovement.clone().normalize();
        const xCollision = checkWallCollision(
          playerPosition,
          xDirection,
          PLAYER_HEIGHT,
          PLAYER_RADIUS
        );

        if (!xCollision.collision) {
          dungeonControls.object.position.add(xMovement);
        }
      }

      // Check Z movement
      if (zMovement.lengthSq() > 0.001) {
        const zDirection = zMovement.clone().normalize();
        const zCollision = checkWallCollision(
          playerPosition,
          zDirection,
          PLAYER_HEIGHT,
          PLAYER_RADIUS
        );

        if (!zCollision.collision) {
          dungeonControls.object.position.add(zMovement);
        }
      }
    }
  }
}

// Update function for dungeon mode
function updateDungeonMode(delta) {
  // Store delta for other functions
  lastDelta = delta;

  // Skip gameplay updates when paused
  if (isGamePaused) return;

  // Log camera position occasionally for debugging
  if (Math.random() < 0.01) {
    console.log("Dungeon update called", {
      isLocked: dungeonControls?.isLocked,
      cameraPosition: dungeonControls?.object?.position?.clone(),
      delta,
    });
  }

  // Always render even if controls aren't locked (just don't process movement)
  // This ensures the scene still renders when the player first enters the game

  // Process movement if controls are locked
  if (dungeonControls && dungeonControls.isLocked) {
    // Update player movement
    updatePlayerMovement(delta);
    document.dispatchEvent(
      new CustomEvent("playerPositionUpdate", {
        detail: {
          position: dungeonControls.object.position,
          rotation: dungeonControls.object.rotation,
        },
      })
    );

    // Check for scrap collection
    checkScrapCollection();

    // Check for core collection
    checkCoreCollection();

    // Update projectiles
    const hitProjectile = projectileSystem.updateProjectiles(
      delta,
      scene,
      dungeonControls.object.position,
      PLAYER_RADIUS
    );

    // Handle player being hit by projectile
    if (hitProjectile) {
      playerHealth -= hitProjectile.damage;

      // Play hit sound
      audioManager.playPlayerSound("hit");

      // Dispatch health update event
      document.dispatchEvent(
        new CustomEvent("updateHealth", {
          detail: {
            health: playerHealth,
            prevHealth: playerHealth + hitProjectile.damage,
          },
        })
      );

      if (playerHealth <= 0) {
        console.log("Game Over! Player defeated.");

        // Play game over sound
        audioManager.playGameSound("game-over");

        // Dispatch game over event
        document.dispatchEvent(
          new CustomEvent("gameOver", {
            detail: { reason: "Player Defeated!" },
          })
        );

        // Reset the game
        playerHealth = 100;
        regenerateDungeon(scene);
      }
    }
  }

  // Update robot behavior regardless of controls lock
  // This ensures robots still animate even when controls are not locked
  updateRobots(delta);

  // Update UI
  updateDungeonUI();
}

// Update robot behaviors
function updateRobots(delta) {
  robotSpawner.getAllRobots().forEach((robot) => {
    // Only process regular robots (not enemies from defense mode)
    if (!robot.isEnemy) {
      // Get player position for calculations
      const playerPos = dungeonControls.object.position;

      // Update robot health bar to face camera
      robotSpawner.updateHealthBarBillboarding(robot, camera);

      // Initialize attack cooldown if not present
      if (robot.attackCooldown === undefined) {
        // Get fire rate from projectile config based on robot type
        const robotTypeId = robot.typeId || "scout";
        const config =
          projectileSystem.PROJECTILE_CONFIG[robotTypeId] ||
          projectileSystem.PROJECTILE_CONFIG.scout;

        // Convert fire rate (shots per second) to cooldown time
        robot.attackCooldown = 0;
        robot.attackCooldownMax = 1 / config.fireRate;
      }

      // Handle attack cooldown
      if (robot.attackCooldown > 0) {
        robot.attackCooldown -= delta;
      }

      // Use the new state machine AI system instead of hardcoded behavior
      robotAI.updateRobotAI(robot, playerPos, delta, scene);

      // Handle shooting if in shooting state and cooldown complete
      if (
        robot.aiState === robotAI.ROBOT_STATES.SHOOTING &&
        robot.attackCooldown <= 0
      ) {
        // Reset cooldown
        robot.attackCooldown = robot.attackCooldownMax;

        // Create a projectile aimed at player
        // Add slight randomness to aiming for different robot types
        const robotTypeId = robot.typeId || "scout";
        let aimJitter = 0;

        switch (robotTypeId) {
          case "scout":
            aimJitter = 0.1; // Moderate accuracy
            break;
          case "tank":
            aimJitter = 0.15; // Lower accuracy
            break;
          case "sniper":
            aimJitter = 0.03; // High accuracy
            break;
          case "healer":
            aimJitter = 0.2; // Poor accuracy
            break;
          default:
            aimJitter = 0.1;
        }

        // Get the distance to the player for jitter scaling
        const distanceToPlayer = robot.position.distanceTo(playerPos);

        // Apply jitter to aim
        const targetPos = playerPos.clone();
        if (aimJitter > 0) {
          targetPos.x += (Math.random() - 0.5) * aimJitter * distanceToPlayer;
          targetPos.y += (Math.random() - 0.5) * aimJitter * distanceToPlayer;
          targetPos.z += (Math.random() - 0.5) * aimJitter * distanceToPlayer;
        }

        // Create the projectile
        projectileSystem.createProjectile(robot, targetPos, scene);
      }
    }
  });
}

export default {
  initDungeonMode,
  updateDungeonMode,
  regenerateDungeon,
};
