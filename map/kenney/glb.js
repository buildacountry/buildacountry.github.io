// Small GLB loader for the Kenney packs: meshes, one colour texture, skins and animations.
// Returns { scene, animations }. Written for these files only, not for every glTF.
(function () {
  const T = THREE;
  const texCache = {};
  const COMP = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array, 5121: Uint8Array, 5122: Int16Array, 5120: Int8Array };
  const SIZE = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
  function texture(url) {
    if (texCache[url]) return texCache[url];
    const t = new T.TextureLoader().load(url);
    t.flipY = false;
    return (texCache[url] = t);
  }
  async function loadGLB(url) {
    let buf, json, binStart = 0;
    if (url.endsWith('.json')) {
      // glTF JSON with the binary buffer embedded as base64
      json = await (await fetch(url)).json();
      const bytes = atob(json.buffers[0].uri.split(',')[1]), u8 = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) u8[i] = bytes.charCodeAt(i);
      buf = u8.buffer;
    } else {
      buf = await (await fetch(url)).arrayBuffer();
      const jsonLen = new DataView(buf).getUint32(12, true);
      json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, jsonLen)));
      binStart = 20 + jsonLen + 8;
    }
    const acc = i => {
      const a = json.accessors[i], bv = json.bufferViews[a.bufferView], C = COMP[a.componentType], n = SIZE[a.type];
      const off = binStart + (bv.byteOffset || 0) + (a.byteOffset || 0);
      const stride = bv.byteStride;
      if (!stride || stride === n * C.BYTES_PER_ELEMENT) return { arr: new C(buf.slice(off, off + a.count * n * C.BYTES_PER_ELEMENT)), n };
      const out = new C(a.count * n);
      for (let k = 0; k < a.count; k++) out.set(new C(buf, off + k * stride, n), k * n);
      return { arr: out, n };
    };
    const base = url.slice(0, url.lastIndexOf('/') + 1);
    const mats = (json.materials || []).map(m => {
      const pbr = m.pbrMetallicRoughness || {};
      const o = { roughness: 0.85, metalness: 0, side: m.doubleSided ? T.DoubleSide : T.FrontSide };
      if (pbr.baseColorTexture) o.map = texture(base + json.images[json.textures[pbr.baseColorTexture.index].source].uri);
      if (pbr.baseColorFactor) o.color = new T.Color(...pbr.baseColorFactor.slice(0, 3));
      return new T.MeshStandardMaterial(o);
    });
    const geoms = json.meshes.map(m => m.primitives.map(p => {
      const g = new T.BufferGeometry();
      const map = { POSITION: 'position', NORMAL: 'normal', TEXCOORD_0: 'uv', JOINTS_0: 'skinIndex', WEIGHTS_0: 'skinWeight' };
      for (const k in map) if (p.attributes[k] !== undefined) { const { arr, n } = acc(p.attributes[k]); g.setAttribute(map[k], new T.BufferAttribute(arr, n)); }
      if (p.indices !== undefined) g.setIndex(new T.BufferAttribute(acc(p.indices).arr, 1));
      return { g, mat: mats[p.material] || new T.MeshStandardMaterial() };
    }));
    const jointSet = new Set(); (json.skins || []).forEach(s => s.joints.forEach(j => jointSet.add(j)));
    const objs = json.nodes.map((n, i) => {
      const o = jointSet.has(i) ? new T.Bone() : new T.Group();
      o.name = n.name || 'node' + i;
      if (n.matrix) new T.Matrix4().fromArray(n.matrix).decompose(o.position, o.quaternion, o.scale);
      if (n.translation) o.position.fromArray(n.translation);
      if (n.rotation) o.quaternion.fromArray(n.rotation);
      if (n.scale) o.scale.fromArray(n.scale);
      return o;
    });
    const skinned = [];
    json.nodes.forEach((n, i) => {
      (n.children || []).forEach(c => objs[i].add(objs[c]));
      if (n.mesh !== undefined) geoms[n.mesh].forEach(({ g, mat }) => {
        let m; if (n.skin !== undefined) { const sm = mat.clone(); sm.skinning = true; m = new T.SkinnedMesh(g, sm); } else m = new T.Mesh(g, mat);
        m.castShadow = true; m.receiveShadow = true; m.name = (n.name || 'mesh') + '-m'; m.frustumCulled = n.skin === undefined;
        if (n.skin !== undefined) skinned.push([m, n.skin]);
        objs[i].add(m);
      });
    });
    const root = new T.Group();
    json.scenes[json.scene || 0].nodes.forEach(i => root.add(objs[i]));
    root.updateMatrixWorld(true);
    skinned.forEach(([m, si]) => {
      const s = json.skins[si], ibm = acc(s.inverseBindMatrices).arr;
      const bones = s.joints.map(j => objs[j]);
      const inv = bones.map((_, k) => new T.Matrix4().fromArray(ibm, k * 16));
      m.bind(new T.Skeleton(bones, inv), m.matrixWorld);
    });
    const animations = (json.animations || []).map(a => {
      const tracks = a.channels.map(ch => {
        const s = a.samplers[ch.sampler], node = objs[ch.target.node];
        const times = acc(s.input).arr, vals = acc(s.output).arr;
        const path = { translation: 'position', rotation: 'quaternion', scale: 'scale' }[ch.target.path];
        const Track = path === 'quaternion' ? T.QuaternionKeyframeTrack : T.VectorKeyframeTrack;
        return new Track(node.name + '.' + path, Array.from(times), Array.from(vals));
      });
      return new T.AnimationClip(a.name, -1, tracks);
    });
    return { scene: root, animations };
  }
  window.loadGLB = loadGLB;
})();
