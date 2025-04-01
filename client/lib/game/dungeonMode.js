// dungeonMode.js - First-person dungeon crawler mode with enhanced movement and audio
import * as THREE from "three";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";
import robotSpawner from "./robots";
import dungeonGenerator from "./dungeonGenerator";
import { randomInt } from "./robots";
import audioManager from "./audioManager";

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
  dungeonControls.object.name = "PointerLockControls";
  dungeonControls.object.userData = { isPlayer: true };
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
  regenerateDungeon(scene);

  // Play dungeon music
  audioManager.playDungeonMusic();

  // Dispatch event to update UI in React
  updateDungeonUI();

  // Return control methods
  return {
    update: updateDungeonMode,
    getControls: () => dungeonControls,
    getPlayerPosition: () => dungeonControls.object.position.clone(),
    getPlayerHealth: () => playerHealth,
    getInventory: () => playerScrapInventory,
    regenerateDungeon: () => regenerateDungeon(scene),
  };
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
  document.addEventListener("mousedown", function (event) {
    // Only process clicks when controls are locked
    if (dungeonControls.isLocked) {
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

  // REMOVED: Click to lock pointer event - this is now handled in GameCanvas.jsx
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

  dungeonControls.object.position.set(spawnX, PLAYER_HEIGHT, spawnZ);

  return dungeonData;
}

// Handle player attack
function handleAttack() {
  // Create a ray from the camera to detect robots
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);

  // Animate weapon firing
  fireWeapon();

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

      // Only attack robots within range
      if (distance < 10) {
        // Longer range than capture
        const damage = randomInt(10, 20);
        const destroyed = robotSpawner.damageRobot(robot, damage, scene);

        // Play hit sound
        audioManager.playRobotSound("hit");

        if (!destroyed) {
          console.log(`Attacked ${robot.type} robot! Health: ${robot.health}`);
        } else {
          console.log(`Destroyed ${robot.type} robot!`);

          // Play destroy sound
          audioManager.playRobotSound("destroy");

          // Check if all robots are defeated
          if (robotSpawner.getAllRobots().length === 0) {
            // Use custom event instead of confirm
            document.dispatchEvent(new CustomEvent("allRobotsDefeated"));
          }
        }

        return; // Only damage the first robot hit
      }
    }
  }
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
    color: 0xff9900,
    transparent: true,
    opacity: 0.8,
  });
  const muzzleFlash = new THREE.Mesh(flashGeometry, flashMaterial);
  muzzleFlash.position.set(0, 0, -0.5); // Position at the end of the weapon
  weaponModel.add(muzzleFlash);

  // Recoil animation
  weaponModel.position.z += 0.2; // Move weapon back

  // Create tracer effect
  const tracerGeometry = new THREE.CylinderGeometry(0.01, 0.01, 50, 8);
  const tracerMaterial = new THREE.MeshBasicMaterial({
    color: 0xffff00,
    transparent: true,
    opacity: 0.3,
  });
  const tracer = new THREE.Mesh(tracerGeometry, tracerMaterial);
  tracer.rotation.x = Math.PI / 2;
  tracer.position.set(0, 0, -25); // Extend forward from weapon
  weaponModel.add(tracer);

  // Remove effects after short delay
  setTimeout(() => {
    weaponModel.remove(muzzleFlash);
    weaponModel.remove(tracer);

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
  // Create an array to hold all the ray directions
  const rayDirections = [
    direction.clone(), // Forward
    new THREE.Vector3(-direction.z, 0, direction.x).normalize(), // Right
    new THREE.Vector3(direction.z, 0, -direction.x).normalize(), // Left
    direction.clone().negate(), // Backward
  ];

  // Add diagonal rays for better corner detection
  rayDirections.push(
    new THREE.Vector3(
      direction.x + rayDirections[1].x,
      0,
      direction.z + rayDirections[1].z
    ).normalize()
  );

  rayDirections.push(
    new THREE.Vector3(
      direction.x + rayDirections[2].x,
      0,
      direction.z + rayDirections[2].z
    ).normalize()
  );

  // Check collisions at different heights
  const heightChecks = [0.1, playerHeight / 2, playerHeight - 0.1];

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
        if (
          (object.isWall || (object.parent && object.parent.isWall)) &&
          intersection.distance < playerRadius
        ) {
          return true; // Collision detected
        }
      }
    }
  }

  return false; // No collision
}

// Update player movement with sprinting, jumping, and better collision
function updatePlayerMovement(delta) {
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

  // Apply movement if no collisions and there's actual movement
  if (playerVelocity.lengthSq() > 0.001) {
    // Get movement direction for collision check
    const moveDirection = playerVelocity.clone().normalize();

    // Check collision with enhanced detection
    const playerPosition = dungeonControls.object.position.clone();
    const collision = checkWallCollision(
      playerPosition,
      moveDirection,
      PLAYER_HEIGHT,
      PLAYER_RADIUS
    );

    if (!collision) {
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

        if (!xCollision) {
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

        if (!zCollision) {
          dungeonControls.object.position.add(zMovement);
        }
      }
    }
  }
}

// Update function for dungeon mode
function updateDungeonMode(delta) {
  // Only process movement if controls are locked
  if (dungeonControls.isLocked) {
    // Update player movement
    updatePlayerMovement(delta);

    // Check for scrap collection
    checkScrapCollection();

    checkCoreCollection();

    // Update robot behavior
    updateRobots(delta);

    // Update UI - include stamina now
    updateDungeonUI();
  }
}

// Update robot behaviors
function updateRobots(delta) {
  robotSpawner.getAllRobots().forEach((robot) => {
    // Only process regular robots (not enemies from defense mode)
    if (!robot.isEnemy) {
      // Get player position for calculations
      const playerPos = dungeonControls.object.position;
      const distanceToPlayer = robot.position.distanceTo(playerPos);

      robotSpawner.updateHealthBarBillboarding(robot, camera);
      // Robots only move if player is within detection range
      if (distanceToPlayer < 15) {
        // Move towards player
        const direction = new THREE.Vector3();
        direction.subVectors(playerPos, robot.position).normalize();

        // Cast ray to check if player is visible
        const raycaster = new THREE.Raycaster();
        raycaster.set(robot.position, direction);
        const intersects = raycaster.intersectObjects(scene.children);

        let canSeePlayer = false;
        for (let i = 0; i < intersects.length; i++) {
          const obj = intersects[i].object;

          // If hit player or something beyond player distance
          if (intersects[i].distance >= distanceToPlayer) {
            canSeePlayer = true;
            break;
          }

          // If hit a wall, player not visible
          if (obj.isWall || (obj.parent && obj.parent.isWall)) {
            break;
          }
        }

        // Only move if can see player
        if (canSeePlayer) {
          // If just detected the player and close enough, play a detection sound
          if (!robot.seesPlayer && distanceToPlayer < 10) {
            audioManager.playRobotSound("detect");
            robot.seesPlayer = true;
          }

          // Apply movement
          robot.position.x += direction.x * robot.speed * delta * 30;
          robot.position.z += direction.z * robot.speed * delta * 30;

          // Make robot face the player
          const robotToPlayer = new THREE.Vector3(
            playerPos.x - robot.position.x,
            0,
            playerPos.z - robot.position.z
          ).normalize();

          // Create a rotation that makes the robot face toward the player
          robot.rotation.y = Math.atan2(-robotToPlayer.x, -robotToPlayer.z);

          // Attack player if very close
          if (distanceToPlayer < 2) {
            const now = Date.now();
            // Play attack sound if not recently played
            if (!robot.lastAttackTime || now - robot.lastAttackTime > 1000) {
              audioManager.playRobotSound("attack");
              robot.lastAttackTime = now;
            }

            playerHealth -= robot.attack * delta;

            // Dispatch health update event
            document.dispatchEvent(
              new CustomEvent("updateHealth", {
                detail: { health: playerHealth },
              })
            );

            // Play hit sound when player takes significant damage
            if (robot.attack * delta > 1) {
              audioManager.playPlayerSound("hit");
            }

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
        } else {
          // Reset seeing player state
          robot.seesPlayer = false;
        }
      } else {
        // Reset seeing player state when out of range
        robot.seesPlayer = false;
      }
    }
  });
}

export default {
  initDungeonMode,
  updateDungeonMode,
  regenerateDungeon,
};
