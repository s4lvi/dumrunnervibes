// audioManager.js - Centralized audio system for DUM RUNNER
import { create } from "zustand";

// Check if we're in a browser environment
const isBrowser = typeof window !== "undefined";

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
class AudioNormalizer {
  constructor() {
    this.audioContext = null;
    this.normalizationFactors = {};
    this.targetRMS = 0.2; // Target RMS level for normalization

    // Initialize audio context if in browser
    if (isBrowser) {
      try {
        window.AudioContext = window.AudioContext || window.webkitAudioContext;
        this.audioContext = new AudioContext();
      } catch (e) {
        console.warn("Web Audio API not supported in this browser");
      }
    }
  }

  // Calculate RMS (Root Mean Square) volume of an audio buffer
  calculateRMS(audioBuffer) {
    const channels = audioBuffer.numberOfChannels;
    let rms = 0;

    // Process each channel
    for (let c = 0; c < channels; c++) {
      const data = audioBuffer.getChannelData(c);
      let sum = 0;

      // Sum of squares of all samples
      for (let i = 0; i < data.length; i++) {
        sum += data[i] * data[i];
      }

      // Average RMS across all channels
      rms += Math.sqrt(sum / data.length);
    }

    return rms / channels;
  }

  // Analyze audio to determine normalization factor
  async analyzeAudio(url, key) {
    if (!this.audioContext) return 1.0;

    try {
      // Fetch the audio file
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();

      // Decode the audio data
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

      // Calculate RMS volume
      const rms = this.calculateRMS(audioBuffer);

      // Calculate normalization factor (how much to multiply to reach target)
      const factor = rms > 0 ? this.targetRMS / rms : 1.0;

      // Store the factor for this sound
      this.normalizationFactors[key] = factor;

      console.log(`Normalized ${key}: factor ${factor.toFixed(2)}`);
      return factor;
    } catch (e) {
      console.warn(`Failed to analyze audio ${key}: ${e.message}`);
      return 1.0;
    }
  }

  // Get normalization factor for a sound
  getNormalizationFactor(key) {
    return this.normalizationFactors[key] || 1.0;
  }
}

const audioNormalizer = isBrowser ? new AudioNormalizer() : null;

// Audio store using Zustand for state management
export const useAudioStore = create((set, get) => ({
  // Audio settings
  masterVolume: 1.0,
  musicVolume: 1.0,
  sfxVolume: 1.0,
  isMuted: false,

  // Currently playing background music
  currentMusic: null,

  // Audio cache
  soundCache: {},
  musicCache: {},

  normalizationFactors: {},
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
  loadSound: async (key, url) => {
    // Skip if not in browser or sound already cached
    if (!isBrowser) return;

    const state = get();
    if (state.soundCache[key]) return;

    try {
      // Analyze the audio if possible to determine normalization factor
      let normalizationFactor = 1.0;
      if (audioNormalizer) {
        normalizationFactor = await audioNormalizer.analyzeAudio(url, key);
      }

      // Load the actual audio element
      const audio = new Audio(url);
      audio.preload = "auto";

      // Store both the audio and its normalization factor
      state.soundCache[key] = audio;
      state.normalizationFactors[key] = normalizationFactor;

      set({
        soundCache: { ...state.soundCache },
        normalizationFactors: { ...state.normalizationFactors },
      });
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

      // Get normalization factor for this sound
      const factor = state.normalizationFactors[key] || 1.0;

      // Apply normalized volume with clamping
      const baseVolume = state.isMuted
        ? 0
        : state.masterVolume * state.sfxVolume;
      sound.volume = clamp(baseVolume * factor, 0, 0.25); // Ensure volume is between 0 and 1
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
  loadMusic: async (key, url) => {
    if (!isBrowser) return;

    const state = get();
    if (state.musicCache[key]) return;

    try {
      // Analyze the audio if possible
      let normalizationFactor = 1.0;
      if (audioNormalizer) {
        normalizationFactor = await audioNormalizer.analyzeAudio(url, key);
      }

      const audio = new Audio(url);
      audio.loop = true;
      audio.preload = "auto";

      // Apply normalized volume
      const baseVolume = state.isMuted
        ? 0
        : state.masterVolume * state.musicVolume;
      audio.volume = baseVolume * normalizationFactor;

      state.musicCache[key] = audio;
      state.normalizationFactors[key] = normalizationFactor;

      set({
        musicCache: { ...state.musicCache },
        normalizationFactors: { ...state.normalizationFactors },
      });
    } catch (error) {
      console.warn(`Failed to load music ${key}: ${error.message}`);
    }
  },

  // Modify playMusic to apply normalization
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

      // Apply normalized volume

      const factor = state.normalizationFactors[key] || 1.0;
      const baseVolume = state.isMuted
        ? 0
        : state.masterVolume * state.musicVolume;
      newMusic.volume = clamp(baseVolume * factor, 0, 1);

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
