// Complete fixed version of robotAI.js with proper scene parameter handling

import * as THREE from "three";
import { ROBOT_STATES, ROBOT_BEHAVIORS } from "./robotConfig";
import audioManager from "./audioManager";

// Handles robot AI state transitions and behaviors
export function updateRobotAI(robot, playerPos, delta, scene) {
  if (!robot || !robot.aiData) return;

  const aiData = robot.aiData;
  aiData.stateTimer += delta;

  // Check for transitions based on conditions
  checkStateTransitions(robot, playerPos, delta, scene);

  // Execute behavior based on current state
  switch (robot.aiState) {
    case ROBOT_STATES.IDLE:
      executeIdleState(robot, delta, scene);
      break;
    case ROBOT_STATES.PATROLLING:
      executePatrolState(robot, delta, scene);
      break;
    case ROBOT_STATES.SEARCHING:
      executeSearchState(robot, playerPos, delta, scene);
      break;
    case ROBOT_STATES.CHASING:
      executeChaseState(robot, playerPos, delta, scene);
      break;
    case ROBOT_STATES.SHOOTING:
      executeShootState(robot, playerPos, delta, scene);
      break;
    case ROBOT_STATES.HIDING:
      executeHideState(robot, playerPos, delta, scene);
      break;
    case ROBOT_STATES.FLEEING:
      executeFleeState(robot, playerPos, delta, scene);
      break;
  }

  // Update robot display based on state
  updateRobotAppearance(robot);
}

// Check for state transitions based on conditions
function checkStateTransitions(robot, playerPos, delta, scene) {
  const aiData = robot.aiData;
  const behavior = aiData.behavior;
  const distanceToPlayer = robot.position.distanceTo(playerPos);

  // Check player visibility - pass scene parameter
  aiData.canSeePlayer = checkPlayerVisibility(robot, playerPos, scene);

  // Store last seen position if player is visible
  if (aiData.canSeePlayer) {
    aiData.lastSeenPlayerPosition.copy(playerPos);
  }

  // Health-based transitions
  const healthPercent = robot.health / robot.maxHealth;

  // FLEE when health is low
  if (
    healthPercent < behavior.fleeHealthThreshold &&
    aiData.canSeePlayer &&
    Math.random() < behavior.stateWeights[ROBOT_STATES.FLEEING]
  ) {
    changeState(robot, ROBOT_STATES.FLEEING);
    return;
  }

  // HIDE when damaged
  if (
    robot.wasRecentlyDamaged &&
    Math.random() <
      behavior.hideChance * behavior.stateWeights[ROBOT_STATES.HIDING]
  ) {
    changeState(robot, ROBOT_STATES.HIDING);
    robot.wasRecentlyDamaged = false;
    return;
  }

  // State-specific transitions
  switch (robot.aiState) {
    case ROBOT_STATES.IDLE:
      // Transition to PATROLLING after some time
      if (aiData.stateTimer > 3) {
        changeState(robot, ROBOT_STATES.PATROLLING);
      }
      // Transition to CHASING if player spotted
      else if (
        aiData.canSeePlayer &&
        distanceToPlayer < behavior.detectionRange
      ) {
        changeState(robot, ROBOT_STATES.CHASING);
      }
      break;

    case ROBOT_STATES.PATROLLING:
      // Transition to CHASING if player spotted
      if (aiData.canSeePlayer && distanceToPlayer < behavior.detectionRange) {
        changeState(robot, ROBOT_STATES.CHASING);
      }
      break;

    case ROBOT_STATES.SEARCHING:
      // Go back to PATROLLING if search time exceeded
      if (aiData.stateTimer > behavior.searchDuration) {
        changeState(robot, ROBOT_STATES.PATROLLING);
      }
      // Transition to CHASING if player spotted
      else if (
        aiData.canSeePlayer &&
        distanceToPlayer < behavior.detectionRange
      ) {
        changeState(robot, ROBOT_STATES.CHASING);
      }
      break;

    case ROBOT_STATES.CHASING:
      // Transition to SHOOTING if in range
      if (aiData.canSeePlayer && distanceToPlayer < behavior.attackRange) {
        changeState(robot, ROBOT_STATES.SHOOTING);
      }
      // Transition to SEARCHING if lost sight
      else if (!aiData.canSeePlayer) {
        changeState(robot, ROBOT_STATES.SEARCHING);
      }
      break;

    case ROBOT_STATES.SHOOTING:
      // Go back to CHASING if player moves out of range
      if (distanceToPlayer > behavior.attackRange) {
        changeState(robot, ROBOT_STATES.CHASING);
      }
      // Go to SEARCHING if lost sight
      else if (!aiData.canSeePlayer) {
        changeState(robot, ROBOT_STATES.SEARCHING);
      }
      break;

    case ROBOT_STATES.HIDING:
      // Return to PATROLLING after hiding for a while if player not seen
      if (aiData.stateTimer > 5 && !aiData.canSeePlayer) {
        changeState(robot, ROBOT_STATES.PATROLLING);
      }
      // SHOOT if can see player from hiding spot
      else if (aiData.canSeePlayer && distanceToPlayer < behavior.attackRange) {
        changeState(robot, ROBOT_STATES.SHOOTING);
      }
      break;

    case ROBOT_STATES.FLEEING:
      // Return to HIDING when safe distance reached
      if (
        distanceToPlayer > behavior.detectionRange * 1.5 ||
        aiData.stateTimer > 4
      ) {
        changeState(robot, ROBOT_STATES.HIDING);
      }
      break;
  }
}

// Change robot state with sound effect
function changeState(robot, newState) {
  if (robot.aiState === newState) return;

  // Play state transition sound
  switch (newState) {
    case ROBOT_STATES.CHASING:
    case ROBOT_STATES.SEARCHING:
      audioManager.playRobotSound("detect");
      break;
    case ROBOT_STATES.FLEEING:
      audioManager.playRobotSound("hit");
      break;
  }

  // Update state and reset timer
  robot.aiState = newState;
  robot.aiData.stateTimer = 0;
  robot.aiData.lastStateChange = performance.now();
}

// Check if robot can see player
function checkPlayerVisibility(robot, playerPos, scene) {
  if (!robot || !playerPos || !scene || !scene.children) {
    console.warn("Invalid parameters in checkPlayerVisibility", {
      robot: !!robot,
      playerPos: !!playerPos,
      scene: !!scene,
      sceneChildren: scene ? !!scene.children : false,
    });
    return false;
  }

  const distanceToPlayer = robot.position.distanceTo(playerPos);
  const behavior = robot.aiData.behavior;

  // Too far to see
  if (distanceToPlayer > behavior.detectionRange) {
    return false;
  }

  try {
    // Cast ray to check if player is visible
    const direction = new THREE.Vector3();
    direction.subVectors(playerPos, robot.position).normalize();

    const raycaster = new THREE.Raycaster();
    raycaster.set(robot.position, direction);
    const intersects = raycaster.intersectObjects(scene.children);

    for (let i = 0; i < intersects.length; i++) {
      const obj = intersects[i].object;

      // If hit player or something beyond player distance
      if (intersects[i].distance >= distanceToPlayer) {
        return true;
      }

      // If hit a wall, player not visible
      if (
        obj.isWall ||
        (obj.parent && obj.parent.isWall) ||
        (obj.userData && obj.userData.isWall) ||
        (obj.parent && obj.parent.userData && obj.parent.userData.isWall)
      ) {
        return false;
      }
    }
  } catch (error) {
    console.error("Error in checkPlayerVisibility:", error);
    return false;
  }

  return false;
}

// IDLE: Robot stands still, occasionally looking around
function executeIdleState(robot, delta, scene) {
  // Occasional random rotation to look around
  if (Math.random() < 0.02) {
    robot.rotation.y += (Math.random() - 0.5) * 0.5;
  }
}

// PATROLLING: Robot moves in a pattern around its spawn area
function executePatrolState(robot, delta, scene) {
  const aiData = robot.aiData;

  // Generate patrol points if needed
  if (aiData.patrolPoints.length === 0) {
    generatePatrolPoints(robot);
  }

  // Get current patrol target
  const currentTarget = aiData.patrolPoints[aiData.currentPatrolIndex || 0];

  // Move towards patrol point
  moveTowardsTarget(robot, currentTarget, delta, scene);

  // Check if reached current patrol point
  const distanceToTarget = robot.position.distanceTo(currentTarget);
  if (distanceToTarget < 0.5) {
    // Move to next patrol point
    aiData.currentPatrolIndex =
      (aiData.currentPatrolIndex + 1) % aiData.patrolPoints.length;
  }
}

// Generate patrol points around current position
function generatePatrolPoints(robot) {
  const aiData = robot.aiData;
  const patrolRadius = 10 + Math.random() * 5;
  const numPoints = 3 + Math.floor(Math.random() * 3);

  for (let i = 0; i < numPoints; i++) {
    const angle = (i / numPoints) * Math.PI * 2;
    const x = robot.position.x + Math.cos(angle) * patrolRadius;
    const z = robot.position.z + Math.sin(angle) * patrolRadius;
    aiData.patrolPoints.push(new THREE.Vector3(x, 0, z));
  }

  aiData.currentPatrolIndex = 0;
}

// SEARCHING: Robot investigates last known player position
function executeSearchState(robot, playerPos, delta, scene) {
  const aiData = robot.aiData;

  // Move towards last seen player position
  moveTowardsTarget(robot, aiData.lastSeenPlayerPosition, delta, scene);

  // Occasionally look around
  if (Math.random() < 0.05) {
    robot.rotation.y += (Math.random() - 0.5) * 1.0;
  }
}

// CHASING: Robot actively pursues the player
function executeChaseState(robot, playerPos, delta, scene) {
  // Move directly towards player
  moveTowardsTarget(robot, playerPos, delta, scene, 1.2); // Move faster when chasing
}

// SHOOTING: Robot stops and fires at player
function executeShootState(robot, playerPos, delta, scene) {
  // Face player
  faceTarget(robot, playerPos);

  // Don't move when shooting
  // Actual shooting is handled in the projectile system
}

// HIDING: Robot moves to cover and hides
function executeHideState(robot, playerPos, delta, scene) {
  const aiData = robot.aiData;

  // Find hiding spot if don't have one
  if (!aiData.hidingPosition) {
    aiData.hidingPosition = findHidingSpot(robot, playerPos, scene);
  }

  // Move towards hiding position
  if (aiData.hidingPosition) {
    moveTowardsTarget(robot, aiData.hidingPosition, delta, scene);
  } else {
    // If no hiding spot found, just move away from player
    executeFleeState(robot, playerPos, delta, scene);
  }
}

// Find a suitable hiding spot
function findHidingSpot(robot, playerPos, scene) {
  // Early safety check
  if (!scene || !scene.children) return null;

  try {
    // Try several random directions to find cover
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 5 + Math.random() * 5;

      const testPos = new THREE.Vector3(
        robot.position.x + Math.cos(angle) * distance,
        robot.position.y,
        robot.position.z + Math.sin(angle) * distance
      );

      // Cast ray from test position to player to check if there's cover
      const direction = new THREE.Vector3();
      direction.subVectors(playerPos, testPos).normalize();

      const raycaster = new THREE.Raycaster();
      raycaster.set(testPos, direction);
      const intersects = raycaster.intersectObjects(scene.children);

      let foundCover = false;

      for (const intersection of intersects) {
        const obj = intersection.object;

        // Check if hit a wall before reaching player
        if (
          obj.isWall ||
          (obj.parent && obj.parent.isWall) ||
          (obj.userData && obj.userData.isWall) ||
          (obj.parent && obj.parent.userData && obj.parent.userData.isWall)
        ) {
          // Distance to player
          const playerDist = testPos.distanceTo(playerPos);

          // If wall is between position and player, it's good cover
          if (intersection.distance < playerDist) {
            foundCover = true;
            return testPos;
          }
        }
      }
    }
  } catch (error) {
    console.error("Error in findHidingSpot:", error);
  }

  // If no good hiding spot found, return null
  return null;
}

// FLEEING: Robot runs away from player
function executeFleeState(robot, playerPos, delta, scene) {
  // Calculate direction away from player
  const direction = new THREE.Vector3();
  direction.subVectors(robot.position, playerPos).normalize();

  // Set target position in that direction
  const targetPos = new THREE.Vector3();
  targetPos.copy(robot.position);
  targetPos.add(direction.multiplyScalar(10)); // Run 10 units away

  // Move towards that position
  moveTowardsTarget(robot, targetPos, delta, scene, 1.5); // Move faster when fleeing
}

// Move robot towards a target position with collision avoidance
function moveTowardsTarget(
  robot,
  targetPos,
  delta,
  scene,
  speedMultiplier = 1.0
) {
  if (!robot || !targetPos || !scene) return;

  // Calculate direction to target
  const direction = new THREE.Vector3();
  direction.subVectors(targetPos, robot.position).normalize();

  // Face the target
  faceTarget(robot, targetPos);

  // Calculate new position with speed adjustment
  const speed = robot.speed * speedMultiplier;
  const newPosition = new THREE.Vector3(
    robot.position.x + direction.x * speed * delta * 30,
    robot.position.y,
    robot.position.z + direction.z * speed * delta * 30
  );

  // Check for wall collision before applying movement
  if (!checkRobotWallCollision(robot, newPosition, scene)) {
    // No collision, apply movement
    robot.position.copy(newPosition);
  } else {
    // Try to slide along walls by breaking movement into x and z components
    const xMovement = new THREE.Vector3(
      robot.position.x + direction.x * speed * delta * 30,
      robot.position.y,
      robot.position.z
    );

    if (!checkRobotWallCollision(robot, xMovement, scene)) {
      robot.position.x = xMovement.x;
    }

    const zMovement = new THREE.Vector3(
      robot.position.x,
      robot.position.y,
      robot.position.z + direction.z * speed * delta * 30
    );

    if (!checkRobotWallCollision(robot, zMovement, scene)) {
      robot.position.z = zMovement.z;
    }
  }
}

// Make robot face towards a target
function faceTarget(robot, targetPos) {
  if (!robot || !targetPos) return;

  const robotToTarget = new THREE.Vector3(
    targetPos.x - robot.position.x,
    0,
    targetPos.z - robot.position.z
  ).normalize();

  // Create a rotation that makes the robot face the target
  robot.rotation.y = Math.atan2(-robotToTarget.x, -robotToTarget.z);
}

// Update robot's visual appearance based on state
function updateRobotAppearance(robot) {
  if (!robot) return;

  // Try to find the robot's eyes
  let leftEye, rightEye;

  // First try to get eyes by name
  leftEye = robot.getObjectByName("leftEye");
  rightEye = robot.getObjectByName("rightEye");

  // If that didn't work, try to find them by traversing the robot's children
  if (!leftEye || !rightEye) {
    robot.traverse((child) => {
      if (child.isMesh) {
        // Check if this could be an eye based on size and position
        if (child.geometry && child.geometry.type === "SphereGeometry") {
          if (child.position.x < 0) {
            leftEye = child;
          } else if (child.position.x > 0) {
            rightEye = child;
          }
        }
      }
    });
  }

  if (leftEye && rightEye) {
    let eyeColor = 0x00ffff; // Default cyan

    switch (robot.aiState) {
      case ROBOT_STATES.CHASING:
      case ROBOT_STATES.SHOOTING:
        eyeColor = 0xff0000; // Red for aggressive
        break;
      case ROBOT_STATES.FLEEING:
      case ROBOT_STATES.HIDING:
        eyeColor = 0xffff00; // Yellow for cautious
        break;
      case ROBOT_STATES.SEARCHING:
        eyeColor = 0xff00ff; // Purple for searching
        break;
    }

    // Update eye materials
    if (leftEye.material) {
      leftEye.material.color.set(eyeColor);
      if (leftEye.material.emissive) {
        leftEye.material.emissive.set(eyeColor);
      }
    }

    if (rightEye.material) {
      rightEye.material.color.set(eyeColor);
      if (rightEye.material.emissive) {
        rightEye.material.emissive.set(eyeColor);
      }
    }
  }
}

// Wall collision check with safety for scene parameter
function checkRobotWallCollision(robot, newPosition, scene) {
  // Add safety check for scene
  if (!scene || !scene.children) {
    console.warn("Invalid scene in checkRobotWallCollision");
    return false; // Consider no collision if scene is invalid
  }

  try {
    const raycaster = new THREE.Raycaster();
    const robotHeight = robot.height || 1;
    const robotRadius = robot.size || 0.5;

    // Direction vector from current to new position
    const direction = new THREE.Vector3()
      .subVectors(newPosition, robot.position)
      .normalize();

    // Check at different heights
    const heightOffsets = [0.1, robotHeight / 2, robotHeight - 0.1];

    // Cast rays in multiple directions around the robot
    const rayAngles = [
      0,
      Math.PI / 4,
      Math.PI / 2,
      (3 * Math.PI) / 4,
      Math.PI,
      (5 * Math.PI) / 4,
      (3 * Math.PI) / 2,
      (7 * Math.PI) / 4,
    ];

    for (const heightOffset of heightOffsets) {
      for (const angle of rayAngles) {
        // Calculate ray direction with the given angle
        const rayDir = new THREE.Vector3(
          Math.cos(angle) * direction.x - Math.sin(angle) * direction.z,
          0,
          Math.sin(angle) * direction.x + Math.cos(angle) * direction.z
        ).normalize();

        // Set ray origin
        const rayOrigin = new THREE.Vector3(
          robot.position.x,
          robot.position.y + heightOffset,
          robot.position.z
        );

        raycaster.set(rayOrigin, rayDir);
        const intersections = raycaster.intersectObjects(scene.children, true);

        // Check wall collisions
        for (const intersection of intersections) {
          const object = intersection.object;

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
            if (intersection.distance < robotRadius * 1.2) {
              return true; // Collision detected
            }
          }
        }
      }
    }

    return false; // No collision
  } catch (error) {
    console.error("Error in checkRobotWallCollision:", error);
    return false; // Consider no collision if error occurs
  }
}

export default {
  updateRobotAI,
  ROBOT_STATES,
};
