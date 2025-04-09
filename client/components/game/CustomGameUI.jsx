// CustomGameUI.jsx - Custom UI layout for DūM RUNNER
"use client";

import { useEffect, useState } from "react";
import { useGameContext } from "./GameContext";
import Minimap from "./Minimap";
import Image from "next/image";
import "./CRTStyle.css";

const CustomGameUI = () => {
  const { gameState, playerHealth, capturedCores, inventory } =
    useGameContext();
  const [currentWeapon, setCurrentWeapon] = useState({
    name: "BASIC LASER",
    ammo: "∞",
    sideImage: "/images/basic_gun_side.png",
    fpsImage: "/images/basic_gun_fps.png",
  });
  const [stamina, setStamina] = useState(100);
  const [weaponFiring, setWeaponFiring] = useState(false);
  const [weaponSwitching, setWeaponSwitching] = useState(true);
  const [isWalking, setIsWalking] = useState(false);

  // Listen for weapon changes from the game
  // Add state to track animation key for forcing rerender
  const [recoilKey, setRecoilKey] = useState(0);
  const [walkKey, setWalkKey] = useState(0);

  useEffect(() => {
    const handleWeaponChange = (event) => {
      const { name, ammo, sideImage, fpsImage } = event.detail;

      // Trigger weapon switching animation
      setWeaponSwitching(true);

      // Play weapon switch sound
      try {
        const switchSound = new Audio("/audio/weapon_switch.mp3");
        switchSound.volume = 0.5;
        switchSound.play().catch((e) => console.log("Audio play error:", e));
      } catch (e) {
        console.log("Audio error:", e);
      }

      // Set new weapon after a brief delay
      setTimeout(() => {
        setCurrentWeapon({
          name,
          ammo,
          // Use provided images or fallback to current images if not provided
          sideImage: sideImage || currentWeapon.sideImage,
          fpsImage: fpsImage || currentWeapon.fpsImage,
        });
      }, 100);

      // End animation after it completes
      setTimeout(() => {
        setWeaponSwitching(false);
      }, 500);
    };

    const handleWeaponFired = (event) => {
      console.log("Weapon fired event received");
      // Reset the animation first (if already animating)
      setWeaponFiring(false);

      // Force browser to recognize the style change
      setTimeout(() => {
        // Increment key to force component update
        setRecoilKey((prevKey) => prevKey + 1);
        // Trigger recoil animation
        setWeaponFiring(true);

        // Reset after animation completes
        setTimeout(() => {
          setWeaponFiring(false);
        }, 150);
      }, 5);
    };

    const handlePlayerMovement = (event) => {
      // Check if player is moving to apply walking animation
      const { moving } = event.detail;
      console.log("Player movement event received:", moving);

      if (moving !== isWalking) {
        if (moving) {
          // Starting to walk
          setWalkKey((prevKey) => prevKey + 1);
        }
        setIsWalking(moving);
      }
    };

    const handleStaminaUpdate = (event) => {
      const { stamina } = event.detail;
      if (stamina !== undefined) {
        setStamina(stamina);
      }
    };

    // Test event dispatch
    console.log("Setting up event listeners for weapon animations");

    // Listen for events
    document.addEventListener("updateWeapon", handleWeaponChange);
    document.addEventListener("weaponFired", handleWeaponFired);
    document.addEventListener("playerMovement", handlePlayerMovement);
    document.addEventListener("updateDungeonUI", handleStaminaUpdate);

    // Dispatch a test event to confirm listeners are working
    setTimeout(() => {
      console.log("Dispatching test event");
      document.dispatchEvent(
        new CustomEvent("playerMovement", {
          detail: { moving: true },
        })
      );
    }, 1000);

    return () => {
      document.removeEventListener("updateWeapon", handleWeaponChange);
      document.removeEventListener("weaponFired", handleWeaponFired);
      document.removeEventListener("playerMovement", handlePlayerMovement);
      document.removeEventListener("updateDungeonUI", handleStaminaUpdate);
    };
  }, [currentWeapon.sideImage, currentWeapon.fpsImage, isWalking]);

  return (
    <div className="game-ui-wrapper">
      {/* Health and Stamina in top left corner */}
      <div className="health-container">
        <div className="health-value">{Math.floor(playerHealth)}</div>
        <div className="stamina-bar-container">
          <div className="stamina-bar-fill" style={{ width: `${stamina}%` }} />
        </div>
      </div>

      {/* Bottom left - Weapon display */}
      <div className="weapon-container">
        {/* Weapon side view image */}
        <div className="weapon-image">
          <Image
            src={currentWeapon.sideImage}
            alt={currentWeapon.name}
            width={80}
            height={80}
            className="weapon-side-image"
          />
        </div>
        <div className="weapon-details">
          <div className="weapon-name">{currentWeapon.name}</div>
          <div className="weapon-ammo">AMMO: {currentWeapon.ammo}</div>
        </div>
      </div>

      {/* Bottom center - Weapon sprite placeholder */}
      <div className="center-weapon-sprite">
        <div
          className={`weapon-wrapper ${
            weaponSwitching ? "weapon-switching" : ""
          }`}
        >
          <div
            key={`walk-${walkKey}`}
            className={`weapon-inner ${isWalking ? "weapon-walking" : ""}`}
          >
            <Image
              key={`recoil-${recoilKey}`}
              src={currentWeapon.fpsImage}
              alt="Weapon view"
              width={320}
              height={320}
              className={`weapon-fps-image ${
                weaponFiring ? "weapon-recoil" : ""
              }`}
            />
          </div>
        </div>
      </div>

      {/* Bottom right - Minimap and resource counters */}
      <div className="bottom-right-container">
        <div className="resource-counters">
          <div className="cores-count">CORES: {capturedCores.length}</div>
          <div className="scrap-count">
            SCRAP [L:{inventory.electronic} C:
            {inventory.metal} E:{inventory.energy}]
          </div>
        </div>
        <Minimap />
      </div>

      {/* Add a crosshair in the center */}
      <div className="crosshair"></div>

      <style jsx>{`
        .game-ui-wrapper {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 100;
          color: #ff0000;
          font-family: monospace;
          text-shadow: 0 0 5px rgba(255, 0, 0, 0.7);
        }

        /* Health in top left */
        .health-container {
          position: absolute;
          top: 20px;
          left: 20px;
          font-size: 36px;
          font-weight: bold;
        }

        /* Stamina bar */
        .stamina-bar-container {
          width: 150px;
          height: 8px;
          background-color: rgba(80, 0, 0, 0.5);
          border: 1px solidrgb(25, 0, 255);
          margin-top: 5px;
          position: relative;
        }

        .stamina-bar-fill {
          height: 100%;
          background-color: rgb(0, 110, 255);
          transition: width 0.2s ease-out;
        }

        /* Weapon display in bottom left */
        .weapon-container {
          position: absolute;
          bottom: 40px;
          left: 20px;
          display: flex;
          align-items: center;
        }

        .weapon-image {
          width: 80px;
          height: 80px;
          margin-right: 10px;
          display: flex;
          justify-content: center;
          align-items: center;
          background-color: rgba(0, 128, 2, 0.3);
        }

        .weapon-details {
          display: flex;
          flex-direction: column;
        }

        .weapon-name {
          font-size: 18px;
          font-weight: bold;
          margin-bottom: 5px;
        }

        .weapon-ammo {
          font-size: 16px;
        }

        /* Center weapon sprite */
        .center-weapon-sprite {
          position: absolute;
          bottom: 0px;
          left: 50%;
          transform: translateX(-50%);
          width: 320px;
          height: 320px;
          display: flex;
          justify-content: center;
          align-items: center;
        }

        .weapon-wrapper {
          width: 100%;
          height: 100%;
          display: flex;
          justify-content: center;
          align-items: flex-end;
        }

        .weapon-inner {
          display: flex;
          justify-content: center;
          align-items: center;
        }

        /* Bottom right container */
        .bottom-right-container {
          position: absolute;
          bottom: 40px;
          right: 20px;
          display: flex;
          align-items: flex-end;
        }

        .resource-counters {
          margin-right: 15px;
          text-align: right;
        }

        .cores-count,
        .scrap-count {
          font-size: 16px;
          margin-bottom: 5px;
        }

        .minimap-container {
          width: 120px;
          height: 120px;
          background-color: #ff0000; /* Red placeholder */
          border-radius: 50%;
          overflow: hidden;
        }

        /* Crosshair */
        .crosshair {
          position: absolute;
          top: 51.5%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: 24px;
          color: #ff0000;
        }

        /* CRT scan line effect on images */
        :global(.weapon-side-image),
        :global(.weapon-fps-image) {
          pointer-events: none;
          filter: brightness(1.2) contrast(1.1) saturate(1.1);
          image-rendering: pixelated;
        }

        /* Weapon animation classes */
        :global(.weapon-recoil) {
          animation: recoil 0.15s ease-out forwards !important;
          transform-origin: center bottom;
        }

        :global(.weapon-walking) {
          animation: weaponSway 1s infinite ease-in-out !important;
          transform-origin: center bottom;
        }

        :global(.weapon-switching) {
          animation: weaponSwitching 0.5s ease-out forwards !important;
        }

        @keyframes recoil {
          0% {
            transform: translateY(0) rotateX(0);
          }
          20% {
            transform: translateY(15px) rotateX(10deg);
          }
          100% {
            transform: translateY(0) rotateX(0);
          }
        }

        @keyframes weaponSway {
          0% {
            transform: translateY(0) rotate(0deg);
          }
          25% {
            transform: translateY(5px) rotate(-1deg);
          }
          75% {
            transform: translateY(3px) rotate(1deg);
          }
          100% {
            transform: translateY(0) rotate(0deg);
          }
        }

        @keyframes weaponSwitching {
          0% {
            transform: translateY(150px);
            opacity: 0;
          }
          70% {
            transform: translateY(-20px);
            opacity: 1;
          }
          100% {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

export default CustomGameUI;
