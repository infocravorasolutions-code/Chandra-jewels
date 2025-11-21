import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Modal,
  Text,
  Dimensions,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute } from '@react-navigation/native';
import { useSelector, useDispatch } from 'react-redux';
import { useAuth } from '../../context/AuthContext';
import { useFilteredEnquiries } from '../../features/enquiries/enquiriesHooks';
import { useClients } from '../../features/clients/clientsHooks';
import { useStatusOptions } from '../../features/statuses/statusesHooks';
import {
  setFilters,
  setSearchQuery,
  setSorting,
  setSelectedStatus,
  setSelectedClient,
  clearFilters,
  setPage,
} from '../../features/enquiries/enquiriesSlice';
import { EnquiryCard, CompactEnquiryCard, CompactEnquiryCardMemo, Card } from '../../components/cards/Cards';
import { Button, SearchInput } from '../../components/common';
import { AnimatedLogoLoader } from '../../components/common';
import TopNavbar from '../../components/common/TopNavbar';
import Icon from '../../components/common/Icon';
import EnquiryFiltersModal from '../../components/filters/EnquiryFiltersModal';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
// Import PDF generator module
import * as pdfGeneratorModule from '../../utils/pdfGenerator';

// Debug: Log module import status
if (__DEV__) {
  console.log('EnquiryListScreen: pdfGeneratorModule imported:', {
    moduleExists: !!pdfGeneratorModule,
    moduleType: typeof pdfGeneratorModule,
    hasDownloadAllEnquiriesPDF: pdfGeneratorModule ? typeof pdfGeneratorModule.downloadAllEnquiriesPDF : 'no module',
    moduleKeys: pdfGeneratorModule ? Object.keys(pdfGeneratorModule) : 'no module',
  });
}

const { width } = Dimensions.get('window');

const EnquiryListScreen = ({ navigation }) => {
  const dispatch = useDispatch();
  const { user } = useAuth();
  const route = useRoute();
  
  // Check if user is a designer (coral or cad)
  const isDesigner = user?.role === 'coral' || user?.role === 'cad';
  
  // Get status options from API (cached) - already includes role-based filtering
  const statusOptions = useStatusOptions();
  
  // Convert status options to status list (array of status names/values)
  const statusList = useMemo(() => {
    return statusOptions.map(opt => opt.value === 'all' ? 'All' : opt.value);
  }, [statusOptions]);
  
  // Redux state
  const filters = useSelector(state => state.enquiries.filters);
  const searchQuery = useSelector(state => state.enquiries.searchQuery);
  const sortBy = useSelector(state => state.enquiries.sortBy);
  const sortOrder = useSelector(state => state.enquiries.sortOrder);
  const selectedStatus = useSelector(state => state.enquiries.selectedStatus);
  const selectedClient = useSelector(state => state.enquiries.selectedClient);
  
  // Get current user ID for filtering assigned enquiries
  // This is used to filter enquiries by assigned user for non-admin roles
  const currentUserId = user?.id || user?._id || user?.userId;
  
  // RTK Query hook - replaces loadEnquiries and all filtering logic
  // Role-based filtering:
  // - Admin users: See ALL enquiries (no assignedTo filter)
  // - Non-admin users (designers, clients, etc.): See ONLY enquiries assigned to them (assignedTo={userId})
  // The hook automatically determines whether to apply assignedTo filter based on role
  const { 
    enquiries: filteredEnquiries, 
    allEnquiries: enquiries, 
    isLoading: loading, 
    isLoadingMore,
    refetch, 
    pagination,
    loadMore,
    hasMore
  } = useFilteredEnquiries(user?.role, currentUserId);
  
  // Get pagination state from Redux
  const currentPage = useSelector(state => state.enquiries.pagination.currentPage);
  const totalPages = useSelector(state => state.enquiries.pagination.totalPages);
  const total = useSelector(state => state.enquiries.pagination.total);
  
  // Fetch clients to enrich client names (using cached hook)
  const { clients: clientsData = [], isLoading: clientsLoading, error: clientsError } = useClients({
    skip: !user,
  });
  
  const clients = Array.isArray(clientsData) ? clientsData : [];
  
  // Debug clients API response (in useEffect to avoid hook order issues)
  useEffect(() => {
    if (__DEV__ && clientsData) {
      console.log('Clients API Response:', {
        dataLength: Array.isArray(clientsData) ? clientsData.length : 'not array',
        firstClient: Array.isArray(clientsData) && clientsData.length > 0 ? clientsData[0] : null,
        error: clientsError
      });
    }
  }, [clientsData, clientsError]);
  
  // Local UI state
  const [showFilters, setShowFilters] = useState(false);
  const [showSortModal, setShowSortModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Create a client ID to name lookup map
  // Handle both string and object ID comparisons
  const clientNameMap = useMemo(() => {
    const map = new Map();
    if (!clients || clients.length === 0) {
      if (__DEV__) {
        console.log('No clients data available yet');
      }
      return map;
    }
    
    clients.forEach(client => {
      if (client && client.id && client.name) {
        // Store both string and normalized versions for lookup
        const idStr = String(client.id).trim();
        map.set(idStr, client.name);
        // Handle MongoDB ObjectId - remove ObjectId wrapper if present
        const cleanId = idStr.replace(/^ObjectId\(/, '').replace(/\)$/, '');
        if (cleanId !== idStr) {
          map.set(cleanId, client.name);
        }
        // Also try without any ObjectId formatting
        map.set(cleanId.trim(), client.name);
      }
    });
    
    if (__DEV__) {
      console.log('Client Name Map created with', map.size, 'entries');
      console.log('Sample client IDs in map:', Array.from(map.keys()).slice(0, 5));
    }
    
    return map;
  }, [clients]);

  // Enrich enquiries with client names from the clients API
  // Use useMemo to prevent unnecessary recomputation
  const enrichedEnquiries = useMemo(() => {
    try {
      if (!enquiries || !Array.isArray(enquiries) || enquiries.length === 0) {
        return [];
      }
      
      return enquiries
        .filter(enquiry => enquiry && typeof enquiry === 'object') // Filter out invalid entries
        .map(enquiry => {
          try {
            // If clientName is 'Unknown Client' or missing, try to fetch from clientNameMap
            let finalClientName = enquiry.clientName || 'Unknown Client';
            if ((!enquiry.clientName || enquiry.clientName === 'Unknown Client') && enquiry.clientId) {
              // Try multiple ID formats for matching
              const clientIdStr = String(enquiry.clientId).trim();
              let clientName = clientNameMap.get(clientIdStr);
              
              // If not found, try without trimming
              if (!clientName) {
                clientName = clientNameMap.get(String(enquiry.clientId));
              }
              
              // Try cleaning MongoDB ObjectId format
              if (!clientName) {
                const cleanId = clientIdStr.replace(/^ObjectId\(/, '').replace(/\)$/, '').trim();
                clientName = clientNameMap.get(cleanId);
              }
              
              if (clientName) {
                finalClientName = clientName;
              }
            }
            return { ...enquiry, clientName: finalClientName };
          } catch (error) {
            if (__DEV__) {
              console.warn('Error enriching enquiry:', error, enquiry);
            }
            // Return enquiry with default client name on error
            return { ...enquiry, clientName: enquiry.clientName || 'Unknown Client' };
          }
        });
    } catch (error) {
      if (__DEV__) {
        console.error('Error in enrichedEnquiries useMemo:', error);
      }
      // Return empty array on critical error to prevent crash
      return [];
    }
  }, [enquiries, clientNameMap]);

  // Re-apply filtering on enriched enquiries
  const enrichedFilteredEnquiries = useMemo(() => {
    try {
      if (!enrichedEnquiries || !Array.isArray(enrichedEnquiries) || enrichedEnquiries.length === 0) {
        // Fallback to original filtered if no enriched data
        return Array.isArray(filteredEnquiries) ? filteredEnquiries : [];
      }

      // Debug: Log first enquiry before filtering
      if (__DEV__ && enrichedEnquiries.length > 0) {
        const firstEnquiry = enrichedEnquiries[0];
        console.log('🔍 ========== BEFORE ENRICHED FILTERING ==========');
        console.log('🔍 First enriched enquiry id:', firstEnquiry?.id);
        console.log('🔍 First enriched enquiry Name:', firstEnquiry?.Name || firstEnquiry?.title);
        console.log('🔍 First enriched enquiry AssignedTo:', firstEnquiry?.AssignedTo);
        console.log('🔍 Total enriched enquiries:', enrichedEnquiries.length);
        console.log('🔍 Active filters:', {
          status: filters.status,
          priority: filters.priority,
          clientId: filters.clientId,
          assignedTo: filters.assignedTo,
        });
        console.log('🔍 ==============================================');
      }

      // Start with a copy and ensure consistent initial order
      let filtered = [...enrichedEnquiries];
      
      // IMPORTANT: Sort FIRST before filtering to ensure consistent order
      // This ensures that even if API returns data in different order, we always start with sorted data
      filtered.sort((a, b) => {
        let aValue, bValue;
        
        switch (sortBy) {
          case 'title':
            aValue = a.title || a.Name || a.name || '';
            bValue = b.title || b.Name || b.name || '';
            break;
          case 'clientName':
            aValue = a.clientName || a.ClientName || a.client || '';
            bValue = b.clientName || b.ClientName || b.client || '';
            break;
          case 'budget':
            aValue = a.budget || a.Budget || a.estimatedPrice || 0;
            bValue = b.budget || b.Budget || b.estimatedPrice || 0;
            break;
          case 'status':
            aValue = a.status || a.Status || a.CurrentStatus || '';
            bValue = b.status || b.Status || b.CurrentStatus || '';
            break;
          case 'createdAt':
            aValue = a.createdAt || a.CreatedDate || a.createdDate || a.CreatedAt || '';
            bValue = b.createdAt || b.CreatedDate || b.createdDate || b.CreatedAt || '';
            break;
          case 'updatedAt':
            aValue = a.updatedAt || a.UpdatedDate || a.updatedDate || a.UpdatedAt || '';
            bValue = b.updatedAt || b.UpdatedDate || b.updatedDate || b.UpdatedAt || '';
            break;
          default:
            aValue = a[sortBy] || '';
            bValue = b[sortBy] || '';
        }
        
        if (aValue == null) aValue = '';
        if (bValue == null) bValue = '';
        
        if (sortBy === 'createdAt' || sortBy === 'updatedAt') {
          aValue = aValue ? new Date(aValue).getTime() : 0;
          bValue = bValue ? new Date(bValue).getTime() : 0;
        } else if (sortBy === 'budget') {
          aValue = parseFloat(aValue) || 0;
          bValue = parseFloat(bValue) || 0;
        } else if (typeof aValue === 'string') {
          aValue = aValue.toLowerCase();
          bValue = bValue.toLowerCase();
        }
        
        // CRITICAL: Use proper comparison based on value type
        let comparison = 0;
        if (sortOrder === 'asc') {
          if (typeof aValue === 'number') {
            comparison = aValue - bValue;
          } else if (typeof aValue === 'string') {
            comparison = aValue.localeCompare(bValue);
          } else {
            if (aValue < bValue) comparison = -1;
            else if (aValue > bValue) comparison = 1;
          }
        } else {
          if (typeof aValue === 'number') {
            comparison = bValue - aValue;
          } else if (typeof aValue === 'string') {
            comparison = bValue.localeCompare(aValue);
          } else {
            if (aValue > bValue) comparison = -1;
            else if (aValue < bValue) comparison = 1;
          }
        }
        
        // CRITICAL: Always apply stable secondary sort by ID to prevent order changes
        if (comparison === 0) {
          const aId = String(a.id || a._id || '');
          const bId = String(b.id || b._id || '');
          return aId.localeCompare(bId);
        }
        
        return comparison;
      });
    
    // Apply status filter
    if (filters.status && filters.status !== 'all') {
      filtered = filtered.filter(e => {
        // Get status from multiple possible sources (prioritize StatusHistory/CurrentStatus)
        let enquiryStatus = '';
        
        // First, try to get from StatusHistory (most accurate)
        if (e.StatusHistory && Array.isArray(e.StatusHistory) && e.StatusHistory.length > 0) {
          const sortedHistory = [...e.StatusHistory].sort((a, b) => {
            const dateA = new Date(a.Timestamp || a.timestamp || 0);
            const dateB = new Date(b.Timestamp || b.timestamp || 0);
            return dateB - dateA;
          });
          enquiryStatus = (sortedHistory[0]?.Status || sortedHistory[0]?.status || '').toString();
        }
        
        // Fallback to other status fields
        if (!enquiryStatus) {
          enquiryStatus = (e.CurrentStatus || e.Status || e.status || '').toString();
        }
        
        const filterStatus = filters.status.toString();
        
        if (__DEV__ && filtered.indexOf(e) === 0) {
          console.log('🔍 ========== STATUS FILTER DEBUG ==========');
          console.log('🔍 Filter Status:', filterStatus);
          console.log('🔍 Enquiry Status:', enquiryStatus);
          console.log('🔍 Enquiry ID:', e.id || e._id);
          console.log('🔍 StatusHistory:', e.StatusHistory ? e.StatusHistory.length : 'none');
          console.log('🔍 CurrentStatus:', e.CurrentStatus);
          console.log('🔍 Status:', e.Status);
          console.log('🔍 status:', e.status);
        }
        
        // Normalize both statuses for comparison (remove spaces, lowercase)
        const normalizedEnquiryStatus = enquiryStatus.toLowerCase().replace(/\s+/g, '');
        const normalizedFilterStatus = filterStatus.toLowerCase().replace(/\s+/g, '');
        
        // Exact match (case insensitive, space insensitive)
        if (normalizedEnquiryStatus === normalizedFilterStatus) {
          if (__DEV__ && filtered.indexOf(e) === 0) {
            console.log('✅ Matched: Exact match');
          }
          return true;
        }
        
        // Handle "Design Approval Pending" variations
        if (normalizedFilterStatus.includes('designapprovalpending') || 
            normalizedFilterStatus.includes('approvalpending')) {
          const matches = normalizedEnquiryStatus.includes('approval') && 
                 !normalizedEnquiryStatus.includes('approved');
          if (__DEV__ && filtered.indexOf(e) === 0) {
            console.log('🔍 Checking Design Approval Pending:', matches);
          }
          return matches;
        }
        
        // Handle "Approved Cad" variations
        if (normalizedFilterStatus.includes('approvedcad') || normalizedFilterStatus === 'approvedcad') {
          const matches = normalizedEnquiryStatus.includes('approvedcad') || 
                 (normalizedEnquiryStatus.includes('approved') && normalizedEnquiryStatus.includes('cad'));
          if (__DEV__ && filtered.indexOf(e) === 0) {
            console.log('🔍 Checking Approved Cad:', matches);
          }
          return matches;
        }
        
        // Handle "Order Placement" variations
        if (normalizedFilterStatus.includes('orderplacement')) {
          const matches = normalizedEnquiryStatus.includes('orderplacement') ||
                 (normalizedEnquiryStatus.includes('order') && normalizedEnquiryStatus.includes('placement'));
          if (__DEV__ && filtered.indexOf(e) === 0) {
            console.log('🔍 Checking Order Placement:', matches);
          }
          return matches;
        }
        
        // Handle "CAM Pending" variations
        if (normalizedFilterStatus.includes('campending')) {
          const matches = normalizedEnquiryStatus.includes('campending') ||
                 (normalizedEnquiryStatus.includes('cam') && normalizedEnquiryStatus.includes('pending'));
          if (__DEV__ && filtered.indexOf(e) === 0) {
            console.log('🔍 Checking CAM Pending:', matches);
          }
          return matches;
        }
        
        // Handle "Production" status
        if (normalizedFilterStatus === 'production') {
          const matches = normalizedEnquiryStatus === 'production' || 
                 normalizedEnquiryStatus.includes('production');
          if (__DEV__ && filtered.indexOf(e) === 0) {
            console.log('🔍 Checking Production:', matches);
          }
          return matches;
        }
        
        // Handle "Coral" status
        if (normalizedFilterStatus === 'coral') {
          const matches = normalizedEnquiryStatus.includes('coral');
          if (__DEV__ && filtered.indexOf(e) === 0) {
            console.log('🔍 Checking Coral:', matches);
          }
          return matches;
        }
        
        // Handle "CAD" status (must be exact, not part of "Approved Cad")
        if (normalizedFilterStatus === 'cad' && normalizedEnquiryStatus === 'cad') {
          if (__DEV__ && filtered.indexOf(e) === 0) {
            console.log('✅ Matched: CAD exact');
          }
          return true;
        }
        
        // Handle "Completed" status
        if (normalizedFilterStatus === 'completed') {
          const matches = normalizedEnquiryStatus.includes('completed') || 
                 normalizedEnquiryStatus.includes('approved');
          if (__DEV__ && filtered.indexOf(e) === 0) {
            console.log('🔍 Checking Completed:', matches);
          }
          return matches;
        }
        
        // Handle "Rejected" status
        if (normalizedFilterStatus === 'rejected') {
          const matches = normalizedEnquiryStatus.includes('rejected');
          if (__DEV__ && filtered.indexOf(e) === 0) {
            console.log('🔍 Checking Rejected:', matches);
          }
          return matches;
        }
        
        // Handle "Enquiry Created" status
        if (normalizedFilterStatus.includes('enquirycreated') || normalizedFilterStatus === 'enquirycreated') {
          const matches = normalizedEnquiryStatus.includes('enquirycreated') ||
                 normalizedEnquiryStatus.includes('pending') ||
                 normalizedEnquiryStatus === 'pending';
          if (__DEV__ && filtered.indexOf(e) === 0) {
            console.log('🔍 Checking Enquiry Created:', matches);
          }
          return matches;
        }
        
        // Fallback: partial match for other statuses
        if (normalizedEnquiryStatus.includes(normalizedFilterStatus) || 
            normalizedFilterStatus.includes(normalizedEnquiryStatus)) {
          if (__DEV__ && filtered.indexOf(e) === 0) {
            console.log('✅ Matched: Partial match');
          }
          return true;
        }
        
        if (__DEV__ && filtered.indexOf(e) === 0) {
          console.log('❌ No match found');
          console.log('🔍 =========================================');
        }
        return false;
      });
    }
    
    // Apply priority filter
    if (filters.priority && filters.priority !== 'all') {
      filtered = filtered.filter(e => {
        const enquiryPriority = e.priority || e.Priority || '';
        return enquiryPriority === filters.priority || 
               enquiryPriority.toLowerCase() === filters.priority.toLowerCase();
      });
    }
    
    // Apply client filter
    if (filters.clientId && filters.clientId !== 'all') {
      filtered = filtered.filter(e => {
        const enquiryClientId = e.clientId || e.ClientId || '';
        return String(enquiryClientId).trim() === String(filters.clientId).trim();
      });
    }
    
    // Apply category filter
    if (filters.category && filters.category !== 'all') {
      filtered = filtered.filter(e => {
        const enquiryCategory = e.category || e.Category || '';
        return String(enquiryCategory).trim() === String(filters.category).trim();
      });
    }
    
    // Apply assignedTo filter
    if (filters.assignedTo && filters.assignedTo !== 'all') {
      filtered = filtered.filter(e => {
        const enquiryAssignedTo = e.assignedTo || e.AssignedTo || '';
        return String(enquiryAssignedTo).trim() === String(filters.assignedTo).trim();
      });
    }
    
    // Apply stoneType filter
    if (filters.stoneType && filters.stoneType !== 'all') {
      filtered = filtered.filter(e => {
        const enquiryStoneType = e.stoneType || e.StoneType || '';
        return String(enquiryStoneType).trim() === String(filters.stoneType).trim();
      });
    }
    
    // Apply metalColor filter
    if (filters.metalColor && filters.metalColor !== 'all') {
      filtered = filtered.filter(e => {
        const metalColor = e.Metal?.Color || e.metal?.color || '';
        return String(metalColor).trim() === String(filters.metalColor).trim();
      });
    }
    
    // Apply metalQuality filter
    if (filters.metalQuality && filters.metalQuality !== 'all') {
      filtered = filtered.filter(e => {
        const metalQuality = e.Metal?.Quality || e.metal?.quality || '';
        return String(metalQuality).trim() === String(filters.metalQuality).trim();
      });
    }
    
    // Apply date range filters
    if (filters.shippingDateFrom || filters.shippingDateTo) {
      filtered = filtered.filter(e => {
        const shippingDate = e.ShippingDate || e.shippingDate || e.deadline || '';
        if (!shippingDate) return false;
        const date = new Date(shippingDate);
        if (isNaN(date.getTime())) return false;
        
        if (filters.shippingDateFrom) {
          const fromDate = new Date(filters.shippingDateFrom);
          if (date < fromDate) return false;
        }
        if (filters.shippingDateTo) {
          const toDate = new Date(filters.shippingDateTo);
          toDate.setHours(23, 59, 59, 999); // Include entire end date
          if (date > toDate) return false;
        }
        return true;
      });
    }
    
    if (filters.assignedDateFrom || filters.assignedDateTo) {
      filtered = filtered.filter(e => {
        const assignedDate = e.AssignedDate || e.assignedDate || '';
        if (!assignedDate) return false;
        const date = new Date(assignedDate);
        if (isNaN(date.getTime())) return false;
        
        if (filters.assignedDateFrom) {
          const fromDate = new Date(filters.assignedDateFrom);
          if (date < fromDate) return false;
        }
        if (filters.assignedDateTo) {
          const toDate = new Date(filters.assignedDateTo);
          toDate.setHours(23, 59, 59, 999);
          if (date > toDate) return false;
        }
        return true;
      });
    }
    
    if (filters.createdDateFrom || filters.createdDateTo) {
      filtered = filtered.filter(e => {
        const createdDate = e.createdAt || e.CreatedDate || e.CreatedAt || '';
        if (!createdDate) return false;
        const date = new Date(createdDate);
        if (isNaN(date.getTime())) return false;
        
        if (filters.createdDateFrom) {
          const fromDate = new Date(filters.createdDateFrom);
          if (date < fromDate) return false;
        }
        if (filters.createdDateTo) {
          const toDate = new Date(filters.createdDateTo);
          toDate.setHours(23, 59, 59, 999);
          if (date > toDate) return false;
        }
        return true;
      });
    }
    
    // Apply search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(e => 
        e.title?.toLowerCase().includes(query) ||
        e.clientName?.toLowerCase().includes(query) ||
        e.description?.toLowerCase().includes(query)
      );
    }
    
    // No need to sort again - we already sorted before filtering
    // Filtering preserves order, so the sorted order is maintained
      
      // Debug: Log first enquiry after filtering
      if (__DEV__ && filtered.length > 0) {
        const firstFiltered = filtered[0];
        console.log('🔍 ========== AFTER ENRICHED FILTERING ==========');
        console.log('🔍 First filtered enquiry id:', firstFiltered?.id);
        console.log('🔍 First filtered enquiry Name:', firstFiltered?.Name || firstFiltered?.title);
        console.log('🔍 Total filtered enquiries:', filtered.length);
        console.log('🔍 ==============================================');
      } else if (__DEV__ && enrichedEnquiries.length > 0 && filtered.length === 0) {
        console.warn('⚠️ ========== ALL ENQUIRIES FILTERED OUT ==========');
        console.warn('⚠️ Had', enrichedEnquiries.length, 'enquiries before filtering');
        console.warn('⚠️ Have', filtered.length, 'enquiries after filtering');
        console.warn('⚠️ First enquiry before filtering:', {
          id: enrichedEnquiries[0]?.id,
          Name: enrichedEnquiries[0]?.Name,
          AssignedTo: enrichedEnquiries[0]?.AssignedTo,
          CurrentStatus: enrichedEnquiries[0]?.CurrentStatus,
        });
        console.warn('⚠️ ===============================================');
      }
      
      return filtered;
    } catch (error) {
      if (__DEV__) {
        console.error('Error in enrichedFilteredEnquiries useMemo:', error);
      }
      // Return empty array on error to prevent crash
      return [];
    }
  }, [
    enrichedEnquiries, 
    filters.status, 
    filters.priority, 
    filters.clientId,
    filters.category,
    filters.assignedTo,
    filters.stoneType,
    filters.metalColor,
    filters.metalQuality,
    filters.shippingDateFrom,
    filters.shippingDateTo,
    filters.assignedDateFrom,
    filters.assignedDateTo,
    filters.createdDateFrom,
    filters.createdDateTo,
    searchQuery, 
    sortBy, 
    sortOrder, 
    filteredEnquiries
  ]);

  // Get all clients from API (not just from current enquiries)
  // Store both name and ID to prevent duplicates and enable proper key generation
  const clientList = useMemo(() => {
    // Use clients from API instead of deriving from enquiries
    // This ensures all clients are shown, not just those with enquiries in current list
    if (!clients || clients.length === 0) {
      return [];
    }
    
    // Create a map to deduplicate by ID (in case of duplicate names)
    const clientMap = new Map();
    clients.forEach(client => {
      const clientId = client.id || client._id;
      const clientName = client.name || client.Name;
      
      if (clientId && clientName && clientName.trim() !== '' && clientName !== 'Unknown Client') {
        // Use ID as key to prevent duplicates
        if (!clientMap.has(clientId)) {
          clientMap.set(clientId, { id: clientId, name: clientName });
        }
      }
    });
    
    // Convert to array and sort by name
    const clientList = Array.from(clientMap.values())
      .sort((a, b) => a.name.localeCompare(b.name));
    
    return clientList;
  }, [clients]);

  // Update filter when route params change
  useEffect(() => {
    if (route.params?.filter && !route.params?.filterType) {
      // Map status filter values from Dashboard to filter format
      // Handle various status name formats from aggregate API
      const statusFilter = route.params.filter.toLowerCase();
      const isDesigner = user?.role === 'coral' || user?.role === 'cad';
      let mappedStatus = 'all';
      
      if (__DEV__) {
        console.log('🔍 ========== ROUTE PARAMS FILTER ==========');
        console.log('🔍 Route params filter:', route.params.filter);
        console.log('🔍 Status filter (lowercase):', statusFilter);
        console.log('🔍 Is Designer:', isDesigner);
      }
      
      // Map common status filter values
      // For designers, 'pending' should map to 'Design Approval Pending'
      if (statusFilter === 'pending') {
        mappedStatus = isDesigner ? 'Design Approval Pending' : 'Enquiry Created';
      } else if (statusFilter === 'enquiry created' || 
          (statusFilter.includes('pending') && !statusFilter.includes('approval') && !statusFilter.includes('cam'))) {
        mappedStatus = 'Enquiry Created';
      } else if (statusFilter === 'approval_pending' || statusFilter === 'design approval pending' || 
                 (statusFilter.includes('approval') && statusFilter.includes('pending'))) {
        mappedStatus = 'Design Approval Pending';
      } else if (statusFilter === 'approved cad' || statusFilter === 'approvedcad') {
        mappedStatus = 'Approved Cad';
      } else if (statusFilter === 'order placement' || statusFilter === 'orderplacement') {
        mappedStatus = 'Order Placement';
      } else if (statusFilter === 'cam pending' || statusFilter === 'campending') {
        mappedStatus = 'CAM Pending';
      } else if (statusFilter === 'production') {
        mappedStatus = 'Production';
      } else if (statusFilter === 'completed' || statusFilter.includes('approved') || statusFilter.includes('completed')) {
        mappedStatus = 'Completed';
      } else if (statusFilter === 'rejected') {
        mappedStatus = 'Rejected';
      } else if (statusFilter === 'coral') {
        mappedStatus = 'Coral';
      } else if (statusFilter === 'cad') {
        mappedStatus = 'CAD';
      } else if (statusFilter === 'all') {
        mappedStatus = 'all';
      } else {
        // For other statuses, try to match exactly or use title case
        // Try to match against status options from API
        const knownStatuses = statusOptions
          .filter(opt => opt.value !== 'all')
          .map(opt => opt.value);
        const matchedStatus = knownStatuses.find(s => 
          s.toLowerCase() === statusFilter || 
          s.toLowerCase().replace(/\s+/g, '') === statusFilter.replace(/\s+/g, '')
        );
        mappedStatus = matchedStatus || (route.params.filter.charAt(0).toUpperCase() + route.params.filter.slice(1).toLowerCase());
      }
      
      if (__DEV__) {
        console.log('🔍 Mapped status:', mappedStatus);
        console.log('🔍 Current filters.status:', filters.status);
        console.log('🔍 =========================================');
      }
      
      if (mappedStatus !== filters.status) {
        if (__DEV__) {
          console.log('✅ Setting filter status to:', mappedStatus);
        }
        dispatch(setFilters({ 
          status: mappedStatus === 'all' ? 'all' : mappedStatus,
        }));
        dispatch(setSelectedStatus(mappedStatus === 'all' ? 'All' : mappedStatus));
        dispatch(setPage(1)); // Reset to first page when filter changes
      }
    }
    
    // Handle client filter from route params
    if (route.params?.filterType === 'client' && route.params?.filter) {
      const clientName = route.params.filter;
      const clientId = route.params?.clientId;
      
      // Clear status filter when applying client filter
      // Set both client filter and clientId
      if (clientId) {
        dispatch(setFilters({ 
          client: clientName,
          clientId: clientId,
          status: 'all' // Clear status filter
        }));
      } else {
        // Try to find client by name if clientId not provided
        const client = clients.find(c => c.name === clientName);
        if (client) {
          dispatch(setFilters({ 
            client: clientName,
            clientId: client.id || client._id,
            status: 'all' // Clear status filter
          }));
        } else {
          dispatch(setFilters({ 
            client: clientName,
            status: 'all' // Clear status filter
          }));
        }
      }
      dispatch(setSelectedClient(clientName));
      dispatch(setSelectedStatus('All'));
      dispatch(setPage(1)); // Reset to first page when filter changes
    }
  }, [route.params?.filterType, route.params?.filter, clients]);
  
  // Reset to page 1 when filters or search change
  // Use a ref to track previous filter values to prevent unnecessary resets
  const prevFiltersRef = React.useRef({ category: '', priority: '', clientId: '', stoneType: '', searchQuery: '' });
  useEffect(() => {
    const currentFilters = {
      category: filters.category || '',
      priority: filters.priority || '',
      clientId: filters.clientId || '',
      stoneType: filters.stoneType || '',
      searchQuery: searchQuery || '',
    };
    
    // Check if any filter actually changed
    const hasChanged = 
      prevFiltersRef.current.category !== currentFilters.category ||
      prevFiltersRef.current.priority !== currentFilters.priority ||
      prevFiltersRef.current.clientId !== currentFilters.clientId ||
      prevFiltersRef.current.stoneType !== currentFilters.stoneType ||
      prevFiltersRef.current.searchQuery !== currentFilters.searchQuery;
    
    // Only reset page if filters changed and we're not already on page 1
    if (hasChanged && currentPage !== 1) {
      dispatch(setPage(1));
    }
    
    // Update ref with current values (only if filters changed)
    if (hasChanged) {
      prevFiltersRef.current = currentFilters;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.category, filters.priority, filters.clientId, filters.stoneType, searchQuery]);
  
  // State to track loading more
  const [isLoadingMoreLocal, setIsLoadingMoreLocal] = useState(false);
  
  // Auto-load all pages for admins to ensure complete enquiry list display
  useEffect(() => {
    if (user?.role === 'admin' && hasMore && !loading && !isLoadingMore && !isLoadingMoreLocal && totalPages > currentPage) {
      // Automatically load next page if we're an admin and have more pages
      const timer = setTimeout(() => {
        if (currentPage < totalPages) {
          dispatch(setPage(currentPage + 1));
          loadMore();
        }
      }, 1000); // Small delay to avoid overwhelming the API
      
      return () => clearTimeout(timer);
    }
  }, [user?.role, hasMore, loading, isLoadingMore, isLoadingMoreLocal, currentPage, totalPages, dispatch, loadMore]);
  
  // Handle loading more data for infinite scroll
  // Automatically load more pages to ensure all enquiries are displayed
  const handleLoadMore = () => {
    try {
      if (!hasMore || isLoadingMore || isLoadingMoreLocal || loading) return;
      
      const nextPage = currentPage + 1;
      if (nextPage <= totalPages) {
        setIsLoadingMoreLocal(true);
        dispatch(setPage(nextPage));
        loadMore();
      }
    } catch (error) {
      if (__DEV__) {
        console.error('Error loading more enquiries:', error);
      }
      setIsLoadingMoreLocal(false);
      // Don't show alert for load more errors - just silently fail
      // User can try again by scrolling
    }
  };
  
  // Reset local loading state when data finishes loading
  useEffect(() => {
    if (!loading && isLoadingMoreLocal) {
      // Small delay to ensure smooth transition
      const timer = setTimeout(() => {
        setIsLoadingMoreLocal(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [loading, isLoadingMoreLocal]);
  
  // Debug: Log loading states (only on significant changes, not every render)
  useEffect(() => {
    if (__DEV__ && (loading || isLoadingMore)) {
      console.log('📊 Loading States:', {
        isLoadingMore,
        isLoadingMoreLocal,
        loading,
        hasMore,
        currentPage,
        totalPages,
        enrichedCount: enrichedFilteredEnquiries.length,
      });
    }
  }, [isLoadingMore, isLoadingMoreLocal, loading, hasMore, currentPage, totalPages]);
  
  // Render enquiry card item for FlatList
  const renderEnquiryItem = ({ item: enquiry }) => {
    if (!enquiry || !enquiry.id) {
      if (__DEV__) {
        console.warn('Skipping invalid enquiry item:', enquiry);
      }
      return null;
    }
    
    try {
      return (
        <CompactEnquiryCardMemo
          key={enquiry.id}
          enquiry={enquiry}
          onPress={() => {
            if (__DEV__) {
              console.log('Navigating to SingleEnquiry with enquiry ID:', enquiry?.id);
            }
            try {
              if (!enquiry?.id) {
                if (__DEV__) {
                  console.warn('Cannot navigate: enquiry missing ID');
                }
                Alert.alert('Error', 'Invalid enquiry data. Please refresh the list.');
                return;
              }
              
              if (!navigation || typeof navigation.navigate !== 'function') {
                if (__DEV__) {
                  console.error('Navigation not available');
                }
                Alert.alert('Error', 'Navigation is not available. Please try again.');
                return;
              }
              
              navigation.navigate('SingleEnquiry', { 
                enquiryId: enquiry.id, 
                enquiry,
                shouldRefresh: false,
              });
            } catch (error) {
              if (__DEV__) {
                console.error('Navigation error:', error);
              }
              Alert.alert('Error', 'Failed to open enquiry. Please try again.');
            }
          }}
          getStatusColor={getStatusColor}
          getStatusIcon={getStatusIcon}
          getPriorityColor={getPriorityColor}
          getPriorityIcon={getPriorityIcon}
          formatCurrency={formatCurrency}
          formatDate={formatDate}
          userRole={user?.role}
        />
      );
    } catch (error) {
      if (__DEV__) {
        console.error('Error rendering enquiry item:', error, enquiry);
      }
      return null; // Return null on error to prevent crash
    }
  };
  
  // Render list header - no longer needed as chips are moved outside FlatList
  const renderListHeader = () => {
    return null;
  };
  
  // Render loading footer for infinite scroll
  const renderListFooter = () => {
    // Check if we have more data available
    const hasMoreData = hasMore && totalPages > currentPage && totalPages > 1;
    
    // Check if currently loading more data
    const isCurrentlyLoading = isLoadingMore || isLoadingMoreLocal || (loading && enrichedFilteredEnquiries.length > 0 && currentPage > 1);
    
    // Don't show anything if no data at all
    if (enrichedFilteredEnquiries.length === 0) {
      return null;
    }
    
    // Show "No more data" message if we've loaded all pages
    if (!hasMoreData && !isCurrentlyLoading) {
      return (
        <View style={styles.endOfListContainer}>
          <View style={styles.endOfListDivider} />
          <Text style={styles.endOfListText}>You've reached the end</Text>
        </View>
      );
    }
    
    // Always show loader if we have more data OR if currently loading
    if (hasMoreData || isCurrentlyLoading) {
      return (
        <View style={styles.loadingMoreContainer}>
          <View style={styles.loadingMoreContent}>
            <ActivityIndicator 
              size="small" 
              color={colors.primary} 
              style={styles.loadingSpinner}
            />
            {isCurrentlyLoading && (
              <Text style={styles.loadingMoreText}>Loading more...</Text>
            )}
          </View>
        </View>
      );
    }
    
    return null;
  };
  
  // Render empty state
  const renderEmpty = () => {
    const hasActiveFilters = (filters.status && filters.status !== 'all') || 
                            (filters.priority && filters.priority !== 'all') ||
                            (filters.clientId && filters.clientId !== 'all') ||
                            searchQuery;
    
    return (
      <Card style={styles.emptyCard}>
        <Icon name="description" size={40} color={colors.textLight} />
        <Text style={[styles.emptyText, { color: colors.textSecondary, fontSize: 13 }]}>
          {hasActiveFilters ? 'No enquiries match your filters' : 'No enquiries found'}
        </Text>
        <Text style={{ color: colors.textLight, fontSize: fonts.sm }}>
          {hasActiveFilters 
            ? 'Try adjusting your filters or search query' 
            : 'Try adjusting your search or filters'}
        </Text>
        {hasActiveFilters && (
          <TouchableOpacity
            style={styles.clearFiltersButton}
            onPress={() => {
              dispatch(clearFilters());
              dispatch(setSearchQuery(''));
              dispatch(setSelectedStatus('All'));
              dispatch(setSelectedClient('All'));
            }}
          >
            <Text style={styles.clearFiltersButtonText}>Clear All Filters</Text>
          </TouchableOpacity>
        )}
      </Card>
    );
  };



  // Handler for downloading all enquiries as PDF
  const handleDownloadAllPDF = async () => {
    try {
      // Get the function from the module
      const downloadFn = pdfGeneratorModule?.downloadAllEnquiriesPDF;
      
      if (!downloadFn || typeof downloadFn !== 'function') {
        if (__DEV__) {
          console.error('downloadAllEnquiriesPDF not available:', {
            module: pdfGeneratorModule,
            moduleType: typeof pdfGeneratorModule,
            moduleKeys: pdfGeneratorModule ? Object.keys(pdfGeneratorModule) : 'no module',
            functionType: typeof downloadFn,
          });
        }
        Alert.alert(
          'Error', 
          'PDF export function is not available. Please contact support if this issue persists.'
        );
        return;
      }

      // Use enrichedEnquiries (all enquiries with client names) for the PDF
      const enquiriesToExport = enrichedEnquiries && enrichedEnquiries.length > 0 
        ? enrichedEnquiries 
        : enquiries;
      
      if (!enquiriesToExport || enquiriesToExport.length === 0) {
        Alert.alert('No Data', 'No enquiries available to export.');
        return;
      }

      // Debug: Log what we're exporting
      if (__DEV__) {
        console.log('========== EXPORTING ENQUIRIES TO PDF ==========');
        console.log('Total enquiries to export:', enquiriesToExport.length);
        console.log('Is array:', Array.isArray(enquiriesToExport));
        console.log('First enquiry keys:', enquiriesToExport[0] ? Object.keys(enquiriesToExport[0]) : 'no data');
        console.log('Sample enquiry:', enquiriesToExport[0] ? JSON.stringify(enquiriesToExport[0]).substring(0, 300) : 'no data');
        console.log('================================================');
      }

      Alert.alert(
        'Generating PDF',
        `Generating PDF for ${enquiriesToExport.length} enquiries...`,
        [],
        { cancelable: false }
      );

      await downloadFn(enquiriesToExport);
      
      Alert.alert(
        'Success',
        `PDF generated successfully for ${enquiriesToExport.length} enquiries! Check your share/download options.`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      if (__DEV__) {
        console.error('Error generating PDF:', error);
      }
      const errorMessage = error?.message || 'Unknown error occurred';
      Alert.alert(
        'Error',
        `Failed to generate PDF: ${errorMessage}. Please try again.`,
        [{ text: 'OK' }]
      );
    }
  };

  // Safety check - don't render if user is not loaded
  if (!user) {
    return <AnimatedLogoLoader size={60} />;
  }
  
  const onRefresh = async () => {
    try {
      setRefreshing(true);
      await refetch(); // RTK Query refetch
    } catch (error) {
      if (__DEV__) {
        console.error('Error refreshing enquiries:', error);
      }
      Alert.alert('Error', 'Failed to refresh enquiries. Please try again.');
    } finally {
      setRefreshing(false);
    }
  };

  // No need for applyFilters - handled by useFilteredEnquiries hook

  const handleFilterChange = (filterType, value) => {
    dispatch(setFilters({ [filterType]: value }));
  };

  const handleClearFilters = () => {
    dispatch(clearFilters());
  };

  const handleApplyFilters = (newFilters) => {
    dispatch(setFilters(newFilters));
    dispatch(setPage(1)); // Reset to first page when filters are applied
  };

  const getStatusOptions = () => {
    const baseOptions = [
      { label: 'All Status', value: 'all' },
      { label: 'Pending', value: 'pending' },
      { label: 'Completed', value: 'completed' },
    ];

    if (user?.role === 'admin') {
      baseOptions.push({ label: 'Rejected', value: 'rejected' });
    }

    return baseOptions;
  };

  const getPriorityOptions = () => [
    { label: 'All Priority', value: 'all' },
    { label: 'High', value: 'high' },
    { label: 'Medium', value: 'medium' },
    { label: 'Low', value: 'low' },
  ];

  const getClientOptions = () => {
    // Use the same clientList logic to ensure consistency
    // clientList now contains objects with {id, name}
    return [
      { label: 'All Clients', value: 'all' },
      ...clientList.map(client => ({ label: client.name, value: client.id })),
    ];
  };

  // Helper functions for status and priority styling
  const getStatusColor = (status) => {
    if (!status) return colors.textSecondary;
    
    const statusLower = String(status).toLowerCase();
    
    // Handle actual status values from the system
    if (statusLower.includes('enquiry created') || statusLower === 'enquiry created') {
      return colors.info || '#2196F3';
    }
    if (statusLower.includes('design approval pending') || statusLower.includes('approval pending')) {
      return colors.warning || '#FF9800';
    }
    if (statusLower.includes('coral')) {
      return colors.primary || '#1976D2';
    }
    if (statusLower.includes('cad') && !statusLower.includes('approved')) {
      return colors.info || '#2196F3';
    }
    if (statusLower.includes('approved cad')) {
      return colors.success || '#4CAF50';
    }
    if (statusLower.includes('order placement')) {
      return colors.accent || '#9C27B0';
    }
    if (statusLower.includes('cam pending')) {
      return colors.secondary || '#7B1FA2';
    }
    if (statusLower.includes('production')) {
      return colors.error || '#F44336';
    }
    if (statusLower.includes('completed')) {
      return colors.success || '#4CAF50';
    }
    if (statusLower.includes('rejected')) {
      return colors.error || '#F44336';
    }
    
    // Legacy support
    if (statusLower === 'pending') return colors.warning || '#FF9800';
    if (statusLower === 'completed') return colors.success || '#4CAF50';
    if (statusLower === 'rejected') return colors.error || '#F44336';
    
    return colors.textSecondary;
  };

  const getStatusIcon = (status) => {
    if (!status) return 'help';
    
    const statusLower = String(status).toLowerCase();
    
    if (statusLower.includes('enquiry created')) return 'add-circle';
    if (statusLower.includes('approval pending')) return 'pending-actions';
    if (statusLower.includes('coral')) return 'palette';
    if (statusLower.includes('cad')) return 'design-services';
    if (statusLower.includes('approved')) return 'check-circle';
    if (statusLower.includes('order')) return 'shopping-cart';
    if (statusLower.includes('production')) return 'build';
    if (statusLower.includes('completed')) return 'check-circle';
    if (statusLower.includes('rejected')) return 'cancel';
    
    return 'help';
  };

  const getPriorityColor = (priority) => {
    if (!priority) return colors.textSecondary;
    
    const priorityLower = String(priority).toLowerCase();
    
    const priorityColors = {
      'normal': colors.success || '#4CAF50',
      'high': colors.warning || '#FF9800',
      'super high': colors.error || '#F44336',
      // Legacy support
      'low': colors.success || '#4CAF50',
      'medium': colors.success || '#4CAF50',
      'urgent': colors.warning || '#FF9800',
      'super urgent': colors.error || '#F44336',
    };
    
    return priorityColors[priorityLower] || colors.textSecondary;
  };

  const getPriorityIcon = (priority) => {
    if (!priority) return 'help';
    
    const priorityLower = String(priority).toLowerCase();
    
    if (priorityLower.includes('super') || priorityLower === 'high') {
      return 'priority-high';
    }
    if (priorityLower === 'normal' || priorityLower === 'medium' || priorityLower === 'low') {
      return 'low-priority';
    }
    
    return 'help';
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  // Sort options
  const sortOptions = [
    { key: 'createdAt', label: 'Date Created', icon: 'schedule' },
    { key: 'title', label: 'Title', icon: 'title' },
    { key: 'clientName', label: 'Client', icon: 'person' },
    { key: 'budget', label: 'Budget', icon: 'attach-money' },
    { key: 'status', label: 'Status', icon: 'flag' },
  ];

  const getSortLabel = () => {
    const option = sortOptions.find(opt => opt.key === sortBy);
    return option ? option.label : 'Sort by';
  };

  const handleSortChange = (newSortBy) => {
    if (newSortBy === sortBy) {
      // Toggle order if same field
      const newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
      dispatch(setSorting({ sortBy, sortOrder: newOrder }));
      if (__DEV__) {
        console.log('Sort order toggled:', newOrder);
      }
    } else {
      dispatch(setSorting({ sortBy: newSortBy, sortOrder: 'asc' })); // Default to desc for new field
      if (__DEV__) {
        console.log('Sort changed to:', newSortBy, 'desc');
      }
    }
    setShowSortModal(false);
  };

  const renderStatusChips = () => {
    if (statusList.length <= 1) return null;
    
    // Filter out the selected status from available options
    const availableStatuses = statusList.filter(status => status !== selectedStatus);
    
    // For designers, if selectedStatus is 'All' (not in their list), treat it as no selection
    const hasSelectedStatus = selectedStatus && selectedStatus !== 'All' && statusList.includes(selectedStatus);
    
    return (
      <View style={styles.compactFilterRow}>
        <Text style={styles.compactFilterLabel}>Status:</Text>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          style={styles.compactChipsScroll}
          contentContainerStyle={styles.compactChipsContent}
        >
          {/* Show selected status first with X button */}
          {hasSelectedStatus && (
            <View style={styles.compactSelectedChip}>
              <Text style={styles.compactSelectedChipText}>{selectedStatus}</Text>
              <TouchableOpacity
                style={styles.compactChipClose}
                onPress={() => {
                  // For designers, clear to 'All' (which won't be in their list, effectively showing all)
                  // For others, set to 'All' explicitly
                  dispatch(setSelectedStatus('All'));
                  dispatch(setFilters({ status: 'all' }));
                }}
              >
                <Icon name="close" size={12} color={colors.textWhite} />
              </TouchableOpacity>
            </View>
          )}
          
          {/* Show available status options (excluding selected) */}
          {availableStatuses.map(status => (
            <TouchableOpacity
              key={status}
              style={styles.compactChip}
              onPress={() => {
                const filterStatus = status === 'All' ? 'all' : status;
                if (__DEV__) {
                  console.log('🔍 Status chip clicked:', status);
                  console.log('🔍 Setting filter to:', filterStatus);
                }
                dispatch(setSelectedStatus(status));
                dispatch(setFilters({ status: filterStatus }));
                dispatch(setPage(1)); // Reset to first page when filter changes
              }}
            >
              <Text style={styles.compactChipText}>{status}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderClientChips = () => {
    // Show client chips even if no enquiries (clients might not have enquiries yet)
    if (!clientList || clientList.length === 0) {
      return null;
    }
    
    // Always include "All" in the list, and filter out only non-"All" selected clients
    const allClients = [{ id: 'all', name: 'All' }, ...clientList];
    const availableClients = allClients.filter(client => {
      // Always show "All" option
      if (client.id === 'all') return true;
      // Filter out the selected client only if it's not "All"
      return client.name !== selectedClient;
    });
    
    return (
      <View style={styles.compactFilterRow}>
        <Text style={styles.compactFilterLabel}>Client:</Text>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          style={styles.compactChipsScroll}
          contentContainerStyle={styles.compactChipsContent}
        >
          {/* Show selected client first with X button (only if not "All") */}
          {selectedClient && selectedClient !== 'All' && (
            <View style={styles.compactSelectedChip}>
              <Text style={styles.compactSelectedChipText}>{selectedClient}</Text>
              <TouchableOpacity
                style={styles.compactChipClose}
                onPress={() => {
                  dispatch(setSelectedClient('All'));
                  dispatch(setFilters({ clientId: 'all', client: 'all' }));
                  dispatch(setPage(1)); // Reset to first page when filter changes
                }}
              >
                <Icon name="close" size={12} color={colors.textWhite} />
              </TouchableOpacity>
            </View>
          )}
          
          {/* Show available client options (including "All" always) */}
          {availableClients.map((client, index) => {
            // Use client ID + index for guaranteed unique key
            const uniqueKey = `client-${client.id}-${index}`;
            const clientName = client.name;
            
            return (
              <TouchableOpacity
                key={uniqueKey}
                style={[
                  styles.compactChip,
                  selectedClient === clientName && styles.compactSelectedChip
                ]}
                onPress={() => {
                  dispatch(setSelectedClient(clientName));
                  
                  if (client.id === 'all') {
                    dispatch(setFilters({ clientId: 'all', client: 'all' }));
                  } else {
                    dispatch(setFilters({ 
                      clientId: String(client.id).trim(),
                      client: clientName 
                    }));
                  }
                  dispatch(setPage(1)); // Reset to first page when filter changes
                }}
              >
                <Text style={[
                  styles.compactChipText,
                  selectedClient === clientName && styles.compactSelectedChipText
                ]}>
                  {clientName}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  const renderFilterModal = () => (
    <EnquiryFiltersModal
      visible={showFilters}
      onClose={() => setShowFilters(false)}
      filters={filters}
      onApplyFilters={handleApplyFilters}
      onClearFilters={handleClearFilters}
      user={user}
    />
  );

  const renderSortModal = () => (
    <Modal
      visible={showSortModal}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowSortModal(false)}>
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => setShowSortModal(false)}>
        <TouchableOpacity
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
          style={styles.sortModalContent}>
          <View style={styles.sortModalHeader}>
            <Text style={styles.sortModalTitle}>Sort by</Text>
            <TouchableOpacity
              style={styles.sortModalClose}
              onPress={() => setShowSortModal(false)}>
              <Icon name="close" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.sortOptionsList}>
            {sortOptions.map((option) => (
              <TouchableOpacity
                key={option.key}
                style={[
                  styles.sortOption,
                  sortBy === option.key && styles.sortOptionActive
                ]}
                onPress={() => handleSortChange(option.key)}>
                <View style={styles.sortOptionContent}>
                  <Icon 
                    name={option.icon} 
                    size={20} 
                    color={sortBy === option.key ? colors.primary : colors.textSecondary} 
                  />
                  <Text style={[
                    styles.sortOptionText,
                    sortBy === option.key && styles.sortOptionTextActive
                  ]}>
                    {option.label}
                  </Text>
                </View>
                {sortBy === option.key && (
                  <View style={styles.sortOrderIndicator}>
                    <Icon 
                      name={sortOrder === 'asc' ? 'keyboard-arrow-up' : 'keyboard-arrow-down'} 
                      size={20} 
                      color={colors.primary} 
                    />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );

  // Show full screen loader only on initial load (when no data yet)
  if (loading && enrichedFilteredEnquiries.length === 0) {
    return <AnimatedLogoLoader size={80} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <TopNavbar navigation={navigation} />
      <View style={styles.header}>
        <View style={styles.searchRow}>
          <View style={styles.searchContainer}>
            <SearchInput
              placeholder="Search enquiries..."
              value={searchQuery}
              onChangeText={(text) => dispatch(setSearchQuery(text))}
              onClear={() => dispatch(setSearchQuery(''))}
            />
          </View>
          
          <TouchableOpacity
            style={styles.sortButton}
            onPress={() => setShowSortModal(true)}>
            <Icon name="sort" size={20} color={colors.primary} />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setShowFilters(true)}>
            <Icon name="tune" size={20} color={colors.primary} />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.downloadButton}
            onPress={handleDownloadAllPDF}>
            <Icon name="download" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>
        
      </View>

      {/* Filter chips - moved outside FlatList to remove gap */}
      {renderStatusChips()}
      {user?.role === 'admin' && renderClientChips()}

      <FlatList
        data={enrichedFilteredEnquiries.filter(enquiry => enquiry && enquiry.id)}
        renderItem={renderEnquiryItem}
        keyExtractor={(item, index) => {
          // Use stable IDs - fallback to index only if absolutely necessary
          if (item?.id) return String(item.id);
          if (item?._id) return String(item._id);
          // Last resort: use index (not ideal but better than Math.random())
          if (__DEV__) {
            console.warn('Enquiry item missing ID, using index:', index, item);
          }
          return `enquiry-${index}`;
        }}
        ListHeaderComponent={null}
        ListFooterComponent={renderListFooter}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={[
          styles.flatListContent,
          enrichedFilteredEnquiries.length === 0 && styles.flatListContentEmpty
        ]}
        style={styles.flatList}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.1} // Lower threshold to load more aggressively and display all enquiries
        numColumns={2}
        columnWrapperStyle={styles.row}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        windowSize={10}
        initialNumToRender={10}
        updateCellsBatchingPeriod={50}
        getItemLayout={(data, index) => ({
          length: 280, // Approximate card height
          offset: 280 * Math.floor(index / 2),
          index,
        })}
      />

      {renderFilterModal()}
      {renderSortModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.background,
    borderBottomWidth: 0,
    shadowColor: colors.cardShadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    marginBottom: 0,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  searchContainer: {
    flex: 1,
  },
  addButtonContainer: {
    marginTop: 16,
    alignItems: 'flex-end',
  },
  sortButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  filterButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  downloadButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  filterChipsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  filterChips: {
    flex: 1,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  filterChipText: {
    color: colors.textWhite,
    fontSize: fonts.sm,
    fontFamily: fonts.medium,
    marginRight: 6,
  },
  filterChipClose: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearAllButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  clearAllText: {
    color: colors.textSecondary,
    fontSize: fonts.sm,
    fontFamily: fonts.medium,
  },
  scrollView: {
    flex: 1,
  },
  flatList: {
    flex: 1,
  },
  flatListContent: {
    paddingBottom: 20,
    paddingTop: 0,
  },
  row: {
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  loadingMoreContainer: {
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingMoreContent: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  loadingSpinner: {
    marginRight: 0,
  },
  loadingMoreText: {
    fontSize: fonts.sm,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
  },
  endOfListContainer: {
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  endOfListDivider: {
    width: 60,
    height: 1,
    backgroundColor: colors.borderLight,
    marginBottom: 12,
  },
  endOfListText: {
    fontSize: fonts.xs,
    fontFamily: fonts.regular,
    color: colors.textLight,
    letterSpacing: 0.3,
  },
  flatListContentEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  cardsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  emptyCard: {
    margin: 16,
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    marginTop: 16,
    marginBottom: 8,
  },
  filterModal: {
    flex: 1,
    backgroundColor: colors.background,
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterContent: {
    flex: 1,
    padding: 20,
  },
  filterSection: {
    marginBottom: 24,
  },
  filterLabel: {
    marginBottom: 12,
  },
  filterOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.backgroundSecondary,
    marginRight: 8,
  },
  filterOptionActive: {
    backgroundColor: colors.primary,
  },
  filterFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  applyButton: {
    width: '100%',
  },
  
  // Sort Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sortModalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '60%',
    width: '100%',
    shadowColor: colors.textPrimary,
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  sortModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sortModalTitle: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
  },
  sortModalClose: {
    padding: 4,
  },
  sortOptionsList: {
    padding: 8,
  },
  sortOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    marginVertical: 2,
  },
  sortOptionActive: {
    backgroundColor: colors.backgroundSecondary,
  },
  sortOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sortOptionText: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
    marginLeft: 12,
  },
  sortOptionTextActive: {
    color: colors.primary,
    fontFamily: fonts.bold,
  },
  sortOrderIndicator: {
    marginLeft: 8,
  },
  listHeaderContainer: {
    backgroundColor: colors.background,
    marginTop: 0,
    paddingTop: 0,
  },
  // Compact Filter Row Styles
  compactFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    marginTop: 0,
  },
  compactFilterLabel: {
    fontSize: fonts.sm,
    fontFamily: fonts.bold,
    color: colors.textSecondary,
    marginRight: 8,
    minWidth: 60,
  },
  compactChipsScroll: {
    flex: 1,
  },
  compactChipsContent: {
    alignItems: 'center',
    paddingRight: 8,
  },
  compactSelectedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 6,
  },
  compactSelectedChipText: {
    fontSize: fonts.xs,
    fontFamily: fonts.medium,
    color: colors.textWhite,
    marginRight: 4,
  },
  compactChipClose: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  compactChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginRight: 6,
  },
  compactChipText: {
    fontSize: fonts.xs,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
  },
  clearFiltersButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: colors.primary,
    borderRadius: 8,
    alignItems: 'center',
  },
  clearFiltersButtonText: {
    fontSize: fonts.sm,
    fontFamily: fonts.medium,
    color: colors.textWhite,
  },
  
  // Old chip styles (keeping for backward compatibility if needed)
  chipsGroupRow: {
    marginBottom: 2,
    paddingLeft: 20,    // match Enquiry Cards' left inset
    paddingRight: 20,  
  },
  chipGroupLabel: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: colors.textSecondary,
    marginBottom: 2,
    marginLeft: 8,
  },
  chipsScroll: {
    marginBottom: 6,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.textSecondary,
    backgroundColor: colors.background,
    marginRight: 8,
    marginBottom: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontFamily: fonts.medium,
  },
  chipTextActive: {
    color: colors.textWhite,
  },
  clientsChipsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 8,
  },
  // Quick Actions Section
  quickActionsSection: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    marginTop: 8,
  },
  quickActionsCard: {
    marginHorizontal: 0,
    marginVertical: 0,
    padding: 18,
  },
  quickActionsTitle: {
    fontSize: fonts.lg,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    marginBottom: 16,
    letterSpacing: 0.3,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionButton: {
    width: '48%',
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 110,
  },
  actionIcon: {
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionText: {
    fontSize: fonts.sm,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
    textAlign: 'center',
    lineHeight: 18,
    letterSpacing: 0.2,
  },
  // Pagination Styles
  paginationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.background,
    borderRadius: 20,
    marginHorizontal: 16,
    marginTop: 18,
    marginBottom: 0,
  },
  paginationArrow: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
  },
  paginationNumbers: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  paginationNumber: {
    minWidth: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 8,
    marginHorizontal: 2,
  },
  paginationNumberActive: {
    backgroundColor: colors.primary, // Brand color
  },
  paginationNumberText: {
    fontSize: fonts.sm,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
  },
  paginationNumberTextActive: {
    color: colors.textWhite,
    fontFamily: fonts.bold,
  },
  paginationEllipsis: {
    fontSize: fonts.sm,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
    paddingHorizontal: 4,
  },
});

export default EnquiryListScreen;
