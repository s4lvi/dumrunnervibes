// portalSystem.js - Portal system for dungeon mode
import * as THREE from "three";
import audioManager from "./audioManager";

// Constants
const PORTAL_RADIUS = 2;
const PORTAL_THICKNESS = 0.3;
const PORTAL_SEGMENTS = 16;
const PARTICLE_COUNT = 500;

// Portal system
const portalSystem = {
  startPortal: null,
  exitPortal: null,
  startPortalBox: null,
  exitPortalBox: null,
  playerCollisionCheckInterval: null,

  /**
   * Initialize the portal system
   * @param {THREE.Scene} scene - The THREE.js scene
   * @param {Object} spawnPosition - Starting position for player
   * @param {Object} portalPosition - Position for the exit portal
   */
  initialize(scene, spawnPosition, portalPosition) {
    // Check if we're entering from another portal
    const urlParams = new URLSearchParams(window.location.search);
    const isFromPortal = urlParams.get("portal") === "true";
    const refUrl = urlParams.get("ref");

    // Create the exit portal in the designated room
    this.createExitPortal(scene, portalPosition);

    // If we're coming from another portal, create a start portal too
    if (isFromPortal && refUrl) {
      this.createStartPortal(scene, spawnPosition, refUrl);
    }
  },

  /**
   * Creates an exit portal that sends player to the portal hub
   * @param {THREE.Scene} scene - The THREE.js scene
   * @param {Object} portalPosition - Position for the exit portal
   */
  createExitPortal(scene, portalPosition) {
    const portalGroup = new THREE.Group();
    portalGroup.name = "ExitPortal";

    // Create portal ring
    const portalGeometry = new THREE.TorusGeometry(
      PORTAL_RADIUS,
      PORTAL_THICKNESS,
      PORTAL_SEGMENTS,
      36
    );
    const portalMaterial = new THREE.MeshPhongMaterial({
      color: 0x00ff00,
      emissive: 0x00ff00,
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.8,
    });
    const portalRing = new THREE.Mesh(portalGeometry, portalMaterial);
    portalGroup.add(portalRing);

    // Create portal inner surface
    const innerGeometry = new THREE.CircleGeometry(PORTAL_RADIUS - 0.1, 32);
    const innerMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
    });
    const innerSurface = new THREE.Mesh(innerGeometry, innerMaterial);
    portalGroup.add(innerSurface);

    // Create portal particles
    const particleGeometry = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(PARTICLE_COUNT * 3);
    const particleColors = new Float32Array(PARTICLE_COUNT * 3);

    for (let i = 0; i < PARTICLE_COUNT * 3; i += 3) {
      // Create particles in a ring around the portal
      const angle = Math.random() * Math.PI * 2;
      const radius =
        PORTAL_RADIUS + (Math.random() - 0.5) * PORTAL_THICKNESS * 2;
      particlePositions[i] = Math.cos(angle) * radius;
      particlePositions[i + 1] = Math.sin(angle) * radius;
      particlePositions[i + 2] = (Math.random() - 0.5) * 0.5;

      // Green color with slight variation
      particleColors[i] = 0;
      particleColors[i + 1] = 0.8 + Math.random() * 0.2;
      particleColors[i + 2] = 0;
    }

    particleGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(particlePositions, 3)
    );
    particleGeometry.setAttribute(
      "color",
      new THREE.BufferAttribute(particleColors, 3)
    );

    const particleMaterial = new THREE.PointsMaterial({
      size: 0.05,
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
    });

    const particles = new THREE.Points(particleGeometry, particleMaterial);
    portalGroup.add(particles);

    // Add portal label
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    canvas.width = 512;
    canvas.height = 64;
    context.fillStyle = "#00ff00";
    context.font = "bold 32px Arial";
    context.textAlign = "center";
    context.fillText("VIBEVERSE PORTAL", canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    const labelGeometry = new THREE.PlaneGeometry(4, 0.5);
    const labelMaterial = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide,
    });

    const label = new THREE.Mesh(labelGeometry, labelMaterial);
    label.position.y = PORTAL_RADIUS + 0.8;
    portalGroup.add(label);

    // Set portal position to the provided position
    portalGroup.position.set(
      portalPosition.x,
      portalPosition.y + PORTAL_RADIUS,
      portalPosition.z
    );

    // Rotate slightly for better visibility
    portalGroup.rotation.y = Math.random() * Math.PI * 2;

    // Add a point light to make the portal glow
    const portalLight = new THREE.PointLight(0x00ff00, 2, 10);
    portalLight.position.set(0, 0, 0);
    portalGroup.add(portalLight);

    // Add portal to scene
    scene.add(portalGroup);

    // Store portal and create collision box
    this.exitPortal = portalGroup;
    this.exitPortalBox = new THREE.Box3().setFromObject(portalGroup);

    // Animate portal
    this.animatePortal(particles, innerMaterial);

    console.log("Exit portal created at", portalPosition);
  },

  /**
   * Creates a start portal that returns to the referring game
   * @param {THREE.Scene} scene - The THREE.js scene
   * @param {Object} spawnPosition - Position where the player spawns
   * @param {string} refUrl - URL to return to
   */
  createStartPortal(scene, spawnPosition, refUrl) {
    const portalGroup = new THREE.Group();
    portalGroup.name = "StartPortal";

    // Create portal ring
    const portalGeometry = new THREE.TorusGeometry(
      PORTAL_RADIUS,
      PORTAL_THICKNESS,
      PORTAL_SEGMENTS,
      36
    );
    const portalMaterial = new THREE.MeshPhongMaterial({
      color: 0xff0000,
      emissive: 0xff0000,
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.8,
    });
    const portalRing = new THREE.Mesh(portalGeometry, portalMaterial);
    portalGroup.add(portalRing);

    // Create portal inner surface
    const innerGeometry = new THREE.CircleGeometry(PORTAL_RADIUS - 0.1, 32);
    const innerMaterial = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
    });
    const innerSurface = new THREE.Mesh(innerGeometry, innerMaterial);
    portalGroup.add(innerSurface);

    // Create portal particles
    const particleGeometry = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(PARTICLE_COUNT * 3);
    const particleColors = new Float32Array(PARTICLE_COUNT * 3);

    for (let i = 0; i < PARTICLE_COUNT * 3; i += 3) {
      // Create particles in a ring around the portal
      const angle = Math.random() * Math.PI * 2;
      const radius =
        PORTAL_RADIUS + (Math.random() - 0.5) * PORTAL_THICKNESS * 2;
      particlePositions[i] = Math.cos(angle) * radius;
      particlePositions[i + 1] = Math.sin(angle) * radius;
      particlePositions[i + 2] = (Math.random() - 0.5) * 0.5;

      // Red color with slight variation
      particleColors[i] = 0.8 + Math.random() * 0.2;
      particleColors[i + 1] = 0;
      particleColors[i + 2] = 0;
    }

    particleGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(particlePositions, 3)
    );
    particleGeometry.setAttribute(
      "color",
      new THREE.BufferAttribute(particleColors, 3)
    );

    const particleMaterial = new THREE.PointsMaterial({
      size: 0.05,
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
    });

    const particles = new THREE.Points(particleGeometry, particleMaterial);
    portalGroup.add(particles);

    // Add portal label with the name of the referring site
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    canvas.width = 512;
    canvas.height = 64;
    context.fillStyle = "#ff0000";
    context.font = "bold 32px Arial";
    context.textAlign = "center";

    // Get just the domain name for display
    let displayUrl = refUrl;
    try {
      // Remove protocol and path, just keep domain
      displayUrl = refUrl
        .replace(/^(?:https?:\/\/)?(?:www\.)?/i, "")
        .split("/")[0];
    } catch (e) {
      console.log("Error parsing refUrl:", e);
    }

    context.fillText(
      `RETURN TO ${displayUrl}`,
      canvas.width / 2,
      canvas.height / 2
    );

    const texture = new THREE.CanvasTexture(canvas);
    const labelGeometry = new THREE.PlaneGeometry(4, 0.5);
    const labelMaterial = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide,
    });

    const label = new THREE.Mesh(labelGeometry, labelMaterial);
    label.position.y = PORTAL_RADIUS + 0.8;
    portalGroup.add(label);

    // Set portal position - place it near the player spawn point
    // We'll offset it a bit so the player doesn't spawn right in the portal
    portalGroup.position.set(
      spawnPosition.x + 2,
      spawnPosition.y + PORTAL_RADIUS,
      spawnPosition.z + 2
    );
    portalGroup.rotation.y = Math.PI / 4;

    // Add portal to scene
    scene.add(portalGroup);

    // Store portal and create collision box
    this.startPortal = portalGroup;
    this.startPortalBox = new THREE.Box3().setFromObject(portalGroup);

    // Animate portal
    this.animatePortal(particles, innerMaterial);

    console.log(
      "Start portal created at",
      spawnPosition,
      "redirecting to",
      refUrl
    );
  },

  /**
   * Animate portal particles and appearance
   * @param {THREE.Points} particles - The particle system
   * @param {THREE.Material} innerMaterial - The inner portal material
   */
  animatePortal(particles, innerMaterial) {
    const animate = () => {
      if (!particles.geometry || !particles.geometry.attributes.position) {
        return;
      }

      const positions = particles.geometry.attributes.position.array;
      for (let i = 0; i < positions.length; i += 3) {
        // Wave-like motion for particles
        positions[i] += 0.003 * Math.sin(Date.now() * 0.001 + i);
        positions[i + 1] += 0.003 * Math.cos(Date.now() * 0.002 + i);
      }
      particles.geometry.attributes.position.needsUpdate = true;

      // Pulse inner surface opacity
      if (innerMaterial) {
        innerMaterial.opacity = 0.3 + Math.sin(Date.now() * 0.002) * 0.2;
      }

      requestAnimationFrame(animate);
    };

    animate();
  },

  /**
   * Start checking for player collisions with portals
   * @param {Function} getPlayerPosition - Function to get current player position
   */
  startCollisionChecking(getPlayerPosition) {
    // Clear any existing interval
    if (this.playerCollisionCheckInterval) {
      clearInterval(this.playerCollisionCheckInterval);
    }

    // Check every 100ms for portal collisions
    this.playerCollisionCheckInterval = setInterval(() => {
      const playerPosition = getPlayerPosition();
      if (!playerPosition) return;

      // Create a simple player bounding box
      const playerBox = new THREE.Box3(
        new THREE.Vector3(
          playerPosition.x - 0.5,
          playerPosition.y - 1,
          playerPosition.z - 0.5
        ),
        new THREE.Vector3(
          playerPosition.x + 0.5,
          playerPosition.y + 1,
          playerPosition.z + 0.5
        )
      );

      // Check exit portal collision
      if (this.exitPortalBox && playerBox.intersectsBox(this.exitPortalBox)) {
        this.handleExitPortalCollision();
      }

      // Check start portal collision
      if (this.startPortalBox && playerBox.intersectsBox(this.startPortalBox)) {
        this.handleStartPortalCollision();
      }
    }, 100);
  },

  /**
   * Handle player entering the exit portal
   */
  handleExitPortalCollision() {
    // Get player information for the URL
    const playerHealth = Math.floor(window.playerHealth || 100);
    const username = "DumRunner_" + Math.floor(Math.random() * 1000);
    const color = "green";
    const speed = 5;

    // Build URL with parameters
    const params = new URLSearchParams();
    params.append("portal", "true");
    params.append("username", username);
    params.append("color", color);
    params.append("speed", speed);
    params.append("health", playerHealth);
    params.append("ref", window.location.href);

    // Play portal sound effect
    audioManager.playGameSound("mode-switch");

    // Show transition notification
    document.dispatchEvent(
      new CustomEvent("displayNotification", {
        detail: {
          message: "Entering Vibeverse Portal...",
          type: "success",
        },
      })
    );

    // Redirect after a short delay to allow for sound and notification
    setTimeout(() => {
      window.location.href = `http://portal.pieter.com?${params.toString()}`;
    }, 1000);

    // Stop checking for collisions after triggering portal
    clearInterval(this.playerCollisionCheckInterval);
  },

  /**
   * Handle player entering the start portal
   */
  handleStartPortalCollision() {
    // Get ref URL from the URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const refUrl = urlParams.get("ref");

    if (!refUrl) return;

    // Get all URL parameters
    const params = new URLSearchParams();

    // Copy all existing params except 'ref' (since we're using it as the base URL)
    for (const [key, value] of urlParams.entries()) {
      if (key !== "ref") {
        params.append(key, value);
      }
    }

    // Play portal sound effect
    audioManager.playGameSound("mode-switch");

    // Show transition notification
    document.dispatchEvent(
      new CustomEvent("displayNotification", {
        detail: {
          message: "Returning to previous game...",
          type: "success",
        },
      })
    );

    // Construct the full URL with parameters
    let returnUrl = refUrl;
    if (!returnUrl.startsWith("http://") && !returnUrl.startsWith("https://")) {
      returnUrl = "https://" + returnUrl;
    }

    // Redirect after a short delay
    setTimeout(() => {
      window.location.href = `${returnUrl}?${params.toString()}`;
    }, 1000);

    // Stop checking for collisions after triggering portal
    clearInterval(this.playerCollisionCheckInterval);
  },

  /**
   * Clean up portal system resources
   */
  cleanup() {
    if (this.playerCollisionCheckInterval) {
      clearInterval(this.playerCollisionCheckInterval);
    }
  },
};

export default portalSystem;
