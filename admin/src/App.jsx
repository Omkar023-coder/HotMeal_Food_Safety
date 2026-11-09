import React, { useState } from 'react'
import Navbar from './components/Navbar/Navbar'
import Sidebar from './components/Sidebar/Sidebar'
import { Routes, Route } from 'react-router-dom';
import Add from './pages/Add/Add';
import List from './pages/List/List';
import Orders from './pages/Orders/Orders';
import AddRestaurant from './pages/AddRestaurant/AddRestaurant';
import ListRestaurant from './pages/ListRestaurant/ListRestaurant';
import SafetyEvidence from './pages/SafetyEvidence/SafetyEvidence';
import Login from './pages/Login/Login';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const App = () => {

  const url = 'http://localhost:4000';

  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [role, setRole]   = useState(localStorage.getItem('role') || '');

  const handleLogin = (newToken, newRole) => {
    setToken(newToken);
    setRole(newRole);
  }

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    setToken('');
    setRole('');
  }

  // Gate 1 — no token at all → show login
  if (!token) {
    return (
      <>
        <ToastContainer />
        <Login url={url} onLogin={handleLogin} />
      </>
    )
  }

  // Gate 2 — token exists but role is not admin
  if (role !== 'admin') {
    return (
      <>
        <ToastContainer />
        <Login url={url} onLogin={handleLogin} />
      </>
    )
  }

  // Admitted — user has token + admin role
  return (
    <div>
      <ToastContainer />
      <Navbar onLogout={handleLogout} />
      <hr />
      <div className="app-content">
        <Sidebar />
        <Routes>
          {/* Food Routes */}
          <Route path='/add'    element={<Add url={url} />} />
          <Route path='/list'   element={<List url={url} />} />
          <Route path='/orders' element={<Orders url={url} />} />
          {/* Restaurant Routes */}
          <Route path='/add-restaurant'  element={<AddRestaurant url={url} />} />
          <Route path='/list-restaurant' element={<ListRestaurant url={url} />} />
          {/* Safety Evidence */}
          <Route path='/safety-evidence' element={<SafetyEvidence url={url} />} />
          {/* Default */}
          <Route path='*' element={<Add url={url} />} />
        </Routes>
      </div>
    </div>
  )
}

export default App
