// robots.js - Robot spawning and handling functionality
import * as THREE from "three";
import { getRobotType, getRandomRobotType } from "./robotConfig";
import { ROBOT_BEHAVIORS } from "./robotConfig";
// Track all active robots
let robotsArray = [];
let scrapPiles = [];
let coreItems = [];

// Create a robot at given coordinates
export function spawnRobot(x, z, scene, robotTypeId = null) {
  // Get robot type - either specific or random
  const robotType = robotTypeId
    ? getRobotType(robotTypeId)
    : getRandomRobotType();

  if (!robotType) {
    console.error("Invalid robot type:", robotTypeId);
    return null;
  }

  // Create robot group
  const robot = new THREE.Group();
  robot.isRobot = true;

  // Initialize AI state machine
  const behavior = ROBOT_BEHAVIORS[robotType.id] || ROBOT_BEHAVIORS.scout;
  robot.aiState = behavior.defaultState;
  robot.aiData = {
    behavior: behavior,
    lastStateChange: 0,
    targetPosition: new THREE.Vector3(),
    patrolPoints: [], // Will be filled during first update
    searchStartTime: 0,
    hidingPosition: null,
    canSeePlayer: false,
    lastSeenPlayerPosition: new THREE.Vector3(),
    stateTimer: 0,
  };

  // Create robot body
  const bodyGeometry = new THREE.BoxGeometry(
    robotType.size,
    robotType.height,
    robotType.size
  );
  const bodyMaterial = new THREE.MeshLambertMaterial({
    color: robotType.color,
  });
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.castShadow = true;
  body.receiveShadow = true;
  robot.add(body);

  // Create head
  const headGeometry = new THREE.BoxGeometry(
    robotType.size * 0.7,
    robotType.size * 0.7,
    robotType.size * 0.7
  );
  const headMaterial = new THREE.MeshLambertMaterial({ color: 0x333333 });
  const head = new THREE.Mesh(headGeometry, headMaterial);
  head.position.y = robotType.height / 2 + robotType.size * 0.35;
  head.castShadow = true;
  robot.add(head);

  // Create eyes
  const eyeGeometry = new THREE.SphereGeometry(robotType.size * 0.15, 8, 8);
  const eyeMaterial = new THREE.MeshLambertMaterial({
    color: 0x00ffff,
    emissive: 0x00ffff,
    emissiveIntensity: 0.5,
  });

  const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
  leftEye.position.set(
    -robotType.size * 0.2,
    robotType.size * 0.1,
    -robotType.size * 0.3
  );
  head.add(leftEye);

  const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
  rightEye.position.set(
    robotType.size * 0.2,
    robotType.size * 0.1,
    -robotType.size * 0.3
  );
  head.add(rightEye);

  // Position robot
  robot.position.set(x, robotType.height / 2, z);

  // Add robot properties from config
  Object.assign(robot, {
    type: robotType.name,
    typeId: robotType.id,
    health: robotType.health,
    attack: robotType.attack,
    speed: robotType.speed,
    coreValue: robotType.coreValue,
    maxHealth: robotType.health,
    scrapValue: robotType.scrapValue,
    scrapType: robotType.scrapType,
    description: robotType.description,
    coreDropChance: robotType.coreDropChance, // New property for core drop chance
  });
  const healthBarWidth = robotType.size * 1.2;
  const healthBarHeight = 0.2; // Increased height for better visibility
  const healthBarGeometry = new THREE.PlaneGeometry(
    healthBarWidth,
    healthBarHeight
  );
  const healthBarMaterial = new THREE.MeshBasicMaterial({
    color: 0x00ff00,
    side: THREE.DoubleSide, // Make it visible from both sides
    depthTest: true,
  });
  const healthBar = new THREE.Mesh(healthBarGeometry, healthBarMaterial);

  // Add a background for the health bar for better contrast
  const healthBarBgGeometry = new THREE.PlaneGeometry(
    healthBarWidth,
    healthBarHeight
  );
  const healthBarBgMaterial = new THREE.MeshBasicMaterial({
    color: 0x444444,
    side: THREE.DoubleSide,
    depthTest: true, // Always render on top
  });
  const healthBarBg = new THREE.Mesh(healthBarBgGeometry, healthBarBgMaterial);

  // Create a separate group for the health bar that will always face up
  const healthBarGroup = new THREE.Group();
  healthBarGroup.position.y = robotType.height + 0.4;
  healthBarGroup.add(healthBarBg);
  healthBarGroup.add(healthBar);

  // Position the actual bar slightly in front of the background
  healthBar.position.z = 0.01;

  robot.add(healthBarGroup);
  robot.healthBar = healthBar;
  robot.healthBarGroup = healthBarGroup;

  // Store original values for update calculations
  robot.healthBarWidth = healthBarWidth;

  // Add to scene and tracking array
  scene.add(robot);
  robotsArray.push(robot);

  return robot;
}

// Update robot health bar
export function updateRobotHealthBar(robot) {
  if (!robot.healthBar) return;

  const healthPercent = Math.max(0, robot.health / robot.maxHealth);

  // Only scale in X direction, keep Y (height) the same
  robot.healthBar.scale.x = healthPercent;

  // Reposition to ensure it remains centered as it scales
  const offset = ((1 - healthPercent) * robot.healthBarWidth) / 2;
  robot.healthBar.position.x = -offset;

  // Change color based on health
  if (healthPercent > 0.6) {
    robot.healthBar.material.color.set(0x00ff00); // Green
  } else if (healthPercent > 0.3) {
    robot.healthBar.material.color.set(0xffff00); // Yellow
  } else {
    robot.healthBar.material.color.set(0xff0000); // Red
  }
}

export function updateHealthBarBillboarding(robot, camera) {
  if (!robot || !robot.healthBarGroup || !camera) return;

  // Get the camera position
  const cameraPosition = camera.position.clone();

  // Make the health bar look at the camera, but only on the horizontal plane
  // This preserves the upward orientation while making it face the camera horizontally
  const robotPosition = robot.position.clone();
  const direction = new THREE.Vector3().subVectors(
    cameraPosition,
    robotPosition
  );

  // We only want to rotate around the Y axis (keep it parallel to ground)
  // so we zero out the y component of the direction vector
  direction.y = 0;
  direction.normalize();

  // Set the health bar group rotation
  // We want it to face up but also face the camera from all horizontal angles
  robot.healthBarGroup.lookAt(
    robotPosition.x + direction.x,
    robotPosition.y + direction, // Look upward
    robotPosition.z + direction.z
  );
}

export function damageRobot(robot, damage, scene) {
  if (!robot || !robot.isRobot) return false;

  robot.health -= damage;
  updateRobotHealthBar(robot);

  // Play the hit animation (add scene parameter)
  playRobotHitAnimation(robot, scene);

  if (robot.health <= 0) {
    destroyRobot(robot, scene);
    return true;
  }
  robot.wasRecentlyDamaged = true;
  return false;
}

// New function for hit animation effect
export function playRobotHitAnimation(robot, scene) {
  if (!robot) return;

  // Store original materials for all meshes
  const originalMaterials = [];

  // Flash color - bright red
  const flashColor = new THREE.Color(1, 0, 0);

  // Find all meshes in the robot and store their original materials
  robot.traverse((child) => {
    if (child.isMesh && child.material) {
      // Store reference to the original material
      originalMaterials.push({
        mesh: child,
        material: child.material,
        originalColor: child.material.color
          ? child.material.color.clone()
          : null,
        originalEmissive: child.material.emissive
          ? child.material.emissive.clone()
          : null,
      });

      // Apply flash effect
      if (child.material.color) {
        child.material.color.set(flashColor);
      }
      if (child.material.emissive) {
        child.material.emissive.set(flashColor);
        child.material.emissiveIntensity = 1.0;
      }
    }
  });

  // Add a hit displacement
  const originalPosition = robot.position.clone();
  const hitDirection = new THREE.Vector3(
    (Math.random() - 0.5) * 0.2,
    0.1,
    (Math.random() - 0.5) * 0.2
  );

  robot.position.add(hitDirection);

  // Create hit particles (only if scene is available)
  if (scene) {
    createHitParticles(robot.position.clone(), scene);
  }

  // Reset materials and position after a short delay
  setTimeout(() => {
    // Reset all materials
    originalMaterials.forEach((item) => {
      if (
        item.originalColor &&
        item.mesh.material &&
        item.mesh.material.color
      ) {
        item.mesh.material.color.copy(item.originalColor);
      }
      if (
        item.originalEmissive &&
        item.mesh.material &&
        item.mesh.material.emissive
      ) {
        item.mesh.material.emissive.copy(item.originalEmissive);
        item.mesh.material.emissiveIntensity = 0.5; // Reset to default
      }
    });

    // Reset position immediately to fix the floating issue
    robot.position.copy(originalPosition);
  }, 100);
}

// Create particles for hit effect
function createHitParticles(position, scene) {
  // If scene is not available, skip particle creation
  if (!scene) return;

  const particleCount = 8;
  const particleGroup = new THREE.Group();

  for (let i = 0; i < particleCount; i++) {
    const size = 0.05 + Math.random() * 0.1;
    const geometry = new THREE.SphereGeometry(size, 4, 4);
    const material = new THREE.MeshBasicMaterial({
      color: 0xff3333,
      transparent: true,
      opacity: 0.8,
    });

    const particle = new THREE.Mesh(geometry, material);

    // Random direction
    const angle = Math.random() * Math.PI * 2;
    const elevation = Math.random() * Math.PI;
    const speed = 0.03 + Math.random() * 0.07;

    particle.userData.velocity = new THREE.Vector3(
      speed * Math.cos(angle) * Math.sin(elevation),
      speed * Math.cos(elevation),
      speed * Math.sin(angle) * Math.sin(elevation)
    );

    particle.position.copy(position);
    particle.position.y += 0.5; // Start slightly above center

    particleGroup.add(particle);
  }

  scene.add(particleGroup);

  // Animate particles
  let lifetime = 0;
  const maxLifetime = 20;

  function animateParticles() {
    lifetime++;

    particleGroup.children.forEach((particle) => {
      particle.position.add(particle.userData.velocity);
      particle.material.opacity = 1 - lifetime / maxLifetime;
    });

    if (lifetime < maxLifetime) {
      requestAnimationFrame(animateParticles);
    } else {
      scene.remove(particleGroup);
    }
  }

  animateParticles();
}

// Destroy a robot and create scrap
export function destroyRobot(robot, scene) {
  if (!robot || !robot.isRobot) return;

  // Remove from tracking array
  robotsArray = robotsArray.filter((r) => r !== robot);

  // Only create scrap and drop cores in dungeon mode (not for enemies in defense mode)
  if (!robot.isEnemy) {
    // Create scrap at robot's position
    createScrapPile(
      robot.position.x,
      robot.position.z,
      robot.scrapValue,
      robot.scrapType,
      scene
    );

    const coreDropChance = robot.coreDropChance;

    if (Math.random() < coreDropChance) {
      const core = {
        type: robot.type,
        value: robot.coreValue,
        power: randomInt(1, 3), // Random power level
      };

      // Add to global array (for compatibility)
      if (!window.capturedCores) {
        window.capturedCores = [];
      }
      window.capturedCores.push(core);

      // Create a visual core item at robot's position
      createCoreItem(robot.position.x, robot.position.z, core, scene);

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

      console.log(`Robot destroyed and dropped a ${core.value} core!`);
    }
  }

  // Create destruction effect (keep this for both modes)
  createDestructionEffect(robot.position.clone(), scene);

  // Remove robot from scene
  scene.remove(robot);
}

// Add a new function to create a core visual item
export function createCoreItem(x, z, core, scene) {
  // Core visuals
  const coreGroup = new THREE.Group();
  coreGroup.isCore = true;

  // Determine color based on core value
  let coreColor;
  switch (core.value) {
    case "speed":
      coreColor = 0xff0000; // Red for speed
      break;
    case "power":
      coreColor = 0x0000ff; // Blue for power
      break;
    case "range":
      coreColor = 0xffff00; // Yellow for range
      break;
    case "healing":
      coreColor = 0x00ffff; // Cyan for healing
      break;
    default:
      coreColor = 0xff00ff; // Pink (default)
  }

  // Create core geometry
  const coreGeometry = new THREE.SphereGeometry(0.3, 8, 8);
  const coreMaterial = new THREE.MeshLambertMaterial({
    color: coreColor,
    emissive: coreColor,
    emissiveIntensity: 0.5,
  });

  const coreMesh = new THREE.Mesh(coreGeometry, coreMaterial);
  coreMesh.position.y = 0.3;
  coreGroup.add(coreMesh);

  // Add glow effect
  const glowGeometry = new THREE.SphereGeometry(0.5, 8, 8);
  const glowMaterial = new THREE.MeshBasicMaterial({
    color: coreColor,
    transparent: true,
    opacity: 0.3,
  });

  const glow = new THREE.Mesh(glowGeometry, glowMaterial);
  coreGroup.add(glow);

  // Make it hover and rotate
  coreGroup.userData.originalY = 0.3;
  coreGroup.userData.hoverSpeed = 0.01;
  coreGroup.userData.hoverDir = 1;
  coreGroup.userData.rotateSpeed = 0.02;

  coreGroup.userData.update = function (delta) {
    // Hover effect
    coreMesh.position.y +=
      coreGroup.userData.hoverSpeed * coreGroup.userData.hoverDir;
    if (coreMesh.position.y > coreGroup.userData.originalY + 0.2) {
      coreGroup.userData.hoverDir = -1;
    }
    if (coreMesh.position.y < coreGroup.userData.originalY - 0.2) {
      coreGroup.userData.hoverDir = 1;
    }

    // Rotate effect
    coreMesh.rotation.y += coreGroup.userData.rotateSpeed;
    glow.rotation.y -= coreGroup.userData.rotateSpeed / 2;
  };

  // Position in the scene
  coreGroup.position.set(x, 0, z);

  // Add to scene
  scene.add(coreGroup);

  // Animate the core
  function animateCore() {
    coreGroup.userData.update(1 / 60);
    if (coreGroup.parent) {
      requestAnimationFrame(animateCore);
    }
  }

  animateCore();

  coreItems.push(coreGroup);
  return coreGroup;
}

// Create scrap pile at location
export function createScrapPile(x, y, value, type, scene) {
  // Create a random pile of scrap pieces
  const numPieces = Math.floor(value * 2);
  const scrapGroup = new THREE.Group();
  scrapGroup.isScrap = true;
  scrapGroup.scrapValue = value;
  scrapGroup.scrapType = type;

  // Determine color based on scrap type
  let scrapColor;
  switch (type) {
    case "electronic":
      scrapColor = 0x00ff00; // Green
      break;
    case "metal":
      scrapColor = 0x888888; // Gray
      break;
    case "energy":
      scrapColor = 0x00ffff; // Cyan
      break;
    default:
      scrapColor = 0xffaa00; // Orange (default)
  }

  // Create random scrap pieces
  for (let i = 0; i < numPieces; i++) {
    // Random size and shape for scrap
    const scrapSize = 0.2 + Math.random() * 0.3;

    // Choose a random geometry for variety
    let scrapGeometry;
    const shapeType = Math.floor(Math.random() * 3);
    switch (shapeType) {
      case 0:
        scrapGeometry = new THREE.BoxGeometry(
          scrapSize,
          scrapSize * 0.5,
          scrapSize
        );
        break;
      case 1:
        scrapGeometry = new THREE.CylinderGeometry(
          scrapSize * 0.3,
          scrapSize * 0.3,
          scrapSize,
          5
        );
        break;
      case 2:
        scrapGeometry = new THREE.TetrahedronGeometry(scrapSize * 0.5);
        break;
    }

    const scrapMaterial = new THREE.MeshLambertMaterial({ color: scrapColor });
    const scrapPiece = new THREE.Mesh(scrapGeometry, scrapMaterial);

    // Position randomly within a small radius
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * 0.5;
    scrapPiece.position.set(
      radius * Math.cos(angle),
      scrapSize * 0.5 + Math.random() * 0.1,
      radius * Math.sin(angle)
    );

    // Random rotation
    scrapPiece.rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI
    );

    scrapPiece.castShadow = true;
    scrapPiece.receiveShadow = true;

    scrapGroup.add(scrapPiece);
  }

  // Position the entire scrap pile
  scrapGroup.position.set(x, 0, y);

  // Make it glow slightly
  const glowGeometry = new THREE.SphereGeometry(0.5, 8, 8);
  const glowMaterial = new THREE.MeshBasicMaterial({
    color: scrapColor,
    transparent: true,
    opacity: 0.2,
  });
  const glow = new THREE.Mesh(glowGeometry, glowMaterial);
  glow.position.y = 0.5;
  scrapGroup.add(glow);

  // Add to scene and tracking array
  scene.add(scrapGroup);
  scrapPiles.push(scrapGroup);

  return scrapGroup;
}

// Create explosion effect when robot is destroyed
export function createDestructionEffect(position, scene) {
  // Create particle group
  const particleCount = 30;
  const particleGroup = new THREE.Group();

  // Create explosion particles
  for (let i = 0; i < particleCount; i++) {
    const size = 0.1 + Math.random() * 0.2;
    const geometry = new THREE.BoxGeometry(size, size, size);

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
    particle.position.y += 0.5; // Start slightly above ground

    particleGroup.add(particle);
  }

  scene.add(particleGroup);

  // Animate the explosion
  let lifetime = 0;
  const maxLifetime = 50;

  function animateExplosion() {
    lifetime++;

    // Update each particle
    particleGroup.children.forEach((particle) => {
      // Move particle
      particle.position.add(particle.userData.velocity);

      // Apply gravity
      particle.userData.velocity.y -= 0.002;

      // Rotate particle
      particle.rotation.x += 0.1;
      particle.rotation.y += 0.1;

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

// Check for nearby scrap and collect it if player is close
export function checkScrapCollection(playerPosition, scene, collectRadius = 2) {
  const collectedScrap = [];

  // Check each scrap pile
  for (let i = scrapPiles.length - 1; i >= 0; i--) {
    const scrap = scrapPiles[i];
    const distance = playerPosition.distanceTo(scrap.position);

    if (distance < collectRadius) {
      // Collect the scrap
      collectedScrap.push({
        value: scrap.scrapValue,
        type: scrap.scrapType,
      });

      // Create collection effect
      createCollectionEffect(scrap.position.clone(), scene);

      // Remove from scene and array
      scene.remove(scrap);
      scrapPiles.splice(i, 1);
    }
  }

  return collectedScrap;
}

export function checkCoreCollection(playerPosition, scene, collectRadius = 2) {
  const collectedCores = [];

  // Check each core item
  for (let i = coreItems.length - 1; i >= 0; i--) {
    const core = coreItems[i];
    const distance = playerPosition.distanceTo(core.position);

    if (distance < collectRadius) {
      // Core was collected
      // No need to push to window.capturedCores - that's already been done when the core was created

      // Create collection effect
      createCollectionEffect(core.position.clone(), scene);

      // Remove from scene and array
      scene.remove(core);
      coreItems.splice(i, 1);

      console.log("Core collected!");
    }
  }

  return collectedCores;
}

// Create an effect when scrap is collected
export function createCollectionEffect(position, scene) {
  const geometry = new THREE.SphereGeometry(0.5, 8, 8);
  const material = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.7,
  });

  const effect = new THREE.Mesh(geometry, material);
  effect.position.copy(position);
  effect.position.y += 0.5;
  scene.add(effect);

  // Animate the collection effect
  let scale = 1;
  function animateCollection() {
    scale += 0.2;
    effect.scale.set(scale, scale, scale);
    effect.material.opacity -= 0.1;

    if (effect.material.opacity > 0) {
      requestAnimationFrame(animateCollection);
    } else {
      scene.remove(effect);
    }
  }

  animateCollection();
}

// Get all active robots
export function getAllRobots() {
  return robotsArray;
}

// Clear all robots
export function clearAllRobots(scene) {
  robotsArray.forEach((robot) => {
    scene.remove(robot);
  });
  robotsArray = [];
  coreItems.forEach((core) => {
    scene.remove(core);
  });
  coreItems = [];
}

// Helper function for random integers
export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

export function clearRobot(robot) {
  if (!robot || !robot.isRobot) return;

  // Remove from tracking array
  robotsArray = robotsArray.filter((r) => r !== robot);
}

// Export as a module
export default {
  spawnRobot,
  updateRobotHealthBar,
  updateHealthBarBillboarding,
  damageRobot,
  destroyRobot,
  createScrapPile,
  checkScrapCollection,
  checkCoreCollection,
  getAllRobots,
  clearAllRobots,
  clearRobot,
  randomInt,
};
