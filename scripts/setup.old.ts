import { execSync, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  blue: "\x1b[34m"
};

function log(msg: string, color: string = colors.reset) {
  console.log(`${color}${msg}${colors.reset}`);
}

function ask(question: string): Promise<boolean> {
  return new Promise((resolve) => {
    rl.question(`${colors.cyan}${question} (y/n): ${colors.reset}`, (answer) => {
      resolve(answer.toLowerCase().startsWith('y'));
    });
  });
}

function checkCommand(command: string): boolean {
  try {
    execSync(`which ${command}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

async function checkCursor() {
  log("\n--- Checking Cursor ---", colors.bright);
  if (checkCommand('cursor')) {
    log("✅ Cursor CLI is installed and in your PATH.", colors.green);
    return;
  }

  log("❌ Cursor CLI not found.", colors.yellow);
  log("To install Cursor on Linux:", colors.bright);
  log("1. Download the Cursor AppImage from https://cursor.com");
  log("2. Make it executable: chmod +x cursor.AppImage");
  log("3. Link it to your path (example):");
  log(`   ${colors.green}sudo ln -s /path/to/your/cursor.AppImage /usr/local/bin/cursor${colors.reset}`);
  
  const tryInstall = await ask("Would you like to see the official install URL?");
  if (tryInstall) {
    console.log("Opening https://cursor.com/cli ...");
    try { execSync('xdg-open https://cursor.com/cli'); } catch {}
  }
}

async function setupProvider(name: string, checkCmd: string, authCmd: string, envVar?: string) {
  log(`\n--- Setting up ${name} ---`, colors.bright);
  
  if (envVar && process.env[envVar]) {
    log(`✅ ${envVar} is set in environment.`, colors.green);
  }

  const shouldAuth = await ask(`Do you want to authenticate ${name} now?`);
  if (!shouldAuth) {
    log(`Skipping ${name} setup.`, colors.yellow);
    return;
  }

  log(`Running: ${authCmd}`, colors.blue);
  try {
    spawnSync(authCmd, { shell: true, stdio: 'inherit' });
    log(`\n✅ ${name} setup step completed.`, colors.green);
  } catch (error) {
    log(`❌ Failed to run auth command: ${error}`, colors.red);
  }
}

async function installPM2() {
  log("\n--- Installing PM2 ---", colors.bright);
  if (checkCommand('pm2')) {
    log("✅ PM2 is already installed.", colors.green);
    return;
  }
  
  const install = await ask("PM2 is required to run the supervisor in background. Install globally?");
  if (install) {
    try {
      execSync('npm install -g pm2', { stdio: 'inherit' });
      log("✅ PM2 installed.", colors.green);
    } catch (e) {
      log("❌ Failed to install PM2. Try running 'sudo npm install -g pm2' manually.", colors.red);
    }
  }
}

async function setupUI() {
  log("\n--- Setting up Supervisor UI ---", colors.bright);
  const install = await ask("Do you want to build the UI (frontend + backend)? This may take a moment.");
  if (!install) return;

  log("Installing and Building UI Frontend...", colors.cyan);
  try {
    execSync('cd UI/frontend && npm install && npm run build', { stdio: 'inherit' });
    log("✅ Frontend built.", colors.green);
  } catch (e) {
    log("❌ Frontend build failed: " + e, colors.red);
    return;
  }

  log("Installing and Building UI Backend...", colors.cyan);
  try {
    execSync('cd UI/backend && npm install && npm run build', { stdio: 'inherit' });
    log("✅ Backend built.", colors.green);
  } catch (e) {
    log("❌ Backend build failed: " + e, colors.red);
    return;
  }
}

async function startServices() {
  log("\n--- Starting Services ---", colors.bright);
  const start = await ask("Start all services (Supervisor + UI) via PM2?");
  if (!start) return;

  if (!checkCommand('pm2')) {
      log("❌ PM2 not found. Cannot start services.", colors.red);
      return;
  }

      try {
      execSync('pm2 start ecosystem.config.js', { stdio: 'inherit' });
      log("✅ Services started.", colors.green);
      
      // Launch Browser
      log("\nOpening Supervisor UI...", colors.bright);
      const url = 'http://localhost:5173';
      try {
          log(`Launching ${url}...`, colors.cyan);        if (process.platform === 'darwin') execSync(`open ${url}`);
        else if (process.platform === 'win32') execSync(`start ${url}`);
        else {
             // Try xdg-open, fallback to echo
             try { execSync(`xdg-open ${url}`); } catch { log(`Please open ${url} in your browser.`, colors.yellow); }
        }
    } catch (e) {
        log(`Could not open browser automatically. Please visit ${url}`, colors.yellow);
    }
    
    log("\nℹ️  To monitor logs: pm2 logs", colors.cyan);
    log("ℹ️  To stop: pm2 stop all", colors.cyan);
    
  } catch (e) {
    log("❌ Failed to start services: " + e, colors.red);
  }
}

async function main() {
  console.clear();
  log("Welcome to the Foundry Setup Wizard", colors.bright + colors.blue);
  log("===================================", colors.blue);
  log("This wizard will help you set up authentication, build the UI, and start services.\n", colors.reset);

  // 1. Check bundled CLIs
  await setupProvider(
    "Google Gemini", 
    "npx @google/gemini-cli --help", 
    "npx @google/gemini-cli login",
    "GOOGLE_API_KEY"
  );

  await setupProvider(
    "GitHub Copilot", 
    "npx @github/copilot --help", 
    "npx @github/copilot auth"
  );

  await setupProvider(
    "Anthropic Claude", 
    "npx @anthropic-ai/claude-code --help", 
    "npx @anthropic-ai/claude-code login"
  );

  // 2. Check Cursor (External)
  await checkCursor();

  // 3. Ollama
  log("\n--- Checking Ollama ---", colors.bright);
  log("Ollama is managed via Docker.", colors.cyan);
  const startDocker = await ask("Do you want to start the Docker infrastructure now? (Downloads phi4-mini)");
  if (startDocker) {
    log("Running: docker compose up -d", colors.blue);
    try {
      spawnSync('docker compose up -d', { shell: true, stdio: 'inherit' });
      log("✅ Infrastructure started.", colors.green);
    } catch (error) {
       log("❌ Failed to start docker: " + error, colors.red);
    }
  }

  // 4. Install PM2
  await installPM2();

  // 5. Initialize State
  log("\n--- Initializing State ---", colors.bright);
  const initState = await ask("Initialize/Reset Supervisor State in DB? (Required for fresh install)");
  if (initState) {
      try {
          // Use default args matching ecosystem.config.js
          const cmd = `npm run cli -- init-state --redis-host localhost --redis-port 6499 --state-key supervisor:state --queue-name tasks --queue-db 2 --execution-mode AUTO`;
          execSync(cmd, { stdio: 'inherit' });
          log("✅ State initialized.", colors.green);
      } catch (e) {
          log("❌ Failed to init state (it might already exist): " + e, colors.yellow);
      }
  }

  // 6. Build UI
  await setupUI();

  // 7. Start Everything
  await startServices();

  log("\n✅ Setup Complete!", colors.bright + colors.green);
  rl.close();
}

main().catch(err => {
  console.error(err);
  rl.close();
});