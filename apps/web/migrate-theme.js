const fs = require('fs');
const path = require('path');

const replacements = [
  // Slate backgrounds
  { from: /bg-slate-950/g, to: 'bg-slate-50 dark:bg-slate-950' },
  { from: /bg-slate-900/g, to: 'bg-white dark:bg-slate-900' },
  { from: /bg-slate-800\/50/g, to: 'bg-slate-100/50 dark:bg-slate-800/50' },
  { from: /bg-slate-800\/40/g, to: 'bg-slate-100/40 dark:bg-slate-800/40' },
  { from: /bg-slate-800/g, to: 'bg-slate-50 dark:bg-slate-800' },
  { from: /bg-slate-700/g, to: 'bg-slate-200 dark:bg-slate-700' },
  // Slate text
  { from: /text-slate-400/g, to: 'text-slate-500 dark:text-slate-400' },
  { from: /text-slate-300/g, to: 'text-slate-600 dark:text-slate-300' },
  { from: /text-slate-200/g, to: 'text-slate-700 dark:text-slate-200' },
  { from: /text-slate-100/g, to: 'text-slate-900 dark:text-slate-100' },
  { from: /text-slate-50/g, to: 'text-slate-900 dark:text-slate-50' },
  { from: /text-white/g, to: 'text-slate-900 dark:text-white' },
  // Slate borders
  { from: /border-slate-800/g, to: 'border-slate-200 dark:border-slate-800' },
  { from: /border-slate-700\/50/g, to: 'border-slate-200/50 dark:border-slate-700/50' },
  { from: /border-slate-700/g, to: 'border-slate-300 dark:border-slate-700' },
  { from: /border-slate-600/g, to: 'border-slate-300 dark:border-slate-600' },
  // Divides
  { from: /divide-slate-800/g, to: 'divide-slate-200 dark:divide-slate-800' },
  { from: /divide-slate-700/g, to: 'divide-slate-200 dark:divide-slate-700' },
  // Hoover and focus
  { from: /hover:bg-slate-800/g, to: 'hover:bg-slate-100 dark:hover:bg-slate-800' },
  { from: /hover:bg-slate-700/g, to: 'hover:bg-slate-200 dark:hover:bg-slate-700' },
  { from: /hover:text-white/g, to: 'hover:text-slate-900 dark:hover:text-white' },
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
    // Basic protection against double-applying if a file already has dark: classes
    // We replace the string, but if it already has "dark:" preceding it, we don't want to mess up.
    // However, regex lookbehinds might be complex. We'll just do a straight replace
    // and then clean up any "dark:bg-white dark:bg-slate-900" errors.
    content = content.replace(rep.from, rep.to);
  });

  // Cleanup: if we accidentally replaced something that was already dark:bg-slate-900
  // e.g. dark:bg-white dark:bg-slate-900 -> revert to dark:bg-slate-900
  content = content.replace(/dark:(?:bg|text|border|divide|hover:bg|hover:text)-(?:white|slate-\d+)\s+dark:/g, 'dark:');

  if (content !== original) {
    fs.writeFileSync(file, content);
    changedFiles++;
    console.log(`Updated ${file}`);
  }
});

console.log(`Migration complete. Updated ${changedFiles} files.`);
