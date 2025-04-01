// projectileSystem.js - New module for handling robot projectiles
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
  const material = new THREE.MeshBasicMaterial({
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

  // Add a small trail
  const trailGeometry = new THREE.CylinderGeometry(
    0,
    config.size * 0.8,
    config.size * 4,
    8
  );
  const trailMaterial = new THREE.MeshBasicMaterial({
    color: config.color,
    transparent: true,
    opacity: 0.3,
  });

  const trail = new THREE.Mesh(trailGeometry, trailMaterial);
  trail.rotation.x = Math.PI / 2;
  trail.position.z = -config.size * 2;
  projectileGroup.add(trail);

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
  const material = new THREE.MeshBasicMaterial({
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

  // Add a small trail
  const trailGeometry = new THREE.CylinderGeometry(
    0,
    config.size * 0.8,
    config.size * 4,
    8
  );
  const trailMaterial = new THREE.MeshBasicMaterial({
    color: config.color,
    transparent: true,
    opacity: 0.3,
  });

  const trail = new THREE.Mesh(trailGeometry, trailMaterial);
  trail.rotation.x = Math.PI / 2;
  trail.position.z = -config.size * 2;
  projectileGroup.add(trail);

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

  // Add to scene and tracking array
  scene.add(projectileGroup);
  projectiles.push(projectileGroup);

  // Play shooting sound
  audioManager.playRobotSound("shoot");

  return projectileGroup;
}

// Update all projectiles
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

    // Move projectile
    projectile.position.add(projectile.velocity.clone().multiplyScalar(delta));

    // Rotate projectile for visual effect
    projectile.rotation.z += 5 * delta;

    // Check collision with player
    const distanceToPlayer = projectile.position.distanceTo(playerPosition);
    if (distanceToPlayer < playerRadius + projectile.config.size) {
      // Hit player
      hitProjectile = {
        damage: projectile.damage,
        position: projectile.position.clone(),
      };

      // Create impact effect
      createImpactEffect(projectile.position.clone(), projectile.config, scene);

      // Remove projectile
      scene.remove(projectile);
      projectiles.splice(i, 1);
    }
    if (projectile.isPlayerProjectile) {
      // Check collision with robots
      const robots = robotSpawner.getAllRobots();
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
            scene
          );

          // Remove projectile
          scene.remove(projectile);
          projectiles.splice(i, 1);

          break; // Only hit one robot per projectile
        }
      }
    }

    // Check collision with walls
    const raycaster = new THREE.Raycaster();
    raycaster.set(
      projectile.position.clone(),
      projectile.velocity.clone().normalize()
    );

    const intersections = raycaster.intersectObjects(scene.children, true);
    for (const intersection of intersections) {
      const object = intersection.object;

      // Check if it's a wall or door
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
        if (intersection.distance < projectile.config.size * 2) {
          // Hit wall, create impact effect
          createImpactEffect(intersection.point, projectile.config, scene);

          // Remove projectile
          scene.remove(projectile);
          projectiles.splice(i, 1);
          break;
        }
      }
    }
  }

  return hitProjectile;
}

// Create impact effect when projectile hits something
function createImpactEffect(position, config, scene) {
  // Create particle group
  const particleCount = config.particleCount;
  const particleGroup = new THREE.Group();

  // Create impact particles
  for (let i = 0; i < particleCount; i++) {
    const size = 0.05 + Math.random() * 0.1;
    const geometry = new THREE.SphereGeometry(size, 4, 4);

    const material = new THREE.MeshBasicMaterial({
      color: config.color,
      transparent: true,
    });

    const particle = new THREE.Mesh(geometry, material);

    // Set random direction
    const speed = 1 + Math.random() * 2;
    const angle = Math.random() * Math.PI * 2;
    const elevation = Math.random() * Math.PI - Math.PI / 2;

    particle.userData.velocity = new THREE.Vector3(
      speed * Math.cos(angle) * Math.cos(elevation),
      speed * Math.sin(elevation),
      speed * Math.sin(angle) * Math.cos(elevation)
    );

    // Set initial position
    particle.position.copy(position);

    particleGroup.add(particle);
  }

  scene.add(particleGroup);

  // Add a glow flash
  const flashGeometry = new THREE.SphereGeometry(config.size * 3, 8, 8);
  const flashMaterial = new THREE.MeshBasicMaterial({
    color: config.color,
    transparent: true,
    opacity: 0.5,
  });

  const flash = new THREE.Mesh(flashGeometry, flashMaterial);
  flash.position.copy(position);
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

      // Fade out
      particle.material.opacity = 1 - lifetime / maxLifetime;
    });

    // Fade and expand flash
    flash.material.opacity = 0.5 * (1 - lifetime / maxLifetime);
    flash.scale.addScalar(0.1);

    if (lifetime < maxLifetime) {
      requestAnimationFrame(animateImpact);
    } else {
      scene.remove(particleGroup);
      scene.remove(flash);
    }
  }

  // Play impact sound
  audioManager.playRobotSound("hit");

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
