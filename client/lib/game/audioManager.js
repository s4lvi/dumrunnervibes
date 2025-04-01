// audioManager.js - Centralized audio system for DUM RUNNER
import { create } from "zustand";

// Check if we're in a browser environment
const isBrowser = typeof window !== "undefined";

// Audio store using Zustand for state management
export const useAudioStore = create((set, get) => ({
  // Audio settings
  masterVolume: 0.7,
  musicVolume: 0.5,
  sfxVolume: 0.8,
  isMuted: false,

  // Currently playing background music
  currentMusic: null,

  // Audio cache
  soundCache: {},
  musicCache: {},

  // Methods to control audio
  setMasterVolume: (volume) => {
    set({ masterVolume: volume });
    // Update all currently playing audio
    const state = get();
    const actualVolume = state.isMuted ? 0 : volume;

    // Update music volume
    if (state.currentMusic) {
      state.currentMusic.volume = actualVolume * state.musicVolume;
    }
  },

  setMusicVolume: (volume) => {
    set({ musicVolume: volume });
    // Update current music if playing
    const state = get();
    if (state.currentMusic && !state.isMuted) {
      state.currentMusic.volume = state.masterVolume * volume;
    }
  },

  setSfxVolume: (volume) => {
    set({ sfxVolume: volume });
  },

  toggleMute: () => {
    const state = get();
    const newMuted = !state.isMuted;
    set({ isMuted: newMuted });

    // Mute/unmute current music
    if (state.currentMusic) {
      state.currentMusic.volume = newMuted
        ? 0
        : state.masterVolume * state.musicVolume;
    }

    return newMuted;
  },

  // Load and cache a sound
  loadSound: (key, url) => {
    // Skip if not in browser or sound already cached
    if (!isBrowser) return;

    const state = get();
    if (state.soundCache[key]) return;

    try {
      const audio = new Audio(url);
      audio.preload = "auto";
      state.soundCache[key] = audio;
      set({ soundCache: { ...state.soundCache } });
    } catch (error) {
      console.warn(`Failed to load sound ${key}: ${error.message}`);
    }
  },

  // Play a sound effect
  playSound: (key) => {
    if (!isBrowser) return;

    const state = get();
    if (!state.soundCache[key]) return;

    try {
      // Create a new instance to allow overlapping sounds
      const sound = state.soundCache[key].cloneNode();
      sound.volume = state.isMuted ? 0 : state.masterVolume * state.sfxVolume;
      sound
        .play()
        .catch((err) =>
          console.warn(`Error playing sound ${key}: ${err.message}`)
        );
    } catch (error) {
      console.warn(`Error playing sound ${key}: ${error.message}`);
    }
  },

  // Load and cache background music
  loadMusic: (key, url) => {
    if (!isBrowser) return;

    const state = get();
    if (state.musicCache[key]) return;

    try {
      const audio = new Audio(url);
      audio.loop = true;
      audio.preload = "auto";
      audio.volume = state.isMuted ? 0 : state.masterVolume * state.musicVolume;

      state.musicCache[key] = audio;
      set({ musicCache: { ...state.musicCache } });
    } catch (error) {
      console.warn(`Failed to load music ${key}: ${error.message}`);
    }
  },

  // Play background music with smooth transition
  playMusic: (key, fadeTime = 1000) => {
    if (!isBrowser) return;

    const state = get();
    if (!state.musicCache[key]) return;

    const newMusic = state.musicCache[key];
    const oldMusic = state.currentMusic;

    // If same music is already playing, do nothing
    if (oldMusic === newMusic) return;

    // Fade out current music if playing
    if (oldMusic) {
      const fadeOutInterval = setInterval(() => {
        if (oldMusic.volume <= 0.05) {
          oldMusic.pause();
          oldMusic.currentTime = 0;
          clearInterval(fadeOutInterval);
        } else {
          oldMusic.volume -= 0.05;
        }
      }, fadeTime / 20);
    }

    try {
      // Reset and play new music
      newMusic.currentTime = 0;
      newMusic.volume = state.isMuted
        ? 0
        : state.masterVolume * state.musicVolume;
      newMusic
        .play()
        .catch((err) =>
          console.warn(`Error playing music ${key}: ${err.message}`)
        );

      set({ currentMusic: newMusic });
    } catch (error) {
      console.warn(`Error playing music ${key}: ${error.message}`);
    }
  },

  // Stop all music
  stopMusic: (fadeTime = 1000) => {
    if (!isBrowser) return;

    const state = get();
    const music = state.currentMusic;

    if (!music) return;

    // Fade out
    const fadeOutInterval = setInterval(() => {
      if (music.volume <= 0.05) {
        music.pause();
        music.currentTime = 0;
        clearInterval(fadeOutInterval);
        set({ currentMusic: null });
      } else {
        music.volume -= 0.05;
      }
    }, fadeTime / 20);
  },
}));

// Initialize and preload all game audio
export function initializeAudio() {
  // Skip if not in browser
  if (!isBrowser) {
    console.warn("Audio initialization skipped (not in browser environment)");
    return null;
  }

  const audioStore = useAudioStore.getState();

  // Preload sound effects
  const soundEffects = {
    // UI Sounds
    "ui-click": "/sounds/ui-click.mp3",
    "ui-hover": "/sounds/ui-hover.mp3",
    "ui-back": "/sounds/ui-back.mp3",

    // Player sounds
    "player-shoot": "/sounds/player-shoot.mp3",
    "player-hit": "/sounds/player-hit.mp3",
    "player-jump": "/sounds/player-jump.mp3",
    "player-footstep": "/sounds/player-footstep.mp3",
    "player-sprint": "/sounds/player-sprint.mp3",

    // Robot sounds
    "robot-hit": "/sounds/robot-hit.mp3",
    "robot-destroy": "/sounds/robot-destroy.mp3",
    "robot-detect": "/sounds/robot-detect.mp3",
    "robot-attack": "/sounds/robot-attack.mp3",

    // Item collection
    "collect-scrap": "/sounds/collect-scrap.mp3",
    "collect-core": "/sounds/collect-core.mp3",

    // Tower defense
    "tower-place": "/sounds/tower-place.mp3",
    "tower-shoot": "/sounds/tower-shoot.mp3",
    "tower-laser": "/sounds/tower-laser.mp3",
    "tower-tesla": "/sounds/tower-tesla.mp3",
    "tower-cannon": "/sounds/tower-cannon.mp3",
    "wave-start": "/sounds/wave-start.mp3",
    "wave-complete": "/sounds/wave-complete.mp3",
    "base-hit": "/sounds/base-hit.mp3",

    // Game state
    "game-over": "/sounds/game-over.mp3",
    "mode-switch": "/sounds/mode-switch.mp3",
  };

  // Preload background music
  const backgroundMusic = {
    "dungeon-music": "/music/dungeon-theme.mp3",
    "defense-music": "/music/defense-theme.mp3",
    "menu-music": "/music/menu-theme.mp3",
    "boss-music": "/music/boss-theme.mp3",
  };

  // Load all sound effects
  Object.entries(soundEffects).forEach(([key, url]) => {
    audioStore.loadSound(key, url);
  });

  // Load all music
  Object.entries(backgroundMusic).forEach(([key, url]) => {
    audioStore.loadMusic(key, url);
  });

  console.log("Audio system initialized");

  // Return the store for immediate use
  return audioStore;
}

// Check if we need to lazy initialize browser-only features
let audioManagerInstance = null;

// Singleton audio manager for direct imperative access
class AudioManager {
  constructor() {
    // Only create the instance if in browser
    if (isBrowser) {
      this.store = useAudioStore;
      this.initialized = false;
    } else {
      // Create a dummy store for SSR
      this.store = {
        getState: () => ({
          playSound: () => {},
          playMusic: () => {},
          stopMusic: () => {},
          masterVolume: 0.7,
          musicVolume: 0.5,
          sfxVolume: 0.8,
          isMuted: false,
          setMasterVolume: () => {},
          setMusicVolume: () => {},
          setSfxVolume: () => {},
          toggleMute: () => false,
        }),
      };
    }
  }

  // Lazy initialization to avoid SSR issues
  init() {
    if (isBrowser && !this.initialized) {
      initializeAudio();
      this.initialized = true;
    }
    return this;
  }

  // Sound effect methods
  playUI(sound) {
    if (!this.initialized && isBrowser) this.init();
    this.store.getState().playSound(`ui-${sound}`);
  }

  playPlayerSound(sound) {
    if (!this.initialized && isBrowser) this.init();
    this.store.getState().playSound(`player-${sound}`);
  }

  playRobotSound(sound) {
    if (!this.initialized && isBrowser) this.init();
    this.store.getState().playSound(`robot-${sound}`);
  }

  playCollectSound(sound) {
    if (!this.initialized && isBrowser) this.init();
    this.store.getState().playSound(`collect-${sound}`);
  }

  playTowerSound(sound) {
    if (!this.initialized && isBrowser) this.init();
    this.store.getState().playSound(`tower-${sound}`);
  }

  playGameSound(sound) {
    if (!this.initialized && isBrowser) this.init();
    this.store.getState().playSound(sound);
  }

  // Music control
  playDungeonMusic() {
    if (!this.initialized && isBrowser) this.init();
    this.store.getState().playMusic("dungeon-music");
  }

  playDefenseMusic() {
    if (!this.initialized && isBrowser) this.init();
    this.store.getState().playMusic("defense-music");
  }

  playMenuMusic() {
    if (!this.initialized && isBrowser) this.init();
    this.store.getState().playMusic("menu-music");
  }

  playBossMusic() {
    if (!this.initialized && isBrowser) this.init();
    this.store.getState().playMusic("boss-music");
  }

  stopMusic() {
    if (!this.initialized && isBrowser) this.init();
    this.store.getState().stopMusic();
  }

  // Settings
  getMasterVolume() {
    if (!this.initialized && isBrowser) this.init();
    return this.store.getState().masterVolume;
  }

  getMusicVolume() {
    if (!this.initialized && isBrowser) this.init();
    return this.store.getState().musicVolume;
  }

  getSfxVolume() {
    if (!this.initialized && isBrowser) this.init();
    return this.store.getState().sfxVolume;
  }

  setMasterVolume(volume) {
    if (!this.initialized && isBrowser) this.init();
    this.store.getState().setMasterVolume(volume);
  }

  setMusicVolume(volume) {
    if (!this.initialized && isBrowser) this.init();
    this.store.getState().setMusicVolume(volume);
  }

  setSfxVolume(volume) {
    if (!this.initialized && isBrowser) this.init();
    this.store.getState().setSfxVolume(volume);
  }

  toggleMute() {
    if (!this.initialized && isBrowser) this.init();
    return this.store.getState().toggleMute();
  }

  isMuted() {
    if (!this.initialized && isBrowser) this.init();
    return this.store.getState().isMuted;
  }
}

// Create singleton instance with lazy initialization
const audioManager = isBrowser
  ? audioManagerInstance || (audioManagerInstance = new AudioManager().init())
  : new AudioManager();

export default audioManager;
