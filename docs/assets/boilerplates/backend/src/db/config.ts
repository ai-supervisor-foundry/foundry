import { type TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSource, type DataSourceOptions } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { types } from 'pg';
import { EnvProps } from '../env';

types.setTypeParser(types.builtins.NUMERIC, (value: string): number =>
  parseFloat(value),
);

export const dataSourceOptions = {
  type: 'postgres',
  url: process.env.DB_URI,
  entities: [__dirname + '/../**/*.entity.{ts,js}'],
  migrations: [__dirname + '/migrations/**/*.{js,ts}'],
  synchronize: false,
  migrationsRun: false,
  logging: JSON.parse(
    (process.env as unknown as EnvProps).ENABLE_LOGGING || 'false',
  ),
  migrationsTableName: 'migrations',
  namingStrategy: new SnakeNamingStrategy(),
  useUTC: true,
  subscribers: [__dirname + '/../**/*.subscriber.{ts,js}'],
} as TypeOrmModuleOptions;

export default new DataSource(dataSourceOptions as DataSourceOptions);
