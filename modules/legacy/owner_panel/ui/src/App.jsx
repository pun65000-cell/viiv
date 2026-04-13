import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';

const App = () => {
  return (
    <Routes>
      <Route path="/" element={<div className="p-10 text-center font-bold text-3xl text-blue-600">VIIV Commerce Platform</div>} />
      
      <Route path="/:shop" element={<Layout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="products" element={<div className="p-10 text-2xl font-bold">Products Management</div>} />
        <Route path="customers" element={<div className="p-10 text-2xl font-bold">Customers Management</div>} />
        <Route path="orders" element={<div className="p-10 text-2xl font-bold">Orders History</div>} />
        <Route path="pos" element={<div className="p-10 text-2xl font-bold">Point of Sale</div>} />
        <Route path="staff" element={<div className="p-10 text-2xl font-bold">Staff Management</div>} />
        <Route path="settings" element={<div className="p-10 text-2xl font-bold">Shop Settings</div>} />
      </Route>

      <Route path="*" element={<div className="p-10 text-center text-red-500 font-bold text-2xl">404 - Not Found</div>} />
    </Routes>
  );
};

export default App;
