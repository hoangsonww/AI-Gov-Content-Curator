"use client";

/**
 * LandingBackground3D
 * --------------------
 * A persistent, full-page WebGL backdrop for the SynthoraAI landing page.
 *
 * Design intent: a deep-space "intelligence command-center" field of glowing
 * data points arranged as an orbiting globe inside an ambient cloud, wrapped in
 * a faint wireframe icosahedron. The whole scene is driven entirely by
 * procedural geometry and hand-written GLSL — NO binary assets (no models,
 * no textures, no images). Point sprites are drawn analytically in the
 * fragment shader.
 *
 * Interactivity:
 *  - Cursor: eases camera parallax + bends the field toward/away from the pointer.
 *  - Scroll: rotates and dollies the scene and morphs the particle distribution
 *    and color ramp as the visitor travels down the page.
 *
 * The canvas is fixed to the viewport (see .landing-bg-3d in landing.css) so a
 * single living scene spans the entire page, not just the hero.
 */

import { type MutableRefObject, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

/* ------------------------------------------------------------------ */
/* Shaders                                                            */
/* ------------------------------------------------------------------ */

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uScroll;
  uniform vec2  uMouse;
  uniform float uSize;
  uniform float uPixelRatio;

  attribute float aScale;
  attribute float aSeed;

  uniform vec3 uColorA; // deep teal
  uniform vec3 uColorB; // gold
  uniform vec3 uColorC; // ice highlight

  varying vec3  vColor;
  varying float vFade;

  void main() {
    vec3 p = position;

    // Organic flow — cheap, stable trig turbulence (no noise texture needed).
    float t = uTime * 0.18;
    float s = aSeed * 6.2831853;
    p.x += sin(t + s + position.z * 0.45) * 1.25;
    p.y += cos(t * 0.92 + s + position.x * 0.40) * 1.20;
    p.z += sin(t * 0.74 + s + position.y * 0.35) * 1.05;

    // Breathing expansion as the page scrolls.
    p *= 1.0 + uScroll * 0.28;

    // Pointer field: points lean toward the cursor, near ones lean more.
    vec2 m = uMouse * 6.0;
    float pull = 1.0 / (1.0 + length(p.xy - m) * 0.18);
    p.xy += (m - p.xy) * pull * 0.10;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);

    // Perspective-attenuated sprite size.
    gl_PointSize = uSize * aScale * uPixelRatio * (12.0 / -mv.z);
    gl_Position = projectionMatrix * mv;

    // Color ramp by height + scroll, with occasional ice-white sparkles.
    float h = clamp((p.y + 9.0) / 18.0, 0.0, 1.0);
    vec3 col = mix(uColorA, uColorB, smoothstep(0.15, 0.95, h + uScroll * 0.25));
    col = mix(col, uColorC, smoothstep(0.82, 1.0, aSeed));
    vColor = col;

    // Fade distant points so depth reads cleanly.
    vFade = smoothstep(-28.0, -4.0, mv.z);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;
  uniform float uOpacity;
  varying vec3  vColor;
  varying float vFade;

  void main() {
    // Soft round glow drawn analytically from the point coord.
    float d = length(gl_PointCoord - vec2(0.5));
    float core = smoothstep(0.5, 0.0, d);
    float halo = smoothstep(0.5, 0.18, d) * 0.55;
    float alpha = (pow(core, 1.7) + halo) * vFade * uOpacity;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(vColor, alpha);
  }
`;

/* ------------------------------------------------------------------ */
/* Adaptive quality — keep low-GPU / mobile devices smooth            */
/* ------------------------------------------------------------------ */

/**
 * Particle GPU cost is dominated by overdraw (large additive sprites) and
 * fill rate (pixels × devicePixelRatio). We scale point count, sprite size,
 * DPR cap, antialiasing and the wireframe by a device tier so weak phones
 * still run smoothly while desktops stay lush.
 */
type Quality = {
  count: number;
  size: number;
  dpr: number;
  aa: boolean;
  wire: number; // icosahedron detail; -1 disables the wireframe
};

const QUALITY: Record<"high" | "mid" | "low" | "min", Quality> = {
  high: { count: 5200, size: 3.0, dpr: 1.75, aa: true, wire: 1 },
  mid: { count: 3200, size: 2.7, dpr: 1.5, aa: true, wire: 1 },
  low: { count: 1800, size: 2.5, dpr: 1.25, aa: false, wire: 0 },
  min: { count: 1000, size: 2.3, dpr: 1.0, aa: false, wire: -1 },
};

function pickQuality(): Quality {
  if (typeof window === "undefined") return QUALITY.high;
  const w = window.innerWidth;
  const dm = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  const cores = navigator.hardwareConcurrency || 4;
  const coarse =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches;
  const mobile = coarse || w < 820;

  if ((dm && dm <= 2) || (mobile && cores <= 3)) return QUALITY.min;
  if (mobile) return QUALITY.low;
  if ((dm && dm <= 4) || cores <= 4 || w < 1280) return QUALITY.mid;
  return QUALITY.high;
}

/* ------------------------------------------------------------------ */
/* Particle field                                                     */
/* ------------------------------------------------------------------ */

function Field({
  pointer,
  scroll,
  reduced,
  quality,
}: {
  pointer: MutableRefObject<{ x: number; y: number }>;
  scroll: MutableRefObject<number>;
  reduced: boolean;
  quality: Quality;
}) {
  const COUNT = quality.count;
  const groupRef = useRef<THREE.Group>(null);

  // Eased interaction state (kept in refs so it survives re-renders).
  const eMouse = useRef({ x: 0, y: 0 });
  const eScroll = useRef(0);
  const clock = useRef(0);

  // Build geometry once: a point-globe shell wrapped in an ambient cloud.
  const geometry = useMemo(() => {
    const positions = new Float32Array(COUNT * 3);
    const scales = new Float32Array(COUNT);
    const seeds = new Float32Array(COUNT);
    const shell = Math.floor(COUNT * 0.55);

    for (let i = 0; i < COUNT; i++) {
      let x: number, y: number, z: number;
      if (i < shell) {
        // Fibonacci-ish sphere shell -> reads as an orbiting data globe.
        const u = Math.random();
        const v = Math.random();
        const theta = 2 * Math.PI * u;
        const phi = Math.acos(2 * v - 1);
        const r = 7 + (Math.random() - 0.5) * 0.9;
        x = r * Math.sin(phi) * Math.cos(theta);
        y = r * Math.cos(phi);
        z = r * Math.sin(phi) * Math.sin(theta);
      } else {
        // Ambient volumetric cloud for depth and atmosphere.
        x = (Math.random() - 0.5) * 28;
        y = (Math.random() - 0.5) * 20;
        z = (Math.random() - 0.5) * 22 - 4;
      }
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      scales[i] = 0.4 + Math.random() * 1.6;
      seeds[i] = Math.random();
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("aScale", new THREE.BufferAttribute(scales, 1));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
    return g;
  }, [COUNT]);

  const material = useMemo(() => {
    const dpr =
      typeof window !== "undefined"
        ? Math.min(window.devicePixelRatio || 1, quality.dpr)
        : 1;
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uScroll: { value: 0 },
        uMouse: { value: new THREE.Vector2(0, 0) },
        uSize: { value: quality.size },
        uPixelRatio: { value: dpr },
        uOpacity: { value: 0.95 },
        uColorA: { value: new THREE.Color("#1f8a70") },
        uColorB: { value: new THREE.Color("#f4b860") },
        uColorC: { value: new THREE.Color("#cdf6ee") },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, [quality]);

  // Faint structural wireframe aligned to the point-globe radius.
  // Skipped entirely on the weakest tier to drop a draw call + overdraw.
  const edges = useMemo(
    () =>
      quality.wire >= 0
        ? new THREE.EdgesGeometry(
            new THREE.IcosahedronGeometry(7.6, quality.wire),
          )
        : null,
    [quality.wire],
  );

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
      edges?.dispose();
    };
  }, [geometry, material, edges]);

  useFrame((state, delta) => {
    if (typeof document !== "undefined" && document.hidden) return;
    const mat = material;
    const group = groupRef.current;
    if (!group) return;

    // Advance time (frozen when the visitor prefers reduced motion).
    clock.current += reduced ? 0 : Math.min(delta, 0.05);
    mat.uniforms.uTime.value = clock.current;

    // Ease pointer + scroll toward their targets for buttery motion.
    const lerp = reduced ? 1 : 0.05;
    eMouse.current.x += (pointer.current.x - eMouse.current.x) * lerp;
    eMouse.current.y += (pointer.current.y - eMouse.current.y) * lerp;
    eScroll.current +=
      (scroll.current - eScroll.current) * (reduced ? 1 : 0.06);

    mat.uniforms.uMouse.value.set(eMouse.current.x, eMouse.current.y);
    mat.uniforms.uScroll.value = eScroll.current;

    // Camera parallax follows the cursor.
    const cam = state.camera;
    cam.position.x += (eMouse.current.x * 3.5 - cam.position.x) * lerp;
    cam.position.y += (-eMouse.current.y * 2.4 - cam.position.y) * lerp;
    cam.position.z = 15 - eScroll.current * 3.2;
    cam.lookAt(0, 0, 0);

    // The whole scene drifts, then tilts with cursor and unwinds on scroll.
    group.rotation.y =
      clock.current * 0.04 + eMouse.current.x * 0.35 + eScroll.current * 1.3;
    group.rotation.x = eMouse.current.y * 0.16 + eScroll.current * 0.35;
  });

  return (
    <group ref={groupRef}>
      <points geometry={geometry} material={material} />
      {edges && (
        <lineSegments geometry={edges}>
          <lineBasicMaterial
            color="#2fe0c0"
            transparent
            opacity={0.1}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </lineSegments>
      )}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Canvas wrapper                                                     */
/* ------------------------------------------------------------------ */

export default function LandingBackground3D() {
  const pointer = useRef({ x: 0, y: 0 });
  const scroll = useRef(0);
  const reducedRef = useRef(false);

  // Pick a device tier once on mount (client-only; this component is ssr:false).
  const quality = useMemo(() => pickQuality(), []);

  useEffect(() => {
    reducedRef.current =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const onPointer = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      scroll.current = max > 0 ? Math.min(window.scrollY / max, 1) : 0;
    };
    // Subtle device-orientation parallax on touch devices.
    const onOrient = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      pointer.current.x = Math.max(-1, Math.min(1, e.gamma / 35));
      pointer.current.y = Math.max(-1, Math.min(1, (e.beta - 45) / 35));
    };

    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("deviceorientation", onOrient);
    onScroll();
    return () => {
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("deviceorientation", onOrient);
    };
  }, []);

  return (
    <div className="landing-bg-3d" aria-hidden="true">
      <Canvas
        camera={{ position: [0, 0, 15], fov: 62 }}
        dpr={[1, quality.dpr]}
        gl={{
          antialias: quality.aa,
          alpha: true,
          // Low tiers favor battery/thermals over raw speed.
          powerPreference:
            quality.count >= QUALITY.mid.count
              ? "high-performance"
              : "low-power",
          failIfMajorPerformanceCaveat: false,
        }}
        onCreated={({ gl }) => {
          // Don't hard-crash on a transient context loss (common on mobile
          // when backgrounding); let the browser restore it.
          gl.domElement.addEventListener(
            "webglcontextlost",
            (e) => e.preventDefault(),
            false,
          );
        }}
        style={{ width: "100%", height: "100%" }}
      >
        <Field
          pointer={pointer}
          scroll={scroll}
          reduced={reducedRef.current}
          quality={quality}
        />
      </Canvas>
      <div className="landing-bg-3d__vignette" />
    </div>
  );
}
