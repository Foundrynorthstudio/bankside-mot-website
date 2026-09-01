import { spawn } from 'node:child_process';

const child = spawn(process.execPath, ['scripts/process-logo.mjs'], { stdio: 'inherit' });
child.on('exit', (code) => process.exit(code ?? 1));
