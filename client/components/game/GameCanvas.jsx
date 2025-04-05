"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { useRouter } from "next/navigation";

// Import game modules
import { initDungeonMode } from "@/lib/game/dungeonMode";
import { initDefenseMode } from "@/lib/game/defenseMode";
import { useGameContext } from "./GameContext";

const GameCanvas = ({ sceneRef: externalSceneRef, escOverlayVisible }) => {
  const router = useRouter();
  const localSceneRef = useRef(null);
  const isGamePausedRef = useRef(false);
  // Use the external ref if provided, otherwise use the local one
  const activeSceneRef = externalSceneRef || localSceneRef;

  const containerRef = useRef(null);
  const rendererRef = useRef(null);
  const animationFrameRef = useRef(null);
  const orbitControlsRef = useRef(null);
  const gameInitializedRef = useRef(false);
  const lastTimeRef = useRef(performance.now());
  const isComponentMountedRef = useRef(true); // Add this ref to track component mount status
  const [initialLoad, setInitialLoad] = useState(true); // NEW: Track initial load state

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
    placedTurrets,
    setPlacedTurrets,
  } = useGameContext();

  // Add state to track if pointer is locked
  const [isPointerLocked, setIsPointerLocked] = useState(false);

  // Create a ref to track the current game state for the animation loop
  const gameStateRef = useRef(gameState);

  // Listen for the gameStarted event
  useEffect(() => {
    const handleGameStarted = () => {
      if (gameInitializedRef.current) return;

      // Initialize the dungeon mode
      if (
        dungeonControllerRef.current &&
        dungeonControllerRef.current.getControls
      ) {
        const controls = dungeonControllerRef.current.getControls();

        // Try to get pointer lock
        setTimeout(() => {
          if (controls && !controls.isLocked) {
            controls.lock();

            // Show a notification
            document.dispatchEvent(
              new CustomEvent("displayNotification", {
                detail: {
                  message: "Entering the Grid...",
                  type: "success",
                  duration: 3000,
                },
              })
            );
          }
        }, 100);
      }

      gameInitializedRef.current = true;
      setInitialLoad(false); // No longer initial load after game starts
    };

    document.addEventListener("gameStarted", handleGameStarted);

    return () => {
      document.removeEventListener("gameStarted", handleGameStarted);
    };
  }, []);

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
    // Set the mounted flag to true
    isComponentMountedRef.current = true;

    // Make sure the body has no margin/padding
    document.body.style.margin = "0";
    document.body.style.padding = "0";
    document.body.style.overflow = "hidden";

    if (!containerRef.current) return;

    // Setup scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111111);
    activeSceneRef.current = scene;

    // Setup renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;
    containerRef.current.appendChild(rendererRef.current.domElement);

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
    console.log("Initializing captured cores:", capturedCores);
    window.capturedCores = capturedCores;

    // Initialize with dungeon mode
    startDungeonMode();

    // Monitor pointer lock changes
    const handlePointerLockChange = () => {
      const newLockedState =
        document.pointerLockElement === containerRef.current ||
        document.pointerLockElement === document.body;

      setIsPointerLocked(newLockedState);

      if (!newLockedState && !escOverlayVisible) {
        console.log("Pointer lock lost but ESC overlay not visible.");

        document.dispatchEvent(new CustomEvent("openEscMenu"));
      }

      if (newLockedState) {
        setInitialLoad(false);
        document.dispatchEvent(
          new CustomEvent("displayNotification", {
            detail: {
              message: "Controls locked. Use WASD to move, mouse to look.",
              type: "info",
              duration: 3000,
            },
          })
        );
      }
    };
    document.addEventListener("pointerlockchange", handlePointerLockChange);

    const globalClickHandler = () => {
      if (
        dungeonControllerRef.current &&
        dungeonControllerRef.current.getControls &&
        gameStateRef.current === "dungeon" &&
        !escOverlayVisible // Don't try to lock if ESC menu is open
      ) {
        const controls = dungeonControllerRef.current.getControls();
        if (controls && !controls.isLocked) {
          console.log("Attempting to lock controls from click");
          controls.lock();
          setInitialLoad(false); // No longer initial load after first click
        }
      }
    };

    // Add click event listener to the container for pointer lock
    containerRef.current.addEventListener("click", globalClickHandler);

    // Attempt to acquire pointer lock after a short delay when the game first loads
    setTimeout(() => {
      if (
        dungeonControllerRef.current &&
        dungeonControllerRef.current.getControls
      ) {
        document.dispatchEvent(
          new CustomEvent("displayNotification", {
            detail: {
              message: "Click to enter the DUM RUNNER",
              type: "info",
            },
          })
        );
      }
    }, 1000);

    // Add an event listener for the pauseGame event
    const handlePauseGame = (event) => {
      isGamePausedRef.current = event.detail.paused;
      console.log("Game paused state:", isGamePausedRef.current);
    };

    document.addEventListener("pauseGame", handlePauseGame);

    const animate = () => {
      try {
        // Only continue animation if component is still mounted
        if (!isComponentMountedRef.current) {
          console.log("Component unmounted, stopping animation loop");
          return;
        }

        animationFrameRef.current = requestAnimationFrame(animate);

        // Calculate actual delta time
        const currentTime = performance.now();
        const delta = Math.min((currentTime - lastTimeRef.current) / 1000, 0.1);
        lastTimeRef.current = currentTime;

        // Access current game state through the ref
        const currentGameState = gameStateRef.current;

        // Skip game logic updates if paused, but still render the current frame
        if (!isGamePausedRef.current) {
          // Game logic update code here
          if (currentGameState === "dungeon" && dungeonControllerRef.current) {
            // Make sure we have a camera reference
            cameraRef.current =
              dungeonControllerRef.current.getControls()?.object ||
              cameraRef.current;

            // Explicitly call the update method
            dungeonControllerRef.current.update(delta);

            // Force camera update if controls are locked
            const controls = dungeonControllerRef.current.getControls();
            if (controls && controls.isLocked) {
              // Ensure camera properties are updated
              cameraRef.current.updateMatrixWorld();
              cameraRef.current.updateProjectionMatrix();
            }
          } else if (
            currentGameState === "defense" &&
            defenseControllerRef.current
          ) {
            defenseControllerRef.current.update(delta);
          }
        }

        // Always render the scene with the current camera
        if (rendererRef.current && cameraRef.current) {
          rendererRef.current.render(scene, cameraRef.current);
        }
      } catch (error) {
        console.error("Error in animation loop:", error);
      }
    };

    // Start the animation loop after a short delay to ensure everything is initialized
    setTimeout(() => {
      animate();
    }, 50);

    // Cleanup
    return () => {
      // Set the mounted flag to false when component unmounts
      isComponentMountedRef.current = false;

      console.log("Cleaning up GameCanvas");
      window.removeEventListener("resize", handleResize);
      document.removeEventListener(
        "pointerlockchange",
        handlePointerLockChange
      );
      document.removeEventListener("pauseGame", handlePauseGame);

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      if (rendererRef.current) {
        rendererRef.current.dispose();
        if (
          containerRef.current &&
          containerRef.current.contains(rendererRef.current.domElement)
        ) {
          containerRef.current.removeChild(rendererRef.current.domElement);
        }
      }

      // Clear scene
      if (scene) {
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
      }

      disposePointerLockControls();

      // Add null check to prevent errors during unmounting
      if (containerRef.current) {
        containerRef.current.removeEventListener("click", globalClickHandler);
      }

      document.removeEventListener("click", handleDungeonClick);
    };
  }, []);

  useEffect(() => {
    // When overlay is hidden and we're in dungeon mode, we just ensure dungeonController knows
    if (!escOverlayVisible && gameState === "dungeon") {
      // No immediate action needed - Game.jsx will handle pointer lock
      // This just serves as a fallback in case the central handler fails
      setTimeout(() => {
        if (
          dungeonControllerRef.current &&
          dungeonControllerRef.current.getControls &&
          !document.pointerLockElement // Only if pointer isn't already locked
        ) {
          const controls = dungeonControllerRef.current.getControls();
          if (controls && !controls.isLocked) {
            controls.lock();
          }
        }
      }, 150); // Slight delay to let Game.jsx handler run first
    }
  }, [escOverlayVisible, gameState]);

  // Effect to handle game state changes from context
  useEffect(() => {
    // Skip during initial render when scene isn't created yet
    if (!activeSceneRef.current) return;

    if (gameState === "dungeon" && defenseControllerRef.current) {
      window.capturedCores = [...capturedCores];
      startDungeonMode();
    } else if (gameState === "defense" && dungeonControllerRef.current) {
      window.capturedCores = [...capturedCores];
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
  }, [gameState, capturedCores]);

  // Effect to update global cores when context changes
  useEffect(() => {
    window.capturedCores = [...capturedCores];
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
    // Only handle click if ESC overlay is not visible
    if (escOverlayVisible) return;

    if (
      dungeonControllerRef.current &&
      dungeonControllerRef.current.getControls &&
      gameStateRef.current === "dungeon"
    ) {
      const controls = dungeonControllerRef.current.getControls();
      if (controls && !controls.isLocked) {
        console.log("Attempting to lock controls from document click");
        controls.lock();
        setInitialLoad(false); // No longer initial load after clicking
      }
    }
  };

  // Modify startDungeonMode to create a fresh camera
  const startDungeonMode = () => {
    if (!activeSceneRef.current || !rendererRef.current) return;

    console.log("Starting dungeon mode");
    window.capturedCores = [...capturedCores];

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

    // Create a fresh camera for dungeon mode with position set
    const newCamera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    newCamera.position.set(0, 1.8, 0); // Set initial height
    cameraRef.current = newCamera;

    // Initialize dungeon mode controller with the fresh camera
    dungeonControllerRef.current = initDungeonMode(
      activeSceneRef.current,
      cameraRef.current,
      rendererRef.current
    );

    // Update camera reference to the one from dungeon controller
    if (
      dungeonControllerRef.current &&
      dungeonControllerRef.current.getControls()
    ) {
      cameraRef.current = dungeonControllerRef.current.getControls().object;

      // Force an immediate click to acquire pointer lock
      setTimeout(() => {
        const controls = dungeonControllerRef.current.getControls();
        if (controls && !controls.isLocked) {
          console.log("Auto-attempting to lock controls");
          try {
            controls.lock();
          } catch (e) {
            console.error("Error locking controls:", e);
          }
        }
      }, 500);
    }

    // Show notification to let the user know they need to click to lock pointer
    document.dispatchEvent(
      new CustomEvent("displayNotification", {
        detail: {
          message: "Click to lock mouse and enter the grid",
          type: "info",
          duration: 5000,
        },
      })
    );

    // Add the click event listener for pointer lock specifically for dungeon mode
    document.addEventListener("click", handleDungeonClick);

    // Also add a keypress listener as a backup way to lock the pointer
    const keyPressHandler = (e) => {
      if (e.code === "Space" || e.code === "Enter") {
        if (
          dungeonControllerRef.current &&
          dungeonControllerRef.current.getControls &&
          gameStateRef.current === "dungeon"
        ) {
          const controls = dungeonControllerRef.current.getControls();
          if (controls && !controls.isLocked) {
            console.log("Attempting to lock controls from keypress");
            controls.lock();
            e.preventDefault();
          }
        }
      }
    };

    document.addEventListener("keydown", keyPressHandler);

    // Make sure we clean up this listener later
    return () => {
      document.removeEventListener("keydown", keyPressHandler);
    };
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

    window.capturedCores = [...capturedCores];
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

  // Add inline styles to ensure no margins or borders
  useEffect(() => {
    // Apply CSS fixes for margin/border issues
    if (containerRef.current) {
      // Remove any margins or padding
      containerRef.current.style.margin = "0";
      containerRef.current.style.padding = "0";
      containerRef.current.style.position = "absolute";
      containerRef.current.style.top = "0";
      containerRef.current.style.left = "0";
      containerRef.current.style.width = "100%";
      containerRef.current.style.height = "100%";
      containerRef.current.style.overflow = "hidden";
      containerRef.current.style.boxSizing = "border-box";

      // Ensure canvas takes up full space
      if (rendererRef.current && rendererRef.current.domElement) {
        rendererRef.current.domElement.style.display = "block";
        rendererRef.current.domElement.style.width = "100%";
        rendererRef.current.domElement.style.height = "100%";
        rendererRef.current.domElement.style.margin = "0";
        rendererRef.current.domElement.style.padding = "0";
      }
    }

    // Add global style overrides
    const styleEl = document.createElement("style");
    styleEl.innerHTML = `
      body, html {
        margin: 0 !important;
        padding: 0 !important;
        overflow: hidden !important;
      }
      .game-wrapper {
        margin: 0 !important;
        padding: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        overflow: hidden !important;
      }
      .game-canvas {
        margin: 0 !important;
        padding: 0 !important;
        overflow: hidden !important;
      }
    `;
    document.head.appendChild(styleEl);

    return () => {
      document.head.removeChild(styleEl);
    };
  }, []);

  return (
    <div
      className="game-canvas"
      ref={containerRef}
      style={{
        margin: 0,
        padding: 0,
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        overflow: "hidden",
        boxSizing: "border-box",
      }}
    >
      {/* Only show the pointer lock prompt during initial load, in dungeon mode, when pointer is not locked,
          and when the ESC overlay is not visible */}
      {gameState === "dungeon" &&
        !isPointerLocked &&
        initialLoad &&
        !escOverlayVisible && (
          <div className="pointer-lock-prompt">
            <h2>Click to Enter the Grid</h2>
            <p>
              Click anywhere on the screen to lock your cursor and begin playing
            </p>
          </div>
        )}
    </div>
  );
};

export default GameCanvas;
