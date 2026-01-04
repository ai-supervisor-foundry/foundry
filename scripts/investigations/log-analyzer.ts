#!/usr/bin/env npx ts-node
/**
 * Log Analyzer Script
 * 
 * Extract and analyze execution logs from prompts.log.jsonl.
 * Helps identify patterns, failures, and provider usage statistics.
 * 
 * Usage:
 *   npx ts-node scripts/investigations/log-analyzer.ts
 *   npx ts-node scripts/investigations/log-analyzer.ts --summary
 *   npx ts-node scripts/investigations/log-analyzer.ts --failures --limit 10
 *   npx ts-node scripts/investigations/log-analyzer.ts --task <task-id>
 */

import * as fs from 'fs';
import * as readline from 'readline';
import { Command } from 'commander';
import { ExecutionLogEntry, ErrorPattern } from './schema';

const program = new Command();

program
  .option('--log-file <path>', 'Path to prompts.log.jsonl', 'prompts.log.jsonl')
  .option('--summary', 'Show aggregate statistics only')
  .option('--failures', 'Show only failed executions')
  .option('--task <id>', 'Filter by task ID')
  .option('--limit <number>', 'Max entries to show', '50')
  .option('--exit-codes', 'Group by exit code')
  .option('--providers', 'Show provider usage breakdown')
  .option('--json', 'Output JSON format')
  .parse(process.argv);

interface Options {
  logFile: string;
  summary?: boolean;
  failures?: boolean;
  task?: string;
  limit: string;
  exitCodes?: boolean;
  providers?: boolean;
  json?: boolean;
}

interface ParsedLogEntry extends ExecutionLogEntry {
  line_number: number;
}

interface Statistics {
  total_entries: number;
  successful: number;
  failed: number;
  by_provider: { [provider: string]: number };
  by_exit_code: { [code: number]: number };
  error_patterns: { [pattern: string]: number };
  date_range: {
    earliest: string;
    latest: string;
  };
}

async function readLogFile(
  filePath: string,
  filter?: { task?: string; failures?: boolean }
): Promise<ParsedLogEntry[]> {
  const entries: ParsedLogEntry[] = [];

  if (!fs.existsSync(filePath)) {
    return entries;
  }

  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let lineNumber = 0;
  for await (const line of rl) {
    lineNumber++;
    if (!line.trim()) continue;

    try {
      const entry: ExecutionLogEntry = JSON.parse(line);

      // Apply filters
      if (filter?.task && entry.task_id !== filter.task) {
        continue;
      }
      if (filter?.failures && entry.metadata.exit_code === 0) {
        continue;
      }

      entries.push({ ...entry, line_number: lineNumber });
    } catch {
      // Skip malformed JSON lines
    }
  }

  return entries;
}

function analyzeEntries(entries: ParsedLogEntry[]): Statistics {
  const stats: Statistics = {
    total_entries: entries.length,
    successful: 0,
    failed: 0,
    by_provider: {},
    by_exit_code: {},
    error_patterns: {},
    date_range: {
      earliest: entries[0]?.timestamp || 'N/A',
      latest: entries[entries.length - 1]?.timestamp || 'N/A',
    },
  };

  entries.forEach((entry) => {
    if (entry.metadata.exit_code === 0) {
      stats.successful++;
    } else {
      stats.failed++;
    }

    // Provider stats
    if (entry.metadata.provider) {
      stats.by_provider[entry.metadata.provider] = (stats.by_provider[entry.metadata.provider] || 0) + 1;
    }

    // Exit code stats
    const code = entry.metadata.exit_code || 0;
    stats.by_exit_code[code] = (stats.by_exit_code[code] || 0) + 1;

    // Error pattern stats
    if (entry.metadata.error_type) {
      stats.error_patterns[entry.metadata.error_type as unknown as string] =
        (stats.error_patterns[entry.metadata.error_type as unknown as string] || 0) + 1;
    }
  });

  return stats;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const sec = ms / 1000;
  if (sec < 60) return `${sec.toFixed(1)}s`;
  const min = sec / 60;
  return `${min.toFixed(1)}m`;
}

async function main(): Promise<void> {
  const options = program.opts() as Options;
  const limit = Math.max(1, parseInt(options.limit, 10));

  try {
    if (!options.json) {
      console.log('\n╔════════════════════════════════════════════════════════════════╗');
      console.log('║                      LOG ANALYZER REPORT                        ║');
      console.log('╚════════════════════════════════════════════════════════════════╝\n');
    }

    // Read log file
    const entries = await readLogFile(options.logFile, {
      task: options.task,
      failures: options.failures,
    });

    if (entries.length === 0) {
      if (!options.json) {
        console.log(`No log entries found in ${options.logFile}`);
        if (options.task) {
          console.log(`Filter: Task ID = ${options.task}`);
        }
        if (options.failures) {
          console.log(`Filter: Failed executions only`);
        }
      }
      return;
    }

    const stats = analyzeEntries(entries);

    if (options.json) {
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        statistics: stats,
        entries: entries.slice(0, limit),
      }, null, 2));
      return;
    }

    // Show summary
    console.log('📊 Execution Statistics:\n');
    console.log(`  Total Entries: ${stats.total_entries}`);
    console.log(`  Successful: ${stats.successful} (${((stats.successful / stats.total_entries) * 100).toFixed(1)}%)`);
    console.log(`  Failed: ${stats.failed} (${((stats.failed / stats.total_entries) * 100).toFixed(1)}%)`);
    console.log(`  Date Range: ${stats.date_range.earliest} → ${stats.date_range.latest}`);
    console.log();

    if (options.providers || (!options.summary && !options.failures && !options.exitCodes)) {
      console.log('🔌 Provider Usage:\n');
      Object.entries(stats.by_provider)
        .sort(([, a], [, b]) => b - a)
        .forEach(([provider, count]) => {
          const percentage = ((count / stats.total_entries) * 100).toFixed(1);
          console.log(`  ${provider.padEnd(15)}: ${count.toString().padStart(4)} (${percentage}%)`);
        });
      console.log();
    }

    if (options.exitCodes || (!options.summary && !options.failures && !options.providers)) {
      console.log('🚪 Exit Codes:\n');
      Object.entries(stats.by_exit_code)
        .sort(([a], [b]) => parseInt(a, 10) - parseInt(b, 10))
        .forEach(([code, count]) => {
          const status = code === '0' ? '✅' : '❌';
          console.log(`  ${status} Exit ${code.padStart(3)}: ${count.toString().padStart(4)} executions`);
        });
      console.log();
    }

    if (Object.keys(stats.error_patterns).length > 0) {
      console.log('⚠️  Error Patterns:\n');
      Object.entries(stats.error_patterns)
        .sort(([, a], [, b]) => b - a)
        .forEach(([pattern, count]) => {
          const percentage = ((count / stats.failed) * 100).toFixed(1);
          console.log(`  ${pattern.padEnd(30)}: ${count.toString().padStart(3)} (${percentage}% of failures)`);
        });
      console.log();
    }

    if (!options.summary) {
      console.log(`📝 Recent Entries (showing ${Math.min(limit, entries.length)}/${entries.length}):\n`);
      entries.slice(0, limit).forEach((entry) => {
        const status = entry.metadata.exit_code === 0 ? '✅' : '❌';
        const duration = entry.metadata.duration_ms ? ` [${formatDuration(entry.metadata.duration_ms as number)}]` : '';
        const memory = entry.metadata.memory_used_bytes ? ` [${formatBytes(entry.metadata.memory_used_bytes as number)}]` : '';
        
        console.log(`  ${status} ${entry.timestamp}`);
        console.log(`     Task: ${entry.task_id}`);
        console.log(`     Provider: ${entry.metadata.provider}`);
        if (entry.metadata.exit_code !== 0) {
          console.log(`     Error: ${entry.metadata.error_type}${duration}${memory}`);
        } else {
          console.log(`     Status: Success${duration}${memory}`);
        }
      });
      console.log();
    }

    console.log('⚙️  Configuration:');
    console.log(`  - Log File: ${options.logFile}`);
    console.log(`  - File Size: ${fs.existsSync(options.logFile) ? formatBytes(fs.statSync(options.logFile).size) : 'N/A'}`);
    console.log();
  } finally {
    // No resources to clean up
  }
}

main().catch((error) => {
  console.error('Error:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
