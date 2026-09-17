// LIAM door film — set, lights, storyboard timeline and an accumulation renderer.
// Shared by render.html (offline frames) and export.html (GLB). The web player only uses the frames.
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {buildDoor, LAYERS, DOOR, fbm, paint, texture, slateTextures, travertineTextures, random} from '../../scene/door-model.js';

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = t => t * t * (3 - 2 * t);

/* ───────────── storyboard timeline ─────────────
   t = 0..1 over the whole film. Each storyboard frame is a key that the film rests on briefly
   (a second key with the same values makes the hold). Missing fields carry forward.
   open: degrees · explode/fan: 0..1 · focus: layer index being presented · present: 0..1
   cam/tgt: metres · frame: framing size multiplier (1 = whole portal, <1 = closer). */
export const BEATS = [
  {id: 1,  t: 0,    title: 'דלת סגורה',        sub: 'עיצוב מינימליסטי שמשתלב עם האדריכלות'},
  {id: 2,  t: .085, title: 'תחילת פתיחה',      sub: 'תנועה חלקה על ציר נסתר'},
  {id: 3,  t: .16,  title: 'פתיחה',            sub: 'פתיחה רחבה לכניסה מרשימה'},
  {id: 4,  t: .235, title: 'מבט צד',           sub: 'עובי כנף כ־85 מ״מ'},
  {id: 5,  t: .30,  title: 'חתך דק',           sub: 'מערכת מתקדמת לשילוב חומרים'},
  {id: 6,  t: .37,  title: 'הפרדת שכבות',      sub: 'החיפוי החיצוני מתנתק מהמערכת'},
  {id: 7,  t: .44,  title: 'חיפוי החוץ',       sub: 'גרניט פורצלן, HPL ואלומיניום — במגוון גוונים'},
  {id: 8,  t: .515, title: 'שכבת בידוד',       sub: 'ליבת בידוד תרמית ואקוסטית'},
  {id: 9,  t: .59,  title: 'חיזוקים פנימיים',  sub: 'מבנה רב־שכבתי עם קורות חיזוק'},
  {id: 10, t: .665, title: 'פרופילי אלומיניום', sub: 'שלדת אלומיניום בדיוק גבוה'},
  {id: 11, t: .74,  title: 'חיפוי פנים',       sub: 'גמר פנימי איכותי'},
  {id: 12, t: .815, title: 'איחוד שכבות',      sub: 'כל הרכיבים חוזרים למקומם'},
  {id: 13, t: .885, title: 'סגירה',            sub: 'המבנה מתאחד לדלת אחת שלמה'},
  {id: 14, t: .95,  title: 'סגירה מלאה',       sub: 'אותה דלת, אותו מראה נקי'},
  {id: 15, t: 1,    title: 'יותר מדלת כניסה',  sub: 'דלת שמשתלבת עם הבית שלכם'}
];
const HOLD = .018;
const POSES = {
  1:  {open: 0,   explode: 0,   fan: 0, focus: 0, present: 0, cam: [0, 1.4, 7.2],  tgt: [0, 1.36, 0],   frame: 1},
  2:  {open: 24,                                                cam: [0, 1.3, 7.0]},
  3:  {open: 62,                                                cam: [0, 1.3, 6.8]},
  4:  {open: 86,                                                cam: [0, 1.3, 6.5],  frame: .96},
  5:  {open: 90,                                                cam: [.05, 1.3, 6.3], frame: .92},
  6:  {explode: .22, fan: .1,                                   cam: [.12, 1.32, 6.2]},
  7:  {explode: 1,   fan: 1,  focus: 0, present: 1,             cam: [.3, 1.36, 6.0], tgt: [.05, 1.34, -.2], frame: .9},
  8:  {focus: 2},
  9:  {focus: 3},
  10: {focus: 4},
  11: {focus: 5},
  12: {explode: 0,   fan: 0,  present: 0,                       cam: [.1, 1.4, 6.3], tgt: [0, 1.36, 0], frame: .94},
  13: {open: 45,                                                cam: [0, 1.3, 6.7], frame: .98},
  14: {open: 0,                                                 cam: [0, 1.3, 7.1], frame: 1},
  15: {                                                         cam: [0, 1.3, 7.5], frame: 1.04}
};
function buildTimeline() {
  let prev = {};
  const keys = [];
  BEATS.forEach(beat => {
    prev = {...prev, ...POSES[beat.id]};
    const hold = beat.id === 1 ? [0, HOLD * 1.5] : beat.id === 15 ? [1 - HOLD, 1] : [beat.t - HOLD / 2, beat.t + HOLD / 2];
    hold.forEach(t => keys.push({...prev, t}));
  });
  // Monotone cubic per channel (smooth velocity, no overshoot at extremes).
  const fields = ['open', 'explode', 'fan', 'focus', 'present', 'cam', 'tgt', 'frame'];
  const channels = fields.flatMap(field => {
    const size = Array.isArray(keys[0][field]) ? keys[0][field].length : 1;
    return Array.from({length: size}, (_, c) => {
      const xs = keys.map(k => k.t), ys = keys.map(k => size > 1 ? k[field][c] : k[field]);
      const d = xs.slice(1).map((x, i) => (ys[i + 1] - ys[i]) / Math.max(1e-6, x - xs[i]));
      const m = xs.map((_, i) => (i === 0 || i === xs.length - 1 || d[i - 1] * d[i] <= 0) ? 0
        : Math.sign(d[i]) * Math.min(Math.abs((d[i - 1] + d[i]) / 2), 3 * Math.abs(d[i - 1]), 3 * Math.abs(d[i])));
      return {field, c, size, xs, ys, m};
    });
  });
  return t => {
    const s = {};
    for (const {field, c, size, xs, ys, m} of channels) {
      let v;
      if (t <= xs[0]) v = ys[0];
      else if (t >= xs[xs.length - 1]) v = ys[ys.length - 1];
      else {
        let i = 0; while (t > xs[i + 1]) i++;
        const h = xs[i + 1] - xs[i], u = (t - xs[i]) / h, u2 = u * u, u3 = u2 * u;
        v = (2 * u3 - 3 * u2 + 1) * ys[i] + (u3 - 2 * u2 + u) * h * m[i] + (-2 * u3 + 3 * u2) * ys[i + 1] + (u3 - u2) * h * m[i + 1];
      }
      if (size > 1) (s[field] ||= [])[c] = v; else s[field] = v;
    }
    return s;
  };
}
export const timeline = buildTimeline();
export const beatAt = t => BEATS.reduce((best, b) => Math.abs(b.t - t) < Math.abs(best.t - t) ? b : best, BEATS[0]);

/* ───────────── set ───────────── */
function buildSet() {
  const set = new THREE.Group(); set.name = 'Set';
  const ow = DOOR.width + DOOR.gap * 2 + .056, oh = DOOR.height + DOOR.gap + .028;   // opening incl. jamb
  const face = .08, back = -.22, S = 12;

  // Wall slabs: 1.2 × 2.48 m slate porcelain, joints aligned to the jamb, UVs in world metres.
  const tileW = 1.2, tileH = oh, tex = 1024;
  const slate = fbm(tex, tex * 2, 301, {scale: 420, octaves: 5, sy: 1.3});
  const streak = fbm(tex, tex * 2, 307, {scale: 50, octaves: 4, sx: 5, sy: .35});
  const grain = fbm(tex, tex * 2, 311, {scale: 5, octaves: 2});
  const wallMap = paint(tex, tex * 2, (x, y, i) => {
    // one texture = 2 × 2 slabs, a slightly different tone per slab
    const slab = (x < tex / 2 ? 0 : 1) + (y < tex ? 0 : 2), tone = [0, .025, -.02, .012][slab];
    const joint = (x % (tex / 2) < 2 || y % tex < 2) ? .45 : 1;
    const v = (.41 + tone + (slate[i] - .5) * .15 + (streak[i] - .5) * .025 + (grain[i] - .5) * .06) * joint;
    return [v * 250, v * 252, v * 254];
  });
  const wallTex = texture(wallMap, {repeat: [1 / (tileW * 2), 1 / (tileH * 2)]});
  wallTex.offset.set((ow / 2) / (tileW * 2), 0);
  const wallMat = new THREE.MeshStandardMaterial({name: 'Wall_Slate', map: wallTex, roughness: .78});

  const shape = new THREE.Shape([[-S / 2, -.01], [S / 2, -.01], [S / 2, 6], [-S / 2, 6]].map(p => new THREE.Vector2(...p)));
  shape.holes.push(new THREE.Path([[-ow / 2, 0], [-ow / 2, oh], [ow / 2, oh], [ow / 2, 0]].map(p => new THREE.Vector2(...p))));
  const wallGeo = new THREE.ShapeGeometry(shape);                 // UV = world XY in metres
  const wall = new THREE.Mesh(wallGeo, wallMat); wall.position.z = face; wall.receiveShadow = wall.castShadow = true; set.add(wall);
  const interiorWallMat = new THREE.MeshStandardMaterial({name: 'Interior_Plaster', color: 0x6f675f, roughness: .92});
  const wallBack = new THREE.Mesh(wallGeo, interiorWallMat); wallBack.position.z = back; wallBack.rotation.y = Math.PI;
  set.add(wallBack);
  const reveal = (w, h, x, y) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, face - back), interiorWallMat); m.position.set(x, y, (face + back) / 2); m.castShadow = m.receiveShadow = true; set.add(m); };
  reveal(.02, oh, -ow / 2 - .01, oh / 2); reveal(.02, oh, ow / 2 + .01, oh / 2); reveal(ow + .04, .02, 0, oh + .01);

  // Travertine returns framing the portal, both sides.
  const trav = travertineTextures(401, {w: 512, h: 1536, tint: [1, .955, .885]});
  const travMat = new THREE.MeshStandardMaterial({name: 'Travertine', color: 0xffffff, ...trav, roughness: .7});
  for (const side of [-1, 1]) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(.34, 4.2, .16), [interiorWallMat, interiorWallMat, travMat, travMat, travMat, travMat]);
    strip.position.set(side * (ow / 2 + .66), 2.1, face + .06);
    strip.castShadow = strip.receiveShadow = true; set.add(strip);
  }

  // Exterior floor: dark slate tiles 1.2 m. Interior floor: warm polished stone.
  const fN = fbm(1024, 1024, 331, {scale: 300, octaves: 5}), fG = fbm(1024, 1024, 337, {scale: 5, octaves: 2});
  const floorMap = paint(1024, 1024, (x, y, i) => {
    const joint = (x % 512 < 2 || y % 512 < 2) ? .5 : 1;
    const v = (.16 + (fN[i] - .5) * .05 + (fG[i] - .5) * .035) * joint; return [v * 255, v * 255, v * 258];
  });
  const floorTex = texture(floorMap, {repeat: [1 / 2.4, 1 / 2.4]}); floorTex.offset.set(.5 - ow / 4.8, 0);
  const outside = new THREE.Mesh(new THREE.PlaneGeometry(S, 8), new THREE.MeshStandardMaterial({name: 'Floor_Outside', map: floorTex, roughness: .62}));
  outside.rotation.x = -Math.PI / 2; outside.position.set(0, 0, face + 4); outside.receiveShadow = true;
  // world-metre UVs so tiles line up with the portal
  const uv = outside.geometry.attributes.uv, pos = outside.geometry.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i), pos.getY(i) + 4);
  set.add(outside);
  const iN = fbm(512, 512, 341, {scale: 180, octaves: 5});
  const insideMat = new THREE.MeshStandardMaterial({name: 'Floor_Inside', roughness: .28,
    map: texture(paint(512, 512, (x, y, i) => { const v = .74 + (iN[i] - .5) * .08; return [v * 236, v * 226, v * 210]; }), {repeat: [2, 2]})});
  const room = {w: 3.6, d: 3.4, h: 2.95};
  const inside = new THREE.Mesh(new THREE.PlaneGeometry(room.w, room.d), insideMat);
  inside.rotation.x = -Math.PI / 2; inside.position.set(0, .001, back - room.d / 2); inside.receiveShadow = true; set.add(inside);
  const threshold = new THREE.Mesh(new THREE.BoxGeometry(ow, .012, face - back), new THREE.MeshStandardMaterial({color: 0x232324, roughness: .5}));
  threshold.position.set(0, .006, (face + back) / 2); threshold.receiveShadow = true; set.add(threshold);

  // Interior room: taupe walls, dark ceiling, a black ceiling track with one wall-washer.
  const backWallMat = new THREE.MeshStandardMaterial({name: 'Interior_BackWall', color: 0x8a7f73, roughness: .95});
  const plane = (w, h, p, r, mat) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(...p); m.rotation.set(...r); m.receiveShadow = true; set.add(m); return m; };
  plane(room.w, room.h, [0, room.h / 2, back - room.d], [0, 0, 0], backWallMat);
  plane(room.d, room.h, [-room.w / 2, room.h / 2, back - room.d / 2], [0, Math.PI / 2, 0], interiorWallMat);
  plane(room.d, room.h, [room.w / 2, room.h / 2, back - room.d / 2], [0, -Math.PI / 2, 0], interiorWallMat);
  plane(room.w, room.d, [0, room.h, back - room.d / 2], [Math.PI / 2, 0, 0], new THREE.MeshStandardMaterial({color: 0x3b3835, roughness: .95}));
  const black = new THREE.MeshStandardMaterial({color: 0x0c0c0c, roughness: .5, metalness: .4});
  const track = new THREE.Mesh(new THREE.BoxGeometry(2.4, .03, .04), black); track.position.set(0, room.h - .015, back - room.d + .55); set.add(track);
  const can = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, .12, 24), black); can.position.set(0, room.h - .1, back - room.d + .55); can.rotation.x = .5; set.add(can);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(.024, 24), new THREE.MeshBasicMaterial({color: new THREE.Color(0xffe2b8).multiplyScalar(4)}));
  lens.position.set(0, room.h - .158, back - room.d + .52); lens.rotation.x = Math.PI / 2 + .5; set.add(lens);

  // A soft skirting of shadow where outside floor meets the wall (cheap contact occlusion).
  const aoCanvas = paint(8, 64, (x, y) => { const v = 255 * (1 - Math.pow(1 - y / 63, 3) * .55); return [v, v, v]; });
  const ao = new THREE.Mesh(new THREE.PlaneGeometry(S, .5), new THREE.MeshBasicMaterial({map: texture(aoCanvas, {jpeg: false}), blending: THREE.MultiplyBlending, transparent: true, depthWrite: false, premultipliedAlpha: true}));
  ao.rotation.x = -Math.PI / 2; ao.position.set(0, .002, face + .25); ao.renderOrder = 2; set.add(ao);

  return {set, roomBack: back - room.d, washerTarget: new THREE.Vector3(0, 1.1, back - room.d)};
}

/* ───────────── scene ───────────── */
export async function createFilm(renderer, {source = 'glb'} = {}) {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a1a);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), .03).texture;
  scene.environmentIntensity = .14;

  const {set, washerTarget} = buildSet();
  scene.add(set);

  let door;
  if (source === 'glb') {
    try { door = (await new GLTFLoader().loadAsync('../../media/3d/liam-door.glb')).scene.getObjectByName('LiamDoor'); }
    catch (e) { console.warn('[film] GLB unavailable, building procedurally', e); }
  }
  door ||= buildDoor();
  door.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
  scene.add(door);
  const leaf = door.getObjectByName('Leaf');
  const layers = LAYERS.map((spec, i) => {
    const node = door.getObjectByName(spec.name);
    return {node, order: i, spread: node.userData.spread ?? spec.spread, fan: node.userData.fan ?? spec.fan, label: node.userData.labelHe ?? spec.label};
  });

  // Lights. Outside: soft overcast key from above-front + sky fill. Inside: warm wall-washer + bounce.
  const lights = [];
  const add = (light, base, jitter) => { light.userData = {base: base.clone(), jitter}; light.position.copy(base); scene.add(light); lights.push(light); return light; };
  scene.add(new THREE.HemisphereLight(0xe6e9ee, 0x2a2826, .1));
  // Sky: one shadow-casting directional light that samples a different direction of the front sky dome
  // on every accumulation pass. Averaged, that is soft sky occlusion — contact shadows under the layers,
  // darker jamb reveals, no floating panels. Directions are fixed per sample index → no flicker in the film.
  const sky = new THREE.DirectionalLight(0xeef1f5, 2.3);
  sky.userData = {dome: true}; sky.position.set(1.5, 8, 5); scene.add(sky);
  sky.target.position.set(0, 1, .5); scene.add(sky.target);
  sky.castShadow = true; sky.shadow.mapSize.set(4096, 4096);
  Object.assign(sky.shadow.camera, {left: -4.5, right: 4.5, top: 4.5, bottom: -2.5, near: .5, far: 24});
  sky.shadow.bias = -.00025; sky.shadow.normalBias = .02;
  lights.push(sky);
  // Key: a broad soft sun from upper-left front — gives the panels modelling and a readable shadow direction.
  const key = add(new THREE.DirectionalLight(0xf6f1ea, 1.5), new THREE.Vector3(-3.6, 7.5, 6.5), 1.4);
  key.target.position.set(.2, 1, .4); scene.add(key.target);
  key.castShadow = true; key.shadow.mapSize.set(4096, 4096);
  Object.assign(key.shadow.camera, {left: -4.5, right: 4.5, top: 4.5, bottom: -2.5, near: .5, far: 24});
  key.shadow.bias = -.00025; key.shadow.normalBias = .02;
  const washer = add(new THREE.SpotLight(0xffc88a, 22, 0, .6, .8, 2), new THREE.Vector3(0, 2.8, washerTarget.z + .62), .05);
  washer.target.position.copy(washerTarget).setY(.3); scene.add(washer.target);
  washer.castShadow = true; washer.shadow.mapSize.set(2048, 2048); washer.shadow.bias = -.0004;
  const bounce = add(new THREE.PointLight(0xffb070, 1.2, 6, 2), new THREE.Vector3(0, 1.0, washerTarget.z + 1.2), .3);
  const spillToDoor = add(new THREE.PointLight(0xffc690, .7, 4, 2), new THREE.Vector3(0, 2.2, -.9), .2);

  const camera = new THREE.PerspectiveCamera(30, 1, .05, 60);
  const target = new THREE.Vector3();

  function pose(t, aspect, jitter = null) {
    const s = timeline(t);
    leaf.rotation.y = THREE.MathUtils.degToRad(s.open);
    for (const L of layers) {
      // exterior leaves the stack first, returns last
      const delay = L.order / (layers.length - 1) * .35;
      const e = smooth(clamp((s.explode - delay) / .65));
      const presenting = s.present * Math.max(0, 1 - Math.abs(s.focus - L.order)) ** 2;
      L.node.position.set(-.5 * smooth(presenting), 0, L.spread * e);   // local −X = toward the camera when edge-on
      L.node.rotation.y = L.fan * s.fan * e + .28 * smooth(presenting);  // presented layer turns its face to us
    }
    // Framing: fit a 3.0 × 3.25 m portal box, whichever dimension binds for this aspect.
    target.set(...s.tgt);
    camera.position.set(...s.cam);
    const dist = camera.position.distanceTo(target);
    const halfH = Math.max(1.85, 2.6 / 2 / aspect) * s.frame;
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(halfH / dist));
    camera.aspect = aspect;
    camera.lookAt(target);
    if (jitter) {
      for (const l of lights) {
        if (l.userData.dome) {
          // cosine-weighted direction on the front half of the upper hemisphere
          const u = jitter.rnd(), v = jitter.rnd(), r = Math.sqrt(u), phi = Math.PI * (v - .5);
          const dir = new THREE.Vector3(r * Math.sin(phi), Math.sqrt(1 - u), r * Math.cos(phi));
          l.position.copy(l.target.position).addScaledVector(dir.normalize(), 11);
          continue;
        }
        const j = l.userData.jitter;
        l.position.copy(l.userData.base).add(new THREE.Vector3(jitter.rnd() - .5, jitter.rnd() - .5, jitter.rnd() - .5).multiplyScalar(j * 2));
      }
    }
    camera.updateProjectionMatrix();
    return s;
  }

  // Screen anchors for HTML callouts: top-centre of each layer, in 0..1 viewport coords.
  function anchors() {
    door.updateMatrixWorld(true);
    return layers.map(L => {
      const v = new THREE.Vector3(DOOR.width / 2 - DOOR.pivotOffset, DOOR.height * .62, 0).applyMatrix4(L.node.matrixWorld).project(camera);
      return [+(v.x * .5 + .5).toFixed(4), +(-v.y * .5 + .5).toFixed(4)];
    });
  }

  return {scene, camera, pose, anchors, layers, door};
}

/* ───────────── accumulation: jittered AA + area-soft shadows ───────────── */
export function createAccumulator(renderer, width, height) {
  const opts = {type: THREE.HalfFloatType, depthBuffer: true, samples: 4};
  const sample = new THREE.WebGLRenderTarget(width, height, opts);
  const accum = new THREE.WebGLRenderTarget(width, height, {type: THREE.HalfFloatType, depthBuffer: false});
  const quadScene = new THREE.Scene(), quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const addMat = new THREE.MeshBasicMaterial({map: sample.texture, blending: THREE.AdditiveBlending, transparent: true, depthTest: false, depthWrite: false, toneMapped: false});
  // Final pass: tone mapping + sRGB, a soft optical vignette and very fine static grain (fixed seed → no shimmer).
  const showMat = new THREE.ShaderMaterial({
    uniforms: {map: {value: accum.texture}, aspect: {value: width / height}},
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
    fragmentShader: `
      uniform sampler2D map; uniform float aspect; varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){
        vec4 c = texture2D(map, vUv);
        vec2 d = (vUv - .5) * vec2(min(aspect, 1.) , min(1. / aspect, 1.)) * 1.6;
        c.rgb *= mix(1., smoothstep(1.3, .15, length(d)), .5);
        c.rgb *= 1. + (hash(floor(gl_FragCoord.xy)) - .5) * .025;
        gl_FragColor = vec4(c.rgb, 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    depthTest: false, depthWrite: false, toneMapped: true
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), addMat); quadScene.add(quad);

  return function render(film, t, {samples = 32, seed = 1} = {}) {
    const rnd = random(seed * 9973);   // same sample pattern every frame → stable, flicker-free film
    const jitter = {rnd};
    renderer.setRenderTarget(accum); renderer.setClearColor(0x000000, 0); renderer.clear();
    addMat.opacity = 1 / samples;
    for (let i = 0; i < samples; i++) {
      film.pose(t, width / height, jitter);
      film.camera.setViewOffset(width, height, rnd() - .5, rnd() - .5, width, height);
      film.camera.updateProjectionMatrix();
      renderer.setRenderTarget(sample); renderer.clear(); renderer.render(film.scene, film.camera);
      quad.material = addMat; renderer.setRenderTarget(accum); renderer.autoClear = false; renderer.render(quadScene, quadCam); renderer.autoClear = true;
    }
    film.camera.clearViewOffset();
    quad.material = showMat; renderer.setRenderTarget(null); renderer.render(quadScene, quadCam);
  };
}
