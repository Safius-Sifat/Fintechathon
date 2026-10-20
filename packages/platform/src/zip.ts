import { crc32 } from "node:zlib";

const SAFE_PATH = /^[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)?$/;

// Minimal stored (uncompressed) ZIP for evidence bundles. Paths are normalized
// and bounded: at most one directory level, no "..", no absolute paths.
export function storedZip(
  files: readonly { path: string; bytes: Uint8Array }[],
): Buffer {
  const local: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  const seen = new Set<string>();
  for (const { path, bytes } of files) {
    if (
      !SAFE_PATH.test(path) ||
      path.split("/").some((p) => p === "." || p === "..") ||
      seen.has(path)
    )
      throw new Error("Unsafe or duplicate archive path");
    seen.add(path);
    const name = Buffer.from(path, "utf8");
    const data = Buffer.from(bytes);
    const crc = crc32(data);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0x0800, 6); // UTF-8 names
    header.writeUInt16LE(0, 8); // stored
    header.writeUInt32LE(0x00210000, 10); // fixed 1980-01-01 timestamp for reproducible bytes
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(data.length, 18);
    header.writeUInt32LE(data.length, 22);
    header.writeUInt16LE(name.length, 26);
    local.push(header, name, data);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4);
    entry.writeUInt16LE(20, 6);
    entry.writeUInt16LE(0x0800, 8);
    entry.writeUInt32LE(0x00210000, 12);
    entry.writeUInt32LE(crc, 16);
    entry.writeUInt32LE(data.length, 20);
    entry.writeUInt32LE(data.length, 24);
    entry.writeUInt16LE(name.length, 28);
    entry.writeUInt32LE(offset, 42);
    central.push(entry, name);
    offset += header.length + name.length + data.length;
  }
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, directory, end]);
}

// Reads back a stored ZIP written by storedZip (used by tests and verifiers).
export function readStoredZip(zip: Buffer): Map<string, Buffer> {
  const out = new Map<string, Buffer>();
  const end = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (end < 0) throw new Error("Not a ZIP archive");
  let p = zip.readUInt32LE(end + 16);
  for (let i = 0; i < zip.readUInt16LE(end + 10); i++) {
    if (zip.readUInt32LE(p) !== 0x02014b50 || zip.readUInt16LE(p + 10) !== 0)
      throw new Error("Unsupported ZIP entry");
    const size = zip.readUInt32LE(p + 24);
    const nameLength = zip.readUInt16LE(p + 28);
    const name = zip.subarray(p + 46, p + 46 + nameLength).toString("utf8");
    const at = zip.readUInt32LE(p + 42);
    const start =
      at + 30 + zip.readUInt16LE(at + 26) + zip.readUInt16LE(at + 28);
    const data = zip.subarray(start, start + size);
    if (crc32(data) !== zip.readUInt32LE(p + 16))
      throw new Error("ZIP entry checksum mismatch");
    out.set(name, Buffer.from(data));
    p += 46 + nameLength;
  }
  return out;
}
