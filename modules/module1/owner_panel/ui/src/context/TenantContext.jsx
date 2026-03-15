import React, { createContext, useContext } from 'react';
import { useParams } from 'react-router-dom';

const TenantContext = createContext(null);

export const TenantProvider = ({ children }) => {
  const { shop } = useParams();

  if (!shop) {
    return <div className="p-10 text-center">Invalid Tenant Context</div>;
  }

  return (
    <TenantContext.Provider value={{ shop }}>
      {children}
    </TenantContext.Provider>
  );
};

export const useTenant = () => {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
};
