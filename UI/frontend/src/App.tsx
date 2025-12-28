import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Tasks from './pages/Tasks';
import Logs from './pages/Logs';
import CommandExecutor from './pages/CommandExecutor';
import StateInspector from './pages/StateInspector';
import Layout from './components/Layout';

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/logs" element={<Logs />} />
          <Route path="/commands" element={<CommandExecutor />} />
          <Route path="/state" element={<StateInspector />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;

