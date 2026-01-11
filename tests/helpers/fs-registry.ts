import { FileSystemMock } from '../mocks/infrastructure/filesystem/fs.mock';

export const fsRegistry = {
  currentMock: null as FileSystemMock | null,
  
  setMock(mock: FileSystemMock) {
    this.currentMock = mock;
  },
  
  reset() {
    this.currentMock = null;
  }
};
