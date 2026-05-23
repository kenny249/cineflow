"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

const APPS = [
  { name: "Frame.io",    color: "#2D9CDB" },
  { name: "Milanote",   color: "#E8572A" },
  { name: "Monday.com", color: "#FF3D57" },
  { name: "QuickBooks", color: "#2CA01C" },
  { name: "HoneyBook",  color: "#C5A3FF" },
  { name: "Notion",     color: "#FFFFFF" },
  { name: "Dropbox",    color: "#0061FF" },
  { name: "Slack",      color: "#4A154B" },
  { name: "DocuSign",   color: "#FFBE10" },
  { name: "Sheets",     color: "#34A853" },
  { name: "Trello",     color: "#0052CC" },
  { name: "Airtable",   color: "#FCB400" },
];

function makeLabel(name: string, color: string): THREE.Texture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size * 2;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  // Card background
  ctx.fillStyle = "#111113";
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(4, 4, canvas.width - 8, canvas.height - 8, 20);
  ctx.fill();
  ctx.stroke();

  // Colored dot
  ctx.beginPath();
  ctx.arc(48, size / 2, 14, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  // Text
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 52px -apple-system, sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillText(name, 80, size / 2);

  return new THREE.CanvasTexture(canvas);
}

interface Props {
  scrollProgress: number; // 0–1 within the chaos section
  explode: boolean;
}

export function ChaosCanvas({ scrollProgress, explode }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    cards: { mesh: THREE.Mesh; vel: THREE.Vector3; rotVel: THREE.Vector3; origin: THREE.Vector3 }[];
    particles: { mesh: THREE.Points; vels: Float32Array } | null;
    ring: THREE.Mesh | null;
    exploded: boolean;
    explodeT: number;
    raf: number;
  } | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const W = mount.clientWidth;
    const H = mount.clientHeight;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 1000);
    camera.position.z = 14;

    // Build card meshes
    const cards: typeof stateRef.current extends null ? never : NonNullable<typeof stateRef.current>["cards"] = [];
    APPS.forEach((app, i) => {
      const tex = makeLabel(app.name, app.color);
      const geo = new THREE.PlaneGeometry(3.2, 1.2);
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(geo, mat);

      const angle = (i / APPS.length) * Math.PI * 2;
      const radius = 5 + Math.random() * 2;
      const x = Math.cos(angle) * radius;
      const y = (Math.random() - 0.5) * 8;
      const z = (Math.random() - 0.5) * 4;
      mesh.position.set(x, y, z);
      mesh.rotation.z = (Math.random() - 0.5) * 0.4;

      const origin = new THREE.Vector3(x, y, z);
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 0.02,
        (Math.random() - 0.5) * 0.02,
        (Math.random() - 0.5) * 0.01,
      );
      const rotVel = new THREE.Vector3(
        (Math.random() - 0.5) * 0.005,
        (Math.random() - 0.5) * 0.005,
        (Math.random() - 0.5) * 0.008,
      );

      scene.add(mesh);
      cards.push({ mesh, vel, rotVel, origin });
    });

    // Particle system (hidden until explode)
    const particleCount = 600;
    const positions = new Float32Array(particleCount * 3);
    const vels = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = 0;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 0;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const speed = 0.08 + Math.random() * 0.25;
      vels[i * 3] = Math.sin(phi) * Math.cos(theta) * speed;
      vels[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * speed;
      vels[i * 3 + 2] = Math.cos(phi) * speed * 0.4;
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const pMat = new THREE.PointsMaterial({ color: 0xd4a853, size: 0.08, transparent: true, opacity: 0 });
    const particles = new THREE.Points(pGeo, pMat);
    scene.add(particles);

    // Gold shockwave ring
    const ringGeo = new THREE.RingGeometry(0.1, 0.3, 64);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xd4a853, transparent: true, opacity: 0, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    scene.add(ring);

    const state = {
      renderer, scene, camera, cards,
      particles: { mesh: particles, vels },
      ring,
      exploded: false,
      explodeT: 0,
      raf: 0,
    };
    stateRef.current = state;

    let t = 0;
    function animate() {
      state.raf = requestAnimationFrame(animate);
      t += 0.008;

      const sp = stateRef.current ? (stateRef.current as any)._scrollProgress ?? 0 : 0;
      const ex = stateRef.current ? (stateRef.current as any)._explode ?? false : false;

      if (!ex) {
        // Orbit + chaos intensity
        const chaos = Math.min(sp * 2, 1);
        cards.forEach((c, i) => {
          const angle = (i / APPS.length) * Math.PI * 2 + t * (0.08 + chaos * 0.25);
          const radius = (5 + Math.sin(t + i) * 0.5) * (1 - chaos * 0.6);
          const tx = Math.cos(angle) * radius;
          const ty = c.origin.y + Math.sin(t * 0.7 + i) * (0.3 + chaos * 0.8);
          const tz = c.origin.z + Math.cos(t * 0.5 + i) * (0.2 + chaos * 0.4);

          c.mesh.position.x += (tx - c.mesh.position.x) * 0.04;
          c.mesh.position.y += (ty - c.mesh.position.y) * 0.04;
          c.mesh.position.z += (tz - c.mesh.position.z) * 0.04;

          c.mesh.rotation.x += c.rotVel.x * (1 + chaos * 3);
          c.mesh.rotation.y += c.rotVel.y * (1 + chaos * 3);
          c.mesh.rotation.z += c.rotVel.z * (1 + chaos * 3);

          const opacity = 1 - chaos * 0.3;
          (c.mesh.material as THREE.MeshBasicMaterial).opacity = opacity;
        });

        (ringMat as THREE.MeshBasicMaterial).opacity = 0;
        (pMat as THREE.PointsMaterial).opacity = 0;

      } else {
        // Explosion sequence
        state.explodeT += 0.025;
        const et = Math.min(state.explodeT, 1);

        // Cards fly outward
        cards.forEach((c) => {
          const dir = c.mesh.position.clone().normalize();
          c.mesh.position.addScaledVector(dir, 0.3 * et);
          (c.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - et * 1.5);
          c.mesh.rotation.x += 0.05;
          c.mesh.rotation.y += 0.07;
        });

        // Particles
        const pPos = pGeo.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < particleCount; i++) {
          pPos.array[i * 3]     += state.particles!.vels[i * 3]     * et;
          pPos.array[i * 3 + 1] += state.particles!.vels[i * 3 + 1] * et;
          pPos.array[i * 3 + 2] += state.particles!.vels[i * 3 + 2] * et;
        }
        pPos.needsUpdate = true;
        pMat.opacity = Math.max(0, 0.9 - et * 0.9);

        // Ring expands
        const ringScale = 1 + et * 20;
        ring.scale.set(ringScale, ringScale, 1);
        ringMat.opacity = Math.max(0, 0.8 - et * 0.8);
      }

      renderer.render(scene, camera);
    }
    animate();

    const onResize = () => {
      const w = mount.clientWidth, h = mount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(state.raf);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, []);

  // Sync scroll progress and explode flag via ref trick
  useEffect(() => {
    if (stateRef.current) {
      (stateRef.current as any)._scrollProgress = scrollProgress;
    }
  }, [scrollProgress]);

  useEffect(() => {
    if (stateRef.current && explode && !stateRef.current.exploded) {
      stateRef.current.exploded = true;
      (stateRef.current as any)._explode = true;
    }
  }, [explode]);

  return <div ref={mountRef} className="absolute inset-0" />;
}
