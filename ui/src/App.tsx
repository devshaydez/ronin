import { Route, Routes, useLocation } from 'react-router-dom';
import { Header } from './components/Header';
import { StatesBar } from './components/StatesBar';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import Pipeline from './pages/Pipeline';
import Orders from './pages/Orders';
import AiDecisions from './pages/AiDecisions';
import Pools from './pages/Pools';
import Safety from './pages/Safety';
import Reviewer from './pages/Reviewer';
import { LIVE } from './lib/mode';

export default function App() {
  const onLanding = useLocation().pathname === '/';
  return (
    <>
      {!onLanding && <Header />}
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/app" element={<Dashboard />} />
        <Route path="/app/pipeline" element={<Pipeline />} />
        <Route path="/app/orders" element={<Orders />} />
        <Route path="/app/ai" element={<AiDecisions />} />
        <Route path="/app/pools" element={<Pools />} />
        <Route path="/app/safety" element={<Safety />} />
        <Route path="/app/reviewer" element={<Reviewer />} />
      </Routes>
      {!onLanding && !LIVE && <StatesBar />}
    </>
  );
}
