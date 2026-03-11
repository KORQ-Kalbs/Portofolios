/**
 * LightContext.jsx — Shared Celestial Light State
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Menyediakan data cahaya utama (sun/moon dari Hero) ke seluruh section
 * di bawahnya (About, Projects, Contact).
 *
 * CARA KERJA:
 *   App.jsx subscribe ke hero scroll event bus → update context.
 *   About.jsx dan Projects.jsx consume context untuk Three.js lighting.
 *
 * DATA YANG DIBAGIKAN:
 *   pos       {THREE.Vector3-like} — posisi sun/moon di world space
 *   color     {[r,g,b]}           — warna cahaya (warm=sun, cool=moon)
 *   intensity {number}            — intensitas base (tanpa scroll mult)
 *   dayBlend  {number}            — 0=night, 1=day
 *   phase     {string}            — "night"|"dawn"|"day"|"dusk"
 *
 * PATTERN: Context + useRef untuk avoid re-render tiap frame.
 * Komponen consumer pakai useLightRef() yang return ref, bukan state.
 * Ini penting karena light data di-update setiap frame dari rAF loop.
 */

import { createContext, useContext, useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULT VALUES (malam hari — aman sebagai initial state)
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_LIGHT = {
  pos: { x: 7, y: 10, z: -20 } /* posisi bulan default             */,
  color: [0.73, 0.84, 0.67] /* cool white-green (moon)          */,
  intensity: 5.5 /* base intensity                   */,
  dayBlend: 0.0 /* 0=malam                          */,
  phase: "night",
};

// ─────────────────────────────────────────────────────────────────────────────
// CONTEXT DEFINITION
// ─────────────────────────────────────────────────────────────────────────────
const LightContext = createContext({
  light: DEFAULT_LIGHT,
  lightRef: { current: DEFAULT_LIGHT } /* untuk akses tanpa re-render      */,
  setLight: () => {},
});

// ─────────────────────────────────────────────────────────────────────────────
// PROVIDER
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Bungkus di App.jsx di atas semua section.
 *
 * @param {ReactNode} children
 */
export const LightProvider = ({ children }) => {
  /* State untuk render-triggering subscribers (misal: UI indicator)      */
  const [light, setLightState] = useState(DEFAULT_LIGHT);

  /* Ref untuk THREE.js rAF loops yang tidak butuh re-render              */
  const lightRef = useRef(DEFAULT_LIGHT);

  /**
   * Update light data.
   * Update ref setiap saat (synchronous, tanpa re-render).
   * State hanya di-update jika phase berubah (sekali per transisi, tidak per frame).
   */
  const setLight = (newLight) => {
    /* Ref selalu sync — dipakai oleh Three.js rAF loop */
    lightRef.current = { ...lightRef.current, ...newLight };

    /* State hanya jika phase berubah agar tidak spam re-render */
    setLightState((prev) => {
      if (
        prev.phase !== (newLight.phase ?? prev.phase) ||
        Math.abs(prev.dayBlend - (newLight.dayBlend ?? prev.dayBlend)) > 0.05
      ) {
        return { ...prev, ...newLight };
      }
      return prev;
    });
  };

  return (
    <LightContext.Provider value={{ light, lightRef, setLight }}>
      {children}
    </LightContext.Provider>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// HOOKS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hook untuk THREE.js components yang butuh real-time light data.
 * Mengembalikan ref (bukan state) → tidak trigger re-render per frame.
 * @returns {{ current: LightData }} ref object
 */
export const useLightRef = () => useContext(LightContext).lightRef;

/**
 * Hook untuk UI components yang butuh react ke phase change.
 * @returns {{ light: LightData, setLight: Function }}
 */
export const useLight = () => {
  const { light, setLight } = useContext(LightContext);
  return { light, setLight };
};

/**
 * Hook untuk App.jsx yang perlu update light (emitter).
 * @returns {Function} setLight
 */
export const useLightSetter = () => useContext(LightContext).setLight;

export default LightContext;
