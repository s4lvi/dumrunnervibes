"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import "./LandingPage.css";

export default function LandingPage() {
  const router = useRouter();
  const [typing, setTyping] = useState(true);
  const [displayText, setDisplayText] = useState("");
  const [showButton, setShowButton] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const terminalRef = useRef(null);

  // Text to be typed out
  const fullText = `
  > INITIALIZING DUM RUNNER v0.7.5...\n
  > MAINFRAME STATUS: COMPROMISED
  > DUM GRID INTEGRITY: 73%
  > ENEMY AGENTS: DETECTED\n
  > Welcome to the DUM 
  > The razor edge of cyberspace.
  > You are the last defense against the rogue AI that has taken control of the system.
  > Jack in and ride the bitstream. Trace the signal, hack the nodes, and battle worms, rogue AIs, and viral code—then exfil with your hard‑won loot.
  > But the system is aware. It's coming for you.
  > Wave after wave will crash against your host. Seize their AI cores, convert them into defense towers, and hold the line around your mainframe.
  > Welcome to the machine, DUM RUNNER \n
  > ARE YOU READY TO ENTER THE GRID?`;

  // Typing effect
  useEffect(() => {
    let currentIndex = 0;
    let timeout = null;

    const typeNextCharacter = () => {
      if (currentIndex <= fullText.length) {
        setDisplayText(fullText.substring(0, currentIndex));
        currentIndex++;

        // Scroll to the bottom as text is typed
        if (terminalRef.current) {
          terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }

        // Random typing speed between 20ms and 50ms
        const typingSpeed = 20 + Math.random() * 30;
        timeout = setTimeout(typeNextCharacter, typingSpeed);
      } else {
        setTyping(false);
        setTimeout(() => setShowButton(true), 500);
      }
    };

    if (typing) {
      // Start the typing animation
      timeout = setTimeout(typeNextCharacter, 100);
    }

    // Cleanup function
    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [typing, fullText]);

  // Click to skip animation
  const handleScreenClick = () => {
    if (typing) {
      setDisplayText(fullText);
      setTyping(false);
      setTimeout(() => setShowButton(true), 200);
    }
  };

  // Handle the navigation with transition effect
  const handleEnterGrid = () => {
    if (isTransitioning) return;

    setIsTransitioning(true);

    // Create a black overlay that stays during page transition
    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.width = "100vw";
    overlay.style.height = "100vh";
    overlay.style.backgroundColor = "black";
    overlay.style.zIndex = "9999";
    overlay.style.opacity = "0";
    overlay.style.transition = "opacity 0.5s ease-in-out";
    document.body.appendChild(overlay);

    // Add the CRT off animation class
    const container = document.querySelector(".terminal-container");
    if (container) {
      container.classList.add("crt-off");
    }

    // Fade in the black overlay
    setTimeout(() => {
      overlay.style.opacity = "1";
    }, 100);

    // Navigate using a hard reload instead of client-side navigation
    // This ensures a clean state for Three.js initialization
    setTimeout(() => {
      window.location.href = "/game";
    }, 500); // Time slightly longer than animation duration
  };

  return (
    <div className="terminal-container" onClick={handleScreenClick}>
      <div className="terminal-overlay">
        <div className="scan-line"></div>
        <div className="glow"></div>
      </div>

      <div className="terminal-header">
        <div className="terminal-title">DUM RUNNER</div>
        <div className="terminal-controls">
          <div className="control"></div>
          <div className="control"></div>
          <div className="control"></div>
        </div>
      </div>

      <div className="terminal-screen" ref={terminalRef}>
        <div className="text-container">
          <pre className="terminal-text">{displayText}</pre>
          {typing && <span className="cursor blink">█</span>}
        </div>

        {showButton && (
          <div className="button-container">
            <button
              className="play-button"
              onClick={handleEnterGrid}
              disabled={isTransitioning}
            >
              <span className="button-text">[ ENTER THE GRID ]</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
