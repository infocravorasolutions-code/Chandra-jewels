import React, { useState, useEffect } from 'react';
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
import { api } from '../../services/api';
import { Card } from '../../components/cards/Cards';
import { Button, SearchInput } from '../../components/common';
import { AnimatedLogoLoader } from '../../components/common';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import Icon from '../../components/common/Icon';
import { formatCurrency, formatDate } from '../../utils/helpers';

const ClientsListScreen = () => {
  const [clients, setClients] = useState([]);
  const [filteredClients, setFilteredClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadClients();
  }, []);

  useEffect(() => {
    applySearchFilter();
  }, [clients, searchQuery]);

  const loadClients = async () => {
    try {
      setLoading(true);
      const data = await api.getClients();
      setClients(data);
    } catch (error) {
      console.error('Error loading clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadClients();
    setRefreshing(false);
  };

  const applySearchFilter = () => {
    if (!searchQuery) {
      setFilteredClients(clients);
      return;
    }

    const filtered = clients.filter(client =>
      client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.phone.includes(searchQuery)
    );

    setFilteredClients(filtered);
  };

  const handleClientPress = (client) => {
    Alert.alert(
      'Client Details',
      `Name: ${client.name}\nEmail: ${client.email}\nPhone: ${client.phone}\nTotal Orders: ${client.totalOrders}\nTotal Spent: ${formatCurrency(client.totalSpent)}\nLast Order: ${formatDate(client.lastOrder)}`,
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
            {client.name}
          </Text>
          <Text style={styles.clientDate}>
            {formatDate(client.lastOrder)}
          </Text>
        </View>

        <View style={styles.clientDetails}>
          <View style={styles.clientRow}>
            <Icon name="info" size={14} color={colors.textSecondary} />
            <Text style={styles.clientDetailText}>
              {client.email}
            </Text>
          </View>

          <View style={styles.clientRow}>
            <Icon name="info" size={14} color={colors.textSecondary} />
            <Text style={styles.clientDetailText}>
              {client.phone}
            </Text>
          </View>
        </View>

        <View style={styles.clientStats}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Orders</Text>
            <Text style={styles.statValue}>{client.totalOrders}</Text>
          </View>

          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Total Spent</Text>
            <Text style={styles.statValue}>{formatCurrency(client.totalSpent)}</Text>
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
            <Text style={styles.statCardValue}>{formatCurrency(clients.reduce((sum, client) => sum + client.totalSpent, 0))}</Text>
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
