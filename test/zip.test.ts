import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createZip } from '../src/lib/zip.ts'

/** Reads back local file headers only — enough to prove the writer round-trips. */
async function readZipEntries(blob: Blob): Promise<{ name: string; data: Uint8Array }[]> {
  const buf = new Uint8Array(await blob.arrayBuffer())
  const view = new DataView(buf.buffer)
  const entries: { name: string; data: Uint8Array }[] = []
  let offset = 0

  while (offset < buf.length && view.getUint32(offset, true) === 0x04034b50) {
    const size = view.getUint32(offset + 18, true)
    const nameLen = view.getUint16(offset + 26, true)
    const extraLen = view.getUint16(offset + 28, true)
    const nameStart = offset + 30
    const dataStart = nameStart + nameLen + extraLen
    entries.push({
      name: new TextDecoder().decode(buf.subarray(nameStart, nameStart + nameLen)),
      data: buf.subarray(dataStart, dataStart + size),
    })
    offset = dataStart + size
  }
  return entries
}

test('round-trips file names and bytes exactly', async () => {
  const a = new Uint8Array([1, 2, 3, 4, 5])
  const b = new Uint8Array(500).map((_, i) => i % 256)
  const zip = createZip([
    { name: 'photostrip.png', data: a },
    { name: 'photo-1.png', data: b },
  ])

  const entries = await readZipEntries(zip)
  assert.equal(entries.length, 2)
  assert.equal(entries[0].name, 'photostrip.png')
  assert.deepEqual([...entries[0].data], [...a])
  assert.equal(entries[1].name, 'photo-1.png')
  assert.deepEqual([...entries[1].data], [...b])
})

test('produces a valid end-of-central-directory record', async () => {
  const zip = createZip([{ name: 'x.png', data: new Uint8Array([9, 9, 9]) }])
  const buf = new Uint8Array(await zip.arrayBuffer())
  const view = new DataView(buf.buffer)

  // EOCD signature must be the last 22 bytes (no comment written).
  const eocdOffset = buf.length - 22
  assert.equal(view.getUint32(eocdOffset, true), 0x06054b50)
  assert.equal(view.getUint16(eocdOffset + 8, true), 1, 'one entry on disk')
  assert.equal(view.getUint16(eocdOffset + 10, true), 1, 'one entry total')
})

test('an empty file list still produces a well-formed (empty) archive', async () => {
  const zip = createZip([])
  const buf = new Uint8Array(await zip.arrayBuffer())
  assert.equal(buf.length, 22, 'just the EOCD record')
  const view = new DataView(buf.buffer)
  assert.equal(view.getUint32(0, true), 0x06054b50)
  assert.equal(view.getUint16(8, true), 0)
})
