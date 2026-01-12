import inquirer from 'inquirer';
import { execSync, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as net from 'net';

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

function spacer(lines: number = 1) {
  if (lines <= 0) return;
  console.log("\n".repeat(lines - 1));
}

process.on('SIGINT', () => {
  spacer(1);
  log("Setup cancelled. Exiting...", colors.yellow);
  spacer(1);
  process.exit(0);
});

function checkCommand(command: string): boolean {
  try {
    execSync(`which ${command}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function appendToEnv(key: string, value: string) {
  const envPath = path.join(process.cwd(), '.env');
  let envContent = '';
  
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf-8');
  }

  const regex = new RegExp(`^${key}=.*`, 'm');
  if (regex.test(envContent)) {
    envContent = envContent.replace(regex, `${key}=${value}`);
  } else {
    envContent += `\n${key}=${value}`;
  }

  fs.writeFileSync(envPath, envContent);
}

async function waitForPort(port: number, name: string, timeoutMs: number = 60000): Promise<boolean> {
  const start = Date.now();
  process.stdout.write(`${colors.cyan}Waiting for ${name} ... ${colors.reset}`);
  
  while (Date.now() - start < timeoutMs) {
    const isOpen = await new Promise<boolean>(resolve => {
        const socket = new net.Socket();
        socket.setTimeout(1000);
        socket.on('connect', () => {
            socket.destroy();
            resolve(true);
        });
        socket.on('timeout', () => {
            socket.destroy();
            resolve(false);
        });
        socket.on('error', () => {
            socket.destroy();
            resolve(false);
        });
        socket.connect(port, 'localhost');
    });

    if (isOpen) {
      process.stdout.write(`${colors.green} [READY]\n${colors.reset}`);
      return true;
    }
    
    process.stdout.write(`${colors.cyan}.${colors.reset}`);
    await new Promise(r => setTimeout(r, 1000));
  }

  process.stdout.write(`${colors.red} [TIMEOUT]\n${colors.reset}`);
  return false;
}

async function checkStatus() {
  const hasEnv = fs.existsSync('.env');
  const hasModules = fs.existsSync('node_modules');
  let isRunning = false;
  if (checkCommand('pm2')) {
    try {
      const output = execSync('pm2 list', { encoding: 'utf-8' });
      if (output.includes('supervisor') && output.includes('online')) {
        isRunning = true;
      }
    } catch {}
  }

  if (hasEnv && hasModules && isRunning) {
    spacer(1);
    log("Foundry is already set up and running!", colors.green + colors.bright);
    log(`   Dashboard: ${colors.cyan}http://localhost:5173`, colors.reset);
    log(`   API:       ${colors.cyan}http://localhost:3001`, colors.reset);
    spacer(1);
    
    const { reconfigure } = await inquirer.prompt([{
      type: 'confirm',
      name: 'reconfigure',
      message: 'Do you want to re-configure the system anyway?',
      default: false
    }]);
    
    if (!reconfigure) {
        spacer(1);
        process.exit(0);
    }
  }
}

async function stepInfrastructure() {
  spacer(1);
  log("--- Infrastructure ---", colors.blue);
  spacer(1);
  log("Starting DragonflyDB (Mandatory)...", colors.cyan);
  spawnSync('docker compose up -d dragonflydb', { shell: true, stdio: 'inherit' });
  
  spacer(1);
  const { useOllama } = await inquirer.prompt([{
    type: 'confirm',
    name: 'useOllama',
    message: 'Use local Ollama for free verification? (Saves API costs, requires ~2GB download)',
    default: true
  }]);

  if (useOllama) {
    spacer(1);
    log("Starting Ollama (background pull for phi4-mini)...", colors.cyan);
    spawnSync('docker compose up -d ollama', { shell: true, stdio: 'inherit' });
  }
  
  spacer(1);
  await waitForPort(6499, "DragonflyDB");
  if (useOllama) await waitForPort(11434, "Ollama Server");
}

async function stepBuild() {
  spacer(1);
  log("--- Installation & Build ---", colors.blue);
  spacer(1);
  log("Installing dependencies and building UI (This usually takes ~60s)...", colors.cyan);
  spacer(1);

  try {
    execSync('npm install', { stdio: 'inherit' });
    execSync('cd UI/frontend && npm install && npm run build', { stdio: 'inherit' });
    execSync('cd UI/backend && npm install && npm run build', { stdio: 'inherit' });
    spacer(1);
    log("Build complete.", colors.green);
  } catch (e) {
    spacer(1);
    log("Build failed: " + e, colors.red);
    process.exit(1);
  }
}

async function stepAIProviders() {
  spacer(1);
  log("--- AI Provider Configuration ---", colors.blue);
  spacer(1);
  log("Foundry orchestrates AI agents. Select which providers you want to enable.", colors.reset);
  log("You can skip this step and configure providers later by following the README.md.", colors.yellow);
  spacer(1);
  
  const { providers } = await inquirer.prompt([{
    type: 'checkbox',
    name: 'providers',
    message: 'Select AI Providers:',
    choices: [
      { name: 'Google Gemini', value: 'gemini', checked: false },
      { name: 'GitHub Copilot', value: 'copilot', checked: false },
      { name: 'Anthropic Claude', value: 'claude', checked: false },
      { name: 'Cursor', value: 'cursor', checked: false }
    ]
  }]);

  const askAuth = async (name: string, authOptions: Array<{name: string, value: string}>) => {
    spacer(1);
    log(`Configuring ${name}...`, colors.bright);
    
    const choices = [...authOptions, { name: 'Skip', value: 'skip' }];

    const { method } = await inquirer.prompt([{
      type: 'list',
      name: 'method',
      message: `Authentication Method for ${name}:`,
      choices
    }]);
    
    return method;
  };

  if (providers.includes('gemini')) {
      const method = await askAuth('Gemini', [{ name: 'Enter API Key (GOOGLE_API_KEY)', value: 'key' }]);
      if (method === 'key') {
          spacer(1);
          const { key } = await inquirer.prompt([{ type: 'password', name: 'key', message: 'Enter GOOGLE_API_KEY:' }]);
          appendToEnv('GOOGLE_API_KEY', key);
      }
  }

  if (providers.includes('copilot')) {
      const method = await askAuth('Copilot', [{ name: 'Interactive Login (Launch Browser)', value: 'interactive' }]);
      if (method === 'interactive') {
          spacer(1);
          log("Instruction: A REPL/Browser will open. Log in, then exit the process (Ctrl+C or 'exit') to return here.", colors.yellow);
          spawnSync('npx @github/copilot', { shell: true, stdio: 'inherit' });
      }
  }

  if (providers.includes('claude')) {
      const method = await askAuth('Claude', [
          { name: 'Interactive Login (setup-token)', value: 'oauth' },
          { name: 'Enter API Key (ANTHROPIC_API_KEY)', value: 'key' }
      ]);
      if (method === 'oauth') {
          spacer(1);
          spawnSync('npx @anthropic-ai/claude-code setup-token', { shell: true, stdio: 'inherit' });
      } else if (method === 'key') {
          spacer(1);
          const { key } = await inquirer.prompt([{ type: 'password', name: 'key', message: 'Enter ANTHROPIC_API_KEY:' }]);
          appendToEnv('ANTHROPIC_API_KEY', key);
      }
  }
  
  if (providers.includes('cursor')) {
     spacer(1);
     if (!checkCommand('cursor')) {
         log("Cursor CLI not found. Please install the Cursor App to use this provider.", colors.yellow);
     } else {
         log("Cursor CLI verified.", colors.green);
     }
  }
}

async function stepInitState() {
  spacer(1);
  log("--- Initialization ---", colors.blue);
  spacer(1);
  log("Ensuring Supervisor State exists in database...", colors.cyan);
  
  try {
      const cmd = `npm run cli -- init-state --redis-host localhost --redis-port 6499 --state-key supervisor:state --queue-name tasks --queue-db 2 --execution-mode AUTO`;
      execSync(cmd, { stdio: 'ignore' });
      spacer(1);
      log("State initialized.", colors.green);
  } catch (e) {
      spacer(1);
      log("State already exists (Skipping).", colors.yellow);
  }
}

async function stepLaunch() {
  spacer(1);
  log("--- Launch ---", colors.blue);
  
  if (!checkCommand('pm2')) {
      spacer(1);
      log("Installing PM2 globally...", colors.cyan);
      try {
        execSync('npm install -g pm2', { stdio: 'ignore' });
      } catch {
        log("❌ Failed to install PM2. Try 'sudo npm install -g pm2'.", colors.red);
        return;
      }
  }

  spacer(1);
  log("Starting Supervisor System and Dashboard (Backend + Frontend)...", colors.cyan);
  try {
      execSync('pm2 start ecosystem.config.js', { stdio: 'inherit' });
      
      spacer(1);
      await waitForPort(3001, "Backend API");
      await waitForPort(5173, "Frontend UI");

      spacer(1);
      log("Foundry is LIVE!", colors.bright + colors.green);
      log(`   Dashboard: ${colors.cyan}http://localhost:5173`, colors.reset);
      spacer(1);
      
      if (process.platform === 'linux') try { execSync('xdg-open http://localhost:5173'); } catch {}
      if (process.platform === 'darwin') try { execSync('open http://localhost:5173'); } catch {}
  } catch (e) {
      spacer(1);
      log("Start failed: " + e, colors.red);
  }
}

async function main() {
  console.clear();
  spacer(1);
  log("Welcome to Foundry Setup Wizard", colors.bright + colors.blue);
  log("===============================", colors.blue);
  spacer(1);

  await checkStatus();
  await stepInfrastructure();
  await stepBuild();
  await stepAIProviders();
  await stepInitState();
  await stepLaunch();

  spacer(1);
  log("Setup Complete!", colors.bright + colors.green);
  spacer(3);
}

main().catch(console.error);