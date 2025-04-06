// projectileSystem.js - Enhanced with robust collision detection

import * as THREE from "three";
import audioManager from "./audioManager";
import robotSpawner from "./robots";

// Track all active projectiles
let projectiles = [];

// Projectile configuration by robot type
const PROJECTILE_CONFIG = {
  scout: {
    color: 0xff0000,
    speed: 15,
    size: 0.15,
    fireRate: 1.2, // Shots per second
    damage: 5,
    lifetime: 2, // Seconds before disappearing
    particleCount: 5,
  },
  tank: {
    color: 0x0000ff,
    speed: 8,
    size: 0.25,
    fireRate: 0.5, // Slower firing rate
    damage: 12,
    lifetime: 3,
    particleCount: 8,
  },
  sniper: {
    color: 0xffff00,
    speed: 25,
    size: 0.12,
    fireRate: 0.3, // Very slow firing rate
    damage: 20,
    lifetime: 4, // Longer range
    particleCount: 3,
  },
  healer: {
    color: 0x00ffff,
    speed: 10,
    size: 0.18,
    fireRate: 0.8,
    damage: 3,
    lifetime: 2,
    particleCount: 6,
  },
  player: {
    color: 0x00ff00, // Green energy projectiles
    speed: 30, // Faster than robot projectiles
    size: 0.15,
    fireRate: 2, // Shots per second
    damage: 15,
    lifetime: 3, // Seconds before disappearing
    particleCount: 6,
  },
};

export function createPlayerProjectile(playerPosition, cameraDirection, scene) {
  // Get player projectile config
  const config = PROJECTILE_CONFIG.player;

  // Create projectile group
  const projectileGroup = new THREE.Group();
  projectileGroup.isProjectile = true;
  projectileGroup.isPlayerProjectile = true; // Flag to identify player projectiles

  // Create projectile visual
  const geometry = new THREE.SphereGeometry(config.size, 8, 8);
  const material = new THREE.MeshStandardMaterial({
    color: config.color,
    emissive: config.color,
    emissiveIntensity: 1.0,
  });

  const projectileMesh = new THREE.Mesh(geometry, material);
  projectileGroup.add(projectileMesh);

  // Add glow effect
  const glowGeometry = new THREE.SphereGeometry(config.size * 1.5, 8, 8);
  const glowMaterial = new THREE.MeshBasicMaterial({
    color: config.color,
    transparent: true,
    opacity: 0.4,
  });

  const glow = new THREE.Mesh(glowGeometry, glowMaterial);
  projectileGroup.add(glow);

  // Set starting position (slightly in front of player weapon)
  const startPos = playerPosition.clone();
  startPos.add(cameraDirection.clone().multiplyScalar(1)); // Start 1 unit in front of camera

  projectileGroup.position.copy(startPos);

  // Store properties in the projectile
  projectileGroup.velocity = cameraDirection
    .clone()
    .multiplyScalar(config.speed);
  projectileGroup.damage = config.damage;
  projectileGroup.lifetime = config.lifetime;
  projectileGroup.elapsedTime = 0;
  projectileGroup.config = config;
  projectileGroup.sourcePlayer = true; // Keep reference to source
  projectileGroup.lastPosition = startPos.clone(); // Store last position for continuous collision detection

  // Add to scene and tracking array
  scene.add(projectileGroup);
  projectiles.push(projectileGroup);

  return projectileGroup;
}

// Create a projectile fired from a robot
export function createProjectile(robot, targetPosition, scene) {
  // Get projectile config based on robot type
  const robotTypeId = robot.typeId || "scout";
  const config = PROJECTILE_CONFIG[robotTypeId] || PROJECTILE_CONFIG.scout;

  // Create projectile group
  const projectileGroup = new THREE.Group();
  projectileGroup.isProjectile = true;

  // Create projectile visual
  const geometry = new THREE.SphereGeometry(config.size, 8, 8);
  const material = new THREE.MeshStandardMaterial({
    color: config.color,
    emissive: config.color,
    emissiveIntensity: 1.0,
  });

  const projectileMesh = new THREE.Mesh(geometry, material);
  projectileGroup.add(projectileMesh);

  // Add glow effect
  const glowGeometry = new THREE.SphereGeometry(config.size * 1.5, 8, 8);
  const glowMaterial = new THREE.MeshStandardMaterial({
    color: config.color,
    transparent: true,
    opacity: 0.4,
  });

  const glow = new THREE.Mesh(glowGeometry, glowMaterial);
  projectileGroup.add(glow);

  // Set starting position (slightly in front of robot)
  const direction = new THREE.Vector3();
  direction.subVectors(targetPosition, robot.position).normalize();

  const startPos = robot.position.clone();
  startPos.y += robot.height / 2 || 0.5; // Adjusts to robot height
  startPos.add(direction.clone().multiplyScalar(robot.size || 0.5));

  projectileGroup.position.copy(startPos);

  // Store properties in the projectile
  projectileGroup.velocity = direction.multiplyScalar(config.speed);
  projectileGroup.damage = config.damage;
  projectileGroup.lifetime = config.lifetime;
  projectileGroup.elapsedTime = 0;
  projectileGroup.config = config;
  projectileGroup.sourceRobot = robot; // Keep reference to source robot
  projectileGroup.lastPosition = startPos.clone(); // Store last position for continuous collision detection

  // Add to scene and tracking array
  scene.add(projectileGroup);
  projectiles.push(projectileGroup);

  // Play shooting sound
  audioManager.playRobotSound("shoot");

  return projectileGroup;
}

// ENHANCED: Performs continuous collision detection for a projectile
function checkProjectileCollision(projectile, scene) {
  // We'll use the projectile's last position and current position to create a continuous ray
  const startPoint = projectile.lastPosition.clone();
  const endPoint = projectile.position.clone();

  // Direction of movement for this frame
  const moveDirection = new THREE.Vector3()
    .subVectors(endPoint, startPoint)
    .normalize();

  // Distance traveled in this frame
  const moveDistance = startPoint.distanceTo(endPoint);

  // Create raycaster from last position to current position
  const raycaster = new THREE.Raycaster();
  raycaster.set(startPoint, moveDirection);
  raycaster.far = moveDistance + projectile.config.size; // Set maximum distance to check

  // Create an array of raycasters for better coverage
  const raycasters = [raycaster];

  // Add additional rays in a small cone shape around the main ray
  // This helps catch collisions even when the main ray might miss a thin surface
  const numExtraRays = 4; // Number of additional rays
  const spreadAngle = 0.2; // Spread angle in radians (about 11 degrees)

  for (let i = 0; i < numExtraRays; i++) {
    // Create a slightly offset direction
    const angle = (i / numExtraRays) * Math.PI * 2;
    const offsetX = Math.cos(angle) * spreadAngle;
    const offsetY = Math.sin(angle) * spreadAngle;

    // Create a new direction vector with the offset
    const offsetDir = new THREE.Vector3(
      moveDirection.x + offsetX,
      moveDirection.y + offsetY,
      moveDirection.z
    ).normalize();

    // Create and add the additional raycaster
    const extraRaycaster = new THREE.Raycaster();
    extraRaycaster.set(startPoint, offsetDir);
    extraRaycaster.far = moveDistance + projectile.config.size;
    raycasters.push(extraRaycaster);
  }

  // Check collisions with all raycasters
  for (const currentRaycaster of raycasters) {
    const intersections = currentRaycaster.intersectObjects(
      scene.children,
      true
    );

    for (const intersection of intersections) {
      const object = intersection.object;

      // Get the object or its parent that may contain userData
      const targetObject = object.userData?.isSolid
        ? object
        : object.parent?.userData?.isSolid
        ? object.parent
        : null;

      // If we found a solid object and the distance is within range
      if (targetObject) {
        // Determine surface type for appropriate impact effect
        let surfaceType = "wall"; // default

        if (targetObject.userData.isFloor) {
          surfaceType = "floor";
        } else if (targetObject.userData.isCeiling) {
          surfaceType = "ceiling";
        } else if (targetObject.userData.isDoor) {
          surfaceType = "door";
        }

        // Return collision info
        return {
          hasCollision: true,
          point: intersection.point,
          surfaceType: surfaceType,
        };
      }
    }
  }

  // No collision detected
  return { hasCollision: false };
}

// Enhanced update function with more robust collision detection
export function updateProjectiles(delta, scene, playerPosition, playerRadius) {
  let hitProjectile = false;

  for (let i = projectiles.length - 1; i >= 0; i--) {
    const projectile = projectiles[i];

    // Update lifetime
    projectile.elapsedTime += delta;

    // Remove if lifetime exceeded
    if (projectile.elapsedTime >= projectile.lifetime) {
      scene.remove(projectile);
      projectiles.splice(i, 1);
      continue;
    }

    // Store current position before moving (for continuous collision detection)
    projectile.lastPosition = projectile.position.clone();

    // Move projectile
    projectile.position.add(projectile.velocity.clone().multiplyScalar(delta));

    // Rotate projectile for visual effect
    projectile.rotation.z += 5 * delta;

    // Check collision with player (for enemy projectiles only)
    if (!projectile.isPlayerProjectile) {
      const distanceToPlayer = projectile.position.distanceTo(playerPosition);
      if (distanceToPlayer < playerRadius + projectile.config.size) {
        // Hit player
        hitProjectile = {
          damage: projectile.damage,
          position: projectile.position.clone(),
        };

        // Create impact effect
        createImpactEffect(
          projectile.position.clone(),
          projectile.config,
          scene,
          "player"
        );

        // Remove projectile
        scene.remove(projectile);
        projectiles.splice(i, 1);
        continue;
      }
    }

    // Check collision with robots (only for player projectiles)
    if (projectile.isPlayerProjectile) {
      const robots = robotSpawner.getAllRobots();
      let hitRobot = false;

      for (let j = 0; j < robots.length; j++) {
        const robot = robots[j];
        if (!robot.isRobot) continue;

        const distanceToRobot = projectile.position.distanceTo(robot.position);
        const hitRadius = robot.size || 0.5; // Use robot size or default

        if (distanceToRobot < hitRadius + projectile.config.size) {
          // Hit robot
          const damage = projectile.damage;
          const destroyed = robotSpawner.damageRobot(robot, damage, scene);

          // Play hit sound
          audioManager.playRobotSound("hit");

          // Create impact effect
          createImpactEffect(
            projectile.position.clone(),
            projectile.config,
            scene,
            "robot"
          );

          // Remove projectile
          scene.remove(projectile);
          projectiles.splice(i, 1);
          hitRobot = true;
          break; // Only hit one robot per projectile
        }
      }

      if (hitRobot) continue;
    }

    // Check collision with environment using enhanced detection
    const collision = checkProjectileCollision(projectile, scene);

    if (collision.hasCollision) {
      // Create impact effect with the correct surface type and location
      createImpactEffect(
        collision.point,
        projectile.config,
        scene,
        collision.surfaceType
      );

      // Remove projectile
      scene.remove(projectile);
      projectiles.splice(i, 1);
    }
  }

  return hitProjectile;
}

// Create impact effect when projectile hits something
function createImpactEffect(position, config, scene, surfaceType = "wall") {
  // Create particle group
  const particleCount = config.particleCount;
  const particleGroup = new THREE.Group();

  // Determine directional bias based on surface type
  let directionBias = new THREE.Vector3(0, 0, 0);

  switch (surfaceType) {
    case "floor":
      // For floor collisions, particles should mostly go upward
      directionBias.set(0, 1, 0);
      break;
    case "ceiling":
      // For ceiling collisions, particles should mostly go downward
      directionBias.set(0, -1, 0);
      break;
    case "robot":
    case "player":
      // For robot/player hits, particles should explode outward
      directionBias.set(0, 0.5, 0);
      break;
    // default wall case has no bias
  }

  // Create impact particles
  for (let i = 0; i < particleCount; i++) {
    const size = 0.05 + Math.random() * 0.1;
    const geometry = new THREE.SphereGeometry(size, 4, 4);

    const material = new THREE.MeshBasicMaterial({
      color: config.color,
      transparent: true,
    });

    const particle = new THREE.Mesh(geometry, material);

    // Set random direction with appropriate bias for the surface
    const speed = 1 + Math.random() * 2;
    const angle = Math.random() * Math.PI * 2;
    const elevation = Math.random() * Math.PI - Math.PI / 2;

    // Create base velocity vector
    const velocity = new THREE.Vector3(
      speed * Math.cos(angle) * Math.cos(elevation),
      speed * Math.sin(elevation),
      speed * Math.sin(angle) * Math.cos(elevation)
    );

    // Add directional bias based on surface type
    if (surfaceType === "floor" || surfaceType === "ceiling") {
      // Make particles spread primarily along the plane of the floor/ceiling
      velocity.add(directionBias.clone().multiplyScalar(speed * 0.7));

      // For floor/ceiling impacts, make particles more disk-shaped than spherical
      velocity.y *= surfaceType === "floor" ? 2.0 : 2.0; // Emphasize vertical component
    } else if (surfaceType === "robot" || surfaceType === "player") {
      // For robot/player hits, add some upward bias
      velocity.add(directionBias.clone().multiplyScalar(speed * 0.5));
    }

    particle.userData.velocity = velocity;

    // Set initial position
    particle.position.copy(position);

    particleGroup.add(particle);
  }

  scene.add(particleGroup);

  // Add a glow flash effect appropriate for the surface
  const flashGeometry = new THREE.SphereGeometry(config.size * 3, 8, 8);
  const flashMaterial = new THREE.MeshStandardMaterial({
    color: config.color,
    transparent: true,
    opacity: 0.5,
  });

  const flash = new THREE.Mesh(flashGeometry, flashMaterial);
  flash.position.copy(position);

  // Flatten the flash effect for floor/ceiling impacts
  if (surfaceType === "floor" || surfaceType === "ceiling") {
    flash.scale.y = 0.2;
  }

  scene.add(flash);

  // Animate the impact
  let lifetime = 0;
  const maxLifetime = 20;

  function animateImpact() {
    lifetime++;

    // Update each particle
    particleGroup.children.forEach((particle) => {
      // Move particle
      particle.position.add(
        particle.userData.velocity.clone().multiplyScalar(0.05)
      );

      // Apply friction
      particle.userData.velocity.multiplyScalar(0.9);

      // Apply gravity effect for particles (more pronounced for floor/ceiling impacts)
      if (
        surfaceType === "floor" ||
        surfaceType === "ceiling" ||
        surfaceType === "robot" ||
        surfaceType === "player"
      ) {
        particle.userData.velocity.y -= 0.02; // Gravity pulling particles down
      }

      // Fade out
      particle.material.opacity = 1 - lifetime / maxLifetime;
    });

    // Fade and expand flash
    flash.material.opacity = 0.5 * (1 - lifetime / maxLifetime);

    // For floor/ceiling impacts, make the flash expand more along the surface
    if (surfaceType === "floor" || surfaceType === "ceiling") {
      flash.scale.x += 0.15;
      flash.scale.z += 0.15;
      flash.scale.y += 0.01; // Minimal vertical expansion
    } else {
      flash.scale.addScalar(0.1); // Uniform expansion for walls and robots
    }

    if (lifetime < maxLifetime) {
      requestAnimationFrame(animateImpact);
    } else {
      scene.remove(particleGroup);
      scene.remove(flash);
    }
  }

  // Play impact sound appropriate to the surface
  if (surfaceType === "robot") {
    audioManager.playRobotSound("hit");
  } else if (surfaceType === "player") {
    audioManager.playPlayerSound("hit");
  } else {
    // Different impact sounds based on surface material
    const impactSound =
      surfaceType === "floor"
        ? "hit"
        : surfaceType === "ceiling"
        ? "hit"
        : "hit";
    audioManager.playRobotSound(impactSound);
  }

  animateImpact();
}

// Clear all projectiles
export function clearAllProjectiles(scene) {
  projectiles.forEach((projectile) => {
    scene.remove(projectile);
  });
  projectiles = [];
}

// Get all active projectiles
export function getAllProjectiles() {
  return projectiles;
}

export default {
  createProjectile,
  createPlayerProjectile,
  updateProjectiles,
  clearAllProjectiles,
  getAllProjectiles,
  PROJECTILE_CONFIG,
};
