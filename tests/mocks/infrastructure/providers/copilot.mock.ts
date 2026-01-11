import { BaseProviderMock } from './base-provider.mock';
import { Provider } from '@/domain/agents/enums/provider';

export class CopilotMock extends BaseProviderMock {
  constructor() {
    super(Provider.COPILOT);
  }
}
