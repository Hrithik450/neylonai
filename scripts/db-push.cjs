// Patches Node.js stdin/stdout to satisfy drizzle-kit's TTY check,
// then auto-answers "yes" to the interactive confirmation prompt.
// This lets drizzle-kit push run non-interactively in Docker.
process.stdin.isTTY = true;
process.stdout.isTTY = true;

const readline = require("readline");
const origCreate = readline.createInterface.bind(readline);
readline.createInterface = function (opts) {
  const rl = origCreate(opts);
  const origQuestion = rl.question.bind(rl);
  rl.question = (_prompt, cb) => cb("y");
  return rl;
};
