// Chạy song song: Tailwind CLI (theo dõi CSS) và server (tự khởi động lại khi sửa code).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const procs = [];
const run = (args) => {
  const p = spawn(process.execPath, args, { stdio: 'inherit' }); // gọi thẳng node.exe, không qua shell (đường dẫn có dấu cách)
  p.on('exit', (code) => { procs.forEach((x) => x !== p && x.kill()); process.exit(code ?? 0); });
  procs.push(p);
};
run([path.join('node_modules', '@tailwindcss', 'cli', 'dist', 'index.mjs'), '-i', 'src/styles.css', '-o', 'public/build.css', '--watch=always']);
run([...(fs.existsSync('.env') ? ['--env-file=.env'] : []), '--watch', 'server.js']);
process.on('SIGINT', () => procs.forEach((p) => p.kill()));
