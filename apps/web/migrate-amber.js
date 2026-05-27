const fs = require('fs');
const path = require('path');

const replacements = [
  // Amber selection backgrounds
  { from: /bg-amber-500\/10/g, to: 'bg-amber-100 dark:bg-amber-500/10' },
  { from: /bg-amber-500\/15/g, to: 'bg-amber-100 dark:bg-amber-500/15' },
  { from: /bg-amber-500\/20/g, to: 'bg-amber-200 dark:bg-amber-500/20' },
  { from: /bg-amber-500\/5/g, to: 'bg-amber-50 dark:bg-amber-500/5' },
  { from: /bg-amber-400\/10/g, to: 'bg-amber-100 dark:bg-amber-400/10' },
  { from: /bg-amber-900\/20/g, to: 'bg-amber-100 dark:bg-amber-900/20' },
  // Amber selection borders
  { from: /border-amber-500\/20/g, to: 'border-amber-300 dark:border-amber-500/20' },
  { from: /border-amber-500\/30/g, to: 'border-amber-300 dark:border-amber-500/30' },
  { from: /border-amber-500\/40/g, to: 'border-amber-400 dark:border-amber-500/40' },
  { from: /border-amber-400\/20/g, to: 'border-amber-300 dark:border-amber-400/20' },
  { from: /border-amber-500\/50/g, to: 'border-amber-400 dark:border-amber-500/50' },
  // Amber hover backgrounds
  { from: /hover:bg-amber-500\/10/g, to: 'hover:bg-amber-200 dark:hover:bg-amber-500/10' },
  { from: /hover:bg-amber-500\/15/g, to: 'hover:bg-amber-200 dark:hover:bg-amber-500/15' },
  { from: /hover:bg-amber-500\/20/g, to: 'hover:bg-amber-200 dark:hover:bg-amber-500/20' },
  // Amber text
  { from: /text-amber-400/g, to: 'text-amber-600 dark:text-amber-400' },
  { from: /text-amber-300/g, to: 'text-amber-600 dark:text-amber-300' },
  // Emerald / Red semi-transparent bg used in shift/reports
  { from: /bg-emerald-900\/20/g, to: 'bg-emerald-100 dark:bg-emerald-900/20' },
  { from: /bg-emerald-900\/40/g, to: 'bg-emerald-200 dark:bg-emerald-900/40' },
  { from: /border-emerald-700/g, to: 'border-emerald-300 dark:border-emerald-700' },
  { from: /text-emerald-400/g, to: 'text-emerald-600 dark:text-emerald-400' },
  { from: /text-emerald-300/g, to: 'text-emerald-600 dark:text-emerald-300' },
  
  { from: /bg-red-900\/20/g, to: 'bg-red-100 dark:bg-red-900/20' },
  { from: /hover:bg-red-900\/40/g, to: 'hover:bg-red-200 dark:hover:bg-red-900/40' },
  { from: /border-red-800/g, to: 'border-red-300 dark:border-red-800' },
  { from: /text-red-400/g, to: 'text-red-600 dark:text-red-400' },
];

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk(path.join(__dirname, 'src'));
let changedFiles = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  replacements.forEach(rep => {
    content = content.replace(rep.from, rep.to);
  });

  // Cleanup potential double darks
  content = content.replace(/dark:(?:bg|text|border|hover:bg)-(?:amber|emerald|red)-\d+(?:\/\d+)?\s+dark:/g, 'dark:');

  if (content !== original) {
    fs.writeFileSync(file, content);
    changedFiles++;
    console.log(`Updated ${file}`);
  }
});

console.log(`Migration complete. Updated ${changedFiles} files.`);
