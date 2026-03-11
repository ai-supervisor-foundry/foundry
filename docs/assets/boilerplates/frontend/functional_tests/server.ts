import { setupServer } from 'msw/node';
import { apiHandlers } from './handlers/apiHandlers';

export const server = setupServer(...apiHandlers);
