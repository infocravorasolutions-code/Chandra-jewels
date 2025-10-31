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
import { Button, Input } from '../../components/common';
import { AnimatedLogoLoader } from '../../components/common';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import Icon from '../../components/common/Icon';
import { formatCurrency, formatDate } from '../../utils/helpers';

const MetalPricesScreen = () => {
  const [metalPrices, setMetalPrices] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingPrices, setEditingPrices] = useState({});
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    loadMetalPrices();
  }, []);

  const loadMetalPrices = async () => {
    try {
      setLoading(true);
      const data = await api.getMetalPrices();
      setMetalPrices(data);
      setEditingPrices(data);
    } catch (error) {
      console.error('Error loading metal prices:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMetalPrices();
    setRefreshing(false);
  };

  const handlePriceChange = (metal, value) => {
    setEditingPrices(prev => ({
      ...prev,
      [metal]: {
        ...prev[metal],
        price: parseFloat(value) || 0,
      },
    }));
  };

  const handleSavePrices = () => {
    Alert.alert(
      'Update Metal Prices',
      'Are you sure you want to update the metal prices?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Update',
          onPress: () => {
            setMetalPrices(editingPrices);
            setIsEditing(false);
            Alert.alert('Success', 'Metal prices updated successfully');
          },
        },
      ]
    );
  };

  const handleCancelEdit = () => {
    setEditingPrices(metalPrices);
    setIsEditing(false);
  };

  // Build a compact summary row for Gold, Silver, Platinum
  const renderSummaryRow = () => {
    if (!metalPrices) return null;
    const order = ['gold', 'silver', 'platinum'];
    const items = order
      .filter(key => metalPrices[key])
      .map(key => ({ key, ...metalPrices[key] }));

    if (items.length === 0) return null;

    return (
      <View style={styles.summaryRow}>
        {items.map((item, idx) => (
          <Card key={item.key} style={[styles.summaryCard, idx !== items.length - 1 && { marginRight: 8 }]}>
            <Text style={styles.summaryTitle}>{item.key.charAt(0).toUpperCase() + item.key.slice(1)}</Text>
            <Text style={styles.summaryPrice}>{(item.price)}</Text>
            <Text style={styles.summaryUpdated}>Last up: {formatDate(item.lastUpdated)}</Text>
          </Card>
        ))}
      </View>
    );
  };

  const renderMetalPriceCard = (metal, data) => (
    <Card key={metal} style={styles.priceCard}>
      <View style={styles.priceHeader}>
        <View style={styles.metalIcon}>
          <Icon name="jewelry" size={20} color={colors.primary} />
        </View>
        <View style={styles.metalInfo}>
          <Text style={[styles.metalName, { fontSize: fonts.lg, fontFamily: fonts.bold, color: colors.textPrimary }]}>
            {metal.charAt(0).toUpperCase() + metal.slice(1)}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: fonts.sm }}>
            Last updated: {formatDate(data.lastUpdated)}
          </Text>
        </View>
      </View>

      <View style={styles.priceContent}>
        {isEditing ? (
          <View style={styles.editContainer}>
            <Input
              label="Price"
              value={editingPrices[metal].price.toString()}
              onChangeText={(value) => handlePriceChange(metal, value)}
              keyboardType="numeric"
              style={styles.priceInput}
            />
            <Text style={[styles.priceUnit, { color: colors.textSecondary, fontSize: fonts.sm }]}>
              {data.unit}
            </Text>
          </View>
        ) : (
          <View style={styles.priceDisplay}>
            <View style={{flexDirection:'row', alignItems:'center', justifyContent:'center'}}>
              <Icon name="attach-money" size={24} color={colors.primary} style={{marginRight:4}} />
              <Text style={[styles.priceValue, { fontSize: fonts['2xl'], fontFamily: fonts.bold, color: colors.textPrimary }]}>
                {(data.price)}
              </Text>
            </View>
            <Text style={[styles.priceUnit, { color: colors.textSecondary, fontSize: fonts.sm }]}>
              {data.unit}
            </Text>
          </View>
        )}
      </View>
    </Card>
  );

  const renderActionButtons = () => (
    <Card style={styles.actionCard}>
      <Text style={[styles.actionTitle, { fontSize: fonts.lg, fontFamily: fonts.bold, color: colors.textPrimary }]}>
        Actions
      </Text>
      
      <View style={styles.actionButtons}>
        {isEditing ? (
          <>
            <Button
              title="Save Changes"
              onPress={handleSavePrices}
              style={styles.saveButton}
            />
            <Button
              title="Cancel"
              variant="outline"
              onPress={handleCancelEdit}
              style={styles.cancelButton}
            />
          </>
        ) : (
          <Button
            title="Edit Prices"
            onPress={() => setIsEditing(true)}
            style={styles.editButton}
          />
        )}
      </View>
    </Card>
  );

  const renderPriceHistory = () => (
    <Card style={styles.historyCard}>
      <Text style={[styles.historyTitle, { fontSize: fonts.lg, fontFamily: fonts.bold, color: colors.textPrimary }]}>
        Price History
      </Text>
      
      <View style={styles.historyItem}>
        <View style={styles.historyIcon}>
          <Icon name="dashboard" size={16} color={colors.success} />
        </View>
        <View style={styles.historyContent}>
          <Text style={{ color: colors.textPrimary, fontSize: fonts.base }}>
            Gold price increased by 2.5%
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: fonts.sm }}>
            2 days ago
          </Text>
        </View>
      </View>

      <View style={styles.historyItem}>
        <View style={styles.historyIcon}>
          <Icon name="warning" size={16} color={colors.error} />
        </View>
        <View style={styles.historyContent}>
          <Text style={{ color: colors.textPrimary, fontSize: fonts.base }}>
            Silver price decreased by 1.2%
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: fonts.sm }}>
            1 week ago
          </Text>
        </View>
      </View>

      <View style={styles.historyItem}>
        <View style={styles.historyIcon}>
          <Icon name="dashboard" size={16} color={colors.success} />
        </View>
        <View style={styles.historyContent}>
          <Text style={{ color: colors.textPrimary, fontSize: fonts.base }}>
            Platinum price increased by 3.1%
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: fonts.sm }}>
            2 weeks ago
          </Text>
        </View>
      </View>
    </Card>
  );

  if (loading) {
    return <AnimatedLogoLoader size={80} />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['left','right','bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingTop:20 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }>
        
        <View style={styles.header}>
          <Text style={{ fontSize: fonts['2xl'], fontFamily: fonts.bold, color: colors.primary }}>
            Metal Prices
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: fonts.sm }}>
            Manage current metal prices for jewellery calculations
          </Text>
        </View>

        {renderSummaryRow()}

        {/* Vertical detailed metal cards removed as requested */}

        {renderActionButtons()}
        {renderPriceHistory()}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    paddingTop: 0,
    paddingBottom: 8,
    paddingHorizontal: 20,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 8,
  },
  priceCard: {
    marginTop: 8,
    marginBottom: 12,
    marginHorizontal: 20,
  },
  priceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  metalIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  metalInfo: {
    flex: 1,
  },
  metalName: {
    marginBottom: 4,
  },
  priceContent: {
    alignItems: 'center',
  },
  editContainer: {
    width: '100%',
    alignItems: 'center',
  },
  priceInput: {
    width: '60%',
    textAlign: 'center',
  },
  priceDisplay: {
    alignItems: 'center',
  },
  priceValue: {
    marginBottom: 4,
  },
  priceUnit: {
    textAlign: 'center',
  },
  actionCard: {
    marginHorizontal: 20,
    marginVertical: 12,
  },
  actionTitle: {
    marginBottom: 16,
  },
  actionButtons: {
    gap: 12,
  },
  editButton: {
    width: '100%',
  },
  saveButton: {
    backgroundColor: colors.success,
  },
  cancelButton: {
    borderColor: colors.error,
  },
  historyCard: {
    marginHorizontal: 20,
    marginVertical: 12,
  },
  historyTitle: {
    marginBottom: 16,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  historyIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  historyContent: {
    flex: 1,
  },
  summaryRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 8,
  },
  summaryCard: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  summaryTitle: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  summaryPrice: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  summaryUpdated: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
  },
});

export default MetalPricesScreen;
