"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";

// Import game modules
import { initDungeonMode } from "@/lib/game/dungeonMode";
import { initDefenseMode } from "@/lib/game/defenseMode";
import { useGameContext } from "./GameContext";

const GameCanvas = ({ sceneRef: externalSceneRef }) => {
  // Create a local sceneRef if one isn't passed in
  const localSceneRef = useRef(null);
  // Use the external ref if provided, otherwise use the local one
  const activeSceneRef = externalSceneRef || localSceneRef;

  const containerRef = useRef(null);
  const rendererRef = useRef(null);
  const animationFrameRef = useRef(null);
  const orbitControlsRef = useRef(null);

  // Get game state from context
  const {
    gameState,
    setGameState,
    capturedCores,
    setCapturedCores,
    playerHealth,
    setPlayerHealth,
    inventory,
    setInventory,
    placedTurrets, // Get placedTurrets from context
    setPlacedTurrets,
  } = useGameContext();

  // Create a ref to track the current game state for the animation loop
  const gameStateRef = useRef(gameState);

  // Update the ref whenever gameState changes
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Controller references
  const dungeonControllerRef = useRef(null);
  const defenseControllerRef = useRef(null);
  const cameraRef = useRef(null);

  // Initialize the game
  useEffect(() => {
    if (!containerRef.current) return;

    // Setup scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111111);
    activeSceneRef.current = scene;

    // Setup renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Create initial camera (will be replaced by mode controllers)
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    cameraRef.current = camera;

    // Add basic lighting
    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    // Setup window resize handler
    const handleResize = () => {
      if (gameStateRef.current === "dungeon") {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
      } else if (
        gameStateRef.current === "defense" &&
        defenseControllerRef.current
      ) {
        const defenseCam = defenseControllerRef.current.getCamera();
        defenseCam.left = window.innerWidth / -32;
        defenseCam.right = window.innerWidth / 32;
        defenseCam.top = window.innerHeight / 32;
        defenseCam.bottom = window.innerHeight / -32;
        defenseCam.updateProjectionMatrix();
      }

      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener("resize", handleResize);

    // Make captured cores available globally for the game modules
    window.capturedCores = capturedCores;

    // Initialize with dungeon mode
    startDungeonMode();

    // Animation loop - use gameStateRef to access current game state
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);

      const delta = 1 / 60; // Fixed delta time for consistent updates

      // Access current game state through the ref
      const currentGameState = gameStateRef.current;

      // Update the current mode
      if (currentGameState === "dungeon" && dungeonControllerRef.current) {
        dungeonControllerRef.current.update(delta);
      } else if (
        currentGameState === "defense" &&
        defenseControllerRef.current
      ) {
        defenseControllerRef.current.update(delta);
      }

      // Render the scene
      renderer.render(scene, cameraRef.current);
    };

    animate();

    // Cleanup
    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameRef.current);
      renderer.dispose();
      if (
        containerRef.current &&
        containerRef.current.contains(renderer.domElement)
      ) {
        containerRef.current.removeChild(renderer.domElement);
      }

      // Clear scene
      scene.traverse((object) => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach((material) => material.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
      disposePointerLockControls();
      document.removeEventListener("click", handleDungeonClick);
    };
  }, []);

  // Effect to handle game state changes from context
  useEffect(() => {
    // Skip during initial render when scene isn't created yet
    if (!activeSceneRef.current) return;

    if (gameState === "dungeon" && defenseControllerRef.current) {
      startDungeonMode();
    } else if (gameState === "defense" && dungeonControllerRef.current) {
      startDefenseMode();
    }

    // Clean up event listeners when mode changes
    return () => {
      if (gameState === "defense") {
        // Leaving dungeon mode, clean up its listeners
        disposePointerLockControls();
        document.removeEventListener("click", handleDungeonClick);
      }
    };
  }, [gameState]);

  // Effect to update global cores when context changes
  useEffect(() => {
    window.capturedCores = capturedCores;
  }, [capturedCores]);

  // Setup effect to track placedTurrets for persistence
  useEffect(() => {
    // Share the React state with the defense mode module
    if (
      defenseControllerRef.current &&
      defenseControllerRef.current.setPlacedTurrets
    ) {
      defenseControllerRef.current.setPlacedTurrets(placedTurrets);
    }
  }, [placedTurrets]);

  const handleDungeonClick = () => {
    if (
      dungeonControllerRef.current &&
      dungeonControllerRef.current.getControls &&
      gameStateRef.current === "dungeon"
    ) {
      const controls = dungeonControllerRef.current.getControls();
      if (controls && !controls.isLocked) {
        controls.lock();
      }
    }
  };

  // Modify startDungeonMode to create a fresh camera
  const startDungeonMode = () => {
    if (!activeSceneRef.current || !rendererRef.current) return;

    // Clean up defense mode first
    if (defenseControllerRef.current) {
      // Clean up any orbit controls
      if (defenseControllerRef.current.getControls) {
        const controls = defenseControllerRef.current.getControls();
        if (controls && controls.dispose) {
          controls.dispose();
        }
      }
      defenseControllerRef.current = null;
    }

    // Clear the scene to remove defense mode elements
    clearScene();

    // Create a fresh camera for dungeon mode
    const newCamera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    cameraRef.current = newCamera;

    // Initialize dungeon mode controller with the fresh camera
    dungeonControllerRef.current = initDungeonMode(
      activeSceneRef.current,
      cameraRef.current,
      rendererRef.current
    );

    // Update camera reference to the one from dungeon controller
    cameraRef.current = dungeonControllerRef.current.getControls().object;

    // Add the click event listener for pointer lock only in dungeon mode
    document.addEventListener("click", handleDungeonClick);
  };

  const disposePointerLockControls = () => {
    if (
      dungeonControllerRef.current &&
      dungeonControllerRef.current.getControls
    ) {
      const controls = dungeonControllerRef.current.getControls();
      if (controls) {
        // Unlock the controls if they're locked
        if (controls.isLocked) {
          controls.unlock();
        }

        // Remove all event listeners
        if (controls.domElement) {
          controls.domElement.removeEventListener("click", controls.lock);
        }

        document.removeEventListener(
          "pointerlockchange",
          controls.onPointerlockChange
        );
        document.removeEventListener(
          "pointerlockerror",
          controls.onPointerlockError
        );

        // Remove from scene if it's in the scene
        if (controls.object && controls.object.parent) {
          controls.object.parent.remove(controls.object);
        }
      }
    }
  };

  // Function to switch to defense mode
  const startDefenseMode = () => {
    if (!activeSceneRef.current || !rendererRef.current) return;

    // Properly dispose of pointer lock controls first
    disposePointerLockControls();

    // Stop listening for click events that might trigger pointer lock
    document.removeEventListener("click", handleDungeonClick);

    // Clear the scene to remove dungeon elements
    clearScene();

    // Now clean up any remaining player objects
    if (activeSceneRef.current) {
      activeSceneRef.current.traverse((object) => {
        if (
          object.name === "Player" ||
          object.name === "PointerLockControls" ||
          (object.userData && object.userData.isPlayer)
        ) {
          activeSceneRef.current.remove(object);
        }
      });
    }

    // Set the dungeon controller to null
    dungeonControllerRef.current = null;

    // Initialize defense mode controller with a fresh camera and pass placedTurrets
    defenseControllerRef.current = initDefenseMode(
      activeSceneRef.current,
      rendererRef.current,
      placedTurrets // Pass the current turrets from React state
    );

    // Update camera reference to the one from defense controller
    cameraRef.current = defenseControllerRef.current.getCamera();

    // Start the first wave after a delay
    setTimeout(() => {
      defenseControllerRef.current.startWave(1);
    }, 2000);
  };

  // Function to clear scene elements
  const clearScene = () => {
    if (!activeSceneRef.current) return;

    const scene = activeSceneRef.current;

    // Keep track of objects to remove
    const objectsToRemove = [];

    // Find all objects to remove except camera and lights
    scene.traverse((object) => {
      // Skip camera
      if (object.isCamera) return;

      // Keep basic light setup
      if (object.isLight) {
        // Only remove non-essential lights
        if (object.intensity < 0.5) {
          objectsToRemove.push(object);
        }
        return;
      }

      // Mark for removal if not a scene or camera
      if (object !== scene) {
        objectsToRemove.push(object);
      }
    });

    // Remove all marked objects
    objectsToRemove.forEach((object) => {
      scene.remove(object);
    });
  };

  return <div className="game-canvas" ref={containerRef}></div>;
};

export default GameCanvas;
