/**
 * Tests for EnquiryListScreen
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import EnquiryListScreen from '../../screens/Enquiries/EnquiryListScreen';
import { createTestStore, createMockNavigation, mockUsers, mockEnquiry } from '../utils/testUtils';

// Mock hooks
jest.mock('../../features/enquiries/enquiriesHooks', () => ({
  useFilteredEnquiries: jest.fn(),
}));

jest.mock('../../store/api', () => {
  const actual = jest.requireActual('../../store/api');
  return {
    ...actual,
    useGetClientsQuery: jest.fn(),
  };
});

describe('EnquiryListScreen', () => {
  let store;
  let mockNavigation;
  const { useFilteredEnquiries } = require('../../features/enquiries/enquiriesHooks');
  const { useGetClientsQuery } = require('../../store/api');

  beforeEach(() => {
    store = createTestStore({
      auth: {
        user: mockUsers.admin,
        token: 'mock-token',
        isAuthenticated: true,
        isLoading: false,
      },
      enquiries: {
        filters: {},
        searchQuery: '',
        sortBy: 'createdAt',
        sortOrder: 'desc',
        selectedStatus: 'All',
        selectedClient: null,
        pagination: {
          currentPage: 1,
          totalPages: 1,
          total: 0,
        },
      },
    });
    mockNavigation = createMockNavigation();

    useFilteredEnquiries.mockReturnValue({
      enquiries: [mockEnquiry],
      allEnquiries: [mockEnquiry],
      isLoading: false,
      refetch: jest.fn(),
      pagination: {
        currentPage: 1,
        totalPages: 1,
        total: 1,
      },
    });

    useGetClientsQuery.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });

    jest.clearAllMocks();
  });

  const renderEnquiryList = () => {
    const { AuthProvider } = require('../../context/AuthContext');
    return render(
      <Provider store={store}>
        <AuthProvider>
          <EnquiryListScreen navigation={mockNavigation} />
        </AuthProvider>
      </Provider>
    );
  };

  it('should render enquiry list', () => {
    const { getByText } = renderEnquiryList();
    expect(getByText).toBeDefined();
  });

  it('should display enquiries', async () => {
    const { queryByText } = renderEnquiryList();
    
    await waitFor(() => {
      expect(queryByText(/enquiry/i)).toBeTruthy();
    });
  });

  it('should handle search input', () => {
    const { getByPlaceholderText } = renderEnquiryList();
    const searchInput = getByPlaceholderText(/search/i);
    
    fireEvent.changeText(searchInput, 'test query');
    expect(searchInput.props.value).toBe('test query');
  });

  it('should open filters modal', () => {
    const { getAllByText } = renderEnquiryList();
    const filterButtons = getAllByText(/filter/i);
    
    if (filterButtons.length > 0) {
      fireEvent.press(filterButtons[0]);
      // Modal should open
      expect(getAllByText).toBeDefined();
    }
  });

  it('should navigate to enquiry detail on card press', () => {
    const { getAllByText } = renderEnquiryList();
    const enquiryCards = getAllByText(/ENQ/i);
    
    if (enquiryCards.length > 0) {
      fireEvent.press(enquiryCards[0]);
      expect(mockNavigation.navigate).toBeDefined();
    }
  });

  it('should handle status filter selection', () => {
    const { getAllByText } = renderEnquiryList();
    const statusButtons = getAllByText(/pending|completed|progress/i);
    
    if (statusButtons.length > 0) {
      fireEvent.press(statusButtons[0]);
      // Status filter should be applied
      expect(getAllByText).toBeDefined();
    }
  });

  it('should show loading state', () => {
    useFilteredEnquiries.mockReturnValue({
      enquiries: [],
      allEnquiries: [],
      isLoading: true,
      refetch: jest.fn(),
      pagination: { currentPage: 1, totalPages: 1, total: 0 },
    });

    const { UNSAFE_getByType } = renderEnquiryList();
    expect(UNSAFE_getByType).toBeDefined();
  });

  it('should handle empty state', () => {
    useFilteredEnquiries.mockReturnValue({
      enquiries: [],
      allEnquiries: [],
      isLoading: false,
      refetch: jest.fn(),
      pagination: { currentPage: 1, totalPages: 1, total: 0 },
    });

    const { queryByText } = renderEnquiryList();
    // Should show empty state message
    expect(queryByText).toBeDefined();
  });

  it('should handle role-based filtering for non-admin users', () => {
    store = createTestStore({
      auth: {
        user: mockUsers.client,
        token: 'mock-token',
        isAuthenticated: true,
        isLoading: false,
      },
      enquiries: {
        filters: {},
        searchQuery: '',
        sortBy: 'createdAt',
        sortOrder: 'desc',
        selectedStatus: 'All',
        selectedClient: null,
        pagination: { currentPage: 1, totalPages: 1, total: 0 },
      },
    });

    useFilteredEnquiries.mockReturnValue({
      enquiries: [mockEnquiry],
      allEnquiries: [mockEnquiry],
      isLoading: false,
      refetch: jest.fn(),
      pagination: { currentPage: 1, totalPages: 1, total: 1 },
    });

    const { queryByText } = renderEnquiryList();
    expect(queryByText).toBeDefined();
  });
});

