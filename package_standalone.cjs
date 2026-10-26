const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const targetDir = path.join(rootDir, 'NetPulse-Server-Package');

console.log('Packaging NetPulse Standalone Production Package...');

// Clean existing
if (fs.existsSync(targetDir)) {
  fs.rmSync(targetDir, { recursive: true, force: true });
}
fs.mkdirSync(targetDir, { recursive: true });

function copyDirSync(src, dest, filterFn) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (filterFn && !filterFn(entry.name, srcPath)) continue;

    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath, filterFn);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// 1. Copy client/dist
console.log('-> Copying pre-built frontend (client/dist)...');
copyDirSync(
  path.join(rootDir, 'client', 'dist'),
  path.join(targetDir, 'client', 'dist')
);

// 2. Copy server (including server/node_modules)
console.log('-> Copying server engine & node_modules...');
copyDirSync(
  path.join(rootDir, 'server'),
  path.join(targetDir, 'server')
);

// 3. Copy data
console.log('-> Copying active data & databases...');
copyDirSync(
  path.join(rootDir, 'data'),
  path.join(targetDir, 'data')
);

// 4. Copy python-monitor (scanner & diagnostic tools)
console.log('-> Copying python-monitor scripts...');
copyDirSync(
  path.join(rootDir, 'python-monitor'),
  path.join(targetDir, 'python-monitor'),
  (name) => name !== '__pycache__'
);

// 5. Copy starter batch files
console.log('-> Copying starter batch files & guides...');
const filesToCopy = [
  'START_PRODUCTION_SERVER.bat',
  'ALLOW_FIREWALL_PORT_5000.bat',
  'OFFICE_SERVER_DEPLOYMENT_README.md',
  'ecosystem.config.cjs',
  'package.json'
];

for (const file of filesToCopy) {
  const p = path.join(rootDir, file);
  if (fs.existsSync(p)) {
    fs.copyFileSync(p, path.join(targetDir, file));
  }
}

// 5. Add a crystal-clear README inside the package
const quickReadme = `=======================================================================
     NETPULSE NOC - STANDALONE OFFICE SERVER PRODUCTION PACKAGE
=======================================================================

Yeh folder bilkul standalone aur ready-to-run hai!
Is folder ko aap kisi bhi server / PC par rakh kar chala sakte hain:

CHALANE KA TAREEQA:
1. (Pehli Baar) ALLOW_FIREWALL_PORT_5000.bat par right-click karke "Run as administrator" karein.
2. START_PRODUCTION_SERVER.bat par double-click karein!

DASHBOARD KHOLNA:
- Server PC par:          http://localhost:5000
- Office ke doosre PCs se: http://<SERVER-IP>:5000

Tamam pre-built frontend (client/dist) aur backend server dependencies (server/node_modules)
pehle se is folder me pack hain. Koi extra build ya vite chalane ki zaroorat nahi hai!
`;

fs.writeFileSync(path.join(targetDir, 'README_FIRST.txt'), quickReadme);

console.log('Done! Package created at:', targetDir);
