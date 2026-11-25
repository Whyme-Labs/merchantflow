import { cp, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { address } from '../public/ledger.mjs';

const [folder] = process.argv.slice(2);
if (!folder) throw new Error('Supply the output folder for the GitHub Pages build.');
const destination = resolve(folder);
const anchor = process.env.QIE_ANCHOR_ADDRESS ? address(process.env.QIE_ANCHOR_ADDRESS) : null;
await mkdir(destination, { recursive: true });
await cp(new URL('../public/', import.meta.url), destination, { recursive: true });
await writeFile(resolve(destination, 'get.mjs'),
  `import { createPagesGet } from './pages-get.mjs';\nexport const get = createPagesGet(${JSON.stringify(anchor)});\n`);
await writeFile(resolve(destination, '.nojekyll'), '');
