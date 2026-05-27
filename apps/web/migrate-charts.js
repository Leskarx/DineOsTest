const fs = require('fs');
const path = require('path');

const files = [
  'src/app/(admin)/admin/page.tsx',
  'src/app/(dashboard)/dashboard/page.tsx',
  'src/app/(dashboard)/executive/page.tsx',
  'src/app/(dashboard)/hotel/dashboard/page.tsx',
  'src/app/(dashboard)/reports/page.tsx',
];

const replacements = [
  // Tooltip content style
  { from: /contentStyle=\{\{\s*background:\s*'#(?:1e293b|0f172a)'[^}]*\}\}/g, to: "contentStyle={{ background: 'var(--chart-tooltip-bg)', border: '1px solid var(--chart-tooltip-border)', borderRadius: 8, color: 'var(--chart-tooltip-text)' }}" },
  
  // Tooltip label style (sometimes hardcoded to #94a3b8)
  { from: /labelStyle=\{\{\s*color:\s*'#94a3b8'\s*\}\}/g, to: "labelStyle={{ color: 'var(--chart-axis-text)' }}" },
  
  // CartesianGrid stroke
  { from: /stroke="#(?:1e293b|334155)"/g, to: 'stroke="var(--chart-grid-line)"' },
  
  // XAxis / YAxis tick fill
  { from: /tick=\{\{\s*fill:\s*'#(?:94a3b8|64748b)'/g, to: "tick={{ fill: 'var(--chart-axis-text)'" },
  
  // Bar cell fill fallback (#334155)
  { from: /fill=\{\s*[^?]*\s*\?\s*'#f59e0b'\s*:\s*'#334155'\s*\}/g, match: /fill=\{([^?]*)\s*\?\s*'#f59e0b'\s*:\s*'#334155'\s*\}/g, toFn: (m, cond) => `fill={${cond} ? '#f59e0b' : 'var(--chart-bar-bg)'}` },
  
  // Bar cursor fill
  { from: /cursor=\{\{\s*fill:\s*'#1e293b'\s*\}\}/g, to: "cursor={{ fill: 'var(--chart-grid-line)' }}" },
];

let changedCount = 0;

files.forEach(relativePath => {
  const file = path.join(__dirname, relativePath);
  if (!fs.existsSync(file)) return;
  
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  replacements.forEach(rep => {
    if (rep.toFn) {
      content = content.replace(rep.match, rep.toFn);
    } else {
      content = content.replace(rep.from, rep.to);
    }
  });
  
  // Hardcoded fallback replace for Cell fill
  content = content.replace(/fill=\{([^?]*)\s*\?\s*'#f59e0b'\s*:\s*'#334155'\s*\}/g, "fill={$1 ? '#f59e0b' : 'var(--chart-bar-bg)'}");

  if (content !== original) {
    fs.writeFileSync(file, content);
    changedCount++;
    console.log(`Updated ${file}`);
  }
});

console.log(`Updated ${changedCount} chart files.`);
