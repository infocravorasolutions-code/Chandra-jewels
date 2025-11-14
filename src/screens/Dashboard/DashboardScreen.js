import React, { useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Text,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useGetDashboardDataQuery, useGetClientsQuery, useGetEnquiriesQuery } from '../../store/api';
import { StatusCard, Card, EnquiryStatusCard } from '../../components/cards/Cards';
import { Button, SearchInput } from '../../components/common';
import { AnimatedLogoLoader } from '../../components/common';
import TopNavbar from '../../components/common/TopNavbar';
import Icon from '../../components/common/Icon';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import { formatCurrency, getRoleDisplayName, spacing, responsivePadding, imageSizes } from '../../utils';
import { FILE_BASE_URL } from '../../config/apiConfig';

// Client Card Component with Image Support
const ClientCardWithImage = ({ client, imageUrl, onPress }) => {
  const [imageError, setImageError] = useState(false);
  
  return (
    <TouchableOpacity
      style={styles.clientCard}
      onPress={onPress}
    >
      {imageUrl && !imageError ? (
        <Image
          source={{ uri: imageUrl }}
          style={styles.clientImage}
          resizeMode="contain"
          onError={() => setImageError(true)}
        />
      ) : (
        <View style={styles.clientImagePlaceholder}>
          <Icon name="account" size={24} color={colors.textSecondary} />
        </View>
      )}
      <Text style={styles.clientCount}>{client.enquiryCount || 0}</Text>
    </TouchableOpacity>
  );
};

const DashboardScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  // Redux hooks for data fetching
  const { 
    data: dashboardData, 
    isLoading: dashboardLoading, 
    refetch: refetchDashboard 
  } = useGetDashboardDataQuery(user?.role || 'client', {
    skip: !user,
  });

  const { 
    data: clientsData = [], 
    isLoading: clientsLoading, 
    refetch: refetchClients 
  } = useGetClientsQuery(undefined, {
    skip: !user || user?.role !== 'admin',
  });

  const { 
    data: enquiriesResponse, 
    isLoading: enquiriesLoading 
  } = useGetEnquiriesQuery(user?.role || 'admin', {
    skip: !user || user?.role !== 'admin',
  });

  // Extract enquiries array from response (new API returns { data, pagination })
  const enquiriesData = enquiriesResponse?.data || [];

  // Compute clients with enquiry counts
  const clients = useMemo(() => {
    if (user?.role !== 'admin' || !clientsData || clientsData.length === 0) {
      return [];
    }

    if (!enquiriesData || !Array.isArray(enquiriesData) || enquiriesData.length === 0) {
      return clientsData.map(client => ({
        ...client,
        enquiryCount: 0,
      }));
    }

    return clientsData.map(client => {
      const enquiryCount = enquiriesData.filter(
        enquiry => enquiry.clientId === client.id || enquiry.clientName === client.name
      ).length;
      
      return {
        ...client,
        enquiryCount: enquiryCount,
      };
    });
  }, [clientsData, enquiriesData, user?.role]);

  // Safety check - don't render if user is not loaded
  if (!user) {
    return <AnimatedLogoLoader size={60} />;
  }

  const loading = dashboardLoading || clientsLoading || enquiriesLoading;

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      refetchDashboard(),
      user?.role === 'admin' && refetchClients(),
    ]);
    setRefreshing(false);
  };

  const getTimeOfDay = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Morning';
    if (hour < 17) return 'Afternoon';
    return 'Evening';
  };

  const renderAdminDashboard = () => (
    <View style={styles.dashboardContent}>
      {/* Enquiries By Status Section */}
      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Status </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Enquiries')}>
            <Text style={styles.viewAllText}>View all</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.enquiryStatusGrid}>
          <EnquiryStatusCard
            status="PENDING"
            value={dashboardData?.pendingEnquiries || '0'}
            color={colors.warning}
            icon={<View style={[styles.simpleIcon, { backgroundColor: colors.warning }]} />}
            style={styles.enquiryStatusItem}
            onPress={() => navigation.navigate('Enquiries', { filter: 'pending' })}
          />
          <EnquiryStatusCard
            status="COMPLETED"
            value={dashboardData?.completedEnquiries || '0'}
            color={colors.success}
            icon={<View style={[styles.simpleIcon, { backgroundColor: colors.success }]} />}
            style={styles.enquiryStatusItem}
            onPress={() => navigation.navigate('Enquiries', { filter: 'completed' })}
          />
        </View>
      </View>

      {/* Clients Section */}
      {clients.length > 0 && (
        <View style={styles.clientsSection}>
          <View style={styles.clientsHeaderContainer}>
            <Text style={styles.clientsHeader}>Clients</Text>
            <TouchableOpacity onPress={() => navigation.navigate('ClientsList')}>
              <Text style={styles.viewAllText}>View all</Text>
            </TouchableOpacity>
          </View>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            style={styles.clientsScroll}
            contentContainerStyle={styles.clientsScrollContent}
          >
            {clients.map(client => {
              // Construct image URL
              const getClientImageUrl = () => {
                if (!client.imageUrl) return null;
                
                // If it's already a full URL, use it directly
                if (client.imageUrl.startsWith('http://') || client.imageUrl.startsWith('https://')) {
                  return client.imageUrl;
                }
                
                // If it starts with /, it's a path - construct full URL
                if (client.imageUrl.startsWith('/')) {
                  return `${FILE_BASE_URL}${client.imageUrl}`;
                }
                
                // Otherwise, treat as file key and construct URL
                return `${FILE_BASE_URL}/api/clients/files/${encodeURIComponent(client.imageUrl)}`;
              };
              
              const imageUrl = getClientImageUrl();
              
              return (
                <ClientCardWithImage
                  key={client.id}
                  client={client}
                  imageUrl={imageUrl}
                  onPress={() => navigation.navigate('Enquiries', { filterType: 'client', filter: client.name })}
                />
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Overview Section */}
      <View style={styles.overviewSection}>
        <Text style={styles.overviewTitle}> Overview</Text>
      </View>

      {/* Other Stats */}
      <View style={styles.statsGrid}>
        <StatusCard
          title="Total Enquiries"
          value={dashboardData?.totalEnquiries || '0'}
          icon={<Icon name="assignment" size={20} color={colors.textWhite} />}
          color={colors.primary}
          onPress={() => navigation.navigate('Enquiries')}
        />
        <StatusCard
          title="Total Clients"
          value={dashboardData?.totalClients || '0'}
          icon={<Icon name="people" size={20} color={colors.textWhite} />}
          color={colors.primary}
          onPress={() => navigation.navigate('ClientsList')}
        />
        <StatusCard
          title="Revenue"
          value={formatCurrency(dashboardData?.revenue || 0)}
          icon={<Icon name="attach-money" size={20} color={colors.textWhite} />}
          color={colors.primary}
          onPress={() => navigation.navigate('RevenueReport')}
        />
      </View>
    </View>
  );

  const renderClientDashboard = () => (
    <View style={styles.statsGrid}>
      <StatusCard
        title="My Enquiries"
        value={dashboardData?.myEnquiries || '0'}
        icon={<Icon name="assignment" size={20} color={colors.textWhite} />}
        color={colors.primary}
        onPress={() => navigation.navigate('Enquiries')}
      />
      <StatusCard
        title="Pending Approvals"
        value={dashboardData?.pendingApprovals || '0'}
        icon={<Icon name="schedule" size={20} color={colors.textWhite} />}
        color={colors.primary}
        onPress={() => navigation.navigate('Enquiries', { filter: 'pending' })}
      />
      <StatusCard
        title="Completed Orders"
        value={dashboardData?.completedOrders || '0'}
        icon={<Icon name="check-circle" size={20} color={colors.textWhite} />}
        color={colors.primary}
        onPress={() => navigation.navigate('Enquiries', { filter: 'completed' })}
      />
      <StatusCard
        title="Total Spent"
        value={formatCurrency(dashboardData?.totalSpent || 0)}
        icon={<Icon name="shopping-cart" size={20} color={colors.textWhite} />}
        color={colors.primary}
        onPress={() => navigation.navigate('OrderHistory')}
      />
    </View>
  );

  const renderDesignerDashboard = (role) => (
    <View style={styles.statsGrid}>
      <StatusCard
        title="Assigned Enquiries"
        value={dashboardData?.assignedEnquiries || '0'}
        icon={<Icon name="work" size={20} color={colors.textWhite} />}
        color={colors.primary}
        onPress={() => navigation.navigate('Enquiries', { filter: 'assigned' })}
      />
      <StatusCard
        title="Completed Designs"
        value={dashboardData?.completedDesigns || '0'}
        icon={<Icon name="palette" size={20} color={colors.textWhite} />}
        color={colors.primary}
        onPress={() => navigation.navigate('Enquiries', { filter: 'completed' })}
      />
      <StatusCard
        title="Pending Designs"
        value={dashboardData?.pendingDesigns || '0'}
        icon={<Icon name="pending" size={20} color={colors.textWhite} />}
        color={colors.primary}
        onPress={() => navigation.navigate('Enquiries', { filter: 'pending' })}
      />
      <StatusCard
        title="Average Rating"
        value={dashboardData?.averageRating || '0.0'}
        icon={<Icon name="star" size={20} color={colors.textWhite} />}
        color={colors.primary}
        onPress={() => navigation.navigate('DesignerProfile')}
      />
    </View>
  );

  const renderQuickActions = () => {
    const actions = [];

    if (user?.role === 'admin') {
      actions.push(
        {
          title: 'Add New Enquiry',
          icon: 'add-circle',
          onPress: () => navigation.navigate('AddEnquiryStep1'),
        },
        {
          title: 'Metal Prices',
          icon: 'trending-up',
          onPress: () => navigation.navigate('MetalPrices'),
        },
        {
          title: 'Clients List',
          icon: 'people',
          onPress: () => navigation.navigate('ClientsList'),
        }
      );
    }

    if (user?.role === 'client') {
      actions.push({
        title: 'Add New Enquiry',
        icon: 'add-circle',
        onPress: () => navigation.navigate('AddEnquiryStep1'),
      });
    }

    if (user?.role === 'coral' || user?.role === 'cad') {
      actions.push(
        {
          title: 'My Assignments',
          icon: 'work',
          onPress: () => navigation.navigate('EnquiryList'),
        },
        {
          title: 'Upload Design',
          icon: 'file-upload',
          onPress: () => navigation.navigate('UploadDesign'),
        }
      );
    }

    return (
      <Card style={styles.quickActionsCard}>
        <Text style={styles.quickActionsTitle}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          {actions.map((action, index) => (
            <TouchableOpacity
              key={index}
              style={styles.actionButton}
              onPress={action.onPress}
              activeOpacity={0.7}
            >
              <View style={styles.actionIcon}>
                <Icon name={action.icon} size={22} color={colors.primary} />
              </View>
              <Text style={styles.actionText}>{action.title}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Card>
    );
  };

  const renderRecentActivity = () => (
    <Card style={styles.recentActivityCard}>
      <Text style={styles.recentActivityTitle}>Recent Activity</Text>
      
      <View style={styles.activityItem}>
        <View style={styles.activityIcon}>
          <Icon name="assignment" size={16} color={colors.primary} />
        </View>
        <View style={styles.activityTextContainer}>
          <Text style={styles.activityText}>
            New enquiry received from John Smith
          </Text>
          <Text style={styles.activityTime}>2 hours ago</Text>
        </View>
      </View>

      <View style={styles.activityItem}>
        <View style={[styles.activityIcon, { backgroundColor: 'rgba(76, 175, 80, 0.1)' }]}>
          <Icon name="check-circle" size={16} color={colors.primary} />
        </View>
        <View style={styles.activityTextContainer}>
          <Text style={styles.activityText}>
            Design approved for Diamond Ring
          </Text>
          <Text style={styles.activityTime}>1 day ago</Text>
        </View>
      </View>

      <View style={styles.activityItem}>
        <View style={[styles.activityIcon]}>
          <Icon name="schedule" size={16} color={colors.primary} />
        </View>
        <View style={styles.activityTextContainer}>
          <Text style={styles.activityText}>
            Payment pending for Gold Necklace
          </Text>
          <Text style={styles.activityTime}>2 days ago</Text>
        </View>
      </View>
    </Card>
  );

  if (loading) {
    return <AnimatedLogoLoader size={80} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <TopNavbar navigation={navigation} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Enhanced Welcome Header */}
        <View style={styles.welcomeSection}>
          <View style={styles.welcomeCard}>
            <View style={styles.welcomeContent}>
              <View style={styles.welcomeText}>
                <Text style={styles.welcomeGreeting}>
                  Hii <Text style={styles.userNameHighlight}>{user?.name || 'User'}</Text>,
                </Text>
                <Text style={styles.welcomeSubtitle}>
                  Welcome to Chandra Jewels
                </Text>
              </View>
              <View style={styles.welcomeIconContainer}>
                <View style={styles.welcomeIcon}>
                  <Icon name="diamond" size={26} color={colors.textWhite} />
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Role-based Dashboard Content */}
        {user?.role === 'admin' && renderAdminDashboard()}
        {user?.role === 'client' && renderClientDashboard()}
        {(user?.role === 'coral' || user?.role === 'cad') && renderDesignerDashboard(user.role)}

        {/* Quick Actions */}
        <View style={styles.quickActionsSection}>
          {renderQuickActions()}
        </View>

        {/* Recent Activity */}
        <View style={styles.recentActivitySection}>
          {renderRecentActivity()}
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
  scrollContent: {
    paddingBottom: 20,
  },
  
  // Welcome Section - Premium Design
  welcomeSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  welcomeCard: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    padding: 20,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
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
    letterSpacing: 0.5,
  },
  userNameHighlight: {
    fontFamily: fonts.bold,
    fontStyle: 'italic',
  },
  welcomeSubtitle: {
    fontSize: fonts.sm,
    fontFamily: fonts.regular,
    color: colors.textWhite,
    opacity: 0.9,
    letterSpacing: 0.3,
  },
  welcomeIconContainer: {
    marginLeft: 12,
  },
  welcomeIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Dashboard Content
  dashboardContent: {
    paddingTop: 4,
  },
  
  // Section Container
  sectionContainer: {
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: fonts.lg,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    letterSpacing: 0.3,
  },
  viewAllText: {
    fontSize: fonts.sm,
    fontFamily: fonts.medium,
    color: colors.primary,
    letterSpacing: 0.2,
  },
  
  // Overview Section
  overviewSection: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
  },
  overviewTitle: {
    fontSize: fonts.lg,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    letterSpacing: 0.3,
  },
  
  // Enquiry Status Grid
  enquiryStatusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  enquiryStatusItem: {
    width: '48%',
    marginBottom: 12,
  },
  simpleIcon: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    justifyContent: 'space-between',
  },

  // Clients Section
  clientsSection: {
    marginBottom: 20,
    paddingLeft: 16,
  },
  clientsHeaderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingRight: 16,
  },
  clientsHeader: {
    fontSize: fonts.lg,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    letterSpacing: 0.3,
  },
  clientsScroll: {
    flexGrow: 0,
  },
  clientsScrollContent: {
    paddingRight: 16,
  },
  clientCard: {
    width: 95,
    height: 95,
    backgroundColor: colors.background,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  clientImage: {
    width: '100%',
    height: 60,
    marginBottom: 4,
    borderRadius: 8,
  },
  clientImagePlaceholder: {
    width: '100%',
    height: 60,
    marginBottom: 4,
    borderRadius: 8,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clientName: {
    fontSize: 11,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 6,
    lineHeight: 14,
  },
  clientCount: {
    fontSize: fonts['2xl'],
    fontFamily: fonts.bold,
    color: colors.primary,
    letterSpacing: 0.5,
  },

  // Quick Actions Section
  quickActionsSection: {
    paddingHorizontal: 16,
    paddingBottom: 8,
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
    // shadowColor: colors.shadow,
    // shadowOffset: { width: 0, height: 2 },
    // shadowOpacity: 0.05,
    // shadowRadius: 4,
    // elevation: 2,
  },
  actionIcon: {
    // width: 48,
    // height: 48,
    // borderRadius: 24,
    // backgroundColor: colors.backgroundSecondary,
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

  // Recent Activity Section
  recentActivitySection: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  recentActivityCard: {
    marginHorizontal: 0,
    marginVertical: 0,
    padding: 18,
  },
  recentActivityTitle: {
    fontSize: fonts.lg,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    marginBottom: 16,
    letterSpacing: 0.3,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.backgroundSecondary,
  },
  activityIcon: {
    // width: 38,
    // height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(33, 150, 243, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  activityTextContainer: {
    flex: 1,
    paddingTop: 2,
  },
  activityText: {
    fontSize: fonts.sm,
    fontFamily: fonts.regular,
    color: colors.textPrimary,
    lineHeight: 20,
    marginBottom: 4,
    letterSpacing: 0.1,
  },
  activityTime: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.textLight,
    lineHeight: 16,
    letterSpacing: 0.1,
  },
});

export default DashboardScreen;