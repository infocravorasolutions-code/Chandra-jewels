import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Text,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { StatusCard, Card } from '../../components/cards/Cards';
import { Button, SearchInput } from '../../components/common';
import { Loader } from '../../components/common/Loader';
import TopNavbar from '../../components/common/TopNavbar';
import Icon from '../../components/common/Icon';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import { formatCurrency, getRoleDisplayName } from '../../utils/helpers';

const DashboardScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Safety check - don't render if user is not loaded
  if (!user) {
    return <Loader />;
  }

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const data = await api.getDashboardData(user?.role || 'client');
      setDashboardData(data);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const getTimeOfDay = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Morning';
    if (hour < 17) return 'Afternoon';
    return 'Evening';
  };

  const renderAdminDashboard = () => (
    <View style={styles.statsGrid}>
      <StatusCard
        title="Total Enquiries"
        value={dashboardData?.totalEnquiries || '0'}
        icon={<Icon name="enquiry" size={20} color={colors.textWhite} />}
        color={colors.info}
      />
      <StatusCard
        title="Pending Enquiries"
        value={dashboardData?.pendingEnquiries || '0'}
        icon={<Icon name="warning" size={20} color={colors.textWhite} />}
        color={colors.warning}
      />
      <StatusCard
        title="Completed Enquiries"
        value={dashboardData?.completedEnquiries || '0'}
        icon={<Icon name="check" size={20} color={colors.textWhite} />}
        color={colors.success}
      />
      <StatusCard
        title="Total Clients"
        value={dashboardData?.totalClients || '0'}
        icon={<Icon name="account" size={20} color={colors.textWhite} />}
        color={colors.primary}
      />
      <StatusCard
        title="Revenue"
        value={formatCurrency(dashboardData?.revenue || 0)}
        icon={<Icon name="dashboard" size={20} color={colors.textWhite} />}
        color={colors.success}
      />
    </View>
  );

  const renderClientDashboard = () => (
    <View style={styles.statsGrid}>
      <StatusCard
        title="My Enquiries"
        value={dashboardData?.myEnquiries || '0'}
        icon={<Icon name="assignment" size={20} color={colors.textWhite} />}
        color={colors.info}
      />
      <StatusCard
        title="Pending Approvals"
        value={dashboardData?.pendingApprovals || '0'}
        icon={<Icon name="warning" size={20} color={colors.textWhite} />}
        color={colors.warning}
      />
      <StatusCard
        title="Completed Orders"
        value={dashboardData?.completedOrders || '0'}
        icon={<Icon name="check" size={20} color={colors.textWhite} />}
        color={colors.success}
      />
      <StatusCard
        title="Total Spent"
        value={formatCurrency(dashboardData?.totalSpent || 0)}
        icon={<Icon name="dashboard" size={20} color={colors.textWhite} />}
        color={colors.primary}
      />
    </View>
  );

  const renderDesignerDashboard = (role) => (
    <View style={styles.statsGrid}>
      <StatusCard
        title="Assigned Enquiries"
        value={dashboardData?.assignedEnquiries || '0'}
        icon={<Icon name="assignment" size={20} color={colors.textWhite} />}
        color={colors.info}
      />
      <StatusCard
        title="Completed Designs"
        value={dashboardData?.completedDesigns || '0'}
        icon={<Icon name="check" size={20} color={colors.textWhite} />}
        color={colors.success}
      />
      <StatusCard
        title="Pending Designs"
        value={dashboardData?.pendingDesigns || '0'}
        icon={<Icon name="warning" size={20} color={colors.textWhite} />}
        color={colors.warning}
      />
      <StatusCard
        title="Average Rating"
        value={dashboardData?.averageRating || '0.0'}
        icon={<Icon name="info" size={20} color={colors.textWhite} />}
        color={colors.primary}
      />
    </View>
  );

  const renderQuickActions = () => {
    const actions = [];

    if (user?.role === 'admin') {
      actions.push(
        {
          title: 'Metal Prices',
          icon: <Icon name="dashboard" size={20} color={colors.primary} />,
          onPress: () => navigation.navigate('MetalPrices'),
        },
        {
          title: 'Clients List',
          icon: <Icon name="account" size={20} color={colors.primary} />,
          onPress: () => navigation.navigate('ClientsList'),
        },
        {
          title: 'Font Test',
          icon: <Icon name="info" size={20} color={colors.primary} />,
          onPress: () => navigation.navigate('FontTest'),
        }
      );
    }

    if (user?.role === 'client') {
      actions.push({
        title: 'Add New Enquiry',
        icon: <Icon name="add" size={20} color={colors.primary} />,
        onPress: () => navigation.navigate('AddEnquiryStep1'),
      });
    }

    if (user?.role === 'coral' || user?.role === 'cad') {
      actions.push(
        {
          title: 'My Assignments',
          icon: <Icon name="assignment" size={20} color={colors.primary} />,
          onPress: () => navigation.navigate('EnquiryList'),
        },
        {
          title: 'Upload Design',
          icon: <Icon name="cloud-upload" size={20} color={colors.primary} />,
          onPress: () => navigation.navigate('UploadDesign'),
        }
      );
    }

    return (
      <Card style={styles.quickActionsCard}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { fontSize: fonts['2xl'], fontFamily: fonts.bold, color: colors.primary }]}>
            Quick Actions
          </Text>
          {/* <View style={styles.sectionAccent}></View> */}
        </View>
        <View style={styles.actionsGrid}>
          {actions.map((action, index) => (
            <TouchableOpacity
              key={index}
              style={styles.actionButton}
              onPress={action.onPress}>
              <View style={styles.actionIcon}>
                <Text style={{ fontSize: 20, color: colors.primary }}>{action.icon}</Text>
              </View>
              <Text style={[styles.actionText, { color: colors.textSecondary, fontSize: fonts.sm, fontFamily: fonts.regular }]}>
                {action.title}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Card>
    );
  };

  const renderBanner = () => (
    <View style={styles.bannerSection}>
      <View style={styles.bannerCard}>
        <View style={styles.bannerContent}>
          <View style={styles.bannerIcon}>
            <Icon name="info" size={20} color={colors.textWhite} />
          </View>
          <View style={styles.bannerText}>
            <Text style={styles.bannerTitle}>
              Welcome to Chandra Jewels!
            </Text>
            <Text style={styles.bannerSubtitle}>
              Your premium jewelry design platform
            </Text>
          </View>
        </View>
      </View>
    </View>
  );

  if (loading) {
    return <Loader />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <TopNavbar navigation={navigation} />
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }>
        
        {/* Enhanced Welcome Header */}
        <View style={styles.welcomeSection}>
          <View style={styles.welcomeCard}>
            <View style={styles.welcomeContent}>
              <View style={styles.welcomeText}>
                <Text style={styles.welcomeGreeting}>
                  Good {getTimeOfDay()}, {user?.name || 'User'}! 👋
                </Text>
                <Text style={styles.welcomeSubtitle}>
                  Welcome to Chandra Jewels Dashboard
                </Text>
                <View style={styles.roleBadge}>
                  <Icon name="account" size={14} color={colors.textWhite} />
                  <Text style={styles.roleText}>
                    {user?.role ? getRoleDisplayName(user.role) : 'User'}
                  </Text>
                </View>
              </View>
              <View style={styles.welcomeIcon}>
                <View style={styles.iconContainer}>
                  <Icon name="jewelry" size={28} color={colors.textWhite} />
                </View>
              </View>
            </View>
          </View>
        </View>

        {renderBanner()}

        {user?.role === 'admin' && renderAdminDashboard()}
        {user?.role === 'client' && renderClientDashboard()}
        {(user?.role === 'coral' || user?.role === 'cad') && renderDesignerDashboard(user.role)}

        {/* Enhanced Quick Actions */}
        <View style={styles.quickActionsSection}>
          {/* <Text style={styles.sectionTitle}>
            Quick Actions
          </Text> */}
          {renderQuickActions()}
        </View>

        {/* Enhanced Recent Activity */}
        <View style={styles.recentActivitySection}>
          <Text style={styles.sectionTitle}>
            Recent Activity
          </Text>
          <Card style={styles.recentActivityCard}>
            <View style={styles.activityItem}>
            <View style={styles.activityIcon}>
              <Icon name="enquiry" size={16} color={colors.primary} />
            </View>
            <Text style={[styles.activityText, { color: colors.textSecondary, fontSize: fonts.base, fontFamily: fonts.regular }]}>
              New enquiry received from John Smith
            </Text>
            <Text style={{ color: colors.textLight, fontSize: fonts.sm, fontFamily: fonts.regular }}>
              2 hours ago
            </Text>
          </View>
          <View style={styles.activityItem}>
            <View style={styles.activityIcon}>
              <Icon name="check" size={16} color={colors.success} />
            </View>
            <Text style={[styles.activityText, { color: colors.textSecondary, fontSize: fonts.base, fontFamily: fonts.regular }]}>
              Design approved for Diamond Ring
            </Text>
            <Text style={{ color: colors.textLight, fontSize: fonts.sm, fontFamily: fonts.regular }}>
              1 day ago
            </Text>
          </View>
          </Card>
        </View>
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
  
  // Enhanced Welcome Section
  welcomeSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  welcomeCard: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    padding: 24,
    shadowColor: colors.primary,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  welcomeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  welcomeText: {
    flex: 1,
  },
  welcomeGreeting: {
    fontSize: fonts['2xl'],
    fontFamily: fonts.bold,
    color: colors.textWhite,
    marginBottom: 4,
  },
  welcomeSubtitle: {
    fontSize: fonts.base,
    fontFamily: fonts.regular,
    color: colors.textWhite,
    opacity: 0.9,
    marginBottom: 12,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  roleText: {
    fontSize: fonts.sm,
    fontFamily: fonts.medium,
    color: colors.textWhite,
    marginLeft: 6,
  },
  welcomeIcon: {
    marginLeft: 16,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Enhanced Banner Section
  bannerSection: {
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  bannerCard: {
    backgroundColor: colors.accent,
    borderRadius: 16,
    padding: 20,
    shadowColor: colors.accent,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bannerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  bannerText: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: fonts.lg,
    fontFamily: fonts.bold,
    color: colors.textWhite,
    marginBottom: 4,
  },
  bannerSubtitle: {
    fontSize: fonts.sm,
    fontFamily: fonts.regular,
    color: colors.textWhite,
    opacity: 0.9,
  },

  // Enhanced Stats Grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    paddingVertical: 10,
    justifyContent: 'space-between',
  },

  // Enhanced Quick Actions Section
  quickActionsSection: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  sectionTitle: {
    fontSize: fonts['2xl'],
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    marginBottom: 16,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionButton: {
    alignItems: 'center',
    marginBottom: 20,
    width: '30%',
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.textWhite,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: colors.textPrimary,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  actionText: {
    fontSize: fonts.sm,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
    textAlign: 'center',
  },

  // Enhanced Recent Activity Section
  recentActivitySection: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  recentActivityCard: {
    borderRadius: 16,
    padding: 20,
    shadowColor: colors.textPrimary,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.backgroundSecondary,
  },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityText: {
    flex: 1,
    fontSize: fonts.base,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
  },
});

export default DashboardScreen;
