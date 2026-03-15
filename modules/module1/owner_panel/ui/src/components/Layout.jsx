import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { TenantProvider } from '../context/TenantContext';

const Layout = () => {
  return (
    <TenantProvider>
      <div className="flex h-screen bg-gray-100 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 p-8">
          <Outlet />
        </main>
      </div>
    </TenantProvider>
  );
};

export default Layout;
