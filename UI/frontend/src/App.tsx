import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Dashboard from './pages/Dashboard';
import Tasks from './pages/Tasks';
import Logs from './pages/Logs';
import CommandExecutor from './pages/CommandExecutor';
import StateInspector from './pages/StateInspector';
import LocalProvider from './pages/LocalProvider';
import Projects from './pages/Projects';
import Settings from './pages/Settings';
import Layout from './components/Layout';

function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/logs" element={<Logs />} />
          <Route path="/commands" element={<CommandExecutor />} />
          <Route path="/state" element={<StateInspector />} />
          <Route path="/local" element={<LocalProvider />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;

