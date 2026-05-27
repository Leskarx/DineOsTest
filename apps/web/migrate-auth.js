const fs = require('fs');
const path = require('path');

const replacements = [
  // Full page background gradients
  { 
    from: /bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950/g, 
    to: 'bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950' 
  },
  { 
    from: /bg-slate-950/g, 
    to: 'bg-slate-50 dark:bg-slate-950' 
  },
  { 
    from: /bg-slate-900\/80/g, 
    to: 'bg-white/80 dark:bg-slate-900/80' 
  },
  { 
    from: /bg-slate-900\/40/g, 
    to: 'bg-slate-50/40 dark:bg-slate-900/40' 
  },
  { 
    from: /bg-slate-900\/30/g, 
    to: 'bg-slate-50/30 dark:bg-slate-900/30' 
  },
  { 
    from: /bg-slate-900/g, 
    to: 'bg-white dark:bg-slate-900' 
  },
];

const targetFiles = [
  'src/app/page.tsx',
  'src/app/(auth)/login/page.tsx',
  'src/app/(auth)/register/page.tsx',
  'src/app/(auth)/forgot-password/page.tsx',
  'src/app/(auth)/reset-password/page.tsx',
  'src/app/(dashboard)/onboarding/page.tsx',
];

targetFiles.forEach(relativePath => {
  const file = path.join(__dirname, relativePath);
  if (!fs.existsSync(file)) return;
  
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  replacements.forEach(rep => {
    // Only replace if it hasn't been prefixed with dark: yet to avoid double dark:
    // Actually, we'll do straight replacement and then clean up double darks.
    content = content.replace(rep.from, rep.to);
  });
  
  // Cleanup double darks that might have occurred from previous migrations
  content = content.replace(/dark:bg-(?:white|slate-\d+)\s+dark:/g, 'dark:');
  content = content.replace(/bg-white dark:bg-white dark:bg-slate-900/g, 'bg-white dark:bg-slate-900');
  content = content.replace(/bg-slate-50 dark:bg-slate-50 dark:bg-slate-950/g, 'bg-slate-50 dark:bg-slate-950');

  if (content !== original) {
    fs.writeFileSync(file, content);
    console.log(`Updated ${file}`);
  }
});
