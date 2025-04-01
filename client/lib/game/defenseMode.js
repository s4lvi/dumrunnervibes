// defenseMode.js - Tower defense mode with top-down view and audio
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import robotSpawner from "./robots";
import { randomInt } from "./robots";
import audioManager from "./audioManager";
import { getMapById, getDefaultMap } from "./mapConfig";

// Game state
let defenseCamera;
let orbitControls;
let defenseBase;
let towerMarkers = [];
let currentWave = 0;
let waveInProgress = false;
let renderer; // Will be set in initDefenseMode
let scene; // Will be set in initDefenseMode
let currentMap = getDefaultMap(); // Current map configuration
let placedTurrets = []; // Track placed turrets for persistence

// Initialize defense mode
export function initDefenseMode(sceneRef, rendererRef) {
  // Store references
  scene = sceneRef;
  renderer = rendererRef;

  // Play defense music
  audioManager.playDefenseMusic();

  // Create top-down orthographic camera
  defenseCamera = new THREE.OrthographicCamera(
    window.innerWidth / -32,
    window.innerWidth / 32,
    window.innerHeight / 32,
    window.innerHeight / -32,
    1,
    1000
  );
  defenseCamera.position.set(0, 40, 0);
  defenseCamera.lookAt(0, 0, 0);
  defenseCamera.zoom = 1.5;
  defenseCamera.updateProjectionMatrix();

  // Create orbit controls for camera
  orbitControls = new OrbitControls(defenseCamera, renderer.domElement);
  orbitControls.enableDamping = true;
  orbitControls.dampingFactor = 0.25;
  orbitControls.screenSpacePanning = false;
  orbitControls.maxPolarAngle = Math.PI / 3; // Limit angle to maintain top-down feel
  orbitControls.minZoom = 0.5;
  orbitControls.maxZoom = 3;

  // Create defense base and environment
  createDefenseBase(scene);

  // Setup event listeners
  setupDefenseEventListeners(scene);

  // Setup custom event handlers
  setupCustomEventHandlers(scene);

  // Update UI
  updateDefenseUI();

  // Return control methods
  return {
    update: updateDefenseMode,
    getCamera: () => defenseCamera,
    getControls: () => orbitControls,
    startWave: (waveNum) => startWave(waveNum, scene),
  };
}

// Setup custom event handlers for React component integration
function setupCustomEventHandlers(scene) {
  // Handle start next wave event
  const handleStartNextWave = (event) => {
    const { waveNumber } = event.detail;
    if (!waveInProgress) {
      startWave(waveNumber, scene);
    }
  };

  // Handle map change event
  const handleChangeMap = (event) => {
    const { mapId } = event.detail;
    const newMap = getMapById(mapId);

    if (newMap) {
      changeMap(newMap, scene);
    }
  };

  // Handle placed turrets update from React
  const handleUpdatePlacedTurrets = (event) => {
    placedTurrets = event.detail;
  };

  document.addEventListener("startNextWave", handleStartNextWave);
  document.addEventListener("changeMap", handleChangeMap);
  document.addEventListener("updatePlacedTurrets", handleUpdatePlacedTurrets);

  // Return cleanup function
  return () => {
    document.removeEventListener("startNextWave", handleStartNextWave);
    document.removeEventListener("changeMap", handleChangeMap);
    document.removeEventListener(
      "updatePlacedTurrets",
      handleUpdatePlacedTurrets
    );
  };
}

// Function to change the current map
function changeMap(newMap, scene) {
  // End any active wave
  if (waveInProgress) {
    // Clear all enemies
    robotSpawner.clearAllRobots(scene);
    waveInProgress = false;
  }

  // Play map change sound
  audioManager.playGameSound("mode-switch");

  // Store the old map's turret markers for reference
  const oldMarkers = [...towerMarkers];

  // Remember the current turrets
  const currentTurrets = [...placedTurrets];

  // Clear the current turrets array
  placedTurrets = [];

  // Remove all towers and markers from the scene
  scene.traverse((object) => {
    if (object.isTower || object.isPlacementMarker) {
      scene.remove(object);
    }
  });

  // Update the current map
  currentMap = newMap;

  // Rebuild the base and paths
  createDefenseBase(scene);

  // Now recreate the towers if they have valid positions in the new map
  const returnedCores = [];

  currentTurrets.forEach((turretData) => {
    // Try to find a matching marker position in the new map
    const matchingMarkerIndex = towerMarkers.findIndex(
      (marker) =>
        marker.isEmpty &&
        Math.abs(marker.position.x - turretData.position.x) < 5 &&
        Math.abs(marker.position.z - turretData.position.z) < 5
    );

    if (matchingMarkerIndex >= 0) {
      // We found a matching position, rebuild the tower here
      const marker = towerMarkers[matchingMarkerIndex];

      // Update the turret data with the new position
      turretData.position = {
        x: marker.position.x,
        y: marker.position.y,
        z: marker.position.z,
      };
      turretData.markerId = matchingMarkerIndex;

      // Create the core object and use it to build the tower
      window.capturedCores = window.capturedCores || [];
      window.capturedCores.push(turretData.core);

      // Create the tower at the new position
      createTower(marker.position, window.capturedCores.length - 1, scene);

      // Remove the core we just added since createTower also removes it
      window.capturedCores = window.capturedCores.slice(0, -1);
    } else {
      // No matching position found, return the core
      returnedCores.push(turretData.core);
    }
  });

  // Return any cores that couldn't be placed
  if (returnedCores.length > 0) {
    // Dispatch an event with the returned cores
    document.dispatchEvent(
      new CustomEvent("returnedCores", {
        detail: { returnedCores },
      })
    );
  }
}

// Create the base environment
function createDefenseBase(scene) {
  // Clear the scene of dungeon elements
  clearScene(scene);

  // Create the base floor
  const baseGeometry = new THREE.PlaneGeometry(50, 50);
  const baseMaterial = new THREE.MeshLambertMaterial({
    color: 0x228822,
    side: THREE.DoubleSide,
  });
  const baseFloor = new THREE.Mesh(baseGeometry, baseMaterial);
  baseFloor.rotation.x = Math.PI / 2;
  baseFloor.receiveShadow = true;
  scene.add(baseFloor);

  // Create grid lines for visual reference
  const gridHelper = new THREE.GridHelper(50, 25, 0x000000, 0x444444);
  gridHelper.position.y = 0.01;
  scene.add(gridHelper);

  // Create the central core building (use basePosition from the map if available)
  const basePosition = currentMap.basePosition || { x: 0, z: 0 };

  const coreGeometry = new THREE.BoxGeometry(5, 3, 5);
  const coreMaterial = new THREE.MeshLambertMaterial({ color: 0x0088ff });
  defenseBase = new THREE.Mesh(coreGeometry, coreMaterial);
  defenseBase.position.set(basePosition.x, 1.5, basePosition.z);
  defenseBase.castShadow = true;
  defenseBase.receiveShadow = true;
  scene.add(defenseBase);

  defenseBase.isBase = true;
  defenseBase.health = 100;
  defenseBase.maxHealth = 100;

  // Add health bar to base
  const healthBarWidth = 5;
  const healthBarHeight = 0.5;
  const healthBarGeometry = new THREE.PlaneGeometry(
    healthBarWidth,
    healthBarHeight
  );
  const healthBarMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
  const healthBar = new THREE.Mesh(healthBarGeometry, healthBarMaterial);
  healthBar.position.y = 4;
  healthBar.rotation.x = -Math.PI / 2;
  defenseBase.add(healthBar);
  defenseBase.healthBar = healthBar;

  // Create tower placement markers
  createTowerPlacementMarkers(scene);

  // Add ambient light
  const ambientLight = new THREE.AmbientLight(0x555555);
  scene.add(ambientLight);

  // Add directional light for shadows
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(10, 20, 10);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  dirLight.shadow.camera.left = -25;
  dirLight.shadow.camera.right = 25;
  dirLight.shadow.camera.top = 25;
  dirLight.shadow.camera.bottom = -25;
  dirLight.shadow.camera.far = 50;
  scene.add(dirLight);

  // Add path indicators for where enemies will approach
  createPathIndicators(scene);
}

// Get tower marker ID by position
function getTowerMarkerIdByPosition(position) {
  // Find the closest marker to this position
  const markerId = towerMarkers.findIndex(
    (marker) =>
      Math.abs(marker.position.x - position.x) < 0.1 &&
      Math.abs(marker.position.z - position.z) < 0.1
  );

  return markerId;
}

// Create markers for tower placement
function createTowerPlacementMarkers(scene) {
  towerMarkers = [];

  // Use the tower spots from the current map
  const markerPositions = currentMap.towerSpots || [
    { x: -10, z: -10 },
    { x: -10, z: 10 },
    { x: 10, z: -10 },
    { x: 10, z: 10 },
    { x: 0, z: -15 },
    { x: 0, z: 15 },
    { x: -15, z: 0 },
    { x: 15, z: 0 },
  ];

  markerPositions.forEach((pos, index) => {
    const markerGeometry = new THREE.CylinderGeometry(1, 1, 0.2, 32);
    const markerMaterial = new THREE.MeshLambertMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: 0.5,
    });
    const marker = new THREE.Mesh(markerGeometry, markerMaterial);

    marker.position.set(pos.x, 0.1, pos.z);
    marker.receiveShadow = true;

    marker.isPlacementMarker = true;
    marker.isEmpty = true;
    marker.markerId = index; // Store the marker ID

    scene.add(marker);
    towerMarkers.push(marker);
  });
}

// Create path indicators for enemy approach routes
function createPathIndicators(scene) {
  // Get paths from the current map configuration
  const pathPositions = currentMap.paths || [
    { start: { x: -25, z: -25 }, end: { x: 0, z: 0 } },
    { start: { x: -25, z: 25 }, end: { x: 0, z: 0 } },
    { start: { x: 25, z: -25 }, end: { x: 0, z: 0 } },
    { start: { x: 25, z: 25 }, end: { x: 0, z: 0 } },
  ];

  pathPositions.forEach((path) => {
    // Create dashed line to indicate path
    const points = [
      new THREE.Vector3(path.start.x, 0.1, path.start.z),
      new THREE.Vector3(path.end.x, 0.1, path.end.z),
    ];

    const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
    const lineMaterial = new THREE.LineDashedMaterial({
      color: 0xff0000,
      linewidth: 1,
      scale: 1,
      dashSize: 1,
      gapSize: 1,
    });

    const line = new THREE.Line(lineGeometry, lineMaterial);
    line.computeLineDistances(); // Required for dashed lines
    scene.add(line);

    // Add arrow indicator at start position
    const arrowGeometry = new THREE.ConeGeometry(0.5, 1, 8);
    const arrowMaterial = new THREE.MeshLambertMaterial({ color: 0xff0000 });
    const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);

    // Position and rotate arrow to point toward center
    arrow.position.set(path.start.x, 0.5, path.start.z);
    arrow.lookAt(path.end.x, 0.5, path.end.z);
    arrow.rotateX(Math.PI / 2);

    scene.add(arrow);
  });
}

// Clear scene of elements not needed in defense mode
function clearScene(scene) {
  // Remove all objects except cameras and basic lights
  for (let i = scene.children.length - 1; i >= 0; i--) {
    const obj = scene.children[i];

    // Skip camera
    if (obj.isCamera) continue;

    // Keep basic light setup
    if (obj.isLight) {
      // Only remove non-essential lights
      if (obj.intensity < 0.5) {
        scene.remove(obj);
      }
      continue;
    }

    // Remove all player-related objects
    if (
      obj.name === "Player" ||
      obj.name === "PointerLockControls" ||
      (obj.userData && obj.userData.isPlayer)
    ) {
      scene.remove(obj);
      continue;
    }

    // Remove all other objects except the scene itself
    if (obj !== scene) {
      scene.remove(obj);
    }
  }

  // Clear any remaining robots
  robotSpawner.clearAllRobots(scene);
}

// Setup event listeners for defense mode
function setupDefenseEventListeners(scene) {
  // Add click event for tower placement
  renderer.domElement.addEventListener("click", function (event) {
    // Cast ray from mouse position
    const mouse = new THREE.Vector2();
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, defenseCamera);

    const intersects = raycaster.intersectObjects(scene.children);

    for (let i = 0; i < intersects.length; i++) {
      const obj = intersects[i].object;

      // Check if clicked on a placement marker
      if (obj.isPlacementMarker && obj.isEmpty) {
        // Play UI hover sound
        audioManager.playUI("hover");

        // Check if we have any cores to place
        if (window.capturedCores && window.capturedCores.length > 0) {
          // Use ReactPortal to show tower placement menu instead
          // This is handled by the React components now
          document.dispatchEvent(
            new CustomEvent("showTowerMenu", {
              detail: {
                marker: obj,
                position: {
                  x: obj.position.x,
                  y: obj.position.y,
                  z: obj.position.z,
                },
              },
            })
          );
        } else {
          // Play error sound
          audioManager.playUI("back");

          // Instead of alert, dispatch event for React to handle
          document.dispatchEvent(new CustomEvent("noAICores"));
        }
        break;
      }
    }
  });

  // Add keyboard controls for wave management
  document.addEventListener("keydown", function (event) {
    if (event.code === "KeyN" && !waveInProgress) {
      startWave(currentWave + 1, scene);
    }
  });
}

// Create a defensive tower
export function createTower(position, coreIndex, scene) {
  // Get the captured cores array from window (set in GameCanvas)
  const capturedCores = window.capturedCores || [];

  // If we have no cores or invalid index, return
  if (!capturedCores.length || coreIndex >= capturedCores.length) return null;

  const core = capturedCores[coreIndex];

  // Remove the core from the array (we'll dispatch an event to update React state)
  const updatedCores = [...capturedCores];
  updatedCores.splice(coreIndex, 1);
  window.capturedCores = updatedCores;

  // Play tower placement sound
  audioManager.playTowerSound("place");

  // Dispatch event to update React state
  document.dispatchEvent(
    new CustomEvent("updateCores", { detail: updatedCores })
  );

  // Create a persistent tower data object for tracking
  const towerData = {
    position: { x: position.x, y: position.y, z: position.z },
    core: core,
    towerType: null, // Will be set below
    markerId: getTowerMarkerIdByPosition(position),
  };

  // Different tower types
  const towerTypes = {
    basic: { color: 0xaaaaaa, range: 8, damage: 5, rate: 1 },
    cannon: { color: 0x880000, range: 6, damage: 15, rate: 0.5 },
    laser: { color: 0x00ff00, range: 12, damage: 3, rate: 2 },
    tesla: { color: 0x8800ff, range: 4, damage: 10, rate: 1.5 },
  };

  // Select tower type
  const towerType = Object.keys(towerTypes)[randomInt(0, 3)];
  const baseStats = towerTypes[towerType];

  // Store the tower type in the tower data
  towerData.towerType = towerType;

  // Create the tower
  const towerGroup = new THREE.Group();
  towerGroup.isTower = true;
  towerGroup.towerData = towerData; // Attach the data for reference

  // Base
  const baseGeometry = new THREE.BoxGeometry(2, 1, 2);
  const baseMaterial = new THREE.MeshLambertMaterial({ color: 0x888888 });
  const towerBase = new THREE.Mesh(baseGeometry, baseMaterial);
  towerBase.position.y = 0.5;
  towerBase.castShadow = true;
  towerBase.receiveShadow = true;
  towerGroup.add(towerBase);

  // Create a turret group that will rotate as a single unit
  const turretGroup = new THREE.Group();
  turretGroup.position.y = 1.75; // Position at the top of the base

  // Turret
  const turretGeometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
  const turretMaterial = new THREE.MeshLambertMaterial({
    color: baseStats.color,
  });
  const turret = new THREE.Mesh(turretGeometry, turretMaterial);
  turret.castShadow = true;
  turret.receiveShadow = true;
  turretGroup.add(turret);

  // Barrel
  const barrelGeometry = new THREE.CylinderGeometry(0.2, 0.2, 1.5, 16);
  const barrelMaterial = new THREE.MeshLambertMaterial({ color: 0x444444 });
  const barrel = new THREE.Mesh(barrelGeometry, barrelMaterial);
  barrel.rotation.x = Math.PI / 2; // Align barrel horizontally
  barrel.position.z = 1; // Position in front of the turret
  barrel.castShadow = true;
  turretGroup.add(barrel);

  // Add the turret group to the tower
  towerGroup.add(turretGroup);

  // Range indicator (visible on hover)
  const rangeGeometry = new THREE.RingGeometry(
    baseStats.range - 0.1,
    baseStats.range,
    32
  );
  const rangeMaterial = new THREE.MeshBasicMaterial({
    color: 0xffff00,
    transparent: true,
    opacity: 0.2,
    side: THREE.DoubleSide,
  });
  const rangeIndicator = new THREE.Mesh(rangeGeometry, rangeMaterial);
  rangeIndicator.rotation.x = Math.PI / 2;
  rangeIndicator.position.y = 0.1;
  rangeIndicator.visible = false;
  towerGroup.add(rangeIndicator);

  // Position the tower
  towerGroup.position.set(position.x, position.y, position.z);

  // Tower properties
  towerGroup.type = towerType;
  towerGroup.range = baseStats.range;
  towerGroup.damage = baseStats.damage;
  towerGroup.fireRate = baseStats.rate;
  towerGroup.lastFired = 0;
  towerGroup.rangeIndicator = rangeIndicator;
  towerGroup.turretGroup = turretGroup; // Reference to the turret group for rotation

  // Apply core bonuses
  if (core) {
    console.log(
      `Applying ${core.type} core (${core.value}) to ${towerType} tower.`
    );

    switch (core.value) {
      case "speed":
        towerGroup.fireRate *= 1 + 0.2 * core.power;
        turret.material.color.setHex(0xff0000);
        break;
      case "power":
        towerGroup.damage *= 1 + 0.3 * core.power;
        turret.material.color.setHex(0x0000ff);
        break;
      case "range":
        towerGroup.range *= 1 + 0.25 * core.power;
        rangeIndicator.scale.set(
          1 + 0.25 * core.power,
          1 + 0.25 * core.power,
          1
        );
        turret.material.color.setHex(0xffff00);
        break;
      case "healing":
        // Healing towers periodically repair other towers and the base
        towerGroup.healAmount = 2 * core.power;
        towerGroup.lastHealed = 0;
        turret.material.color.setHex(0x00ffff);
        break;
    }
  }

  // Add mouse event listeners for range display
  const onMouseMove = function (event) {
    const mouse = new THREE.Vector2();
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, defenseCamera);

    const intersects = raycaster.intersectObject(towerGroup, true);

    if (intersects.length > 0) {
      rangeIndicator.visible = true;
      // Play hover sound if not recently played
      if (
        !towerGroup.lastHoverSound ||
        Date.now() - towerGroup.lastHoverSound > 500
      ) {
        audioManager.playUI("hover");
        towerGroup.lastHoverSound = Date.now();
      }
    } else {
      rangeIndicator.visible = false;
    }
  };

  scene.addEventListener("mousemove", onMouseMove);

  // Add the tower to the scene
  scene.add(towerGroup);

  // Update UI
  updateDefenseUI();

  // Find the marker this tower was placed on and mark it as not empty
  const marker = towerMarkers.find(
    (m) =>
      Math.abs(m.position.x - position.x) < 0.1 &&
      Math.abs(m.position.z - position.z) < 0.1
  );

  if (marker) {
    marker.isEmpty = false;
  }

  // Add to the placed turrets array for persistence
  placedTurrets.push(towerData);

  // Dispatch event to update React state
  document.dispatchEvent(
    new CustomEvent("updatePlacedTurrets", { detail: placedTurrets })
  );

  return towerGroup;
}

// Start a wave of attacking robots
function startWave(waveNumber, scene) {
  if (waveInProgress) return;

  waveInProgress = true;
  currentWave = waveNumber;
  console.log(`Starting wave ${waveNumber}`);

  // Play wave start sound
  audioManager.playGameSound("wave-start");

  // Dispatch wave started event for React UI
  document.dispatchEvent(
    new CustomEvent("waveStarted", {
      detail: { waveNumber: waveNumber },
    })
  );

  const numEnemies = 5 + waveNumber * 2;

  // Use spawn points from the current map
  const spawnPositions = currentMap.spawnPoints || [
    { x: -25, z: -25 },
    { x: -25, z: 25 },
    { x: 25, z: -25 },
    { x: 25, z: 25 },
  ];

  let enemiesSpawned = 0;
  let enemiesAlive = numEnemies;

  // Dispatch countdown event for React to handle UI
  document.dispatchEvent(
    new CustomEvent("waveCountdown", {
      detail: { seconds: 3 },
    })
  );

  // Start spawning enemies after countdown
  setTimeout(() => {
    const spawnInterval = setInterval(() => {
      if (enemiesSpawned >= numEnemies) {
        clearInterval(spawnInterval);
        return;
      }

      const spawnPos = spawnPositions[randomInt(0, spawnPositions.length - 1)];

      // Create enemy robot at spawn position - ensure scene is passed correctly
      const enemy = robotSpawner.spawnRobot(spawnPos.x, spawnPos.z, scene);

      if (enemy) {
        // Play robot spawn sound
        audioManager.playRobotSound("detect");

        // Add enemy-specific properties
        enemy.isEnemy = true;
        enemy.target = new THREE.Vector3(
          currentMap.basePosition?.x || 0,
          0,
          currentMap.basePosition?.z || 0
        ); // Target the central base
        enemy.health *= 1 + waveNumber * 0.2; // Scale health with wave number
        enemy.maxHealth = enemy.health;

        // Debug visualization - make enemies more visible
        if (enemy.children.length > 0) {
          enemy.children[0].material.color.set(0xff0000);
        }

        // Add event listener for enemy death
        enemy.onDestroy = function () {
          enemiesAlive--;

          // Check if wave is complete
          if (enemiesAlive <= 0) {
            waveInProgress = false;

            // Play wave complete sound
            audioManager.playGameSound("wave-complete");

            // Dispatch wave complete event for React UI
            document.dispatchEvent(
              new CustomEvent("waveComplete", {
                detail: { waveNumber: waveNumber },
              })
            );
          }
        };

        console.log(`Spawned enemy at ${spawnPos.x}, ${spawnPos.z}`);
        enemiesSpawned++;
      } else {
        console.error("Failed to spawn enemy!");
      }
    }, 1000);
  }, 3000); // 3 second countdown

  return numEnemies;
}

// Update tower targeting and firing
function updateTowers(delta, scene) {
  scene.children.forEach((obj) => {
    if (obj.isTower) {
      const now = Date.now();

      // Can the tower fire?
      if (now - obj.lastFired > 1000 / obj.fireRate) {
        // Find closest enemy in range
        let closestEnemy = null;
        let closestDistance = Infinity;

        robotSpawner.getAllRobots().forEach((enemy) => {
          if (enemy.isEnemy) {
            const distance = enemy.position.distanceTo(obj.position);

            if (distance < obj.range && distance < closestDistance) {
              closestEnemy = enemy;
              closestDistance = distance;
            }
          }
        });

        if (closestEnemy) {
          // Rotate the entire turret group to face the enemy
          obj.turretGroup.lookAt(
            closestEnemy.position.x,
            obj.turretGroup.position.y,
            closestEnemy.position.z
          );

          // Tower fires at enemy
          obj.lastFired = now;

          // Create laser effect
          fireTowerWeapon(obj, closestEnemy, scene);

          // Apply damage to enemy
          const destroyed = robotSpawner.damageRobot(
            closestEnemy,
            obj.damage,
            scene
          );

          // If enemy destroyed, call its onDestroy callback
          if (destroyed && closestEnemy.onDestroy) {
            closestEnemy.onDestroy();
          }
        }
      }

      // Special case for healing towers
      if (obj.healAmount && now - obj.lastHealed > 3000) {
        obj.lastHealed = now;

        // Heal the base if it's nearby
        if (
          defenseBase &&
          obj.position.distanceTo(defenseBase.position) < obj.range
        ) {
          defenseBase.health = Math.min(
            defenseBase.maxHealth,
            defenseBase.health + obj.healAmount
          );
          updateBaseHealth();
          createHealingEffect(defenseBase.position, scene);
        }

        // Heal other towers in range
        scene.children.forEach((otherObj) => {
          if (
            otherObj.isTower &&
            otherObj !== obj &&
            obj.position.distanceTo(otherObj.position) < obj.range
          ) {
            // Healing effect on other tower
            createHealingEffect(otherObj.position, scene);
          }
        });
      }
    }
  });
}

// Fire tower weapon with visual effects
function fireTowerWeapon(tower, target, scene) {
  // Calculate positions
  const start = new THREE.Vector3().setFromMatrixPosition(
    tower.turretGroup.children[1].matrixWorld
  ); // Get barrel world position

  const end = new THREE.Vector3(
    target.position.x,
    target.position.y,
    target.position.z
  );
  let distance = 0;

  // Play appropriate tower weapon sound
  switch (tower.type) {
    case "laser":
      audioManager.playTowerSound("laser");
      break;
    case "tesla":
      audioManager.playTowerSound("tesla");
      break;
    case "cannon":
      audioManager.playTowerSound("cannon");
      break;
    default:
      audioManager.playTowerSound("shoot");
  }

  // Determine effect based on tower type
  switch (tower.type) {
    case "laser":
      // Create laser beam
      const laserGeometry = new THREE.CylinderGeometry(0.05, 0.05, 1, 8);
      const laserMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ff00,
        transparent: true,
        opacity: 0.7,
      });
      const laser = new THREE.Mesh(laserGeometry, laserMaterial);

      // Position and scale laser to reach target
      distance = start.distanceTo(end);
      laser.scale.y = distance;

      // Position at midpoint
      const mid = new THREE.Vector3()
        .addVectors(start, end)
        .multiplyScalar(0.5);
      laser.position.copy(mid);

      // Orient toward target
      laser.lookAt(end);
      laser.rotateX(Math.PI / 2);

      scene.add(laser);

      // Remove after short delay
      setTimeout(() => scene.remove(laser), 150);
      break;

    case "cannon":
      // Create projectile
      const projectileGeometry = new THREE.SphereGeometry(0.2, 8, 8);
      const projectileMaterial = new THREE.MeshBasicMaterial({
        color: 0xff0000,
      });
      const projectile = new THREE.Mesh(projectileGeometry, projectileMaterial);

      // Start at tower
      projectile.position.copy(start);
      scene.add(projectile);

      // Animate projectile
      const direction = new THREE.Vector3().subVectors(end, start).normalize();
      const speed = 0.5;
      distance = 0;
      const maxDistance = start.distanceTo(end);

      function animateProjectile() {
        projectile.position.add(direction.clone().multiplyScalar(speed));
        distance += speed;

        if (distance < maxDistance) {
          requestAnimationFrame(animateProjectile);
        } else {
          // Create explosion at target
          createExplosion(end, scene);
          scene.remove(projectile);
        }
      }

      animateProjectile();
      break;

    case "tesla":
      // Create lightning effect
      const numArcs = 5;
      const points = [];

      // Generate zigzag path from tower to target
      points.push(start);

      for (let i = 1; i < numArcs; i++) {
        const t = i / numArcs;
        const pos = new THREE.Vector3().lerpVectors(start, end, t);

        // Add random offset
        pos.x += (Math.random() - 0.5) * 1;
        pos.y += (Math.random() - 0.5) * 1;
        pos.z += (Math.random() - 0.5) * 1;

        points.push(pos);
      }

      points.push(end);

      // Create lightning segments
      for (let i = 0; i < points.length - 1; i++) {
        const segmentGeometry = new THREE.BufferGeometry().setFromPoints([
          points[i],
          points[i + 1],
        ]);

        const segmentMaterial = new THREE.LineBasicMaterial({
          color: 0x8800ff,
          linewidth: 3,
        });

        const segment = new THREE.Line(segmentGeometry, segmentMaterial);
        scene.add(segment);

        // Remove after short delay
        setTimeout(() => scene.remove(segment), 100);
      }
      break;

    default:
      // Basic tower - simple beam
      const beamGeometry = new THREE.CylinderGeometry(0.05, 0.05, 1, 8);
      const beamMaterial = new THREE.MeshBasicMaterial({
        color: 0xffff00,
        transparent: true,
        opacity: 0.5,
      });
      const beam = new THREE.Mesh(beamGeometry, beamMaterial);

      // Position and scale beam to reach target
      const beamDistance = start.distanceTo(end);
      beam.scale.y = beamDistance;

      // Position at midpoint
      const beamMid = new THREE.Vector3()
        .addVectors(start, end)
        .multiplyScalar(0.5);
      beam.position.copy(beamMid);

      // Orient toward target
      beam.lookAt(end);
      beam.rotateX(Math.PI / 2);

      scene.add(beam);

      // Remove after short delay
      setTimeout(() => scene.remove(beam), 100);
  }
}

// Create explosion effect
function createExplosion(position, scene) {
  // Create particle group
  const particleCount = 20;
  const particleGroup = new THREE.Group();

  // Create explosion particles
  for (let i = 0; i < particleCount; i++) {
    const size = 0.1 + Math.random() * 0.2;
    const geometry = new THREE.SphereGeometry(size, 8, 8);

    // Random color: orange, red, yellow
    const colors = [0xff4500, 0xff0000, 0xffaa00];
    const material = new THREE.MeshBasicMaterial({
      color: colors[Math.floor(Math.random() * colors.length)],
      transparent: true,
    });

    const particle = new THREE.Mesh(geometry, material);

    // Set random direction
    const speed = 0.05 + Math.random() * 0.1;
    const angle = Math.random() * Math.PI * 2;
    const elevation = Math.random() * Math.PI - Math.PI / 2;

    particle.userData.velocity = new THREE.Vector3(
      speed * Math.cos(angle) * Math.cos(elevation),
      speed * Math.sin(elevation) + 0.05, // Add upward boost
      speed * Math.sin(angle) * Math.cos(elevation)
    );

    // Set initial position
    particle.position.copy(position);

    particleGroup.add(particle);
  }

  scene.add(particleGroup);

  // Animate the explosion
  let lifetime = 0;
  const maxLifetime = 30;

  function animateExplosion() {
    lifetime++;

    // Update each particle
    particleGroup.children.forEach((particle) => {
      // Move particle
      particle.position.add(particle.userData.velocity);

      // Apply gravity
      particle.userData.velocity.y -= 0.002;

      // Fade out
      particle.material.opacity = 1 - lifetime / maxLifetime;
    });

    if (lifetime < maxLifetime) {
      requestAnimationFrame(animateExplosion);
    } else {
      scene.remove(particleGroup);
    }
  }

  animateExplosion();
}

// Create healing effect
function createHealingEffect(position, scene) {
  const geometry = new THREE.SphereGeometry(0.5, 8, 8);
  const material = new THREE.MeshBasicMaterial({
    color: 0x00ffff,
    transparent: true,
    opacity: 0.7,
  });

  const effect = new THREE.Mesh(geometry, material);
  effect.position.copy(position);
  effect.position.y += 0.5;
  scene.add(effect);

  // Animate the healing effect
  let scale = 1;
  function animateHeal() {
    scale += 0.1;
    effect.scale.set(scale, scale, scale);
    effect.material.opacity -= 0.05;

    if (effect.material.opacity > 0) {
      requestAnimationFrame(animateHeal);
    } else {
      scene.remove(effect);
    }
  }

  animateHeal();
}

// Update enemy behaviors in defense mode
function updateEnemies(delta) {
  // Get a copy of the array to avoid issues with modifications during iteration
  const enemies = [...robotSpawner.getAllRobots()].filter(
    (enemy) => enemy.isEnemy
  );

  enemies.forEach((enemy) => {
    // Skip processing if enemy has been removed from scene
    if (!enemy.parent) return;

    robotSpawner.updateHealthBarBillboarding(enemy, defenseCamera);

    // Move towards base
    if (!(enemy.target instanceof THREE.Vector3)) {
      enemy.target = new THREE.Vector3(
        currentMap.basePosition?.x || 0,
        0,
        currentMap.basePosition?.z || 0
      );
    }
    const direction = new THREE.Vector3();
    direction.subVectors(enemy.target, enemy.position).normalize();

    // Apply movement scaled by delta time
    enemy.position.x += direction.x * enemy.speed * delta * 30;
    enemy.position.z += direction.z * enemy.speed * delta * 30;

    // Make enemy face the direction of movement
    enemy.lookAt(
      enemy.position.x + direction.x,
      enemy.position.y,
      enemy.position.z + direction.z
    );

    // Check if reached base
    const basePosition = defenseBase
      ? defenseBase.position
      : new THREE.Vector3(
          currentMap.basePosition?.x || 0,
          0,
          currentMap.basePosition?.z || 0
        );

    const distanceToBase = enemy.position.distanceTo(basePosition);

    if (distanceToBase < 3) {
      // Attack the base if it exists
      if (defenseBase) {
        // Play base hit sound
        audioManager.playGameSound("base-hit");

        defenseBase.health -= 1;
        updateBaseHealth();
      }

      // Safely remove the enemy
      try {
        // Only remove if it's still in the scene
        if (enemy.parent) {
          scene.remove(enemy);
        }

        // Call onDestroy callback if exists (in a try/catch block)
        if (typeof enemy.onDestroy === "function") {
          try {
            enemy.onDestroy();
          } catch (e) {
            console.error("Error in enemy onDestroy callback:", e);
          }
        }

        // Use robotSpawner's method to safely remove from the array
        robotSpawner.clearRobot(enemy);
      } catch (e) {
        console.error("Error removing enemy:", e);
      }
    }
  });
}

// Update base health display
function updateBaseHealth() {
  if (defenseBase && defenseBase.healthBar) {
    const healthPercent = Math.max(
      0,
      defenseBase.health / defenseBase.maxHealth
    );
    defenseBase.healthBar.scale.x = healthPercent;

    // Change color based on health
    if (healthPercent > 0.6) {
      defenseBase.healthBar.material.color.set(0x00ff00); // Green
    } else if (healthPercent > 0.3) {
      defenseBase.healthBar.material.color.set(0xffff00); // Yellow
    } else {
      defenseBase.healthBar.material.color.set(0xff0000); // Red
    }
  }

  // Dispatch event to update React UI
  document.dispatchEvent(
    new CustomEvent("updateBaseHealth", {
      detail: {
        health: Math.floor(defenseBase?.health || 0),
        maxHealth: defenseBase?.maxHealth || 100,
        prevHealth: defenseBase?.prevHealth,
      },
    })
  );

  // Store previous health for damage detection
  if (defenseBase) {
    defenseBase.prevHealth = defenseBase.health;
  }

  // Check for game over
  if (defenseBase && defenseBase.health <= 0) {
    gameOver();
  }
}

// Game over handler
function gameOver() {
  console.log("Game Over! Base destroyed.");

  // Play game over sound
  audioManager.playGameSound("game-over");

  // Dispatch game over event for React UI
  document.dispatchEvent(
    new CustomEvent("gameOver", {
      detail: { reason: "Base Destroyed!" },
    })
  );
}

// Update defense UI through events (React will handle the actual UI updates)
function updateDefenseUI() {
  // Dispatch events for React components to update
  document.dispatchEvent(
    new CustomEvent("updateDefenseUI", {
      detail: {
        gameState: "defense",
        waveNumber: currentWave,
        coresCount: window.capturedCores ? window.capturedCores.length : 0,
        baseHealth: defenseBase ? Math.floor(defenseBase.health) : 0,
        baseMaxHealth: defenseBase ? defenseBase.maxHealth : 0,
      },
    })
  );
}

// Update function for defense mode
function updateDefenseMode(delta) {
  // Update orbit controls
  orbitControls.update();

  // Update towers
  updateTowers(delta, scene);

  // Update enemies
  updateEnemies(delta);

  // Update UI
  updateDefenseUI();
}

export default {
  initDefenseMode,
  createTower,
  startWave,
};
