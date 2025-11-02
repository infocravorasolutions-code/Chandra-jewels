import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
  Text,
  Dimensions,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute } from '@react-navigation/native';
import { useSelector, useDispatch } from 'react-redux';
import { useAuth } from '../../context/AuthContext';
import { useFilteredEnquiries } from '../../features/enquiries/enquiriesHooks';
import { useGetClientsQuery } from '../../store/api';
import {
  setFilters,
  setSearchQuery,
  setSorting,
  setSelectedStatus,
  setSelectedClient,
  clearFilters,
} from '../../features/enquiries/enquiriesSlice';
import { EnquiryCard, Card } from '../../components/cards/Cards';
import { Button, SearchInput } from '../../components/common';
import { AnimatedLogoLoader } from '../../components/common';
import TopNavbar from '../../components/common/TopNavbar';
import Icon from '../../components/common/Icon';
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

const statusList = ['All', 'Pending', 'In Progress', 'Completed'];

const EnquiryListScreen = ({ navigation }) => {
  const dispatch = useDispatch();
  const { user } = useAuth();
  const route = useRoute();
  
  // Redux state
  const filters = useSelector(state => state.enquiries.filters);
  const searchQuery = useSelector(state => state.enquiries.searchQuery);
  const sortBy = useSelector(state => state.enquiries.sortBy);
  const sortOrder = useSelector(state => state.enquiries.sortOrder);
  const selectedStatus = useSelector(state => state.enquiries.selectedStatus);
  const selectedClient = useSelector(state => state.enquiries.selectedClient);
  
  // RTK Query hook - replaces loadEnquiries and all filtering logic
  const { enquiries: filteredEnquiries, allEnquiries: enquiries, isLoading: loading, refetch } = 
    useFilteredEnquiries(user?.role);
  
  // Fetch clients to enrich client names
  const { data: clientsData = [], isLoading: clientsLoading, error: clientsError } = useGetClientsQuery(undefined, {
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
    if (!enquiries || enquiries.length === 0) {
      return [];
    }
    
    return enquiries.map(enquiry => {
      // If clientName is 'Unknown Client' or missing, try to fetch from clientNameMap
      let finalClientName = enquiry.clientName;
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
          if (__DEV__ && enquiries.indexOf(enquiry) === 0) {
            console.log('Enriched enquiry with client name:', {
              clientId: enquiry.clientId,
              clientName: finalClientName
            });
          }
        }
      }
      return { ...enquiry, clientName: finalClientName };
    });
  }, [enquiries, clientNameMap]);

  // Re-apply filtering on enriched enquiries
  const enrichedFilteredEnquiries = useMemo(() => {
    if (!enrichedEnquiries || enrichedEnquiries.length === 0) {
      return filteredEnquiries; // Fallback to original filtered if no enriched data
    }

    let filtered = [...enrichedEnquiries];
    
    // Apply status filter
    if (filters.status && filters.status !== 'all') {
      filtered = filtered.filter(e => e.status === filters.status);
    }
    
    // Apply priority filter
    if (filters.priority && filters.priority !== 'all') {
      filtered = filtered.filter(e => e.priority === filters.priority);
    }
    
    // Apply client filter - use enriched client names
    if (filters.client && filters.client !== 'all') {
      filtered = filtered.filter(e => e.clientName === filters.client);
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
    
    // Apply sorting (same logic as hook)
    filtered.sort((a, b) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];
      
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
      
      if (sortOrder === 'asc') {
        if (aValue < bValue) return -1;
        if (aValue > bValue) return 1;
        return 0;
      } else {
        if (aValue > bValue) return -1;
        if (aValue < bValue) return 1;
        return 0;
      }
    });
    
    return filtered;
  }, [enrichedEnquiries, filters, searchQuery, sortBy, sortOrder, filteredEnquiries]);

  // Get unique client list from enriched enquiries
  const clientList = useMemo(() => {
    if (!enrichedEnquiries || enrichedEnquiries.length === 0) {
      return [];
    }
    
    const clients = Array.from(
      new Set(
        enrichedEnquiries
          .map(e => e.clientName)
          .filter(name => name && name.trim() !== '' && name !== 'Unknown Client')
      )
    ).sort();
    
    if (__DEV__) {
      console.log('Client List Generated:', clients);
      console.log('Total Enquiries:', enrichedEnquiries.length);
      console.log('Unique Clients Found:', clients.length);
      console.log('Client Name Map Size:', clientNameMap.size);
      console.log('Total Clients from API:', clients?.length || 0);
      console.log('Sample enriched enquiry:', enrichedEnquiries[0]);
      if (enrichedEnquiries.length > 0) {
        const sampleClientIds = enrichedEnquiries.slice(0, 5).map(e => e.clientId);
        console.log('Sample Client IDs from enquiries:', sampleClientIds);
      }
    }
    
    return clients;
  }, [enrichedEnquiries, clientNameMap]);

  // Update filter when route params change
  useEffect(() => {
    const newStatus = route.params?.filter || 'all';
    if (newStatus !== filters.status) {
      dispatch(setFilters({ status: newStatus }));
    }
    if (route.params?.filterType === 'client' && route.params?.filter) {
      dispatch(setSelectedClient(route.params.filter));
    }
  }, [route.params?.filterType, route.params?.filter]);

  // Handler for downloading all enquiries as PDF
  const handleDownloadAllPDF = async () => {
    try {
      // Get the function from the module
      const downloadFn = pdfGeneratorModule?.downloadAllEnquiriesPDF;
      
      if (!downloadFn || typeof downloadFn !== 'function') {
        console.error('downloadAllEnquiriesPDF not available:', {
          module: pdfGeneratorModule,
          moduleType: typeof pdfGeneratorModule,
          moduleKeys: pdfGeneratorModule ? Object.keys(pdfGeneratorModule) : 'no module',
          functionType: typeof downloadFn,
        });
        Alert.alert(
          'Error', 
          'PDF export function not available. Please restart Metro bundler with: npm start -- --reset-cache'
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
      console.error('Error generating PDF:', error);
      Alert.alert(
        'Error',
        `Failed to generate PDF: ${error.message || 'Unknown error'}. Please try again.`,
        [{ text: 'OK' }]
      );
    }
  };

  // Safety check - don't render if user is not loaded
  if (!user) {
    return <AnimatedLogoLoader size={60} />;
  }
  
  const onRefresh = async () => {
    setRefreshing(true);
    await refetch(); // RTK Query refetch
    setRefreshing(false);
  };

  // No need for applyFilters - handled by useFilteredEnquiries hook

  const handleFilterChange = (filterType, value) => {
    dispatch(setFilters({ [filterType]: value }));
  };

  const handleClearFilters = () => {
    dispatch(clearFilters());
  };

  const getStatusOptions = () => {
    const baseOptions = [
      { label: 'All Status', value: 'all' },
      { label: 'Pending', value: 'pending' },
      { label: 'In Progress', value: 'in_progress' },
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
    const clients = clientList; // Use the already filtered and sorted clientList
    return [
      { label: 'All Clients', value: 'all' },
      ...clients.map(client => ({ label: client, value: client })),
    ];
  };

  // Helper functions for status and priority styling
  const getStatusColor = (status) => {
    const statusColors = {
      pending: colors.warning,
      in_progress: colors.info,
      completed: colors.success,
      rejected: colors.error,
    };
    return statusColors[status] || colors.textSecondary;
  };

  const getStatusIcon = (status) => {
    const statusIcons = {
      pending: 'pendingActions',
      in_progress: 'work',
      completed: 'check-circle',
      rejected: 'cancel',
    };
    return statusIcons[status] || 'help';
  };

  const getPriorityColor = (priority) => {
    const priorityColors = {
      high: colors.error,
      medium: colors.warning,
      low: colors.success,
    };
    return priorityColors[priority] || colors.textSecondary;
  };

  const getPriorityIcon = (priority) => {
    const priorityIcons = {
      high: 'priorityHigh',
      medium: 'remove',
      low: 'lowPriority',
    };
    return priorityIcons[priority] || 'help';
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
    { key: 'budget', label: 'Budget', icon: 'currency-rupee' },
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
      dispatch(setSorting({ sortBy: newSortBy, sortOrder: 'desc' })); // Default to desc for new field
      if (__DEV__) {
        console.log('Sort changed to:', newSortBy, 'desc');
      }
    }
    setShowSortModal(false);
  };

  const renderFilterChips = () => {
    const activeFilters = Object.entries(filters).filter(([key, value]) => value !== 'all');
    
    if (activeFilters.length === 0) return null;

    return (
      <View style={styles.filterChipsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterChips}>
          {activeFilters.map(([key, value]) => (
            <View key={key} style={styles.filterChip}>
              <Text style={styles.filterChipText}>
                {key === 'status' ? 'Status' : key}: {value}
              </Text>
              <TouchableOpacity
                style={styles.filterChipClose}
                onPress={() => handleFilterChange(key, 'all')}>
                <Icon name="close" size={14} color={colors.textWhite} />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
        <TouchableOpacity style={styles.clearAllButton} onPress={handleClearFilters}>
          <Text style={styles.clearAllText}>Clear All</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderStatusChips = () => (
    statusList.length <= 1 ? null : (
      <View style={styles.chipsGroupRow}>
        <Text style={styles.chipGroupLabel}>Status</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
          {statusList.map(status => (
            <TouchableOpacity
              key={status}
              style={[
                styles.chip,
                selectedStatus === status && styles.chipActive,
              ]}
              onPress={() => {
                dispatch(setSelectedStatus(status));
                // Filter is automatically updated by setSelectedStatus action
              }}
            >
              <Text style={[
                styles.chipText,
                selectedStatus === status && styles.chipTextActive,
              ]}>{status}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    )
  );

  const renderClientChips = () => {
    // Always show client chips, even if there's only one client or none
    // This ensures the UI is consistent
    if (!enrichedEnquiries || enrichedEnquiries.length === 0) {
      return null; // Don't show if no enquiries loaded yet
    }
    
    // Don't show if no valid clients found
    if (!clientList || clientList.length === 0) {
      return null;
    }
    
    return (
      <View style={styles.chipsGroupRow}>
        <Text style={styles.chipGroupLabel}>Client</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
          {["All", ...clientList].map(client => (
            <TouchableOpacity
              key={client}
              style={[
                styles.chip,
                selectedClient === client && styles.chipActive,
              ]}
              onPress={() => {
                dispatch(setSelectedClient(client));
                // Filter is automatically updated by setSelectedClient action
              }}
            >
              <Text style={[
                styles.chipText,
                selectedClient === client && styles.chipTextActive,
              ]}>{client}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderFilterModal = () => (
    <Modal
      visible={showFilters}
      animationType="slide"
      presentationStyle="pageSheet">
      <View style={styles.filterModal}>
        <View style={styles.filterHeader}>
          <Text style={{ fontSize: 16, fontFamily: fonts.bold, color: colors.textPrimary }}>
            Filters
          </Text>
          <TouchableOpacity onPress={() => setShowFilters(false)}>
            <Text style={{ fontSize: 20, color: colors.textPrimary }}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.filterContent}>
          <View style={styles.filterSection}>
            <Text style={[styles.filterLabel, { color: colors.textPrimary, fontSize: 13, fontWeight: '500' }]}>
              Status
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {getStatusOptions().map(option => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.filterOption,
                    filters.status === option.value && styles.filterOptionActive,
                  ]}
                  onPress={() => handleFilterChange('status', option.value)}>
                  <Text style={{ 
                    color: filters.status === option.value ? colors.textWhite : colors.textSecondary, 
                    fontSize: 13 
                  }}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.filterSection}>
            <Text style={[styles.filterLabel, { color: colors.textPrimary, fontSize: 13, fontWeight: '500' }]}>
              Priority
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {getPriorityOptions().map(option => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.filterOption,
                    filters.priority === option.value && styles.filterOptionActive,
                  ]}
                  onPress={() => handleFilterChange('priority', option.value)}>
                  <Text style={{ 
                    color: filters.priority === option.value ? colors.textWhite : colors.textSecondary, 
                    fontSize: 13 
                  }}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.filterSection}>
            <Text style={[styles.filterLabel, { color: colors.textPrimary, fontSize: 13, fontWeight: '500' }]}>
              Client
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {getClientOptions().map(option => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.filterOption,
                    filters.client === option.value && styles.filterOptionActive,
                  ]}
                  onPress={() => handleFilterChange('client', option.value)}>
                  <Text style={{ 
                    color: filters.client === option.value ? colors.textWhite : colors.textSecondary, 
                    fontSize: 13 
                  }}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </ScrollView>

        <View style={styles.filterFooter}>
          <Button
            title="Apply Filters"
            onPress={() => setShowFilters(false)}
            style={styles.applyButton}
          />
        </View>
      </View>
    </Modal>
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
        <View style={styles.sortModalContent}>
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
        </View>
      </TouchableOpacity>
    </Modal>
  );

  if (loading) {
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

      {renderStatusChips()}
      {renderClientChips()}
      {renderFilterChips()}

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }>
        
        {enrichedFilteredEnquiries.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Icon name="description" size={40} color={colors.textLight} />
            <Text style={[styles.emptyText, { color: colors.textSecondary, fontSize: 13 }]}>
              No enquiries found
            </Text>
            <Text style={{ color: colors.textLight, fontSize: fonts.sm }}>
              Try adjusting your search or filters
            </Text>
          </Card>
        ) : (
          enrichedFilteredEnquiries.filter(enquiry => enquiry && enquiry.id).map(enquiry => (
            <EnquiryCard
              key={enquiry.id}
              enquiry={enquiry}
              onPress={() => {
                console.log('Navigating to SingleEnquiry with enquiry:', enquiry);
                console.log('Enquiry ID:', enquiry?.id);
                console.log('Enquiry object keys:', enquiry ? Object.keys(enquiry) : 'No enquiry object');
                try {
                  navigation.navigate('SingleEnquiry', { 
                    enquiryId: enquiry.id, 
                    enquiry,
                    shouldRefresh: false,
                  });
                } catch (error) {
                  console.error('Navigation error:', error);
                }
              }}
              getStatusColor={getStatusColor}
              getStatusIcon={getStatusIcon}
              getPriorityColor={getPriorityColor}
              getPriorityIcon={getPriorityIcon}
              formatCurrency={formatCurrency}
              formatDate={formatDate}
            />
          ))
        )}
      </ScrollView>

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
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: colors.cardShadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    marginBottom: 12,
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
});

export default EnquiryListScreen;
