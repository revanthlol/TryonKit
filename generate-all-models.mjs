#!/usr/bin/env node
/**
 * generate-all-models.mjs
 *
 * Generates all 6 placeholder GLB jewellery models:
 *   - earring-dangling.glb  (teardrop dangle)
 *   - earring-hoop.glb      (circular hoop)
 *   - earring-stud.glb      (small sphere stud)
 *   - necklace-chain.glb    (chain of linked rings)
 *   - nose-pin.glb          (tiny stud)
 *   - nose-ring.glb         (small open hoop)
 */

import { writeFileSync, mkdirSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR   = path.resolve(__dirname, 'packages/web/public/models')
mkdirSync(OUT_DIR, { recursive: true })

// ─── Geometry primitives ──────────────────────────────────────────

function makeCylinder(rTop, rBot, height, segs) {
  const pos = [], idx = []
  const hh = height / 2
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI * 2
    const c = Math.cos(a), s = Math.sin(a)
    pos.push(c * rTop, hh, s * rTop)
    pos.push(c * rBot, -hh, s * rBot)
  }
  for (let i = 0; i < segs; i++) {
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3
    idx.push(a, b, c, b, d, c)
  }
  return { positions: pos, indices: idx }
}

function makeSphere(radius, wSegs, hSegs, sx = 1, sy = 1, sz = 1, oy = 0) {
  const pos = [], idx = []
  for (let y = 0; y <= hSegs; y++) {
    const v = y / hSegs, phi = v * Math.PI
    for (let x = 0; x <= wSegs; x++) {
      const u = x / wSegs, theta = u * Math.PI * 2
      pos.push(
        radius * Math.sin(phi) * Math.cos(theta) * sx,
        radius * Math.cos(phi) * sy + oy,
        radius * Math.sin(phi) * Math.sin(theta) * sz
      )
    }
  }
  for (let y = 0; y < hSegs; y++)
    for (let x = 0; x < wSegs; x++) {
      const a = y * (wSegs + 1) + x, b = a + wSegs + 1
      idx.push(a, b, a + 1, b, b + 1, a + 1)
    }
  return { positions: pos, indices: idx }
}

function makeTorus(radius, tube, radSegs, tubSegs, arc = 1) {
  const pos = [], idx = []
  for (let j = 0; j <= radSegs; j++)
    for (let i = 0; i <= tubSegs; i++) {
      const u = (i / tubSegs) * Math.PI * 2 * arc
      const v = (j / radSegs) * Math.PI * 2
      pos.push(
        (radius + tube * Math.cos(v)) * Math.cos(u),
        (radius + tube * Math.cos(v)) * Math.sin(u),
        tube * Math.sin(v)
      )
    }
  for (let j = 0; j < radSegs; j++)
    for (let i = 0; i < tubSegs; i++) {
      const a = (tubSegs + 1) * j + i, b = (tubSegs + 1) * (j + 1) + i
      idx.push(a, b, a + 1, b, b + 1, a + 1)
    }
  return { positions: pos, indices: idx }
}

function offsetY(geom, dy) {
  for (let i = 1; i < geom.positions.length; i += 3)
    geom.positions[i] += dy
  return geom
}

function mergeGeometries(parts) {
  let allPos = [], allIdx = [], vOff = 0
  for (const p of parts) {
    allPos = allPos.concat(p.positions)
    allIdx = allIdx.concat(p.indices.map(i => i + vOff))
    vOff += p.positions.length / 3
  }
  return { positions: allPos, indices: allIdx }
}

// ─── GLB writer ───────────────────────────────────────────────────

function writeGLB(filepath, positions, indices, material) {
  let minX = Infinity, minY = Infinity, minZ = Infinity
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity
  for (let i = 0; i < positions.length; i += 3) {
    minX = Math.min(minX, positions[i])
    minY = Math.min(minY, positions[i + 1])
    minZ = Math.min(minZ, positions[i + 2])
    maxX = Math.max(maxX, positions[i])
    maxY = Math.max(maxY, positions[i + 1])
    maxZ = Math.max(maxZ, positions[i + 2])
  }

  const posF32 = new Float32Array(positions)
  const idxU16 = new Uint16Array(indices)
  const pad4 = n => Math.ceil(n / 4) * 4
  const posByteLen = pad4(posF32.buffer.byteLength)
  const idxByteLen = pad4(idxU16.buffer.byteLength)

  const binBuf = Buffer.alloc(posByteLen + idxByteLen, 0)
  Buffer.from(posF32.buffer).copy(binBuf, 0)
  Buffer.from(idxU16.buffer).copy(binBuf, posByteLen)
  const totalBinLen = binBuf.byteLength

  const gltf = {
    asset: { version: '2.0', generator: 'TryonKit model-gen' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: path.basename(filepath, '.glb') }],
    meshes: [{
      name: 'mesh',
      primitives: [{ attributes: { POSITION: 0 }, indices: 1, material: 0 }]
    }],
    materials: [material],
    accessors: [
      {
        bufferView: 0, componentType: 5126,
        count: positions.length / 3, type: 'VEC3',
        min: [minX, minY, minZ], max: [maxX, maxY, maxZ],
      },
      {
        bufferView: 1, componentType: 5123,
        count: indices.length, type: 'SCALAR',
      }
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: posF32.buffer.byteLength, target: 34962 },
      { buffer: 0, byteOffset: posByteLen, byteLength: idxU16.buffer.byteLength, target: 34963 },
    ],
    buffers: [{ byteLength: totalBinLen }],
  }

  const jsonBytes = Buffer.from(JSON.stringify(gltf), 'utf8')
  const jsonPadLen = pad4(jsonBytes.length)
  const jsonPadded = Buffer.alloc(jsonPadLen, 0x20)
  jsonBytes.copy(jsonPadded)

  const totalLen = 12 + 8 + jsonPadLen + 8 + totalBinLen
  const out = Buffer.alloc(totalLen)
  let off = 0
  out.writeUInt32LE(0x46546C67, off); off += 4  // 'glTF'
  out.writeUInt32LE(2, off); off += 4            // version
  out.writeUInt32LE(totalLen, off); off += 4     // total
  out.writeUInt32LE(jsonPadLen, off); off += 4   // JSON chunk len
  out.writeUInt32LE(0x4E4F534A, off); off += 4   // 'JSON'
  jsonPadded.copy(out, off); off += jsonPadLen
  out.writeUInt32LE(totalBinLen, off); off += 4  // BIN chunk len
  out.writeUInt32LE(0x004E4942, off); off += 4   // 'BIN\0'
  binBuf.copy(out, off)

  writeFileSync(filepath, out)
  console.log(`  ✅ ${path.basename(filepath)} — ${positions.length / 3} verts, ${indices.length / 3} tris, ${(out.byteLength / 1024).toFixed(1)} KB`)
}

// ─── Materials ────────────────────────────────────────────────────

const GOLD = {
  name: 'gold',
  pbrMetallicRoughness: {
    baseColorFactor: [0.788, 0.659, 0.298, 1.0],
    metallicFactor: 0.95,
    roughnessFactor: 0.15,
  }
}

const SILVER = {
  name: 'silver',
  pbrMetallicRoughness: {
    baseColorFactor: [0.82, 0.82, 0.85, 1.0],
    metallicFactor: 0.95,
    roughnessFactor: 0.2,
  }
}

const ROSE_GOLD = {
  name: 'rose-gold',
  pbrMetallicRoughness: {
    baseColorFactor: [0.76, 0.55, 0.45, 1.0],
    metallicFactor: 0.9,
    roughnessFactor: 0.18,
  }
}

// ─── Model definitions ───────────────────────────────────────────

console.log('Generating TryonKit placeholder models...\n')

// 1. Earring — Dangling (hook + rod + bead + teardrop)
{
  const parts = [
    offsetY(makeTorus(0.06, 0.012, 8, 16, 0.75), 0.02),  // hook
    offsetY(makeCylinder(0.008, 0.008, 0.12, 8), -0.11),  // rod
    makeSphere(0.022, 8, 8, 1, 1, 1, -0.18),              // bead
    makeSphere(0.075, 12, 12, 0.7, 1.2, 0.5, -0.32),      // teardrop
  ]
  const { positions, indices } = mergeGeometries(parts)
  writeGLB(path.join(OUT_DIR, 'earring-dangling.glb'), positions, indices, GOLD)
}

// 2. Earring — Hoop (single torus ring)
{
  const hoop = makeTorus(0.08, 0.012, 16, 24, 1.0)
  // Rotate the torus so it hangs vertically (swap Y/Z)
  const pos = hoop.positions
  for (let i = 0; i < pos.length; i += 3) {
    const y = pos[i + 1], z = pos[i + 2]
    pos[i + 1] = -z   // ring hangs down
    pos[i + 2] = y
  }
  writeGLB(path.join(OUT_DIR, 'earring-hoop.glb'), pos, hoop.indices, GOLD)
}

// 3. Earring — Stud (small sphere + tiny backing disc)
{
  const parts = [
    makeSphere(0.035, 10, 10),                             // front gem
    offsetY(makeCylinder(0.015, 0.015, 0.01, 8), -0.03),  // backing
  ]
  const { positions, indices } = mergeGeometries(parts)
  writeGLB(path.join(OUT_DIR, 'earring-stud.glb'), positions, indices, SILVER)
}

// 4. Necklace — Chain (series of linked torus rings along a curve)
{
  const parts = []
  const chainLen = 15
  const spread = 0.26  // total width of the chain arc
  for (let i = 0; i < chainLen; i++) {
    const t = (i / (chainLen - 1)) * Math.PI  // 0 to π
    const x = (i / (chainLen - 1) - 0.5) * spread * 2
    const y = Math.sin(t) * -0.04  // gentle sag
    const link = makeTorus(0.012, 0.003, 6, 8)
    // Alternate link orientation for chain look
    const p = link.positions
    if (i % 2 === 0) {
      for (let j = 0; j < p.length; j += 3) {
        const py = p[j + 1], pz = p[j + 2]
        p[j + 1] = -pz
        p[j + 2] = py
      }
    }
    for (let j = 0; j < p.length; j += 3) {
      p[j] += x
      p[j + 1] += y
    }
    parts.push(link)
  }
  // Add a small pendant in the center
  parts.push(offsetY(makeSphere(0.025, 8, 8, 0.8, 1.1, 0.6), -0.06))
  const { positions, indices } = mergeGeometries(parts)
  writeGLB(path.join(OUT_DIR, 'necklace-chain.glb'), positions, indices, ROSE_GOLD)
}

// 5. Nose pin (tiny sphere)
{
  const pin = makeSphere(0.015, 8, 8)
  writeGLB(path.join(OUT_DIR, 'nose-pin.glb'), pin.positions, pin.indices, SILVER)
}

// 6. Nose ring (small open hoop)
{
  const ring = makeTorus(0.025, 0.004, 10, 16, 0.7)
  // Rotate so it hangs down from nostril
  const pos = ring.positions
  for (let i = 0; i < pos.length; i += 3) {
    const y = pos[i + 1], z = pos[i + 2]
    pos[i + 1] = -z
    pos[i + 2] = y
  }
  writeGLB(path.join(OUT_DIR, 'nose-ring.glb'), pos, ring.indices, GOLD)
}

console.log('\nAll models generated in', OUT_DIR)
