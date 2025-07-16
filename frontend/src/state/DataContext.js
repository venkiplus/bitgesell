import React, { createContext, useCallback, useContext, useState } from 'react';

const DataContext = createContext();

export function DataProvider({ children }) {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchItems = useCallback(async (signal, { page = 1, limit = 10, q = '' } = {}) => {
    setLoading(true);
    setError(null);
    
    try {
      // Validate parameters
      const validPage = Math.max(1, parseInt(page) || 1);
      const validLimit = Math.min(100, Math.max(1, parseInt(limit) || 10));
      
      const params = new URLSearchParams({ 
        page: validPage, 
        limit: validLimit 
      });
      
      if (q && typeof q === 'string' && q.trim()) {
        params.append('q', q.trim());
      }
      
      const res = await fetch(`http://localhost:3001/api/items?${params}`, { 
        signal,
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      
      const json = await res.json();
      
      // Validate response structure
      if (!json || typeof json !== 'object') {
        throw new Error('Invalid response format');
      }
      
      if (!Array.isArray(json.items)) {
        throw new Error('Invalid items data received');
      }
      
      if (!json.pagination || typeof json.pagination !== 'object') {
        throw new Error('Invalid pagination data received');
      }
      
      setItems(json.items);
      setPagination(json.pagination);
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Failed to fetch items');
        setItems([]);
        setPagination(null);
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

  return (
    <DataContext.Provider value={{ items, pagination, loading, error, fetchItems }}>
      {children}
    </DataContext.Provider>
  );
}

export const useData = () => useContext(DataContext);