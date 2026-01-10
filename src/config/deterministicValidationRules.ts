import { CriterionMapping } from '../application/services/deterministicValidator';

// Criterion → Check mappings
export const DETERMINISTIC_VALIDATION_RULES: Record<string, CriterionMapping> = {
  expo_project: {
    confidence: 'high',
    keywords: [
      /expo.*project.*(created|initialized|setup)/i,
      /create.*expo.*project/i,
      /initialize.*expo/i
    ],
    checks: [
      { type: 'file_exists', path: 'package.json' },
      { type: 'json_contains', path: 'package.json', pattern: 'dependencies.expo' },
      { type: 'file_exists', path: 'app.json' },
      { type: 'file_exists', path: 'tsconfig.json' },
    ]
  },
  
  no_boilerplate: {
    confidence: 'medium', // Heuristic-based
    keywords: [
      /no.*(boilerplate|demo|template|example|sample)/i,
      /remove.*(boilerplate|demo)/i,
      /clean.*structure/i,
    ],
    checks: [
      // Ensure we don't have too many files (heuristic for "clean" init)
      { type: 'file_count', pattern: 'src/**/*.{ts,tsx}', count: { max: 5 } },
      { type: 'directory_exists', path: 'screens', negate: true },
      { type: 'directory_exists', path: 'components/demo', negate: true },
      // Check src folder for boilerplate keywords
      { type: 'grep_not_found', path: 'src', pattern: 'boilerplate|demo|example' },
    ]
  },
  
  dependencies_installed: {
    confidence: 'high',
    keywords: [
      /dependencies.*(installed|added|present)/i,
      /npm install/i,
      /node_modules/i,
    ],
    checks: [
      { type: 'directory_exists', path: 'node_modules' },
      { type: 'file_exists', path: 'package-lock.json' },
    ]
  },
  
  typescript_configured: {
    confidence: 'high',
    keywords: [
      /typescript.*(configured|setup)/i,
      /tsconfig/i,
    ],
    checks: [
      { type: 'file_exists', path: 'tsconfig.json' },
      { type: 'json_contains', path: 'tsconfig.json', pattern: 'compilerOptions' },
    ]
  },
  
  // Note: builds_successfully is tricky without running a command.
  // We check for the script existence as a proxy for "setup for build",
  // but strictly speaking, this doesn't prove it builds.
  // We'll keep it as a partial check - if these miss, it definitely fails.
  builds_successfully_proxy: {
    confidence: 'medium', // Proxy check only
    keywords: [
      /(builds?|compiles?).*(success|without.*error)/i,
      /project.*builds?/i,
    ],
    checks: [
      { type: 'file_exists', path: 'package.json' },
      { type: 'json_contains', path: 'package.json', pattern: 'scripts.build' },
    ]
  },

  api_structure: {
      confidence: 'high',
      keywords: [
          /api.*structure/i,
          /express.*server/i
      ],
      checks: [
          { type: 'file_exists', path: 'package.json'},
          { type: 'json_contains', path: 'package.json', pattern: 'dependencies.express'},
          { type: 'file_exists', path: 'src/index.ts' } // Common convention
      ]
  },

  prisma_setup: {
    confidence: 'high',
    keywords: [
      /prisma.*(setup|schema)/i,
      /setup.*prisma/i
    ],
    checks: [
      { type: 'file_exists', path: 'prisma/schema.prisma' },
      { type: 'json_contains', path: 'package.json', pattern: 'dependencies.@prisma/client' }
    ]
  },

  sequelize_setup: {
    confidence: 'high',
    keywords: [
      /sequelize.*(setup|models)/i,
      /setup.*sequelize/i
    ],
    checks: [
      { type: 'json_contains', path: 'package.json', pattern: 'dependencies.sequelize' }
    ]
  },

  typeorm_setup: {
    confidence: 'high',
    keywords: [
      /typeorm.*(setup|entities)/i,
      /setup.*typeorm/i
    ],
    checks: [
      { type: 'json_contains', path: 'package.json', pattern: 'dependencies.typeorm' }
    ]
  },

  tests_present: {
    confidence: 'high',
    keywords: [
      /tests?.*(present|created|added|setup)/i,
      /unit.*tests/i,
      /integration.*tests/i,
      /jest.*setup/i
    ],
    checks: [
      { type: 'file_count', pattern: '**/tests/**/*.test.{ts,tsx,js}', count: { min: 1 } },
      { type: 'json_contains', path: 'package.json', pattern: 'scripts.test' }
    ]
  },

  documentation_updated: {
    confidence: 'high',
    keywords: [
      /documentation.*(updated|added|present)/i,
      /README.*(updated|added|present)/i,
      /update.*README/i
    ],
    checks: [
      { type: 'file_exists', path: 'README.md' },
      { type: 'grep_found', path: 'README.md', pattern: '.' } // Not empty
    ]
  },

  config_files: {
    confidence: 'high',
    keywords: [
      /config.*(files?|setup)/i,
      /env.*example/i,
      /docker.*compose/i,
      /gitignore/i
    ],
    checks: [
      { type: 'file_exists', path: '.env.example' },
      { type: 'file_exists', path: '.gitignore' },
      { type: 'file_exists', path: 'docker-compose.yml' }
    ]
  }
};
