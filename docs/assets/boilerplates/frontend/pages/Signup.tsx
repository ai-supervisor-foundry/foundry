import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Clock, ArrowRight } from 'lucide-react';
import { SubmitButton } from '../components/buttons';
import { useAuth } from '../services/authContext';
import { signupApi } from '../services/api';
import { User, UserRole } from '../types';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN_LEN = 8;
const hasUppercase = (s: string) => /[A-Z]/.test(s);
const hasNumber = (s: string) => /\d/.test(s);

export const Signup: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');
  const navigate = useNavigate();
  const { login } = useAuth();

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = 'Name is required';
    if (!email.trim()) next.email = 'Email is required';
    else if (!EMAIL_REGEX.test(email)) next.email = 'Enter a valid email address';
    if (password.length < PASSWORD_MIN_LEN) next.password = 'Password must be at least 8 characters';
    else if (!hasUppercase(password)) next.password = 'Password must contain at least one uppercase letter';
    else if (!hasNumber(password)) next.password = 'Password must contain at least one number';
    if (password !== confirmPassword) next.confirmPassword = 'Passwords do not match';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    if (!validate()) return;
    setLoading(true);
    try {
      const data = await signupApi(name.trim(), email.trim(), password);
      const user: User = {
        id: String(data.user.id),
        name: data.user.name,
        email: data.user.email,
        role: data.user.role as UserRole,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(data.user.name)}&background=0D8ABC&color=fff`,
      };
      login(data.accessToken, user);
      navigate('/', { replace: true });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 overflow-x-hidden">
      <div className="max-w-md w-full min-w-0 bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100">
        <div className="p-8 md:p-12">
          <div className="flex justify-center mb-8">
            <div className="p-3 bg-indigo-50 rounded-xl">
              <Clock className="w-10 h-10 text-indigo-600" />
            </div>
          </div>

          <h2 className="text-2xl sm:text-3xl font-bold text-center text-slate-800 mb-2">Create account</h2>
          <p className="text-center text-slate-500 mb-8">Register to manage your timesheets</p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {submitError && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg" role="alert">{submitError}</p>
            )}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">Name</label>
              <input
                id="name"
                type="text"
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none bg-white"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
              <input
                id="email"
                type="email"
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none bg-white"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <input
                id="password"
                type="password"
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none bg-white"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password}</p>}
            </div>
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 mb-1">Confirm Password</label>
              <input
                id="confirmPassword"
                type="password"
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none bg-white"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              {errors.confirmPassword && <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>}
            </div>

            <SubmitButton disabled={loading} width="full">
              {loading ? 'Creating account...' : 'Create account'}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </SubmitButton>
          </form>

          <div className="mt-8 text-center text-sm text-slate-500">
            <p>Already have an account? <Link to="/login" className="text-indigo-600 font-medium hover:underline">Login</Link></p>
          </div>
        </div>
        <div className="px-8 py-4 bg-slate-50 border-t border-slate-100 text-center text-xs text-slate-400">
          &copy; 2024 TimeMate. All rights reserved.
        </div>
      </div>
    </div>
  );
};
