// LIAM pivot door — procedural source of truth for media/3d/liam-door.glb.
// Look follows the 15-frame storyboard (grey slate porcelain leaf, recessed black pull, black jamb).
// Units: metres. Node names + userData are the contract used by scene.js; a future CAD model can
// replace the GLB as long as it keeps the same names and pivot convention.
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

export const DOOR = {
  width: 1.4,
  height: 2.45,
  thickness: 0.085,     // client copy: about 85 mm
  pivotOffset: 0.42,    // pivot axis measured from the hinge-side (left) edge
  gap: 0.005
};

// Exterior → interior. `spread` = local-Z travel when fanned (at 90° that is screen-horizontal),
// `fan` = extra swivel (rad) around the layer's own pivot line. Negative fan shows the exterior face.
export const LAYERS = [
  {name: 'Layer_ExteriorCladding',   label: 'חיפוי חוץ · גרניט פורצלן', spread: .62,  fan: -.42},
  {name: 'Layer_ReinforcementSheet', label: 'פח חיזוק',                   spread: .42,  fan: -.29},
  {name: 'Layer_Insulation',         label: 'ליבת בידוד תרמית ואקוסטית', spread: .22,  fan: -.16},
  {name: 'Layer_SteelFrame',         label: 'חיזוקים פנימיים',            spread: .02,  fan: -.04},
  {name: 'Layer_AluminiumProfile',   label: 'פרופילי אלומיניום',          spread: -.18, fan: .1},
  {name: 'Layer_InteriorCladding',   label: 'חיפוי פנים',                 spread: -.38, fan: .24}
];

/* ---------- deterministic procedural textures ---------- */
export function random(seed) {
  return () => {
    seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
// Multi-octave value noise → Float32Array (0..1). sx/sy stretch the grain.
export function fbm(w, h, seed, {octaves = 6, scale = 256, sx = 1, sy = 1, gain = .5} = {}) {
  const out = new Float32Array(w * h), rnd = random(seed);
  let amp = 1, total = 0;
  for (let o = 0; o < octaves; o++) {
    const cx = Math.max(1, scale * sx / 2 ** o), cy = Math.max(1, scale * sy / 2 ** o);
    const gw = Math.ceil(w / cx) + 2, gh = Math.ceil(h / cy) + 2;
    const grid = new Float32Array(gw * gh);
    for (let i = 0; i < grid.length; i++) grid[i] = rnd();
    for (let y = 0; y < h; y++) {
      const fy = y / cy, iy = fy | 0, ty = fy - iy, vy = ty * ty * (3 - 2 * ty);
      for (let x = 0; x < w; x++) {
        const fx = x / cx, ix = fx | 0, tx = fx - ix, vx = tx * tx * (3 - 2 * tx);
        const a = grid[iy * gw + ix], b = grid[iy * gw + ix + 1];
        const c = grid[(iy + 1) * gw + ix], d = grid[(iy + 1) * gw + ix + 1];
        const top = a + (b - a) * vx;
        out[y * w + x] += amp * (top + (c + (d - c) * vx - top) * vy);
      }
    }
    total += amp; amp *= gain;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}
export function makeCanvas(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
}
export function paint(w, h, fn) {
  const c = makeCanvas(w, h), ctx = c.getContext('2d'), img = ctx.createImageData(w, h);
  for (let y = 0, i = 0; y < h; y++) for (let x = 0; x < w; x++, i += 4) {
    const [r, g, b] = fn(x, y, y * w + x);
    img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0); return c;
}
export function normalFromHeight(height, w, h, strength) {
  return paint(w, h, (x, y) => {
    const s = (xx, yy) => height[Math.min(h - 1, Math.max(0, yy)) * w + Math.min(w - 1, Math.max(0, xx))];
    const dx = (s(x + 1, y) - s(x - 1, y)) * strength, dy = (s(x, y + 1) - s(x, y - 1)) * strength;
    const l = Math.hypot(dx, dy, 1);
    return [(-dx / l * .5 + .5) * 255, (dy / l * .5 + .5) * 255, (1 / l * .5 + .5) * 255];
  });
}
export function texture(c, {srgb = true, jpeg = true, repeat} = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 16;
  t.userData.mimeType = jpeg ? 'image/jpeg' : 'image/png';
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}

// Cleft slate porcelain: soft cloudy tone, fine directional grain, faint lamination streaks.
// `joints` are cladding grooves as fractions of the height — the horizontal lines that make a
// leaf read as stone panels rather than one painted sheet, as in the client's reference film.
export function slateTextures(seed, {w = 1024, h = 2048, base = .47, contrast = 1, joints = []} = {}) {
  const cloud = fbm(w, h, seed, {scale: 520, octaves: 5, sy: 1.3});
  const streak = fbm(w, h, seed + 7, {scale: 60, octaves: 4, sx: 5, sy: .35});
  const grain = fbm(w, h, seed + 13, {scale: 5, octaves: 2});
  const rnd = random(seed + 3), height = new Float32Array(w * h);
  const groove = Math.max(1, Math.round(h / 620));                     // ~3 px at 2048
  const rows = joints.map(j => Math.round(j * h));
  const map = paint(w, h, (x, y, i) => {
    let v = base + (cloud[i] - .5) * .17 * contrast + (streak[i] - .5) * .03 * contrast + (grain[i] - .5) * .07;
    if (rnd() > .9993) v -= .06;                                       // tiny pits
    height[i] = cloud[i] * .5 + grain[i] * .5;
    for (const row of rows) {
      const d = Math.abs(y - row);
      if (d > groove) continue;
      const cut = 1 - d / (groove + 1);
      v -= .17 * cut;                                                  // shadow in the groove
      height[i] -= .8 * cut;
    }
    const c = Math.max(0, Math.min(1, v)) * 255;
    return [c * .99, c, c * 1.005];
  });
  const rough = paint(w / 4, h / 4, (x, y) => [0, (.72 + (streak[y * 4 * w + x * 4] - .5) * .25) * 255, 0]);
  return {map: texture(map), normalMap: texture(normalFromHeight(height, w, h, 2.4 * w / 1024), {srgb: false}), roughnessMap: texture(rough, {srgb: false})};
}
// Light travertine / cream porcelain with horizontal vein bands.
export function travertineTextures(seed, {w = 512, h = 1024, tint = [1, .965, .9]} = {}) {
  const band = fbm(w, h, seed, {scale: 200, octaves: 5, sx: 3.5, sy: .18});
  const cloud = fbm(w, h, seed + 5, {scale: 260, octaves: 4});
  const pores = fbm(w, h, seed + 9, {scale: 4, octaves: 2});
  const height = new Float32Array(w * h);
  const map = paint(w, h, (x, y, i) => {
    const v = .8 + (band[i] - .5) * .22 + (cloud[i] - .5) * .08 - Math.max(0, pores[i] - .72) * .5;
    height[i] = band[i] * .4 + (pores[i] > .72 ? 0 : .6);
    return [v * 255 * tint[0], v * 255 * tint[1], v * 255 * tint[2]];
  });
  return {map: texture(map), normalMap: texture(normalFromHeight(height, w, h, 1.4 * w / 512), {srgb: false})};
}
function insulationTextures(q = 1) {
  // Rigid insulation board: off-white, compressed fibres and speckle.
  const w = 512 * q, h = 1024 * q, fib = fbm(w, h, 97, {scale: 3, octaves: 3, sx: 2.5}), cl = fbm(w, h, 101, {scale: 120, octaves: 4});
  const height = new Float32Array(w * h);
  const map = paint(w, h, (x, y, i) => {
    const v = .8 + (fib[i] - .5) * .22 + (cl[i] - .5) * .08; height[i] = fib[i];
    return [v * 250, v * 243, v * 226];
  });
  return {map: texture(map), normalMap: texture(normalFromHeight(height, w, h, 4 * w / 512), {srgb: false})};
}
function brushedTexture(q = 1) {
  const w = 256 * q, h = 512 * q, n = fbm(w, h, 131, {scale: 2, octaves: 2, sy: 60});
  return texture(paint(w, h, (x, y, i) => [0, (.3 + n[i] * .25) * 255, 0]), {srgb: false});
}

/* ---------- geometry helpers ---------- */
function mesh(name, geometry, material, x, y, z) {
  const m = new THREE.Mesh(geometry, material);
  m.name = name; m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; return m;
}
// Small bevels catch light on every edge — the cheapest realism win.
const rbox = (w, h, d, r = .0015) => new RoundedBoxGeometry(w, h, d, 2, Math.min(r, Math.min(w, h, d) / 2.2));
function group(name, userData = {}) {
  const g = new THREE.Group(); g.name = name; Object.assign(g.userData, userData); return g;
}

// `quality` scales every procedural texture. 1 = film quality (offline renderer),
// .5 or .25 = the realtime web scene, where generation cost is paid on the main thread.
export function buildDoor({quality: q = 1} = {}) {
  const {width: W, height: H, thickness: T, pivotOffset: P} = DOOR;
  const slate = slateTextures(11, {w: 1024 * q, h: 2048 * q, joints: [.27, .52, .77]});
  const cream = travertineTextures(61, {tint: [1, .97, .92], w: 512 * q, h: 1024 * q});
  const ins = insulationTextures(q), brushed = brushedTexture(q);

  const M = {
    slate: new THREE.MeshStandardMaterial({name: 'Porcelain_SlateGrey', color: 0xffffff, ...slate, roughness: 1}),
    slateEdge: new THREE.MeshStandardMaterial({name: 'Porcelain_Edge', color: 0x6d6e6e, roughness: .8}),
    cream: new THREE.MeshStandardMaterial({name: 'Interior_Cream', color: 0xffffff, ...cream, roughness: .5}),
    insulation: new THREE.MeshStandardMaterial({name: 'Insulation_Board', color: 0xffffff, ...ins, roughness: .95}),
    sheet: new THREE.MeshStandardMaterial({name: 'Steel_Sheet_Black', color: 0x1b1c1d, metalness: .7, roughness: .45}),
    steel: new THREE.MeshStandardMaterial({name: 'Steel_Galvanised', color: 0xc3c6c9, metalness: 1, roughness: 1, roughnessMap: brushed}),
    alu: new THREE.MeshStandardMaterial({name: 'Aluminium_Satin', color: 0xa9adb1, metalness: 1, roughness: .32}),
    black: new THREE.MeshStandardMaterial({name: 'Black_Anodised', color: 0x0e0e0f, metalness: .55, roughness: .42}),
    frame: new THREE.MeshStandardMaterial({name: 'Frame_Black', color: 0x121213, metalness: .5, roughness: .5})
  };

  const root = group('LiamDoor', {units: 'm', leaf: {width: W, height: H, thickness: T, pivotOffset: P}});
  const leaf = group('Leaf', {pivot: true, openAxis: 'y', note: 'positive rotation.y swings the lock side into the house'});
  leaf.position.set(-W / 2 + P, 0, 0);
  root.add(leaf);
  const x0 = -P, cx = x0 + W / 2, cy = H / 2;

  const layer = i => {
    const s = LAYERS[i];
    const g = group(s.name, {labelHe: s.label, spread: s.spread, fan: s.fan, order: i});
    leaf.add(g); return g;
  };

  // 0 · exterior porcelain (12 mm) with the recessed black pull and lock rosette
  const ext = layer(0);
  // RoundedBoxGeometry keeps BoxGeometry's 6 material groups (+z = index 4).
  const slab = new THREE.Mesh(rbox(W - .004, H - .004, .012, .002), [M.slateEdge, M.slateEdge, M.slateEdge, M.slateEdge, M.slate, M.slateEdge]);
  slab.name = 'ExteriorSlab'; slab.position.set(cx, cy, T / 2 - .006); slab.castShadow = slab.receiveShadow = true;
  ext.add(slab);
  const pull = group('Hardware_Handle', {labelHe: 'ידית שקועה'});
  const px = x0 + W - .26, pz = T / 2;
  pull.add(mesh('PullChannel', rbox(.05, 1.72, .006, .0025), M.black, px, 1.36, pz + .0015));
  pull.add(mesh('PullGrip', rbox(.022, 1.66, .016, .004), M.black, px, 1.36, pz + .009));
  const rosette = mesh('LockRosette', new THREE.CylinderGeometry(.021, .021, .012, 40), M.black, px + .075, 1.02, pz + .006);
  rosette.rotation.x = Math.PI / 2; pull.add(rosette);
  ext.add(pull);

  // 1 · black reinforcement sheet
  const sheet = layer(1);
  sheet.add(mesh('ReinforcementSheet', rbox(W - .02, H - .02, .003, .001), M.sheet, cx, cy, T / 2 - .0145));

  // 2 · insulation core
  const insulation = layer(2);
  insulation.add(mesh('InsulationCore', rbox(W - .07, H - .07, .036, .003), M.insulation, cx, cy, 0));

  // 3 · internal steel reinforcement grid
  const steel = layer(3), sd = .03, st = .03;
  steel.add(mesh('StileHinge', rbox(st, H - .1, sd), M.steel, x0 + .07, cy, 0));
  steel.add(mesh('StileLock', rbox(st, H - .1, sd), M.steel, x0 + W - .07, cy, 0));
  steel.add(mesh('StileCentre', rbox(.024, H - .16, sd), M.steel, cx + .1, cy, 0));
  const beams = 7;
  for (let i = 0; i < beams; i++) {
    const y = .07 + i * (H - .14) / (beams - 1);
    steel.add(mesh(`CrossBeam_${i + 1}`, rbox(W - .14, .026, sd), M.steel, cx, y, 0));
  }
  const lock = group('Hardware_Lock', {labelHe: 'מנעול רב־בריחי'});
  lock.add(mesh('LockBody', rbox(.03, .32, .026), M.steel, x0 + W - .1, 1.02, 0));
  steel.add(lock);
  const pivot = group('Hardware_Pivot');
  pivot.add(mesh('PivotBottom', new THREE.CylinderGeometry(.02, .02, .03, 32), M.steel, 0, .015, 0));
  pivot.add(mesh('PivotTop', new THREE.CylinderGeometry(.02, .02, .03, 32), M.steel, 0, H - .015, 0));
  steel.add(pivot);

  // 4 · aluminium: black outer perimeter + satin inner frame (two rectangles, as in the storyboard)
  const alu = layer(4), pw = .03, pd = .055;
  for (const [n, inset, depth, mat] of [['Outer', 0, pd, M.black], ['Inner', .09, .02, M.alu]]) {
    const w = W - inset * 2, h = H - inset * 2;
    alu.add(mesh(`Profile${n}Hinge`, rbox(pw, h, depth), mat, x0 + inset + pw / 2, cy, 0));
    alu.add(mesh(`Profile${n}Lock`, rbox(pw, h, depth), mat, x0 + W - inset - pw / 2, cy, 0));
    alu.add(mesh(`Profile${n}Top`, rbox(w - pw * 2, pw, depth), mat, cx, H - inset - pw / 2, 0));
    alu.add(mesh(`Profile${n}Bottom`, rbox(w - pw * 2, pw, depth), mat, cx, inset + pw / 2, 0));
  }

  // 5 · interior cladding (cream porcelain / HPL)
  const int = layer(5);
  int.add(mesh('InteriorSlab', rbox(W - .004, H - .004, .008, .0015), M.cream, cx, cy, -T / 2 + .004));

  // Static black jamb, flush with the wall face.
  const frame = group('Frame', {static: true});
  const fw = .028, fd = .2, ow = W + DOOR.gap * 2, oh = H + DOOR.gap;
  frame.add(mesh('JambLeft', rbox(fw, oh + fw, fd), M.frame, -ow / 2 - fw / 2, (oh + fw) / 2, -.02));
  frame.add(mesh('JambRight', rbox(fw, oh + fw, fd), M.frame, ow / 2 + fw / 2, (oh + fw) / 2, -.02));
  frame.add(mesh('Head', rbox(ow, fw, fd), M.frame, 0, oh + fw / 2, -.02));
  root.add(frame);

  return root;
}
