import { apiClient } from './apiClient';
import type { User } from '../types';

const BASE = '/api/v1/users';

export interface CreateUserPayload {
  name: string;
  email: string;
  password: string;
  role?: 'ADMIN' | 'MANAGER' | 'USER';
  position?: string | null;
  managerId?: number | null;
}

export interface UpdateUserPayload {
  name?: string;
  email?: string;
  role?: 'ADMIN' | 'MANAGER' | 'USER';
  position?: string | null;
  managerId?: number | null;
}

export const usersApi = {
  list: async (): Promise<User[]> => {
    const data = await apiClient.get<unknown>(BASE);
    if (Array.isArray(data)) return data as User[];
    const items = (data as { items?: User[] })?.items;
    return Array.isArray(items) ? items : [];
  },

  create: async (body: CreateUserPayload): Promise<User> => {
    const created = await apiClient.post<User>(BASE, body);
    return created as User;
  },

  update: async (id: string | number, body: UpdateUserPayload): Promise<void> => {
    await apiClient.put<unknown>(`${BASE}/${id}`, body);
  },

  delete: async (id: string | number): Promise<void> => {
    await apiClient.delete(`${BASE}/${id}`);
  },
};
