
import {
  exec
} from 'child_process';
import {
  promisify
} from 'util';
import {
  Command
} from 'commander';

const execAsync = promisify(exec);
const program = new Command();

program
  .requiredOption('--task-file <path>', 'Path to the tasks JSON file')
  .option('--halt-after <seconds>', 'Halt the supervisor after specified seconds', parseInt)
  .option('--redis-host <host>', 'DragonflyDB host', 'localhost')
  .option('--redis-port <port>', 'DragonflyDB port', '6499')
  .option('--state-key <key>', 'Supervisor state key', 'supervisor:state')
  .option('--queue-name <name>', 'Task queue name', 'tasks')
  .option('--queue-db <index>', 'Queue database index', '2')
  .parse(process.argv);

const options = program.opts();

const commonArgs = `--redis-host ${options.redisHost} --redis-port ${options.redisPort} --state-key ${options.stateKey} --queue-name ${options.queueName} --queue-db ${options.queueDb}`;

async function runCommand(cmd: string, description: string) {
  console.log(`\n>>> ${description}...`);
  try {
    const { stdout, stderr } = await execAsync(cmd);
    if (stdout) console.log(stdout.trim());
    if (stderr) console.error(stderr.trim());
    console.log(`✅ ${description} completed.`);
  } catch (error: any) {
    console.error(`❌ ${description} failed:`, error.message);
    if (error.stderr) console.error(error.stderr);
    throw error;
  }
}

async function main() {
  try {
    // 1. Halt Supervisor (graceful attempt)
    // Ignore error if it's already halted/stopped
    try {
      await runCommand(`npm run cli -- halt ${commonArgs}`, 'Halting Supervisor');
    } catch (e) {
      console.log('⚠️  Halt failed (supervisor might be down), proceeding...');
    }

    // 2. Stop PM2 Process 18
    await runCommand('pm2 stop 18', 'Stopping PM2 Process 18');

    // 3. Clean Tasks (Redis DEL)
    // Note: Queue DB index is passed as -n <db>
    await runCommand(`redis-cli -h ${options.redisHost} -p ${options.redisPort} -n ${options.queueDb} del queue:${options.queueName}`, 'Cleaning Task Queue');

    // 4. Reset State
    // Must delete key first because init-state fails if key exists
    await runCommand(`redis-cli -h ${options.redisHost} -p ${options.redisPort} del ${options.stateKey}`, 'Deleting State Key');
    await runCommand(`npm run cli -- init-state ${commonArgs} --execution-mode AUTO`, 'Initializing State');

    // Restore Goal (Hardcoded default goal as we reset state)
    // In a real scenario, we might want to read the old goal first, but for this refresh script, we set a standard one or need a param.
    // Assuming we want to keep the goal from the current context or a placeholder.
    // For now, I'll set a generic placeholder or the classifieds goal if intended.
    // Given the prompt "remount tasks", I'll assume we want the classifieds goal back.
    const goalDescription = "A simplified classifieds app that aggregates and serves property & vehicle listings into a single mobile-first experience. The platform combines a robust backend aggregation and scraping system that continuously collects, normalizes, and enriches listings from multiple external sources with a subscription-based daily curated feed. Featuring phone-only authentication, large readable UI elements, and a search, the system is designed to reduce complexity for end users while delivering a reliable, scalable, and continuously updated marketplace, with the frontend located in ./sandbox/easeclassifieds and the backend and aggregation services in ./sandbox/easeclassifieds-api.";
    await runCommand(`npm run cli -- set-goal ${commonArgs} --project-id easeclassifieds --description "${goalDescription}"`, 'Setting Goal');

    // 5. Remount Tasks
    await runCommand(`npm run cli -- enqueue ${commonArgs} --task-file ${options.taskFile}`, 'Enqueueing Tasks');

    // 6. Flush PM2 Logs
    await runCommand('pm2 flush 18', 'Flushing PM2 Logs');

    // 7. Restart PM2
    await runCommand('pm2 restart 18', 'Restarting PM2 Process 18');

    // 8. Resume Supervisor
    // We need to wait a moment for the process to be online
    await new Promise(resolve => setTimeout(resolve, 2000));
    await runCommand(`npm run cli -- resume ${commonArgs}`, 'Resuming Supervisor');

    // 9. Halt After (Optional)
    if (options.haltAfter) {
      console.log(`\n⏳ Scheduling Halt in ${options.haltAfter} seconds...`);
      setTimeout(async () => {
        await runCommand(`npm run cli -- halt ${commonArgs} --reason "Scheduled Halt"`, 'Scheduled Halt');
        process.exit(0);
      }, options.haltAfter * 1000);
      
      // Keep process alive if waiting
      if (options.haltAfter > 0) {
        // Wait forever (until timeout fires)
        await new Promise(() => {}); 
      }
    }

  } catch (error) {
    console.error('\n❌ Refresh/Remount Failed!');
    process.exit(1);
  }
}

main();
