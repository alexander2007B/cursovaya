#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
node -e 'if(Number(process.versions.node.split(".")[0])<22)throw new Error("Node.js 22+ required")'
npm ci
if [ ! -f .env ]; then
  node --input-type=module <<'JS'
import {writeFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
writeFileSync('.env',`PORT=3000\nMONGODB_URI=mongodb://127.0.0.1:27017/avtobaza?replicaSet=rs0&directConnection=true\nSESSION_SECRET=${randomBytes(32).toString('hex')}\nNODE_ENV=development\nSEED_DEMO=true\n`,{mode:0o600,flag:'wx'});
JS
fi
npm run db:up
npm run seed
npm run build
