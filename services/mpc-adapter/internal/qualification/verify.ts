import { readFileSync } from 'node:fs';
import { recoverAddress, isHex } from '../../../../packages/schema/node_modules/viem';

async function main(): Promise<void> {
  const path = process.argv[2];
  if (!path) throw new Error('Public qualification JSON path required');
  const report: unknown = JSON.parse(readFileSync(path, 'utf8'));
  if (typeof report !== 'object' || report === null || !('executor' in report) || typeof report.executor !== 'string' || !('cases' in report) || !Array.isArray(report.cases)) throw new Error('Invalid report');
  let count = 0;
  for (const entry of report.cases) {
    if (typeof entry !== 'object' || entry === null || !('signature' in entry)) continue;
    if (typeof entry.signature !== 'string' || !isHex(entry.signature) || !('digest' in entry) || typeof entry.digest !== 'string' || !isHex(entry.digest)) throw new Error('Invalid public signature vector');
    const address = await recoverAddress({hash:entry.digest, signature:entry.signature});
    if (address.toLowerCase() !== report.executor.toLowerCase()) throw new Error('Wrong recovered executor');
    count++;
  }
  if (count === 0) throw new Error('No real threshold signature in report');
  console.log(JSON.stringify({result:'LOCAL_PASS', recoveredSignatures:count}));
}
void main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
