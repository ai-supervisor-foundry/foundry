import { type TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSource, type DataSourceOptions } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { types } from 'pg';

types.setTypeParser(types.builtins.NUMERIC, (value: string): number =>
  parseFloat(value),
);

export const testDataSourceOptions = {
  type: 'postgres',
  url:
    process.env.TEST_DB_URI ||
    process.env.DB_URI?.replace(/\/[^/]+$/, '/test_db'),
  entities: [__dirname + '/../**/*.entity.{ts,js}'],
  migrations: [__dirname + '/migrations/**/*.{js,ts}'],
  synchronize: false,
  migrationsRun: false,
  logging: false,
  migrationsTableName: 'migrations',
  namingStrategy: new SnakeNamingStrategy(),
  useUTC: true,
  subscribers: [__dirname + '/../**/*.subscriber.{ts,js}'],
} as TypeOrmModuleOptions;

export default new DataSource(testDataSourceOptions as DataSourceOptions);
