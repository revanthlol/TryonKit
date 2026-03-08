#!/usr/bin/env node
/**
 * generate-all-models.mjs
 *
 * Generates 6 placeholder GLB jewellery models at proper sizes:
 *   Earrings:  0.15–0.20 units (visible on face)
 *   Necklace:  0.35 units wide
 *   Nose:      0.015–0.02 units
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
  for (let i = 1; i < geom.positions.length; i += 3) geom.positions[i] += dy
  return geom
}

function rotateXZ(geom) {
  const p = geom.positions
  for (let i = 0; i < p.length; i += 3) {
    const y = p[i + 1], z = p[i + 2]
    p[i + 1] = -z; p[i + 2] = y
  }
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
    minX = Math.min(minX, positions[i]);     maxX = Math.max(maxX, positions[i])
    minY = Math.min(minY, positions[i + 1]); maxY = Math.max(maxY, positions[i + 1])
    minZ = Math.min(minZ, positions[i + 2]); maxZ = Math.max(maxZ, positions[i + 2])
  }
  const posF32 = new Float32Array(positions)
  const idxU16 = new Uint16Array(indices)
  const pad4 = n => Math.ceil(n / 4) * 4
  const posBL = pad4(posF32.buffer.byteLength), idxBL = pad4(idxU16.buffer.byteLength)
  const binBuf = Buffer.alloc(posBL + idxBL, 0)
  Buffer.from(posF32.buffer).copy(binBuf, 0)
  Buffer.from(idxU16.buffer).copy(binBuf, posBL)
  const gltf = {
    asset: { version: '2.0', generator: 'TryonKit' }, scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: path.basename(filepath, '.glb') }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1, material: 0 }] }],
    materials: [material],
    accessors: [
      { bufferView: 0, componentType: 5126, count: positions.length / 3, type: 'VEC3', min: [minX, minY, minZ], max: [maxX, maxY, maxZ] },
      { bufferView: 1, componentType: 5123, count: indices.length, type: 'SCALAR' },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: posF32.buffer.byteLength, target: 34962 },
      { buffer: 0, byteOffset: posBL, byteLength: idxU16.buffer.byteLength, target: 34963 },
    ],
    buffers: [{ byteLength: binBuf.byteLength }],
  }
  const jb = Buffer.from(JSON.stringify(gltf), 'utf8'), jpl = pad4(jb.length)
  const jp = Buffer.alloc(jpl, 0x20); jb.copy(jp)
  const tl = 12 + 8 + jpl + 8 + binBuf.byteLength, out = Buffer.alloc(tl)
  let o = 0
  out.writeUInt32LE(0x46546C67, o); o += 4; out.writeUInt32LE(2, o); o += 4
  out.writeUInt32LE(tl, o); o += 4; out.writeUInt32LE(jpl, o); o += 4
  out.writeUInt32LE(0x4E4F534A, o); o += 4; jp.copy(out, o); o += jpl
  out.writeUInt32LE(binBuf.byteLength, o); o += 4; out.writeUInt32LE(0x004E4942, o); o += 4
  binBuf.copy(out, o)
  writeFileSync(filepath, out)
  const h = maxY - minY, w = maxX - minX
  console.log(`  ${path.basename(filepath).padEnd(24)} ${h.toFixed(3)}h  ${w.toFixed(3)}w  ${(out.byteLength / 1024).toFixed(1)}KB`)
}

// ─── Materials ────────────────────────────────────────────────────
const GOLD = { name: 'gold', pbrMetallicRoughness: { baseColorFactor: [0.83, 0.69, 0.22, 1], metallicFactor: 0.95, roughnessFactor: 0.12 } }
const SILVER = { name: 'silver', pbrMetallicRoughness: { baseColorFactor: [0.85, 0.85, 0.88, 1], metallicFactor: 0.95, roughnessFactor: 0.18 } }
const ROSE = { name: 'rose', pbrMetallicRoughness: { baseColorFactor: [0.76, 0.55, 0.45, 1], metallicFactor: 0.9, roughnessFactor: 0.15 } }

// ─── Generate ─────────────────────────────────────────────────────
console.log('Generating models...\n')

// 1. Dangling earring — total height ~0.20, origin at top (hook)
{
  const S = 0.4
  const parts = [
    offsetY(makeTorus(0.06 * S, 0.014 * S, 8, 16, 0.75), 0.02 * S),
    offsetY(makeCylinder(0.009 * S, 0.009 * S, 0.10 * S, 8), -0.09 * S),
    makeSphere(0.025 * S, 10, 10, 1, 1, 1, -0.16 * S),
    makeSphere(0.065 * S, 14, 14, 0.7, 1.3, 0.5, -0.28 * S),
  ]
  const { positions, indices } = mergeGeometries(parts)
  writeGLB(path.join(OUT_DIR, 'earring-dangling.glb'), positions, indices, GOLD)
}

// 2. Hoop earring — diameter ~0.08
{
  const hoop = rotateXZ(makeTorus(0.04, 0.007, 16, 24, 1.0))
  writeGLB(path.join(OUT_DIR, 'earring-hoop.glb'), hoop.positions, hoop.indices, GOLD)
}

// 3. Stud earring — diameter ~0.035
{
  const parts = [
    makeSphere(0.018, 12, 12),
    offsetY(makeCylinder(0.006, 0.006, 0.005, 8), -0.016),
  ]
  const { positions, indices } = mergeGeometries(parts)
  writeGLB(path.join(OUT_DIR, 'earring-stud.glb'), positions, indices, SILVER)
}

// 4. Necklace chain — width ~0.35
{
  const parts = []
  const N = 21, spread = 0.17
  for (let i = 0; i < N; i++) {
    const t = (i / (N - 1)) * Math.PI
    const x = (i / (N - 1) - 0.5) * spread * 2
    const y = Math.sin(t) * -0.025
    const link = makeTorus(0.008, 0.0025, 6, 10)
    if (i % 2 === 0) rotateXZ(link)
    for (let j = 0; j < link.positions.length; j += 3) {
      link.positions[j] += x; link.positions[j + 1] += y
    }
    parts.push(link)
  }
  parts.push(offsetY(makeSphere(0.014, 10, 10, 0.8, 1.2, 0.6), -0.04))
  const { positions, indices } = mergeGeometries(parts)
  writeGLB(path.join(OUT_DIR, 'necklace-chain.glb'), positions, indices, ROSE)
}

// 5. Nose pin — diameter ~0.015
{
  const pin = makeSphere(0.0075, 10, 10)
  writeGLB(path.join(OUT_DIR, 'nose-pin.glb'), pin.positions, pin.indices, SILVER)
}

// 6. Nose ring — diameter ~0.025
{
  const ring = rotateXZ(makeTorus(0.012, 0.002, 12, 18, 0.7))
  writeGLB(path.join(OUT_DIR, 'nose-ring.glb'), ring.positions, ring.indices, GOLD)
}

console.log('\nDone.')
