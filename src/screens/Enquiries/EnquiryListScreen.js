import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
  Text,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { EnquiryCard, Card } from '../../components/cards/Cards';
import { Button, SearchInput } from '../../components/common';
import { AnimatedLogoLoader } from '../../components/common';
import TopNavbar from '../../components/common/TopNavbar';
import Icon from '../../components/common/Icon';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';

const { width } = Dimensions.get('window');

const statusList = ['All', 'Pending', 'In Progress', 'Completed'];

const EnquiryListScreen = ({ navigation }) => {
  const { user } = useAuth();
  const route = useRoute();
  const [enquiries, setEnquiries] = useState([]);
  const [filteredEnquiries, setFilteredEnquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showSortModal, setShowSortModal] = useState(false);
  const [sortBy, setSortBy] = useState('createdAt'); // Default sort by creation date
  const [sortOrder, setSortOrder] = useState('desc'); // Default to newest first
  
  // Get filter from route params, default to 'all' if not provided
  const initialFilter = route.params?.filter || 'all';
  const [filters, setFilters] = useState({
    status: initialFilter,
    priority: 'all',
    client: 'all',
  });

  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedClient, setSelectedClient] = useState('All');

  // Get unique client list
  const clientList = Array.from(new Set(enquiries.map(e => e.clientName))).sort();

  useEffect(() => {
    loadEnquiries();
  }, []);

  // Update filter when route params change
  useEffect(() => {
    const newStatus = route.params?.filter || 'all';
    if (newStatus !== filters.status) {
      setFilters(prev => ({
        ...prev,
        status: newStatus
      }));
    }
    if (route.params?.filterType === 'client' && route.params?.filter) {
      setSelectedClient(route.params.filter);
    }
  }, [route.params?.filterType, route.params?.filter]);

  useEffect(() => {
    applyFilters();
  }, [enquiries, searchQuery, filters, sortBy, sortOrder]);

  // Safety check - don't render if user is not loaded
  if (!user) {
    return <AnimatedLogoLoader size={60} />;
  }

  const loadEnquiries = async () => {
    try {
      setLoading(true);
      // Enhanced dummy data with proper statuses and priorities
      const dummyEnquiries = [
        {
          id: '1',
          title: 'Custom Diamond Ring Design',
          clientName: 'John Smith',
          clientId: 'client1',
          status: 'pending',
          priority: 'high',
          description: 'Looking for a custom diamond engagement ring with vintage style',
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
          updatedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 minutes ago
          budget: 15000,
          deadline: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(), // 7 days from now
          category: 'Engagement Ring',
          metalType: 'Gold',
          stoneType: 'Diamond',
        },
        {
          id: '2',
          title: 'Emerald Necklace Collection',
          clientName: 'Sarah Johnson',
          clientId: 'client2',
          status: 'in_progress',
          priority: 'medium',
          description: 'Design a luxury emerald necklace for special occasion',
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(), // 2 days ago
          updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(), // 4 hours ago
          budget: 25000,
          deadline: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString(), // 14 days from now
          category: 'Necklace',
          metalType: 'Platinum',
          stoneType: 'Emerald',
        },
        {
          id: '3',
          title: 'Gold Bracelet Set',
          clientName: 'Michael Brown',
          clientId: 'client3',
          status: 'completed',
          priority: 'low',
          description: 'Traditional gold bracelet set for wedding',
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(), // 7 days ago
          updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
          budget: 8000,
          deadline: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(), // 2 days ago (completed)
          category: 'Bracelet',
          metalType: 'Gold',
          stoneType: 'Ruby',
        },
        {
          id: '4',
          title: 'Sapphire Earrings',
          clientName: 'Emily Davis',
          clientId: 'client4',
          status: 'pending',
          priority: 'high',
          description: 'Elegant sapphire drop earrings for gala event',
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(), // 6 hours ago
          updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(), // 6 hours ago
          budget: 12000,
          deadline: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5).toISOString(), // 5 days from now
          category: 'Earrings',
          metalType: 'White Gold',
          stoneType: 'Sapphire',
        },
        {
          id: '5',
          title: 'Pearl Necklace',
          clientName: 'Robert Wilson',
          clientId: 'client5',
          status: 'in_progress',
          priority: 'medium',
          description: 'Classic pearl necklace with diamond accents',
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(), // 3 days ago
          updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
          budget: 18000,
          deadline: new Date(Date.now() + 1000 * 60 * 60 * 24 * 10).toISOString(), // 10 days from now
          category: 'Necklace',
          metalType: 'Gold',
          stoneType: 'Pearl',
        },
        {
          id: '6',
          title: 'Ruby Ring',
          clientName: 'Lisa Anderson',
          clientId: 'client6',
          status: 'completed',
          priority: 'high',
          description: 'Vintage ruby ring with intricate design',
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(), // 10 days ago
          updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1).toISOString(), // 1 day ago
          budget: 22000,
          deadline: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(), // 3 days ago (completed)
          category: 'Ring',
          metalType: 'Gold',
          stoneType: 'Ruby',
        },
      ];
      
      setEnquiries(dummyEnquiries);
    } catch (error) {
      console.error('Error loading enquiries:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadEnquiries();
    setRefreshing(false);
  };

  const applyFilters = () => {
    let filtered = enquiries;

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(enquiry =>
        enquiry.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        enquiry.clientName.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Status filter
    if (filters.status !== 'all') {
      filtered = filtered.filter(enquiry => enquiry.status === filters.status);
    }

    // Priority filter
    if (filters.priority !== 'all') {
      filtered = filtered.filter(enquiry => enquiry.priority === filters.priority);
    }

    if (selectedClient !== 'All') {
      filtered = filtered.filter(enquiry => enquiry.clientName === selectedClient);
    }

    // Sort the filtered results
    filtered.sort((a, b) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];

      // Handle different data types
      if (sortBy === 'createdAt' || sortBy === 'updatedAt') {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      } else if (sortBy === 'budget') {
        aValue = parseFloat(aValue) || 0;
        bValue = parseFloat(bValue) || 0;
      } else if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    setFilteredEnquiries(filtered);
  };

  const handleFilterChange = (filterType, value) => {
    setFilters(prev => ({ ...prev, [filterType]: value }));
  };

  const clearFilters = () => {
    setFilters({
      status: 'all',
      priority: 'all',
      client: 'all',
    });
    setSearchQuery('');
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
    const clients = [...new Set(enquiries.map(e => e.clientName))];
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
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortOrder('desc'); // Default to desc for new field
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
        <TouchableOpacity style={styles.clearAllButton} onPress={clearFilters}>
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
              onPress={() => setSelectedStatus(status)}
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

  const renderClientChips = () => (
    clientList.length <= 1 ? null : (
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
              onPress={() => setSelectedClient(client)}
            >
              <Text style={[
                styles.chipText,
                selectedClient === client && styles.chipTextActive,
              ]}>{client}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    )
  );

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
              onChangeText={setSearchQuery}
              onClear={() => setSearchQuery('')}
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
        </View>
        
        {user?.role === 'client' && (
          <View style={styles.addButtonContainer}>
            <Button
              title="Add Enquiry"
              onPress={() => navigation.navigate('AddEnquiryStep1')}
              size="small"
            />
          </View>
        )}
      </View>

      {renderStatusChips()}
      {renderClientChips()}
      {renderFilterChips()}

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }>
        
        {filteredEnquiries.length === 0 ? (
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
          filteredEnquiries.filter(enquiry => enquiry && enquiry.id).map(enquiry => (
            <EnquiryCard
              key={enquiry.id}
              enquiry={enquiry}
              onPress={() => {
                console.log('Navigating to SingleEnquiry with enquiry:', enquiry);
                console.log('Enquiry ID:', enquiry?.id);
                console.log('Enquiry object keys:', enquiry ? Object.keys(enquiry) : 'No enquiry object');
                try {
                  navigation.navigate('SingleEnquiry', { enquiryId: enquiry.id, enquiry });
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
});

export default EnquiryListScreen;
