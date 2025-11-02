import React, { useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Text,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGetClientsQuery } from '../../store/api';
import { Card } from '../../components/cards/Cards';
import { Button, SearchInput } from '../../components/common';
import { AnimatedLogoLoader } from '../../components/common';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import Icon from '../../components/common/Icon';
import { formatCurrency, formatDate } from '../../utils/helpers';

const ClientsListScreen = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Redux hook
  const { data: clientsData = [], isLoading: loading, refetch } = useGetClientsQuery();
  const clients = clientsData || [];

  // Filter clients based on search query using useMemo for performance
  const filteredClients = useMemo(() => {
    if (!searchQuery) {
      return clients;
    }

    const query = searchQuery.toLowerCase();
    return clients.filter(client =>
      (client.name && client.name.toLowerCase().includes(query)) ||
      (client.email && client.email.toLowerCase().includes(query)) ||
      (client.phone && client.phone.includes(searchQuery))
    );
  }, [clients, searchQuery]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleClientPress = (client) => {
    const lastOrderDate = client.lastOrder ? formatDate(client.lastOrder) : 'No orders yet';
    Alert.alert(
      'Client Details',
      `Name: ${client.name || 'N/A'}\nEmail: ${client.email || 'N/A'}\nPhone: ${client.phone || 'N/A'}\nTotal Orders: ${client.totalOrders || 0}\nTotal Spent: ${formatCurrency(client.totalSpent || 0)}\nLast Order: ${lastOrderDate}`,
      [{ text: 'OK' }]
    );
  };

  const handleAddClient = () => {
    Alert.alert(
      'Add New Client',
      'This would open a form to add a new client',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add',
          onPress: () => {
            Alert.alert('Success', 'New client added successfully');
          },
        },
      ]
    );
  };

  const renderClientItem = (client) => (
    <TouchableOpacity
      key={client.id}
      style={styles.clientItem}
      onPress={() => handleClientPress(client)}>
      
      <View style={styles.clientAvatar}>
        <Icon name="account" size={20} color={colors.textWhite} />
      </View>

      <View style={styles.clientContent}>
        <View style={styles.clientHeader}>
          <Text style={styles.clientName}>
            {client.name || 'Unknown Client'}
          </Text>
          <Text style={styles.clientDate}>
            {client.lastOrder ? formatDate(client.lastOrder) : 'No orders'}
          </Text>
        </View>

        {client.email !== 'N/A' || client.phone !== 'N/A' ? (
          <View style={styles.clientDetails}>
            {client.email && client.email !== 'N/A' && (
              <View style={styles.clientRow}>
                <Icon name="info" size={14} color={colors.textSecondary} />
                <Text style={styles.clientDetailText}>
                  {client.email}
                </Text>
              </View>
            )}

            {client.phone && client.phone !== 'N/A' && (
              <View style={styles.clientRow}>
                <Icon name="info" size={14} color={colors.textSecondary} />
                <Text style={styles.clientDetailText}>
                  {client.phone}
                </Text>
              </View>
            )}
          </View>
        ) : null}

        <View style={styles.clientStats}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Orders</Text>
            <Text style={styles.statValue}>{client.totalOrders || 0}</Text>
          </View>

          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Total Spent</Text>
            <Text style={styles.statValue}>{formatCurrency(client.totalSpent || 0)}</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity style={styles.moreButton}>
        <Text style={{ fontSize: 16, color: colors.textSecondary }}>⋮</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderStatsCards = () => (
    <View style={styles.statsContainer}>
      <Card style={styles.statCard}>
        <View style={styles.statContent}>
          <Icon name="account" size={20} color={colors.primary} />
          <View style={styles.statText}>
            <Text style={styles.statCardValue}>{clients.length}</Text>
            <Text style={styles.statCardLabel}>Total Clients</Text>
          </View>
        </View>
      </Card>

      <Card style={styles.statCard}>
        <View style={styles.statContent}>
          <Icon name="dashboard" size={20} color={colors.success} />
          <View style={styles.statText}>
            <Text style={styles.statCardValue}>{formatCurrency(clients.reduce((sum, client) => sum + (client.totalSpent || 0), 0))}</Text>
            <Text style={styles.statCardLabel}>Total Revenue</Text>
          </View>
        </View>
      </Card>
    </View>
  );

  if (loading) {
    return <AnimatedLogoLoader size={80} />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['left','right','bottom']}>
      <View style={styles.header}>
        <SearchInput
          placeholder="Search clients..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          onClear={() => setSearchQuery('')}
        />
        
        <TouchableOpacity style={styles.addButton} onPress={handleAddClient}>
          <Text style={{ fontSize: 20, color: colors.primary }}>➕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }>
        
        {renderStatsCards()}

        <Card style={styles.clientsHeader}>
          <Text style={styles.allClientsTitle}>All Clients</Text>
          <Text style={styles.allClientsSubtitle}>{filteredClients.length} clients found</Text>
        </Card>

        {filteredClients.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Icon name="account" size={40} color={colors.textLight} />
            <Text style={[styles.emptyText, { color: colors.textSecondary, fontSize: fonts.base }]}>
              {searchQuery ? 'No clients found' : 'No clients available'}
            </Text>
            <Text style={{ color: colors.textLight, fontSize: fonts.sm }}>
              {searchQuery ? 'Try adjusting your search' : 'Add your first client'}
            </Text>
          </Card>
        ) : (
          <View style={styles.clientsList}>
            {filteredClients.map(renderClientItem)}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  addButton: {
    marginLeft: 12,
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 12,
  },
  statCard: {
    flex: 1,
  },
  statContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    marginLeft: 12,
  },
  clientsHeader: {
    marginHorizontal: 20,
    marginTop: 6,
    marginBottom: 8,
  },
  clientsList: {
    paddingHorizontal: 20,
  },
  clientItem: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    shadowColor: colors.cardShadow,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  clientAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  clientContent: {
    flex: 1,
  },
  clientHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  clientName: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
  },
  clientDate: {
    color: colors.textLight,
    fontSize: 13,
    fontFamily: fonts.regular,
  },
  clientDetails: {
    marginBottom: 12,
  },
  clientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  clientText: {
    marginLeft: 8,
  },
  clientDetailText: {
    marginLeft: 8,
    color: colors.textSecondary,
    fontSize: 13,
    fontFamily: fonts.regular,
  },
  clientStats: {
    flexDirection: 'row',
    gap: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontFamily: fonts.regular,
  },
  statValue: {
    color: colors.textPrimary,
    fontSize: 16,
    fontFamily: fonts.bold,
    marginTop: 2,
  },
  statCardValue: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
  },
  statCardLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontFamily: fonts.regular,
  },
  allClientsTitle: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
  },
  allClientsSubtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    fontFamily: fonts.regular,
  },
  moreButton: {
    padding: 8,
    alignSelf: 'flex-start',
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
});

export default ClientsListScreen;
