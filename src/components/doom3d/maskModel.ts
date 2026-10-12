// The 3D Doctor Doom (UI only): "Doctor Doom's Mask" by Nicolas_Laube
// (https://sketchfab.com/3d-models/doctor-dooms-mask-8db5464072f341a994ad1c729d9080f7), licensed
// CC BY 4.0 — the author is credited in the Landing footer. public/models/doom-full.glb is the whole
// model (mask, head, hood/cloak, clasps) with its textures re-saved as JPEG.
//
// prepareMask() takes the loaded model, centres it, scales it to MASK units and finds the eyes.

import * as THREE from 'three';

/** The model is scaled to fill this height (y), centred on the origin; it faces +z. */
export const MASK = { top: 1.12, bottom: -1.12 };

export type MaskModel = {
  /** The mask, centred and scaled. */
  root: THREE.Object3D;
  /** Centre of each eye opening (in the mask's own units). */
  eyes: [THREE.Vector3, THREE.Vector3];
  /** Size of the mask (width, height, depth). */
  size: THREE.Vector3;
};

export function prepareMask(scene: THREE.Object3D): MaskModel {
  const root = scene.clone(true);
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());
  const k = (MASK.top - MASK.bottom) / size.y;

  // Eyes: the middle of the left and right halves of the eyelid part.
  const sums = [new THREE.Vector3(), new THREE.Vector3()];
  const counts = [0, 0];
  const v = new THREE.Vector3();
  root.getObjectByName('eyelids_low')?.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const pos = mesh.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
      const side = v.x < centre.x ? 0 : 1;
      sums[side].add(v);
      counts[side]++;
    }
  });
  const toMask = (p: THREE.Vector3) => p.sub(centre).multiplyScalar(k);
  const eyes: [THREE.Vector3, THREE.Vector3] =
    counts[0] && counts[1]
      ? [toMask(sums[0].divideScalar(counts[0])), toMask(sums[1].divideScalar(counts[1]))]
      : [new THREE.Vector3(-0.3, 0.25, 0.4), new THREE.Vector3(0.3, 0.25, 0.4)];

  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.frustumCulled = false;
    (mesh.material as THREE.MeshStandardMaterial).envMapIntensity = 1.1;
  });

  // Centre and scale, wrapped in groups so the model's own transforms stay as they are.
  root.position.sub(centre);
  const inner = new THREE.Group();
  inner.add(root);
  inner.scale.setScalar(k);
  const holder = new THREE.Group();
  holder.add(inner);
  return { root: holder, eyes, size: size.multiplyScalar(k) };
}

/** Soft round glow used for the eyes and the halo. */
export function glowTexture(size = 64) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
