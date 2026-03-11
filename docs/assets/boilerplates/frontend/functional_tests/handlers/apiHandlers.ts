/**
 * MSW handlers for boilerplate functional tests.
 * Auth + Users only. Add domain handlers when extending.
 */
import { http, HttpResponse } from 'msw';
import { MOCK_USER, MOCK_ADMIN } from '../fixtures/mockObjects';

const API = 'http://localhost/api/v1';

export const apiHandlers = [
  http.post(`${API}/auth/login`, () =>
    HttpResponse.json({
      accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjk5OTk5OTk5OTl9.x',
      user: { id: 1, name: MOCK_USER.name, email: MOCK_USER.email, role: MOCK_USER.role },
    })
  ),
  http.post(`${API}/auth/signup`, () =>
    HttpResponse.json({
      accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjk5OTk5OTk5OTl9.x',
      user: { id: 2, name: 'New User', email: 'new@example.com', role: 'USER' },
    })
  ),
  http.get(`${API}/auth/profile`, () =>
    HttpResponse.json({ id: 1, name: MOCK_USER.name, email: MOCK_USER.email, role: MOCK_USER.role })
  ),
  http.get(/\/api\/v1\/users($|\?)/, () =>
    HttpResponse.json([MOCK_USER, MOCK_ADMIN])
  ),
];
