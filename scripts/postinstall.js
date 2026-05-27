const fs = require('fs');
const path = require('path');

// Missing nested dependency mappings: { targetPath: sourcePackageName }
const missingDeps = {
  'node_modules/@fastify/otel/node_modules/minimatch': 'minimatch',
  'node_modules/recharts/node_modules/react-is': 'react-is'
};

console.log('Running postinstall script to patch nested node_modules...');

for (const [targetPath, sourcePkg] of Object.entries(missingDeps)) {
  const fullTargetPath = path.join(__dirname, '..', targetPath);
  const sourcePath = path.join(__dirname, '..', 'node_modules', sourcePkg);

  if (fs.existsSync(sourcePath)) {
    if (!fs.existsSync(fullTargetPath)) {
      console.log(`Patching missing dependency: ${sourcePkg} -> ${targetPath}`);
      fs.mkdirSync(path.dirname(fullTargetPath), { recursive: true });
      // Copy directory contents
      try {
        fs.cpSync(sourcePath, fullTargetPath, { recursive: true });
      } catch (err) {
        console.error(`Failed to copy ${sourcePkg}:`, err.message);
      }
    } else {
      console.log(`Dependency already exists: ${targetPath}`);
    }
  } else {
    console.warn(`Source dependency not found at root: ${sourcePkg}`);
  }
}

console.log('Postinstall complete.');
