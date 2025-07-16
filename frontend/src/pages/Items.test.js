import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Items from './Items';
import { useData } from '../state/DataContext';

// Mock the useData hook
jest.mock('../state/DataContext');

// Mock react-window with a simple implementation
jest.mock('react-window', () => ({
  FixedSizeList: ({ children, itemData, itemCount, ...props }) => (
    <div data-testid="virtual-list" {...props}>
      {itemData && itemData.slice(0, Math.min(itemCount, 5)).map((item, index) =>
        <div key={item.id} data-testid={`item-${item.id}`}>
          {children({ index, style: {}, data: itemData })}
        </div>
      )}
    </div>
  )
}));

const mockUseData = useData;

const renderWithRouter = (component) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('Items Component', () => {
  const mockFetchItems = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchItems.mockImplementation(() => Promise.resolve());
    mockUseData.mockReturnValue({
      items: [],
      pagination: null,
      loading: false,
      error: null,
      fetchItems: mockFetchItems
    });
  });

  it('renders search form', () => {
    renderWithRouter(<Items />);
    
    expect(screen.getByPlaceholderText('Search items by name...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument();
  });

  it('renders loading state', () => {
    mockUseData.mockReturnValue({
      items: [],
      pagination: null,
      loading: true,
      error: null,
      fetchItems: mockFetchItems
    });

    renderWithRouter(<Items />);
    
    expect(screen.getByText('Loading items...')).toBeInTheDocument();
  });

  it('renders items list', () => {
    const mockItems = [
      { id: 1, name: 'Test Item 1' },
      { id: 2, name: 'Test Item 2' }
    ];

    const mockPagination = {
      page: 1,
      limit: 10,
      total: 2,
      totalPages: 1,
      hasNext: false,
      hasPrev: false
    };

    mockUseData.mockReturnValue({
      items: mockItems,
      pagination: mockPagination,
      loading: false,
      error: null,
      fetchItems: mockFetchItems
    });

    renderWithRouter(<Items />);
    
    expect(screen.getByTestId('virtual-list')).toBeInTheDocument();
    expect(screen.getByText('Total items: 2')).toBeInTheDocument();
  });

  it('renders empty state when no items', () => {
    mockUseData.mockReturnValue({
      items: [],
      pagination: { page: 1, total: 0, totalPages: 1, hasNext: false, hasPrev: false },
      loading: false,
      error: null,
      fetchItems: mockFetchItems
    });

    renderWithRouter(<Items />);
    
    expect(screen.getByText('No items found')).toBeInTheDocument();
    expect(screen.getByText('No items available at the moment.')).toBeInTheDocument();
  });

  it('renders error state', () => {
    mockUseData.mockReturnValue({
      items: [],
      pagination: null,
      loading: false,
      error: 'Network error',
      fetchItems: mockFetchItems
    });

    renderWithRouter(<Items />);
    
    expect(screen.getByText('Unable to load items')).toBeInTheDocument();
    expect(screen.getByText('Network error')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('calls fetchItems on mount', () => {
    renderWithRouter(<Items />);
    
    expect(mockFetchItems).toHaveBeenCalledWith(
      expect.any(Object),
      { page: 1, limit: 50, q: '' }
    );
  });

  it('handles search form submission', async () => {
    renderWithRouter(<Items />);
    
    const searchInput = screen.getByPlaceholderText('Search items by name...');
    const searchForm = searchInput.closest('form');

    // Clear the initial call from useEffect
    mockFetchItems.mockClear();

    fireEvent.change(searchInput, { target: { value: 'test query' } });
    
    // Create a proper form submission event with form data
    const formData = new FormData(searchForm);
    formData.set('search', 'test query');
    
    fireEvent.submit(searchForm, {
      target: {
        search: { value: 'test query' }
      }
    });

    await waitFor(() => {
      expect(mockFetchItems).toHaveBeenCalledWith(
        expect.any(Object),
        { page: 1, limit: 50, q: 'test query' }
      );
    });
  });

  it('handles pagination correctly', () => {
    const mockPagination = {
      page: 2,
      limit: 10,
      total: 25,
      totalPages: 3,
      hasNext: true,
      hasPrev: true
    };

    mockUseData.mockReturnValue({
      items: [{ id: 1, name: 'Test Item' }],
      pagination: mockPagination,
      loading: false,
      error: null,
      fetchItems: mockFetchItems
    });

    renderWithRouter(<Items />);
    
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();
    
    const prevButton = screen.getByRole('button', { name: /previous/i });
    const nextButton = screen.getByRole('button', { name: /next/i });
    
    expect(prevButton).not.toBeDisabled();
    expect(nextButton).not.toBeDisabled();
  });

  it('disables pagination buttons when appropriate', () => {
    const mockPagination = {
      page: 1,
      limit: 10,
      total: 5,
      totalPages: 1,
      hasNext: false,
      hasPrev: false
    };

    mockUseData.mockReturnValue({
      items: [{ id: 1, name: 'Test Item' }],
      pagination: mockPagination,
      loading: false,
      error: null,
      fetchItems: mockFetchItems
    });

    renderWithRouter(<Items />);
    
    const prevButton = screen.getByRole('button', { name: /previous/i });
    const nextButton = screen.getByRole('button', { name: /next/i });
    
    expect(prevButton).toBeDisabled();
    expect(nextButton).toBeDisabled();
  });

  it('handles retry button click', () => {
    mockUseData.mockReturnValue({
      items: [],
      pagination: null,
      loading: false,
      error: 'Network error',
      fetchItems: mockFetchItems
    });

    renderWithRouter(<Items />);
    
    const retryButton = screen.getByRole('button', { name: /try again/i });
    fireEvent.click(retryButton);

    expect(mockFetchItems).toHaveBeenCalled();
  });

  it('has proper accessibility attributes', () => {
    const mockItems = [{ id: 1, name: 'Test Item' }];
    const mockPagination = {
      page: 1,
      limit: 10,
      total: 1,
      totalPages: 1,
      hasNext: false,
      hasPrev: false
    };

    mockUseData.mockReturnValue({
      items: mockItems,
      pagination: mockPagination,
      loading: false,
      error: null,
      fetchItems: mockFetchItems
    });

    renderWithRouter(<Items />);
    
    expect(screen.getByRole('search')).toBeInTheDocument();
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });

  it('handles pagination button clicks', () => {
    const mockPagination = {
      page: 1,
      limit: 10,
      total: 30,
      totalPages: 3,
      hasNext: true,
      hasPrev: false
    };

    mockUseData.mockReturnValue({
      items: [{ id: 1, name: 'Test Item' }],
      pagination: mockPagination,
      loading: false,
      error: null,
      fetchItems: mockFetchItems
    });

    renderWithRouter(<Items />);
    
    // Clear the initial call from useEffect
    mockFetchItems.mockClear();
    
    const nextButton = screen.getByRole('button', { name: /next/i });
    fireEvent.click(nextButton);

    expect(mockFetchItems).toHaveBeenCalledWith(
      expect.any(Object),
      { page: 2, limit: 50, q: '' }
    );
  });

  it('shows empty search results message', () => {
    mockUseData.mockReturnValue({
      items: [],
      pagination: { page: 1, total: 0, totalPages: 1, hasNext: false, hasPrev: false },
      loading: false,
      error: null,
      fetchItems: mockFetchItems
    });

    const TestWrapper = () => {
      const [searchQuery, setSearchQuery] = React.useState('nonexistent');
      
      React.useEffect(() => {
        // Simulate search state
      }, []);
      
      return <Items />;
    };

    renderWithRouter(<TestWrapper />);
    
    expect(screen.getByText('No items found')).toBeInTheDocument();
  });
});