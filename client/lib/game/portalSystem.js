// portalSystem.js - Updated with entrance and exit portals
import * as THREE from "three";
import audioManager from "./audioManager";

// Portal state
let entrancePortal;
let exitPortal;
let portalCheckInterval;
let getPlayerPositionFunc;
let scene;
let isNearEntrancePortal = false;
let isNearExitPortal = false;
let interactionPromptVisible = false;
let interactionPromptEl = null;
let portalCooldown = false;

// Constants
const PORTAL_INTERACTION_DISTANCE = 3;
const PORTAL_CHECK_FREQUENCY = 100;
const PORTAL_COOLDOWN_TIME = 2000;

// Initialize the portal system
export function initialize(sceneRef, entrancePosition, exitPosition) {
  scene = sceneRef;

  // Clean up any existing portals
  cleanup();

  // Create entrance portal (blue, ceiling mounted)
  entrancePortal = createEntrancePortal();
  entrancePortal.position.set(
    entrancePosition.x,
    entrancePosition.y + 3,
    entrancePosition.z
  );
  scene.add(entrancePortal);

  // Create exit portal (red, floor mounted)
  exitPortal = createExitPortal();
  exitPortal.position.set(exitPosition.x, exitPosition.y - 1.5, exitPosition.z);
  scene.add(exitPortal);

  // Create interaction prompt if it doesn't exist
  createInteractionPrompt();

  // Add event listener for 'E' key to interact with portals
  document.addEventListener("keydown", handleKeyPress);
}

// Create a distinctive entrance portal (blue, ceiling mounted)
function createEntrancePortal() {
  const portalGroup = new THREE.Group();
  portalGroup.name = "entrancePortal";

  // Create portal ring
  const ringGeometry = new THREE.TorusGeometry(1.2, 0.2, 16, 32);
  const ringMaterial = new THREE.MeshStandardMaterial({
    color: 0x3366ff,
    emissive: 0x0044cc,
    emissiveIntensity: 1.5,
    side: THREE.DoubleSide,
  });
  const portalRing = new THREE.Mesh(ringGeometry, ringMaterial);
  portalRing.rotation.x = Math.PI / 2; // Horizontal orientation
  portalGroup.add(portalRing);

  // Create portal surface (shimmering effect)
  const surfaceGeometry = new THREE.CircleGeometry(1.1, 32);
  const surfaceMaterial = new THREE.MeshBasicMaterial({
    color: 0x66aaff,
    transparent: true,
    opacity: 0.7,
    side: THREE.DoubleSide,
  });
  const portalSurface = new THREE.Mesh(surfaceGeometry, surfaceMaterial);
  portalSurface.rotation.x = Math.PI / 2; // Horizontal orientation
  portalGroup.add(portalSurface);

  // Add point light for glow effect
  const portalLight = new THREE.PointLight(0x3366ff, 2, 10);
  portalLight.position.set(0, 0, 0);
  portalGroup.add(portalLight);

  // Add animation
  animatePortal(portalGroup, portalRing, portalSurface, 0x3366ff);

  // Mark as entrance portal
  portalGroup.userData = {
    isPortal: true,
    isEntrancePortal: true,
    interactable: true,
  };

  return portalGroup;
}

// Create a distinctive exit portal (red, floor mounted)
function createExitPortal() {
  const portalGroup = new THREE.Group();
  portalGroup.name = "exitPortal";

  // Create portal ring
  const ringGeometry = new THREE.TorusGeometry(1.2, 0.2, 16, 32);
  const ringMaterial = new THREE.MeshStandardMaterial({
    color: 0xff3333,
    emissive: 0xcc0000,
    emissiveIntensity: 1.5,
    side: THREE.DoubleSide,
  });
  const portalRing = new THREE.Mesh(ringGeometry, ringMaterial);
  portalRing.rotation.x = Math.PI / 2; // Horizontal orientation
  portalGroup.add(portalRing);

  // Create portal surface (shimmering effect)
  const surfaceGeometry = new THREE.CircleGeometry(1.1, 32);
  const surfaceMaterial = new THREE.MeshBasicMaterial({
    color: 0xff6666,
    transparent: true,
    opacity: 0.7,
    side: THREE.DoubleSide,
  });
  const portalSurface = new THREE.Mesh(surfaceGeometry, surfaceMaterial);
  portalSurface.rotation.x = Math.PI / 2; // Horizontal orientation
  portalGroup.add(portalSurface);

  // Add point light for glow effect
  const portalLight = new THREE.PointLight(0xff3333, 2, 10);
  portalLight.position.set(0, 0, 0);
  portalGroup.add(portalLight);

  // Add animation
  animatePortal(portalGroup, portalRing, portalSurface, 0xff3333);

  // Mark as exit portal
  portalGroup.userData = {
    isPortal: true,
    isExitPortal: true,
    interactable: true,
  };

  return portalGroup;
}

// Animate portal with subtle effects
function animatePortal(portalGroup, ring, surface, baseColor) {
  let time = 0;

  function animate() {
    time += 0.02;

    // Rotate the ring slowly
    ring.rotation.z = time * 0.2;

    // Pulse the surface
    const pulseScale = 0.95 + 0.1 * Math.sin(time * 1.5);
    surface.scale.set(pulseScale, pulseScale, 1);

    // Pulse opacity
    surface.material.opacity = 0.5 + 0.3 * Math.abs(Math.sin(time));

    // Cycle colors slightly
    const hue = Math.sin(time * 0.3) * 0.05;
    const color = new THREE.Color(baseColor);
    color.offsetHSL(hue, 0, 0.1 * Math.sin(time * 0.7));
    surface.material.color = color;

    // Set next animation frame
    portalGroup.userData.animationId = requestAnimationFrame(animate);
  }

  // Start animation
  animate();
}

// Create interaction prompt element
function createInteractionPrompt() {
  if (!interactionPromptEl) {
    interactionPromptEl = document.createElement("div");
    interactionPromptEl.id = "portalInteractionPrompt";
    interactionPromptEl.style.position = "fixed";
    interactionPromptEl.style.top = "60%";
    interactionPromptEl.style.left = "50%";
    interactionPromptEl.style.transform = "translate(-50%, -50%)";
    interactionPromptEl.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
    interactionPromptEl.style.color = "#fff";
    interactionPromptEl.style.padding = "10px 20px";
    interactionPromptEl.style.borderRadius = "5px";
    interactionPromptEl.style.fontFamily = "monospace";
    interactionPromptEl.style.fontSize = "18px";
    interactionPromptEl.style.fontWeight = "bold";
    interactionPromptEl.style.zIndex = "1000";
    interactionPromptEl.style.display = "none";
    interactionPromptEl.style.pointerEvents = "none";
    document.body.appendChild(interactionPromptEl);
  }
}

// Show the interaction prompt
function showInteractionPrompt(portalType) {
  if (interactionPromptEl && !interactionPromptVisible) {
    if (portalType === "entrance") {
      interactionPromptEl.innerText = "Press E to return to mainframe";
      interactionPromptEl.style.borderColor = "#3366ff";
      interactionPromptEl.style.boxShadow = "0 0 10px #3366ff";
    } else {
      interactionPromptEl.innerText = "Press E to enter next level";
      interactionPromptEl.style.borderColor = "#ff3333";
      interactionPromptEl.style.boxShadow = "0 0 10px #ff3333";
    }
    interactionPromptEl.style.display = "block";
    interactionPromptVisible = true;
  }
}

// Hide the interaction prompt
function hideInteractionPrompt() {
  if (interactionPromptEl && interactionPromptVisible) {
    interactionPromptEl.style.display = "none";
    interactionPromptVisible = false;
  }
}

// Handle 'E' key press for portal interaction
function handleKeyPress(event) {
  if (event.code === "KeyE") {
    // Skip if we're already in cooldown
    if (portalCooldown) {
      return;
    }

    if (isNearEntrancePortal) {
      // Use entrance portal (go to mainframe)
      useEntrancePortal();
      // Set cooldown to prevent rapid interactions
      startPortalCooldown();
    } else if (isNearExitPortal) {
      // Use exit portal (go to next level)
      useExitPortal();
      // Set cooldown to prevent rapid interactions
      startPortalCooldown();
    }
  }
}

function startPortalCooldown() {
  portalCooldown = true;

  // Temporarily remove the event listener to prevent any possible interaction
  document.removeEventListener("keydown", handleKeyPress);

  // Hide interaction prompt during cooldown
  hideInteractionPrompt();

  console.log("Portal on cooldown for " + PORTAL_COOLDOWN_TIME + "ms");

  // Reset cooldown after the timeout
  setTimeout(() => {
    portalCooldown = false;
    // Reattach the event listener
    document.addEventListener("keydown", handleKeyPress);

    // Show prompt again if near a portal
    if (isNearEntrancePortal) {
      showInteractionPrompt("entrance");
    } else if (isNearExitPortal) {
      showInteractionPrompt("exit");
    }

    console.log("Portal cooldown ended");
  }, PORTAL_COOLDOWN_TIME);
}

// Use entrance portal - UPDATED to return to mainframe
function useEntrancePortal() {
  // Immediately set flags to prevent multiple calls
  isNearEntrancePortal = false;
  isNearExitPortal = false;

  audioManager.playGameSound("mode-switch");

  // Show portal effect
  document.dispatchEvent(
    new CustomEvent("displayNotification", {
      detail: {
        message: "Returning to mainframe...",
        type: "info",
        duration: 3000,
      },
    })
  );

  // Switch to mainframe (defense) mode
  setTimeout(() => {
    document.dispatchEvent(
      new CustomEvent("switchMode", {
        detail: { mode: "defense" },
      })
    );
  }, 1000);
}

function useExitPortal() {
  // Immediately set flags to prevent multiple calls
  isNearEntrancePortal = false;
  isNearExitPortal = false;

  audioManager.playGameSound("mode-switch");

  // Show portal effect
  document.dispatchEvent(
    new CustomEvent("displayNotification", {
      detail: {
        message: "Entering next level...",
        type: "info",
        duration: 3000,
      },
    })
  );

  // Wait for animation then regenerate dungeon
  setTimeout(() => {
    document.dispatchEvent(
      new CustomEvent("portalEntered", {
        detail: {
          portalType: "exit",
          action: "nextLevel",
        },
      })
    );

    // Call the dungeon regeneration function with complete scene cleanup
    if (window.dungeonController) {
      // Force a complete scene cleanup before regeneration
      const activeScene =
        window.dungeonController.getDungeonData().dungeon.parent;
      forceSceneCleanup(activeScene);

      // Now regenerate the dungeon
      window.dungeonController.regenerateDungeon();
    }
  }, 1000);
}

// Helper function to thoroughly clean the scene
function forceSceneCleanup(scene) {
  if (!scene) return;

  console.log("Performing thorough scene cleanup before level transition");

  // First remove all items with custom userData
  const toRemove = [];

  scene.traverse((object) => {
    // Skip the scene itself
    if (object === scene) return;

    // Skip cameras and essential lighting
    if (object.isCamera) return;
    if (object.isLight && object.intensity >= 0.8) return;

    // Mark for removal
    toRemove.push(object);
  });

  // Remove objects and dispose resources
  toRemove.forEach((object) => {
    if (object.parent) {
      object.parent.remove(object);
    }

    // Dispose of geometries and materials
    if (object.geometry) {
      object.geometry.dispose();
    }

    if (object.material) {
      if (Array.isArray(object.material)) {
        object.material.forEach((material) => {
          disposeMaterial(material);
        });
      } else {
        disposeMaterial(object.material);
      }
    }
  });

  // Force garbage collection hint
  if (window.gc) window.gc();
}

// Helper to properly dispose material
function disposeMaterial(material) {
  if (!material) return;

  // Dispose textures
  for (const prop in material) {
    const value = material[prop];
    if (value && typeof value === "object" && "dispose" in value) {
      value.dispose();
    }
  }

  // Dispose the material itself
  material.dispose();
}

// Start checking for player proximity to portals
export function startCollisionChecking(getPlayerPosFn) {
  getPlayerPositionFunc = getPlayerPosFn;

  // Stop any existing checks
  if (portalCheckInterval) {
    clearInterval(portalCheckInterval);
  }

  // Start checking for portal proximity
  portalCheckInterval = setInterval(() => {
    const playerPos = getPlayerPositionFunc();

    if (!playerPos || !entrancePortal || !exitPortal) return;

    // Check distance to entrance portal
    const distanceToEntrance = playerPos.distanceTo(entrancePortal.position);
    if (distanceToEntrance < PORTAL_INTERACTION_DISTANCE) {
      if (!isNearEntrancePortal) {
        isNearEntrancePortal = true;
        showInteractionPrompt("entrance");
        // Play sound when first getting near portal
        audioManager.playUI("hover");
      }
    } else {
      isNearEntrancePortal = false;
    }

    // Check distance to exit portal
    const distanceToExit = playerPos.distanceTo(exitPortal.position);
    if (distanceToExit < PORTAL_INTERACTION_DISTANCE) {
      if (!isNearExitPortal) {
        isNearExitPortal = true;
        showInteractionPrompt("exit");
        // Play sound when first getting near portal
        audioManager.playUI("hover");
      }
    } else {
      isNearExitPortal = false;
    }

    // Hide prompt if not near any portal
    if (!isNearEntrancePortal && !isNearExitPortal) {
      hideInteractionPrompt();
    }
  }, PORTAL_CHECK_FREQUENCY);
}

// Clean up resources
export function cleanup() {
  if (portalCheckInterval) {
    clearInterval(portalCheckInterval);
    portalCheckInterval = null;
  }

  // Remove event listener
  document.removeEventListener("keydown", handleKeyPress);

  portalCooldown = false;
  // Remove portals from scene
  if (scene) {
    if (entrancePortal) {
      // Cancel animation
      if (entrancePortal.userData && entrancePortal.userData.animationId) {
        cancelAnimationFrame(entrancePortal.userData.animationId);
      }
      scene.remove(entrancePortal);
    }

    if (exitPortal) {
      // Cancel animation
      if (exitPortal.userData && exitPortal.userData.animationId) {
        cancelAnimationFrame(exitPortal.userData.animationId);
      }
      scene.remove(exitPortal);
    }
  }

  entrancePortal = null;
  exitPortal = null;
  isNearEntrancePortal = false;
  isNearExitPortal = false;

  // Remove interaction prompt
  if (interactionPromptEl) {
    hideInteractionPrompt();
  }
}

export default {
  initialize,
  startCollisionChecking,
  cleanup,
};
