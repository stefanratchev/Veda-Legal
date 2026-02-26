#!/usr/bin/env node
// Wrapper: runs GSD statusline, then appends git branch + commits ahead
const { execFileSync, execSync } = require('child_process');
const path = require('path');

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    // Run GSD statusline with the same stdin
    const gsdScript = path.join(__dirname, 'gsd-statusline.js');
    const gsdOutput = execFileSync('node', [gsdScript], {
      input,
      encoding: 'utf8',
      timeout: 3000,
    });

    // Get git branch + commits ahead
    let git = '';
    try {
      const data = JSON.parse(input);
      const dir = data.workspace?.current_dir || process.cwd();
      const branch = execSync('git rev-parse --abbrev-ref HEAD 2>/dev/null', {
        cwd: dir, encoding: 'utf8', timeout: 2000,
      }).trim();

      if (branch) {
        let ahead = '';
        try {
          const count = execSync(`git rev-list --count @{u}..HEAD 2>/dev/null`, {
            cwd: dir, encoding: 'utf8', timeout: 2000,
          }).trim();
          if (count && parseInt(count) > 0) ahead = ` \x1b[33m\u2191${count}\x1b[0m`;
        } catch (e) {}
        git = ` \x1b[2m\u2502\x1b[0m \x1b[36m${branch}\x1b[0m${ahead}`;
      }
    } catch (e) {}

    process.stdout.write(gsdOutput + git);
  } catch (e) {
    // If GSD script fails, just output nothing rather than break statusline
  }
});
