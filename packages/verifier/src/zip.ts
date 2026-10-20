import { crc32 } from "node:zlib";

const MAX_FILES = 256;
const MAX_BYTES = 64 * 1024 * 1024;
const SAFE_PATH = /^[A-Za-z0-9._/-]{1,200}$/;

// Reads the uncompressed ("stored") ZIP the Mandate export writes. Anything
// else is refused: compression, unsafe paths, duplicates, bad checksums or
// oversized archives. Nothing inside is ever executed.
export function readStoredZip(buf: Buffer): Map<string, Buffer> {
  if (buf.length > MAX_BYTES) throw new Error("Archive too large");
  const files = new Map<string, Buffer>();
  let offset = 0;
  while (offset + 4 <= buf.length && buf.readUInt32LE(offset) === 0x04034b50) {
    if (files.size >= MAX_FILES) throw new Error("Too many files in archive");
    const flags = buf.readUInt16LE(offset + 6);
    const method = buf.readUInt16LE(offset + 8);
    const crc = buf.readUInt32LE(offset + 14);
    const size = buf.readUInt32LE(offset + 18);
    const rawSize = buf.readUInt32LE(offset + 22);
    const nameLen = buf.readUInt16LE(offset + 26);
    const extraLen = buf.readUInt16LE(offset + 28);
    if (method !== 0 || size !== rawSize || (flags & 0x08) !== 0)
      throw new Error("Only uncompressed archive entries are accepted");
    const nameStart = offset + 30;
    const name = buf.subarray(nameStart, nameStart + nameLen).toString("utf8");
    if (
      !SAFE_PATH.test(name) ||
      name.split("/").some((p) => p === "" || p === "." || p === "..")
    )
      throw new Error(`Unsafe archive path ${name}`);
    if (files.has(name)) throw new Error(`Duplicate archive path ${name}`);
    const dataStart = nameStart + nameLen + extraLen;
    const data = buf.subarray(dataStart, dataStart + size);
    if (data.length !== size || crc32(data) >>> 0 !== crc)
      throw new Error(`Corrupt archive entry ${name}`);
    files.set(name, Buffer.from(data));
    offset = dataStart + size;
  }
  if (files.size === 0) throw new Error("Not a Mandate evidence archive");
  return files;
}
