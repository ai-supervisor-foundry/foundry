import { dataSourceOptions } from './config';

describe('Database Config', () => {
  describe('dataSourceOptions', () => {
    it('should have correct configuration structure', () => {
      expect(dataSourceOptions).toBeDefined();
      expect(dataSourceOptions.type).toBe('postgres');
      expect(dataSourceOptions.entities).toBeDefined();
      expect(dataSourceOptions.migrations).toBeDefined();
      expect(dataSourceOptions.synchronize).toBe(false);
      expect(dataSourceOptions.migrationsRun).toBe(false);
      expect(dataSourceOptions.migrationsTableName).toBe('migrations');
      expect(dataSourceOptions.subscribers).toBeDefined();
    });

    it('should have entities path pattern', () => {
      expect(dataSourceOptions.entities).toContain(
        __dirname + '/../**/*.entity.{ts,js}',
      );
    });

    it('should have migrations path pattern', () => {
      expect(dataSourceOptions.migrations).toContain(
        __dirname + '/migrations/**/*.{js,ts}',
      );
    });

    it('should have subscribers path pattern', () => {
      expect(dataSourceOptions.subscribers).toContain(
        __dirname + '/../**/*.subscriber.{ts,js}',
      );
    });

    it('should have SnakeNamingStrategy', () => {
      expect(dataSourceOptions.namingStrategy).toBeDefined();
    });
  });
});
