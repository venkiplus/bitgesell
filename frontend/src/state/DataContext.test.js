import React from 'react';
import { render, act, waitFor } from '@testing-library/react';
import { DataProvider, useData } from './DataContext';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Test component to access context
const TestComponent = ({ onData }) => {
  const data = useData();
  React.useEffect(() => {
    if (onData) {
      onData(data);
    }
  }, [data, onData]);
  return <div data-testid="test-component">Test</div>;
};

describe('DataContext', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [],
        pagination: { page: 1, limit: 10, total: 0, totalPages: 1, hasNext: false, hasPrev: false }
      })
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('provides initial state', () => {
    let contextData;
    const handleData = (data) => {
      contextData = data;
    };

    render(
      <DataProvider>
        <TestComponent onData={handleData} />
      </DataProvider>
    );

    expect(contextData).toEqual({
      items: [],
      pagination: null,
      loading: false,
      error: null,
      fetchItems: expect.any(Function)
    });
  });

  it('fetches items successfully', async () => {
    const mockResponse = {
      items: [{ id: 1, name: 'Test Item' }],
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1, hasNext: false, hasPrev: false }
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    });

    let contextData;
    const handleData = (data) => {
      contextData = data;
    };

    render(
      <DataProvider>
        <TestComponent onData={handleData} />
      </DataProvider>
    );

    const abortController = new AbortController();

    await act(async () => {
      await contextData.fetchItems(abortController.signal);
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3001/api/items?page=1&limit=10',
      expect.objectContaining({
        signal: abortController.signal,
        headers: { 'Content-Type': 'application/json' }
      })
    );

    expect(contextData.items).toEqual(mockResponse.items);
    expect(contextData.pagination).toEqual(mockResponse.pagination);
    expect(contextData.loading).toBe(false);
    expect(contextData.error).toBe(null);
  });

  it('handles fetch errors', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    let contextData;
    const handleData = (data) => {
      contextData = data;
    };

    render(
      <DataProvider>
        <TestComponent onData={handleData} />
      </DataProvider>
    );

    const abortController = new AbortController();

    await act(async () => {
      await contextData.fetchItems(abortController.signal);
    });

    expect(contextData.items).toEqual([]);
    expect(contextData.pagination).toBe(null);
    expect(contextData.loading).toBe(false);
    expect(contextData.error).toBe('Network error');
  });

  it('handles HTTP errors', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error'
    });

    let contextData;
    const handleData = (data) => {
      contextData = data;
    };

    render(
      <DataProvider>
        <TestComponent onData={handleData} />
      </DataProvider>
    );

    const abortController = new AbortController();

    await act(async () => {
      await contextData.fetchItems(abortController.signal);
    });

    expect(contextData.error).toBe('HTTP 500: Internal Server Error');
  });

  it('handles invalid response format', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ invalid: 'response' })
    });

    let contextData;
    const handleData = (data) => {
      contextData = data;
    };

    render(
      <DataProvider>
        <TestComponent onData={handleData} />
      </DataProvider>
    );

    const abortController = new AbortController();

    await act(async () => {
      await contextData.fetchItems(abortController.signal);
    });

    expect(contextData.error).toBe('Invalid items data received');
  });

  it('ignores aborted requests', async () => {
    const abortError = new Error('Request aborted');
    abortError.name = 'AbortError';
    mockFetch.mockRejectedValueOnce(abortError);

    let contextData;
    const handleData = (data) => {
      contextData = data;
    };

    render(
      <DataProvider>
        <TestComponent onData={handleData} />
      </DataProvider>
    );

    const abortController = new AbortController();

    await act(async () => {
      await contextData.fetchItems(abortController.signal);
    });

    expect(contextData.error).toBe(null);
  });

  it('handles search parameters correctly', async () => {
    const mockResponse = {
      items: [],
      pagination: { page: 1, limit: 10, total: 0, totalPages: 1, hasNext: false, hasPrev: false }
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    });

    let contextData;
    const handleData = (data) => {
      contextData = data;
    };

    render(
      <DataProvider>
        <TestComponent onData={handleData} />
      </DataProvider>
    );

    const abortController = new AbortController();

    await act(async () => {
      await contextData.fetchItems(abortController.signal, { 
        page: 2, 
        limit: 20, 
        q: 'search term' 
      });
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3001/api/items?page=2&limit=20&q=search+term',
      expect.any(Object)
    );
  });

  it('validates and clamps parameters', async () => {
    const mockResponse = {
      items: [],
      pagination: { page: 1, limit: 10, total: 0, totalPages: 1, hasNext: false, hasPrev: false }
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    });

    let contextData;
    const handleData = (data) => {
      contextData = data;
    };

    render(
      <DataProvider>
        <TestComponent onData={handleData} />
      </DataProvider>
    );

    const abortController = new AbortController();

    await act(async () => {
      await contextData.fetchItems(abortController.signal, { 
        page: -1, 
        limit: 500, 
        q: '   ' 
      });
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3001/api/items?page=1&limit=100',
      expect.any(Object)
    );
  });
});