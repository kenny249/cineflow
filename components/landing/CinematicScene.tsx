"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

// ─── helpers ────────────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
function easeOut(t: number, p = 3) { return 1 - Math.pow(1 - t, p); }
function easeInOut(t: number) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }
function phase(prog: number, start: number, end: number) {
  return clamp((prog - start) / (end - start), 0, 1);
}

// ─── procedural film objects ─────────────────────────────────────────────────

function makeCameraBody(): THREE.Group {
  const g = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x111116, metalness: 0.25, roughness: 0.82 });
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0x44444e, metalness: 0.88, roughness: 0.18 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xd4a853, metalness: 0.95, roughness: 0.06 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x081830, metalness: 0.05, roughness: 0.0, transparent: true, opacity: 0.72 });
  const rubberMat = new THREE.MeshStandardMaterial({ color: 0x070709, metalness: 0.0, roughness: 1.0 });

  // Main body
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.85, 1.28, 2.7), bodyMat);
  g.add(body);

  // Lens mount ring
  const mountGeo = new THREE.CylinderGeometry(0.46, 0.49, 0.14, 48);
  mountGeo.rotateX(Math.PI / 2);
  const mount = new THREE.Mesh(mountGeo, chromeMat);
  mount.position.z = 1.36;
  g.add(mount);

  // Lens barrel segments
  const barrelData = [
    { r: 0.38, len: 0.55, z: 1.85 },
    { r: 0.35, len: 0.45, z: 2.32 },
    { r: 0.31, len: 0.22, z: 2.61 },
  ];
  barrelData.forEach(({ r, len, z }, i) => {
    const geo = new THREE.CylinderGeometry(r, r + 0.015, len, 40);
    geo.rotateX(Math.PI / 2);
    const mat = i === 0 ? chromeMat : bodyMat;
    const m = new THREE.Mesh(geo, mat);
    m.position.z = z;
    g.add(m);
  });

  // Gold focus ring
  const focusRingGeo = new THREE.TorusGeometry(0.42, 0.028, 10, 56);
  focusRingGeo.rotateX(Math.PI / 2);
  const focusRing = new THREE.Mesh(focusRingGeo, goldMat);
  focusRing.position.z = 2.05;
  g.add(focusRing);

  // Front glass
  const glassDisc = new THREE.Mesh(new THREE.CircleGeometry(0.295, 48), glassMat);
  glassDisc.position.z = 2.73;
  g.add(glassDisc);

  // Lens reflection shimmer (emissive disc)
  const shim = new THREE.Mesh(
    new THREE.CircleGeometry(0.15, 32),
    new THREE.MeshStandardMaterial({ color: 0x4488cc, emissive: 0x1133aa, emissiveIntensity: 0.8, transparent: true, opacity: 0.35 })
  );
  shim.position.z = 2.74;
  shim.position.x = 0.06;
  shim.position.y = -0.06;
  g.add(shim);

  // Top handle
  const handleGeo = new THREE.BoxGeometry(1.7, 0.19, 0.19);
  const handle = new THREE.Mesh(handleGeo, rubberMat);
  handle.position.y = 0.74;
  handle.position.z = -0.1;
  g.add(handle);
  // Handle end caps
  [-0.84, 0.84].forEach(x => {
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.28, 0.28), rubberMat);
    cap.position.set(x, 0.74, -0.1);
    g.add(cap);
  });

  // Side grip
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.24, 1.14, 0.68), rubberMat);
  grip.position.set(1.02, -0.07, 0.2);
  g.add(grip);
  // Grip ridges
  for (let i = 0; i < 5; i++) {
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.0, 0.68), rubberMat);
    ridge.position.set(1.16, -0.07, 0.2);
    g.add(ridge);
  }

  // Viewfinder block
  const vf = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.28, 0.56), bodyMat);
  vf.position.set(-0.52, 0.74, -0.62);
  g.add(vf);
  const vfEye = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.15, 20), rubberMat);
  vfEye.rotateZ(Math.PI / 2);
  vfEye.position.set(-0.74, 0.74, -0.62);
  g.add(vfEye);

  // Recording light
  const recLight = new THREE.Mesh(
    new THREE.CircleGeometry(0.035, 16),
    new THREE.MeshStandardMaterial({ color: 0xff1111, emissive: 0xff0000, emissiveIntensity: 4 })
  );
  recLight.position.set(0.88, 0.7, 1.36);
  g.add(recLight);

  // CFast / battery slots
  const slotMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0e, roughness: 1 });
  [-0.25, 0.25].forEach(z => {
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.14, 0.06), slotMat);
    slot.position.set(-0.92, -0.35, z);
    g.add(slot);
  });

  return g;
}

function makeFilmReel(): THREE.Group {
  const g = new THREE.Group();
  const silverMat = new THREE.MeshStandardMaterial({ color: 0x9a9aaa, metalness: 0.78, roughness: 0.28 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x020204, roughness: 1 });

  const disk = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.17, 80), silverMat);
  g.add(disk);

  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.28, 28), silverMat);
  g.add(hub);

  // Spokes
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const spokeGeo = new THREE.BoxGeometry(0.07, 0.22, 0.82);
    const spoke = new THREE.Mesh(spokeGeo, silverMat);
    spoke.position.set(Math.cos(angle) * 0.52, 0, Math.sin(angle) * 0.52);
    spoke.rotation.y = -angle;
    g.add(spoke);
  }

  // Perforations (dark cylinders at rim)
  for (let i = 0; i < 32; i++) {
    const angle = (i / 32) * Math.PI * 2;
    const perf = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.21, 8), darkMat);
    perf.position.set(Math.cos(angle) * 0.91, 0, Math.sin(angle) * 0.91);
    g.add(perf);
  }

  // Rim edge ring
  const rimGeo = new THREE.TorusGeometry(1.15, 0.025, 8, 80);
  rimGeo.rotateX(Math.PI / 2);
  g.add(new THREE.Mesh(rimGeo, silverMat));

  g.rotation.x = Math.PI / 2;
  return g;
}

function makeAnamorphicLens(): THREE.Group {
  const g = new THREE.Group();
  const blackMat = new THREE.MeshStandardMaterial({ color: 0x0c0c10, metalness: 0.3, roughness: 0.75 });
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0x505560, metalness: 0.92, roughness: 0.12 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xd4a853, metalness: 0.95, roughness: 0.06 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x081830, transparent: true, opacity: 0.82, roughness: 0.0 });

  // Main barrel
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.46, 2.6, 56), blackMat);
  barrel.rotateX(Math.PI / 2);
  g.add(barrel);

  // Chrome grip rings (5)
  for (let i = 0; i < 5; i++) {
    const ringGeo = new THREE.TorusGeometry(0.472, 0.022, 10, 56);
    ringGeo.rotateX(Math.PI / 2);
    const ring = new THREE.Mesh(ringGeo, i === 2 ? goldMat : chromeMat);
    ring.position.z = -1.0 + i * 0.5;
    g.add(ring);
  }

  // Front + rear glass elements
  [-1.31, 1.31].forEach(z => {
    const geo = new THREE.CylinderGeometry(0.4, 0.4, 0.07, 48);
    geo.rotateX(Math.PI / 2);
    const glass = new THREE.Mesh(geo, glassMat);
    glass.position.z = z;
    g.add(glass);
    // Lens flare inner shimmer
    const shimmer = new THREE.Mesh(
      new THREE.CircleGeometry(0.18, 32),
      new THREE.MeshStandardMaterial({ color: 0x2255cc, emissive: 0x1133bb, emissiveIntensity: 1.2, transparent: true, opacity: 0.4 })
    );
    shimmer.position.z = z + (z > 0 ? 0.05 : -0.05);
    g.add(shimmer);
  });

  // Anamorphic oval flare disc
  const flareGeo = new THREE.CircleGeometry(0.12, 32);
  flareGeo.scale(1, 2.8, 1);
  const flareMat = new THREE.MeshStandardMaterial({ color: 0x5599ff, emissive: 0x2266ff, emissiveIntensity: 2.5, transparent: true, opacity: 0.2 });
  const flare = new THREE.Mesh(flareGeo, flareMat);
  flare.position.z = 1.32;
  g.add(flare);

  return g;
}

function makeFresnelLight(): THREE.Group {
  const g = new THREE.Group();
  const houseMat = new THREE.MeshStandardMaterial({ color: 0x7a7a80, metalness: 0.6, roughness: 0.45 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1e, metalness: 0.4, roughness: 0.7 });

  // Housing
  const house = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 0.65), houseMat);
  g.add(house);

  // Back dome
  const backDome = new THREE.Mesh(new THREE.SphereGeometry(0.6, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), houseMat);
  backDome.rotation.x = Math.PI / 2;
  backDome.position.z = -0.4;
  g.add(backDome);

  // Fresnel lens (concentric rings on the front)
  for (let r = 0; r < 6; r++) {
    const ringGeo = new THREE.TorusGeometry(0.08 + r * 0.09, 0.012, 6, 48);
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshStandardMaterial({ color: 0x88aadd, metalness: 0, roughness: 0.4, transparent: true, opacity: 0.6 }));
    ring.position.z = 0.33;
    g.add(ring);
  }

  // Emissive glow disc
  const glowDisc = new THREE.Mesh(
    new THREE.CircleGeometry(0.6, 64),
    new THREE.MeshStandardMaterial({ color: 0xfff8e0, emissive: 0xffe8a0, emissiveIntensity: 6.0, transparent: true, opacity: 0.95 })
  );
  glowDisc.position.z = 0.34;
  g.add(glowDisc);

  // Barn doors (4 sides)
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x282828, metalness: 0.5, roughness: 0.65 });
  [
    { pos: [0, 0.88, 0.18] as const, rot: [-0.28, 0, 0] as const, s: [1.58, 0.07, 0.44] as const },
    { pos: [0, -0.88, 0.18] as const, rot: [0.28, 0, 0] as const, s: [1.58, 0.07, 0.44] as const },
    { pos: [0.88, 0, 0.18] as const, rot: [0, 0.28, 0] as const, s: [0.07, 1.58, 0.44] as const },
    { pos: [-0.88, 0, 0.18] as const, rot: [0, -0.28, 0] as const, s: [0.07, 1.58, 0.44] as const },
  ].forEach(({ pos, rot, s }) => {
    const door = new THREE.Mesh(new THREE.BoxGeometry(s[0], s[1], s[2]), doorMat);
    door.position.set(pos[0], pos[1], pos[2]);
    door.rotation.set(rot[0], rot[1], rot[2]);
    g.add(door);
  });

  // Yoke / tilt bracket
  const yokeMat = new THREE.MeshStandardMaterial({ color: 0x555560, metalness: 0.7, roughness: 0.3 });
  [-0.88, 0.88].forEach(x => {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.9, 0.1), yokeMat);
    arm.position.set(x, 0, -0.55);
    g.add(arm);
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.15, 12), yokeMat);
    bolt.position.set(x, -0.45, -0.55);
    g.add(bolt);
  });

  return g;
}

function makeClapperboard(): THREE.Group {
  const g = new THREE.Group();

  // Striped canvas texture
  const cv = document.createElement("canvas");
  cv.width = 512; cv.height = 512;
  const ctx = cv.getContext("2d")!;
  const sz = 46;
  for (let i = 0; i < Math.ceil(512 / sz); i++) {
    for (let j = 0; j < Math.ceil(512 / sz); j++) {
      ctx.fillStyle = (i + j) % 2 === 0 ? "#000000" : "#ffffff";
      ctx.fillRect(i * sz, j * sz, sz, sz);
    }
  }
  const stripesTex = new THREE.CanvasTexture(cv);

  // White label area canvas
  const lv = document.createElement("canvas");
  lv.width = 512; lv.height = 256;
  const lctx = lv.getContext("2d")!;
  lctx.fillStyle = "#1a1a1a";
  lctx.fillRect(0, 0, 512, 256);
  lctx.fillStyle = "#333";
  for (let i = 0; i < 4; i++) {
    lctx.fillRect(16, 40 + i * 52, 480, 1);
  }
  lctx.fillStyle = "#888";
  lctx.font = "bold 28px monospace";
  lctx.fillText("SCENE", 22, 68);
  lctx.fillText("TAKE", 200, 68);
  lctx.fillText("ROLL", 360, 68);
  lctx.fillStyle = "#fff";
  lctx.font = "bold 52px monospace";
  lctx.fillText("01", 22, 140);
  lctx.fillText("04", 200, 140);
  lctx.fillText("A", 360, 140);
  lctx.fillStyle = "#555";
  lctx.font = "18px monospace";
  lctx.fillText("CINEFLOW PRODUCTIONS", 22, 200);
  const labelTex = new THREE.CanvasTexture(lv);

  const boardMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, map: labelTex, roughness: 0.85 });
  const board = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.5, 0.07), boardMat);
  g.add(board);

  // Metal edge strips
  const metalStrip = new THREE.MeshStandardMaterial({ color: 0x888890, metalness: 0.8, roughness: 0.2 });
  const edgeT = new THREE.Mesh(new THREE.BoxGeometry(2.36, 0.06, 0.09), metalStrip);
  edgeT.position.y = 0.75; g.add(edgeT);
  const edgeB = new THREE.Mesh(new THREE.BoxGeometry(2.36, 0.06, 0.09), metalStrip);
  edgeB.position.y = -0.75; g.add(edgeB);

  // Clap sticks
  const stickGroup = new THREE.Group();
  const stickMat = new THREE.MeshStandardMaterial({ map: stripesTex, roughness: 0.7 });
  const stick = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.26, 0.07), stickMat);
  stick.position.y = -0.13;
  stickGroup.add(stick);
  // Metal hinge
  const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.3, 12), metalStrip);
  hinge.rotation.z = Math.PI / 2;
  stickGroup.add(hinge);
  stickGroup.position.y = 0.75;
  stickGroup.rotation.z = -0.35; // open
  g.add(stickGroup);

  return g;
}

// ─── chaos app cards ──────────────────────────────────────────────────────────

const APPS = [
  { name: "Frame.io", color: "#2D9CDB" }, { name: "Milanote", color: "#E8572A" },
  { name: "Monday", color: "#FF3D57" }, { name: "QuickBooks", color: "#2CA01C" },
  { name: "HoneyBook", color: "#C5A3FF" }, { name: "Notion", color: "#FFFFFF" },
  { name: "Dropbox", color: "#0061FF" }, { name: "Slack", color: "#7B68EE" },
  { name: "DocuSign", color: "#FFBE10" }, { name: "Sheets", color: "#34A853" },
  { name: "Trello", color: "#0052CC" }, { name: "Airtable", color: "#FCB400" },
];

function makeCardTexture(name: string, color: string): THREE.CanvasTexture {
  const cv = document.createElement("canvas");
  cv.width = 400; cv.height = 180;
  const ctx = cv.getContext("2d")!;
  // Background
  ctx.fillStyle = "#111116";
  ctx.beginPath();
  ctx.roundRect(4, 4, cv.width - 8, cv.height - 8, 18);
  ctx.fill();
  // Border
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  // Color dot
  ctx.beginPath();
  ctx.arc(50, 90, 16, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  // Text
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 52px -apple-system, sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillText(name, 84, 90);
  return new THREE.CanvasTexture(cv);
}

// ─── main component ───────────────────────────────────────────────────────────

export function CinematicScene() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // ── renderer ────────────────────────────────────────────────────────────
    const W = window.innerWidth, H = window.innerHeight;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    // ── scene / camera ───────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x030308);
    scene.fog = new THREE.FogExp2(0x030308, 0.018);

    const camera = new THREE.PerspectiveCamera(52, W / H, 0.1, 200);
    camera.position.set(0, 0, 22);

    // ── lighting ─────────────────────────────────────────────────────────────
    const ambient = new THREE.AmbientLight(0x0a0a18, 0.4);
    scene.add(ambient);

    const keyLight = new THREE.PointLight(0xffd080, 6, 40);
    keyLight.position.set(-7, 5, 12);
    scene.add(keyLight);

    const fillLight = new THREE.PointLight(0x1a3a7a, 3, 35);
    fillLight.position.set(9, -3, 10);
    scene.add(fillLight);

    const rimLight = new THREE.PointLight(0xffeebb, 8, 50);
    rimLight.position.set(0, 2, -18);
    scene.add(rimLight);

    // Extra top light for detail
    const topLight = new THREE.PointLight(0xfff0cc, 2.5, 30);
    topLight.position.set(0, 14, 5);
    scene.add(topLight);

    // ── stars / dust ─────────────────────────────────────────────────────────
    const starCount = 1800;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      starPos[i * 3] = (Math.random() - 0.5) * 160;
      starPos[i * 3 + 1] = (Math.random() - 0.5) * 160;
      starPos[i * 3 + 2] = (Math.random() - 0.5) * 160;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.07, transparent: true, opacity: 0.6 }));
    scene.add(stars);

    // ── film objects ─────────────────────────────────────────────────────────
    const cam3d = makeCameraBody();
    const reel = makeFilmReel();
    const lens = makeAnamorphicLens();
    const light3d = makeFresnelLight();
    const clapper = makeClapperboard();

    // Initial scattered positions (pre-arrival)
    cam3d.position.set(-1.5, 0.5, 0);
    cam3d.rotation.set(0.1, -0.3, 0.05);

    reel.position.set(6, -3, -4);
    reel.rotation.set(0.2, 0.8, 0.1);

    lens.position.set(-5, 3, -3);
    lens.rotation.set(0.3, 1.2, -0.2);

    light3d.position.set(7, 4, -2);
    light3d.rotation.set(-0.2, -0.8, 0.1);

    clapper.position.set(5, -2, 2);
    clapper.rotation.set(0, 0.6, 0.15);

    [cam3d, reel, lens, light3d, clapper].forEach(o => scene.add(o));

    // ── chaos app cards ───────────────────────────────────────────────────────
    type CardData = {
      mesh: THREE.Mesh;
      origin: THREE.Vector3;
      vel: THREE.Vector3;
      rotVel: THREE.Vector3;
      explodeDir: THREE.Vector3;
    };
    const cards: CardData[] = APPS.map((app, i) => {
      const tex = makeCardTexture(app.name, app.color);
      const geo = new THREE.PlaneGeometry(3.0, 1.15);
      const mat = new THREE.MeshStandardMaterial({
        map: tex, transparent: true, side: THREE.DoubleSide,
        metalness: 0.05, roughness: 0.9,
      });
      const mesh = new THREE.Mesh(geo, mat);

      const angle = (i / APPS.length) * Math.PI * 2;
      const r = 7 + Math.random() * 2.5;
      const pos = new THREE.Vector3(Math.cos(angle) * r, (Math.random() - 0.5) * 6, Math.sin(angle) * r * 0.4 - 5);
      mesh.position.copy(pos);
      mesh.rotation.set((Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.3);
      (mat as THREE.MeshStandardMaterial).opacity = 0; // start invisible

      const vel = new THREE.Vector3((Math.random() - 0.5) * 0.015, (Math.random() - 0.5) * 0.012, (Math.random() - 0.5) * 0.008);
      const rotVel = new THREE.Vector3((Math.random() - 0.5) * 0.004, (Math.random() - 0.5) * 0.004, (Math.random() - 0.5) * 0.006);
      const explodeDir = pos.clone().normalize().multiplyScalar(0.28 + Math.random() * 0.18);

      scene.add(mesh);
      return { mesh, origin: pos.clone(), vel, rotVel, explodeDir };
    });

    // ── particles (gold explosion) ────────────────────────────────────────────
    const PCOUNT = 1200;
    const pPos = new Float32Array(PCOUNT * 3);
    const pVel = new Float32Array(PCOUNT * 3);
    const pOrigins = new Float32Array(PCOUNT * 3);
    for (let i = 0; i < PCOUNT; i++) {
      pPos[i * 3] = 0; pPos[i * 3 + 1] = 0; pPos[i * 3 + 2] = 0;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const speed = 0.12 + Math.random() * 0.32;
      pVel[i * 3] = Math.sin(phi) * Math.cos(theta) * speed;
      pVel[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * speed;
      pVel[i * 3 + 2] = Math.cos(phi) * speed * 0.45;
      pOrigins[i * 3] = (Math.random() - 0.5) * 60;
      pOrigins[i * 3 + 1] = (Math.random() - 0.5) * 60;
      pOrigins[i * 3 + 2] = (Math.random() - 0.5) * 60;
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute("position", new THREE.BufferAttribute(pPos.slice(), 3));
    const pMat = new THREE.PointsMaterial({
      color: 0xd4a853, size: 0.12, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const particles = new THREE.Points(pGeo, pMat);
    scene.add(particles);

    // Floating embers (clarity phase)
    const eCount = 400;
    const ePos = new Float32Array(eCount * 3);
    for (let i = 0; i < eCount; i++) {
      ePos[i * 3] = (Math.random() - 0.5) * 30;
      ePos[i * 3 + 1] = (Math.random() - 0.5) * 20;
      ePos[i * 3 + 2] = (Math.random() - 0.5) * 20;
    }
    const eGeo = new THREE.BufferGeometry();
    eGeo.setAttribute("position", new THREE.BufferAttribute(ePos, 3));
    const eMat = new THREE.PointsMaterial({
      color: 0xd4a853, size: 0.07, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const embers = new THREE.Points(eGeo, eMat);
    scene.add(embers);

    // ── shockwave ring ────────────────────────────────────────────────────────
    const ringGeo = new THREE.RingGeometry(0.1, 0.35, 80);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xd4a853, transparent: true, opacity: 0, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    scene.add(ring);

    // ── post-processing (dynamic import) ─────────────────────────────────────
    let composer: any = null;
    let bloomPass: any = null;
    let rgbShiftPass: any = null;
    let useComposer = false;

    (async () => {
      try {
        const { EffectComposer } = await import("three/examples/jsm/postprocessing/EffectComposer.js" as any);
        const { RenderPass } = await import("three/examples/jsm/postprocessing/RenderPass.js" as any);
        const { UnrealBloomPass } = await import("three/examples/jsm/postprocessing/UnrealBloomPass.js" as any);
        const { ShaderPass } = await import("three/examples/jsm/postprocessing/ShaderPass.js" as any);
        const { VignetteShader } = await import("three/examples/jsm/shaders/VignetteShader.js" as any);
        const { RGBShiftShader } = await import("three/examples/jsm/shaders/RGBShiftShader.js" as any);

        composer = new EffectComposer(renderer);
        composer.addPass(new RenderPass(scene, camera));

        bloomPass = new UnrealBloomPass(
          new THREE.Vector2(W, H), 1.4, 0.55, 0.82
        );
        composer.addPass(bloomPass);

        rgbShiftPass = new ShaderPass(RGBShiftShader);
        rgbShiftPass.uniforms.amount.value = 0.0;
        composer.addPass(rgbShiftPass);

        const vigPass = new ShaderPass(VignetteShader);
        vigPass.uniforms["offset"].value = 0.9;
        vigPass.uniforms["darkness"].value = 1.55;
        composer.addPass(vigPass);

        useComposer = true;
      } catch {
        // fallback: render without post-processing
      }
    })();

    // ── scroll state (driven by GSAP, zero React re-renders) ─────────────────
    const state = { prog: 0, explodeT: -1, exploded: false };

    // ── GSAP ScrollTrigger ───────────────────────────────────────────────────
    let gsapKill: (() => void) | undefined;
    (async () => {
      const gsap = (await import("gsap")).default;
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      gsap.registerPlugin(ScrollTrigger);
      const trigger = ScrollTrigger.create({
        trigger: document.body,
        start: "top top",
        end: "bottom bottom",
        onUpdate: (self) => {
          state.prog = self.progress;
          if (self.progress > 0.45 && !state.exploded) {
            state.exploded = true;
            state.explodeT = 0;
          }
        },
      });
      gsapKill = () => trigger.kill();
    })();

    // ── render loop ──────────────────────────────────────────────────────────
    let raf: number;
    const clock = new THREE.Clock();
    const camTarget = new THREE.Vector3();
    const tmpV = new THREE.Vector3();

    function render() {
      raf = requestAnimationFrame(render);
      const t = clock.getElapsedTime();
      void clock; // elapsed time only; delta unused
      const p = state.prog;

      // Phase weights
      const pArrival  = easeOut(phase(p, 0,    0.14));
      const pChaos    = easeOut(phase(p, 0.14, 0.38));
      const pCollapse = easeOut(phase(p, 0.38, 0.47));
      const pExplode  = easeOut(phase(p, 0.47, 0.53));
      const pClarity  = easeOut(phase(p, 0.53, 0.70));
      const pShowcase = easeOut(phase(p, 0.70, 0.90));
      const pCta      = easeOut(phase(p, 0.90, 1.00));

      // ── camera ──────────────────────────────────────────────────────────────
      const camZ = 22
        - pArrival  * 5
        + pClarity  * 2
        - pShowcase * 4
        - pCta      * 1;
      const camX = pCollapse * 1.8 - pClarity * 1.8;
      const camY = pCollapse * -1.0 + pClarity * 1.0;
      // Gentle camera shake during collapse
      const shake = pCollapse * (1 - pExplode);
      camTarget.set(
        camX + Math.sin(t * 18) * shake * 0.08,
        camY + Math.cos(t * 14) * shake * 0.06,
        camZ
      );
      camera.position.lerp(camTarget, 0.04);
      camera.lookAt(0, 0, 0);

      // ── lighting dynamics ────────────────────────────────────────────────────
      keyLight.intensity  = 6  + pChaos * 2  - pExplode * 4 + pClarity * 3;
      fillLight.intensity = 3  + pChaos * 1.5 - pExplode * 2 + pClarity * 1;
      rimLight.intensity  = 8  - pChaos * 3  - pExplode * 6 + pClarity * 4;
      // Key light slowly circles during clarity
      keyLight.position.x = -7 + Math.sin(t * 0.3) * (1 + pClarity * 3);
      keyLight.position.y = 5  + Math.cos(t * 0.2) * pClarity * 2;

      // Light color transitions: warm at arrival → harsh white at chaos → gold at clarity
      const rKey = 0xff * (1 - pChaos * 0.3) / 255;
      const gKey = 0xd0 * (1 - pChaos * 0.5) / 255;
      const bKey = 0x80 * (1 - pChaos * 0.8) / 255;
      keyLight.color.setRGB(
        THREE.MathUtils.lerp(rKey, 0xff / 255, pClarity),
        THREE.MathUtils.lerp(gKey, 0xe8 / 255, pClarity),
        THREE.MathUtils.lerp(bKey, 0x80 / 255, pClarity)
      );

      // ── film objects ──────────────────────────────────────────────────────────
      // During arrival: they drift into frame
      // During chaos: they tumble with more energy
      // During clarity: they settle into a slow beautiful orbit
      // During showcase: one comes forward, others recede

      const objsArr = [cam3d, reel, lens, light3d, clapper];
      const clarityPositions = [
        new THREE.Vector3(-2.5, 0.8, 0),
        new THREE.Vector3(2.8, -1.0, -1),
        new THREE.Vector3(-3.5, -1.5, 2),
        new THREE.Vector3(3.2, 2.0, 1),
        new THREE.Vector3(0.5, -2.5, -1),
      ];
      const showcasePositions = [
        new THREE.Vector3(0, 0, 2),   // cam forward
        new THREE.Vector3(0, 0, 2),   // reel forward
        new THREE.Vector3(0, 0, 2),   // lens forward
        new THREE.Vector3(0, 0, 2),   // light forward
        new THREE.Vector3(0, 0, 2),   // clapper forward
      ];

      const showcasePanel = Math.min(4, Math.floor(pShowcase * 5));

      objsArr.forEach((obj, i) => {
        const baseFloat = new THREE.Vector3(
          Math.sin(t * 0.4 + i * 1.2) * 0.25,
          Math.cos(t * 0.3 + i * 0.9) * 0.18,
          Math.sin(t * 0.2 + i * 0.7) * 0.12,
        );

        if (pClarity > 0) {
          // Settle into clarity positions
          const target = clarityPositions[i].clone().add(baseFloat);
          if (pShowcase > 0 && i === showcasePanel) {
            // This object comes to center
            target.lerp(showcasePositions[i], easeInOut(Math.min(1, pShowcase * 5 - i)));
          }
          obj.position.lerp(target, 0.025);
        } else {
          // Chaos / collapse drift
          const chaosIntensity = 1 + pChaos * 4 + pCollapse * 2;
          obj.position.x += Math.sin(t * 0.6 + i) * 0.003 * chaosIntensity;
          obj.position.y += Math.cos(t * 0.5 + i * 1.3) * 0.002 * chaosIntensity;
        }

        // Rotation
        const rotSpeed = 0.004 * (1 + pChaos * 3 + pCollapse * 2 - pClarity * 0.7);
        obj.rotation.x += Math.sin(t * 0.3 + i) * rotSpeed;
        obj.rotation.y += rotSpeed * (1 + i * 0.2);
        obj.rotation.z += Math.cos(t * 0.4 + i * 0.8) * rotSpeed * 0.5;

        // Collapse: converge toward center
        if (pCollapse > 0) {
          obj.position.lerp(new THREE.Vector3(0, 0, -3), pCollapse * 0.04);
        }

        // Scale pulse during explosion flash
        const flashScale = 1 + easeOut(phase(p, 0.47, 0.49)) * 0.15;
        obj.scale.setScalar(flashScale);
        // Fade out during explosion
        obj.traverse(child => {
          if ((child as THREE.Mesh).isMesh) {
            const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
            if (mat && mat.opacity !== undefined) {
              mat.transparent = true;
              mat.opacity = Math.max(0, 1 - phase(p, 0.48, 0.54) * 1.4 + pClarity * 1.4);
            }
          }
        });
      });

      // ── chaos cards ────────────────────────────────────────────────────────
      const cardVisible = clamp(pChaos * 2.5, 0, 1) * (1 - easeOut(phase(p, 0.45, 0.52)));
      cards.forEach((c, i) => {
        const chaos = pChaos;
        const orbitAngle = (i / APPS.length) * Math.PI * 2 + t * (0.06 + chaos * 0.22);
        const r = (6 + Math.sin(t + i) * 0.6) * (1 - pCollapse * 0.85);
        const tx = Math.cos(orbitAngle) * r;
        const ty = c.origin.y + Math.sin(t * 0.7 + i) * (0.4 + chaos * 0.9);
        const tz = -5 + Math.cos(t * 0.4 + i) * (0.3 + chaos * 0.5);

        if (state.exploded && state.explodeT >= 0) {
          const et = state.explodeT;
          c.mesh.position.addScaledVector(c.explodeDir, easeOut(Math.min(et * 0.5, 1)) * 0.35);
          const mat = c.mesh.material as THREE.MeshStandardMaterial;
          mat.opacity = Math.max(0, 1 - et * 0.04);
        } else {
          c.mesh.position.x += (tx - c.mesh.position.x) * 0.04;
          c.mesh.position.y += (ty - c.mesh.position.y) * 0.04;
          c.mesh.position.z += (tz - c.mesh.position.z) * 0.04;
          c.mesh.rotation.x += c.rotVel.x * (1 + chaos * 3 + pCollapse * 4);
          c.mesh.rotation.y += c.rotVel.y * (1 + chaos * 3 + pCollapse * 4);
          c.mesh.rotation.z += c.rotVel.z * (1 + chaos * 2);
          const mat = c.mesh.material as THREE.MeshStandardMaterial;
          mat.opacity = cardVisible;
        }
      });

      // ── explosion particles ────────────────────────────────────────────────
      if (state.explodeT >= 0) {
        state.explodeT += 0.012;
        const et = state.explodeT;
        const pBuf = pGeo.attributes.position as THREE.BufferAttribute;
        const gravity = -0.0012;
        for (let i = 0; i < PCOUNT; i++) {
          const drag = 1 - 0.008 * Math.min(et, 60);
          pBuf.array[i * 3]     += pVel[i * 3]     * easeOut(Math.min(et * 0.3, 1)) * drag;
          pBuf.array[i * 3 + 1] += pVel[i * 3 + 1] * easeOut(Math.min(et * 0.3, 1)) * drag + gravity;
          pBuf.array[i * 3 + 2] += pVel[i * 3 + 2] * easeOut(Math.min(et * 0.3, 1)) * drag * 0.5;
        }
        pBuf.needsUpdate = true;
        pMat.opacity = Math.max(0, Math.min(0.9, et * 0.4) * (1 - et * 0.008));

        // Shockwave ring
        const rs = 1 + et * 18;
        ring.scale.set(rs, rs, 1);
        ringMat.opacity = Math.max(0, 0.9 - et * 0.06);
      }

      // Clarity embers drift upward
      eMat.opacity = pClarity * 0.55 * (1 - pShowcase * 0.8);
      if (pClarity > 0) {
        const eBuf = eGeo.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < eCount; i++) {
          eBuf.array[i * 3 + 1] += 0.008 * pClarity;
          if (eBuf.array[i * 3 + 1] > 12) eBuf.array[i * 3 + 1] = -12;
        }
        eBuf.needsUpdate = true;
      }

      // Stars rotate gently
      stars.rotation.y = t * 0.008;
      stars.rotation.x = t * 0.004;

      // ── bloom dynamics ────────────────────────────────────────────────────
      if (bloomPass) {
        const flashStrength = easeOut(phase(p, 0.47, 0.49)) * 5.5;
        bloomPass.strength = 1.3
          + pChaos * 0.7
          + pCollapse * 1.2
          + flashStrength
          - pClarity * 0.4;
        bloomPass.threshold = 0.82 - pChaos * 0.15 - pCollapse * 0.2 - flashStrength * 0.08 + pClarity * 0.1;
      }
      if (rgbShiftPass) {
        rgbShiftPass.uniforms.amount.value =
          pChaos * 0.0018 + pCollapse * 0.006 - pClarity * 0.006;
      }

      // ── render ─────────────────────────────────────────────────────────────
      if (useComposer && composer) {
        composer.render();
      } else {
        renderer.render(scene, camera);
      }
    }
    render();

    // ── resize ───────────────────────────────────────────────────────────────
    function onResize() {
      const w = window.innerWidth, h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      if (composer) composer.setSize(w, h);
    }
    window.addEventListener("resize", onResize);

    // ── cleanup ──────────────────────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      gsapKill?.();
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className="fixed inset-0 z-0"
      style={{ pointerEvents: "none" }}
    />
  );
}
