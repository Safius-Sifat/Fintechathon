export const MAX_PROOF_BYTES = 20 * 1024 * 1024;
export async function readProofBytes(
  response: Response,
  assertOwner: () => void,
): Promise<Uint8Array> {
  assertOwner();
  if (
    !response.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("application/zip")
  )
    throw new Error("The service did not return a proof ZIP.");
  const length = response.headers.get("content-length");
  if (
    length !== null &&
    (!/^\d+$/.test(length) || Number(length) > MAX_PROOF_BYTES)
  )
    throw new Error("The proof ZIP exceeds this phone's 20 MB export limit.");
  const reader = response.body?.getReader?.();
  let bytes: Uint8Array;
  if (reader) {
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
      while (true) {
        const chunk = await reader.read();
        assertOwner();
        if (chunk.done) break;
        total += chunk.value.byteLength;
        if (total > MAX_PROOF_BYTES)
          throw new Error(
            "The proof ZIP exceeds this phone's 20 MB export limit.",
          );
        chunks.push(chunk.value);
      }
    } catch (error) {
      await reader.cancel().catch(() => undefined);
      throw error;
    } finally {
      reader.releaseLock();
    }
    bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
  } else {
    if (length === null)
      throw new Error(
        "The service must report the proof size before this phone can download it.",
      );
    bytes = new Uint8Array(await response.arrayBuffer());
    assertOwner();
    if (bytes.length > MAX_PROOF_BYTES)
      throw new Error("The proof ZIP exceeds this phone's 20 MB export limit.");
  }
  assertOwner();
  if (
    bytes.length < 4 ||
    bytes[0] !== 80 ||
    bytes[1] !== 75 ||
    !((bytes[2] === 3 && bytes[3] === 4) || (bytes[2] === 5 && bytes[3] === 6))
  )
    throw new Error("The proof ZIP is malformed.");
  return bytes;
}
