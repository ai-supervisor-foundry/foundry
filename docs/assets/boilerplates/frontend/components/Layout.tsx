import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import { useAuth } from '../services/authContext';
import { 
  LayoutDashboard, 
  LogOut,
  Menu as MenuIcon,
  X,
  Activity,
} from 'lucide-react';
import { getPageTitle } from '../utils/layoutUtils';
import { GhostButton, IconButton } from './buttons';
import { MENU_ITEM } from '../theme/buttons';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const pageTitle = getPageTitle(location.pathname);
  const [mobileSidenavOpen, setMobileSidenavOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
    setMobileSidenavOpen(false);
  };

  const navItems = [
    { to: '/', label: 'Home', icon: LayoutDashboard },
  ];

  const sidebarContent = (
    <>
      <div className="p-6 border-b border-slate-800">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Activity className="w-7 h-7 text-indigo-400" /> 
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-cyan-400">
            Foundry
          </span>
        </h1>
      </div>
      <nav className="p-4 space-y-2 flex-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `
              flex items-center gap-3 px-4 min-h-[44px] py-3 rounded-lg transition-colors
              ${isActive 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50' 
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'}
            `}
          >
            <item.icon className="w-5 h-5" />
            <span className="font-medium">{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="p-4 border-t border-slate-800 bg-slate-900">
        <Menu as="div" className="relative">
          <MenuButton className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-slate-800 transition-colors text-left">
            <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold shrink-0">
              {user?.name?.charAt(0).toUpperCase() ?? '?'}
            </div>
            <div className="overflow-hidden min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.name}</p>
              <p className="text-xs text-slate-300 truncate">{user?.email}</p>
            </div>
          </MenuButton>
          <MenuItems anchor="top" className="z-50 w-56 rounded-lg bg-slate-800 border border-slate-700 shadow-xl p-1 focus:outline-none">
            <p className="px-3 py-2 text-xs text-slate-400 truncate border-b border-slate-700">{user?.email}</p>
            <MenuItem>
              <GhostButton
                role="menuitem"
                onClick={handleLogout}
                className={`${MENU_ITEM} text-slate-300 hover:text-red-400 hover:bg-slate-700 text-sm`}
              >
                <LogOut className="w-4 h-4" />
                Logout
              </GhostButton>
            </MenuItem>
          </MenuItems>
        </Menu>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row md:overflow-x-hidden mobile-overflow-visible">
      {/* Mobile Header */}
      <header className="md:hidden bg-white border-b p-4 flex justify-between items-center sticky top-0 z-20 shadow-sm">
        <IconButton
          type="button"
          onClick={() => setMobileSidenavOpen(true)}
          className="rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
          variant="ghost"
          aria-label="Open menu"
        >
          <MenuIcon className="w-6 h-6" />
        </IconButton>
        <div className="flex flex-col min-w-0 flex-1 mx-2">
          <span className="text-lg font-semibold text-slate-800 truncate">Foundry</span>
          <p className="text-xs text-slate-500 truncate">{pageTitle}</p>
        </div>
      </header>

      {/* Mobile Sidenav (drawer) */}
      {mobileSidenavOpen && (
        <>
          <div className="md:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setMobileSidenavOpen(false)} aria-hidden />
          <aside className="md:hidden fixed inset-y-0 left-0 w-72 bg-slate-900 text-slate-100 z-50 flex flex-col shadow-xl">
            <div className="p-4 flex justify-between items-center border-b border-slate-800">
              <span className="font-bold text-white">Foundry</span>
              <IconButton type="button" onClick={() => setMobileSidenavOpen(false)} variant="ghost" className="p-2 rounded-lg hover:bg-slate-800 text-slate-400" aria-label="Close menu">
                <X className="w-5 h-5" />
              </IconButton>
            </div>
            <nav className="p-4 space-y-1 flex-1 overflow-y-auto">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileSidenavOpen(false)}
                  className={({ isActive }) => `
                    flex items-center gap-3 px-4 min-h-[44px] py-3 rounded-lg
                    ${isActive ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}
                  `}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </NavLink>
              ))}
            </nav>
            <div className="p-4 border-t border-slate-800">
              <p className="text-sm font-medium text-white truncate">{user?.name}</p>
              <p className="text-xs text-slate-400 truncate">{user?.email}</p>
              <GhostButton onClick={handleLogout} className="mt-3 w-full justify-start gap-2 px-3 py-2 text-sm text-slate-300 hover:text-red-400 hover:bg-slate-800 rounded-lg border-none font-normal">
                <LogOut className="w-4 h-4" /> Logout
              </GhostButton>
            </div>
          </aside>
        </>
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900 text-slate-100 fixed inset-y-0 z-10">
        {sidebarContent}
      </aside>

      {/* Main content */}
      <div className="flex-1 md:ml-64 flex flex-col min-h-0 md:overflow-x-hidden mobile-overflow-visible">
        <header className="hidden md:block bg-white border-b px-6 py-4 shadow-sm">
          <h2 className="text-xl font-bold text-slate-800">{pageTitle}</h2>
          <p className="text-sm text-slate-500 mt-0.5">Welcome, {user?.name ?? 'User'}</p>
        </header>
        <main className="flex-1 p-4 md:p-8 overflow-y-auto md:h-screen pb-20 md:pb-0 md:overflow-x-hidden mobile-overflow-visible">
          {children}
        </main>
      </div>
    </div>
  );
};
