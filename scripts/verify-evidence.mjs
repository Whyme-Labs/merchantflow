import { readFile } from 'node:fs/promises';
import { verifyEvidence } from '../public/evidence.mjs';

try {
  const file = process.argv[2];
  if (!file) throw new Error('Usage: node scripts/verify-evidence.mjs <merchantflow-evidence.json>');
  const commitment = await verifyEvidence(JSON.parse(await readFile(file, 'utf8')));
  console.log('Verified SHA-256 commitment ' + commitment);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
