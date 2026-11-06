import { productionProblems } from "../src/lib/production-config";
const problems = productionProblems(process.env);
if (problems.length) {
  console.error("Production setup is incomplete:");
  for (const problem of problems) console.error(`- ${problem}`);
  process.exitCode = 1;
} else console.log("Production configuration checks passed. Live delivery, private bucket access, backups and worker health still require smoke tests.");
