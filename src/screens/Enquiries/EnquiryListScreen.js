import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
  Text,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { EnquiryCard, Card } from '../../components/cards/Cards';
import { Button, SearchInput } from '../../components/common';
import { Loader } from '../../components/common/Loader';
import TopNavbar from '../../components/common/TopNavbar';
import Icon from '../../components/common/Icon';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';

const EnquiryListScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [enquiries, setEnquiries] = useState([]);
  const [filteredEnquiries, setFilteredEnquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    status: 'all',
    priority: 'all',
    client: 'all',
  });

  useEffect(() => {
    loadEnquiries();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [enquiries, searchQuery, filters]);

  // Safety check - don't render if user is not loaded
  if (!user) {
    return <Loader />;
  }

  const loadEnquiries = async () => {
    try {
      setLoading(true);
      const data = await api.getEnquiries(user?.role || 'client', filters);
      setEnquiries(data);
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
        enquiry.client.toLowerCase().includes(searchQuery.toLowerCase())
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

    // Client filter
    if (filters.client !== 'all') {
      filtered = filtered.filter(enquiry => enquiry.client === filters.client);
    }

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
    const clients = [...new Set(enquiries.map(e => e.client))];
    return [
      { label: 'All Clients', value: 'all' },
      ...clients.map(client => ({ label: client, value: client })),
    ];
  };

  const renderFilterChips = () => {
    const activeFilters = Object.entries(filters).filter(([key, value]) => value !== 'all');
    
    if (activeFilters.length === 0) return null;

    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterChips}>
        {activeFilters.map(([key, value]) => (
          <TouchableOpacity
            key={key}
            style={styles.filterChip}
            onPress={() => handleFilterChange(key, 'all')}>
            <Text style={{ color: colors.textWhite, fontSize: fonts.sm }}>
              {key}: {value}
            </Text>
            <Text style={{ fontSize: 14, color: colors.textWhite }}>✕</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={styles.clearAllChip} onPress={clearFilters}>
          <Text style={{ color: colors.primary, fontSize: fonts.sm }}>
            Clear All
          </Text>
        </TouchableOpacity>
      </ScrollView>
    );
  };

  const renderFilterModal = () => (
    <Modal
      visible={showFilters}
      animationType="slide"
      presentationStyle="pageSheet">
      <View style={styles.filterModal}>
        <View style={styles.filterHeader}>
          <Text style={{ fontSize: fonts.xl, fontFamily: fonts.bold, color: colors.textPrimary }}>
            Filters
          </Text>
          <TouchableOpacity onPress={() => setShowFilters(false)}>
            <Text style={{ fontSize: 20, color: colors.textPrimary }}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.filterContent}>
          <View style={styles.filterSection}>
            <Text style={[styles.filterLabel, { color: colors.textPrimary, fontSize: fonts.base, fontWeight: '500' }]}>
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
                    fontSize: fonts.sm 
                  }}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.filterSection}>
            <Text style={[styles.filterLabel, { color: colors.textPrimary, fontSize: fonts.base, fontWeight: '500' }]}>
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
                    fontSize: fonts.sm 
                  }}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.filterSection}>
            <Text style={[styles.filterLabel, { color: colors.textPrimary, fontSize: fonts.base, fontWeight: '500' }]}>
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
                    fontSize: fonts.sm 
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

  if (loading) {
    return <Loader />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <TopNavbar navigation={navigation} />
      <View style={styles.header}>
        <SearchInput
          placeholder="Search enquiries..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          onClear={() => setSearchQuery('')}
        />
        
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setShowFilters(true)}>
            <Icon name="search" size={20} color={colors.primary} />
          </TouchableOpacity>
          
          {user?.role === 'client' && (
            <Button
              title="Add Enquiry"
              onPress={() => navigation.navigate('AddEnquiryStep1')}
              size="small"
            />
          )}
        </View>
      </View>

      {renderFilterChips()}

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }>
        
        {filteredEnquiries.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Icon name="enquiry" size={40} color={colors.textLight} />
            <Text style={[styles.emptyText, { color: colors.textSecondary, fontSize: fonts.base }]}>
              No enquiries found
            </Text>
            <Text style={{ color: colors.textLight, fontSize: fonts.sm }}>
              Try adjusting your search or filters
            </Text>
          </Card>
        ) : (
          filteredEnquiries.map(enquiry => (
            <EnquiryCard
              key={enquiry.id}
              title={enquiry.title}
              client={enquiry.client}
              status={enquiry.status}
              priority={enquiry.priority}
              createdAt={enquiry.createdAt}
              estimatedPrice={enquiry.estimatedPrice}
              onPress={() => {
                console.log('Navigating to SingleEnquiry with enquiry:', enquiry);
                navigation.navigate('SingleEnquiry', { enquiry });
              }}
            />
          ))
        )}
      </ScrollView>

      {renderFilterModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  header: {
    padding: 16,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  filterButton: {
    padding: 8,
  },
  filterChips: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  clearAllChip: {
    backgroundColor: colors.backgroundSecondary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
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
});

export default EnquiryListScreen;
