import { createHash, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';

try {
  const file = process.argv[2];
  if (!file) throw new Error('Usage: node scripts/verify-evidence.mjs <merchantflow-evidence.json>');
  const { algorithm, commitment, record } = JSON.parse(await readFile(file, 'utf8'));
  if (algorithm !== 'sha256' || typeof commitment !== 'string' || !/^0x[0-9a-f]{64}$/.test(commitment) ||
      record?.version !== 'merchantflow/reconciliation/1' || !/^[0-9a-f]{64}$/.test(record.salt)) {
    throw new Error('This is not a supported MerchantFlow evidence export.');
  }
  const actual = createHash('sha256').update(JSON.stringify(record)).digest();
  if (!timingSafeEqual(actual, Buffer.from(commitment.slice(2), 'hex'))) throw new Error('The evidence digest does not match.');
  console.log('Verified SHA-256 commitment ' + commitment);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
