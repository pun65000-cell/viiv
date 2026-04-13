import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTenant } from '../context/TenantContext';
import { LayoutDashboard, ShoppingBag, Users, ShoppingCart, Users2, Settings, LogOut } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const Sidebar = () => {
  const { shop } = useTenant();
  const location = useLocation();

  const menuItems = [
    { name: 'Dashboard', path: `/${shop}/dashboard`, icon: LayoutDashboard },
    { name: 'POS', path: `/${shop}/pos`, icon: ShoppingCart },
    { name: 'Products', path: `/${shop}/products`, icon: ShoppingBag },
    { name: 'Customers', path: `/${shop}/customers`, icon: Users },
    { name: 'Orders', path: `/${shop}/orders`, icon: ShoppingCart },
    { name: 'Staff', path: `/${shop}/staff`, icon: Users2 },
    { name: 'Settings', path: `/${shop}/settings`, icon: Settings },
  ];

  return (
    <div className="flex flex-col w-64 h-screen bg-gray-900 text-white border-r border-gray-800">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-blue-500">VIIV</h1>
        <p className="text-sm text-gray-400 mt-1 uppercase tracking-wider">{shop}</p>
      </div>
      
      <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          
          return (
            <Link
              key={item.name}
              to={item.path}
              className={cn(
                "flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors duration-200",
                isActive 
                  ? "bg-blue-600 text-white" 
                  : "text-gray-400 hover:bg-gray-800 hover:text-white"
              )}
            >
              <Icon className="w-5 h-5 mr-3" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-800">
        <button className="flex items-center w-full px-4 py-3 text-sm font-medium text-gray-400 rounded-lg hover:bg-gray-800 hover:text-white transition-colors duration-200">
          <LogOut className="w-5 h-5 mr-3" />
          Logout
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
