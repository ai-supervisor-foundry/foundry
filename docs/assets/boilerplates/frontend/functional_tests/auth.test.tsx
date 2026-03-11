/**
 * Functional tests: Auth flows (login, signup).
 */
import './setup';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from './server';
import { Login } from '../pages/Login';
import { AuthProvider } from '../services/authContext';
import { ToastProvider } from '../services/toastContext';

const renderLogin = (initialPath = '/login') =>
  render(
    <AuthProvider>
      <ToastProvider>
        <MemoryRouter initialEntries={[initialPath]}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<div data-testid="dashboard">Dashboard</div>} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </AuthProvider>
  );

describe('Auth: Login flows', () => {
  it('valid login → dashboard', async () => {
    const user = userEvent.setup();
    renderLogin();
    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'Password1!');
    await user.click(screen.getByRole('button', { name: /Sign In/i }));
    expect(await screen.findByTestId('dashboard')).toBeInTheDocument();
  });

  it('invalid credentials → error, stays on login', async () => {
    server.use(
      http.post('http://localhost/api/v1/auth/login', () =>
        HttpResponse.json({ message: 'Invalid credentials' }, { status: 401 })
      )
    );
    const user = userEvent.setup();
    renderLogin();
    await user.type(screen.getByLabelText(/email/i), 'wrong@example.com');
    await user.type(screen.getByLabelText(/password/i), 'Wrong1!');
    await user.click(screen.getByRole('button', { name: /Sign In/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Invalid|credentials/i);
    expect(screen.getByPlaceholderText(/name@company.com/i)).toBeInTheDocument();
  });
});
