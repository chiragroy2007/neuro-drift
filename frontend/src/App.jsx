import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import Home from './components/Home';
import TaskEngine from './components/TaskEngine';
import Dashboard from './components/Dashboard';

function App() {
  const [userId, setUserId] = useState(() => localStorage.getItem('biodrift_user_id'));

  useEffect(() => {
    if (userId) {
      localStorage.setItem('biodrift_user_id', userId);
    }
  }, [userId]);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home userId={userId} setUserId={setUserId} />} />
        <Route path="/task" element={<TaskEngine userId={userId} />} />
        <Route path="/dashboard" element={<Dashboard userId={userId} />} />
      </Routes>
    </Router>
  );
}

export default App;
