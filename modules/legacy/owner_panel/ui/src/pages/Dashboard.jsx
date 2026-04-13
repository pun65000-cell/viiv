import React from 'react';
import { useTenant } from '../context/TenantContext';
import { ShoppingCart, Package, Users, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';

const StatCard = ({ title, value, icon: Icon, color }) => (
  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
    <div className="flex items-center justify-between mb-4">
      <div className={`p-3 rounded-lg ${color}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <span className="text-green-500 text-sm font-semibold">+12%</span>
    </div>
    <h3 className="text-gray-500 text-sm font-medium">{title}</h3>
    <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
  </div>
);

const Dashboard = () => {
  const { shop } = useTenant();

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 capitalize">Dashboard</h1>
          <p className="text-gray-500 mt-1 uppercase text-sm tracking-widest">{shop}</p>
        </div>
        <Link 
          to={`/${shop}/pos`}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold transition-all shadow-md active:scale-95 flex items-center"
        >
          <ShoppingCart className="w-5 h-5 mr-2" />
          Quick POS
        </Link>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Sales" value="฿ 45,280" icon={TrendingUp} color="bg-blue-500" />
        <StatCard title="Orders" value="124" icon={ShoppingCart} color="bg-green-500" />
        <StatCard title="Products" value="48" icon={Package} color="bg-purple-500" />
        <StatCard title="Customers" value="892" icon={Users} color="bg-orange-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 min-h-[400px]">
          <h3 className="text-lg font-bold text-gray-900 mb-6 border-b pb-4">Recent Sales</h3>
          <div className="space-y-4">
             {/* Sales list placeholder */}
             {[1,2,3,4,5].map(i => (
               <div key={i} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                  <div className="flex items-center">
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mr-4">
                      <Users className="w-5 h-5 text-gray-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Customer #{i}</p>
                      <p className="text-xs text-gray-500">2 mins ago</p>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-gray-900">฿ 450.00</span>
               </div>
             ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 min-h-[400px]">
          <h3 className="text-lg font-bold text-gray-900 mb-6 border-b pb-4">Top Products</h3>
          <div className="space-y-4">
             {/* Products list placeholder */}
             {[1,2,3,4,5].map(i => (
               <div key={i} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                  <div className="flex items-center">
                    <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center mr-4">
                      <Package className="w-5 h-5 text-gray-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Product Sample {i}</p>
                      <p className="text-xs text-gray-500">32 sold</p>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-gray-900">฿ 120.00</span>
               </div>
             ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
