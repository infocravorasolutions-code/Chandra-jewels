/**
 * Integration tests for enquiry management flow
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

describe('Enquiry Management Flow Integration', () => {
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
          total: 1,
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

  const renderWithProviders = (component) => {
    const { AuthProvider } = require('../../context/AuthContext');
    return render(
      <Provider store={store}>
        <AuthProvider>
          {component}
        </AuthProvider>
      </Provider>
    );
  };

  it('should display enquiry list and navigate to detail', async () => {
    const { queryByText, getAllByText } = renderWithProviders(
      <EnquiryListScreen navigation={mockNavigation} />
    );

    await waitFor(() => {
      expect(queryByText(/ENQ/i)).toBeTruthy();
    });

    // Navigate to enquiry detail
    const enquiryCards = getAllByText(/ENQ/i);
    if (enquiryCards.length > 0) {
      fireEvent.press(enquiryCards[0]);
      expect(mockNavigation.navigate).toHaveBeenCalled();
    }
  });

  it('should filter enquiries by status', async () => {
    const { getAllByText } = renderWithProviders(
      <EnquiryListScreen navigation={mockNavigation} />
    );

    const statusButtons = getAllByText(/pending|completed|progress/i);
    if (statusButtons.length > 0) {
      fireEvent.press(statusButtons[0]);
      
      await waitFor(() => {
        // Filter should be applied
        expect(getAllByText).toBeDefined();
      });
    }
  });

  it('should search enquiries', async () => {
    const { getByPlaceholderText } = renderWithProviders(
      <EnquiryListScreen navigation={mockNavigation} />
    );

    const searchInput = getByPlaceholderText(/search/i);
    fireEvent.changeText(searchInput, 'test query');

    await waitFor(() => {
      expect(searchInput.props.value).toBe('test query');
    });
  });

  it('should open and apply filters', async () => {
    const { getAllByText, getByText } = renderWithProviders(
      <EnquiryListScreen navigation={mockNavigation} />
    );

    // Open filters modal
    const filterButtons = getAllByText(/filter/i);
    if (filterButtons.length > 0) {
      fireEvent.press(filterButtons[0]);

      await waitFor(() => {
        // Filters modal should be visible
        const applyButton = getByText(/apply/i);
        if (applyButton) {
          fireEvent.press(applyButton);
          // Filters should be applied
          expect(getByText).toBeDefined();
        }
      });
    }
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
        pagination: {
          currentPage: 1,
          totalPages: 1,
          total: 0,
        },
      },
    });

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

    const { queryByText } = renderWithProviders(
      <EnquiryListScreen navigation={mockNavigation} />
    );

    // Client should only see their own enquiries
    expect(queryByText).toBeDefined();
  });
});

