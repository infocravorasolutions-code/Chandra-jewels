import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Text,
  Image,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  const [actualImageUrl, setActualImageUrl] = useState(null);
  const [imageHeaders, setImageHeaders] = useState({});
  const [isLoadingImage, setIsLoadingImage] = useState(false);
  
  // Load auth token for image headers
  useEffect(() => {
    const loadAuthToken = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        if (token) {
          setImageHeaders({
            'Authorization': `Bearer ${token}`,
          });
        }
      } catch (error) {
        console.error('Error loading auth token:', error);
      }
    };
    loadAuthToken();
  }, []);
  
  // Extract actual image URL from Google redirect URLs
  useEffect(() => {
    if (!imageUrl) {
      setActualImageUrl(null);
      setIsLoadingImage(false);
      setImageError(false);
      return;
    }
    
    // Reset error state when URL changes
    setImageError(false);
    setIsLoadingImage(true);
    
    const processImageUrl = async () => {
      try {
        let urlToUse = imageUrl;
        
        // Check if it's a Google redirect URL
        if (imageUrl.includes('google.com/url') && imageUrl.includes('url=')) {
          const urlMatch = imageUrl.match(/url=([^&]+)/);
          if (urlMatch) {
            urlToUse = decodeURIComponent(urlMatch[1]);
            if (__DEV__) {
              console.log('🔍 Extracted URL from Google redirect:', urlToUse);
            }
          }
        }
        
        // Check if the URL is actually an image (has image extension)
        const isImageUrl = /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i.test(urlToUse) || 
                          urlToUse.includes('amazonaws.com') || 
                          urlToUse.includes('s3.') ||
                          urlToUse.includes('cloudinary.com') ||
                          urlToUse.includes('imgur.com');
        
        // Check if URL is an HTML page (not an image)
        const isHtmlPage = /\.(html|htm)(\?|$)/i.test(urlToUse) || 
                          urlToUse.includes('.html') ||
                          urlToUse.includes('.htm');
        
        // If it's an HTML page, don't try to load it as an image
        if (isHtmlPage && !isImageUrl) {
          if (__DEV__) {
            console.warn('⚠️ URL is an HTML page, not an image:', urlToUse);
          }
          setActualImageUrl(null);
          setIsLoadingImage(false);
          return;
        }
        
        // Check if URL is an API endpoint (needs auth)
        const isApiEndpoint = urlToUse.includes(FILE_BASE_URL) || urlToUse.includes('/api/');
        
        if (isApiEndpoint) {
          // Try to fetch and check if it returns JSON with image URL
          try {
            const token = await AsyncStorage.getItem('token');
            const response = await fetch(urlToUse, {
              headers: token ? { 'Authorization': `Bearer ${token}` } : {},
            });
            
            if (response.ok) {
              const contentType = response.headers.get('content-type') || '';
              
              // Check if response is JSON (API returns a URL object)
              if (contentType.includes('application/json')) {
                const jsonData = await response.json();
                const imageUrlFromJson = jsonData.url || jsonData.imageUrl || jsonData.src || jsonData.location;
                if (imageUrlFromJson) {
                  setActualImageUrl(imageUrlFromJson);
                  setIsLoadingImage(false);
                  return;
                }
              } else if (contentType.startsWith('image/')) {
                // Direct image response from API
                setActualImageUrl(urlToUse);
                setIsLoadingImage(false);
                return;
              } else if (contentType.includes('text/html')) {
                // API returned HTML, not an image
                if (__DEV__) {
                  console.warn('⚠️ API returned HTML instead of image:', urlToUse);
                }
                setActualImageUrl(null);
                setIsLoadingImage(false);
                return;
              }
            }
          } catch (fetchError) {
            if (__DEV__) {
              console.error('Error fetching image from API:', fetchError);
            }
          }
        }
        
        // Use URL directly only if it looks like an image URL
        if (isImageUrl || isApiEndpoint) {
          setActualImageUrl(urlToUse);
        } else {
          // Not a recognized image URL, show placeholder
          if (__DEV__) {
            console.warn('⚠️ URL does not appear to be an image:', urlToUse);
          }
          setActualImageUrl(null);
        }
        setIsLoadingImage(false);
      } catch (error) {
        console.error('Error processing image URL:', error);
        setActualImageUrl(null);
        setIsLoadingImage(false);
      }
    };
    
    processImageUrl();
  }, [imageUrl]);
  
  return (
    <TouchableOpacity
      style={styles.clientCard}
      onPress={onPress}
    >
      {actualImageUrl && !imageError ? (
        <Image
          source={{ 
            uri: actualImageUrl,
            headers: imageHeaders,
          }}
          style={styles.clientImage}
          resizeMode="contain"
          onError={(error) => {
            if (__DEV__) {
              console.error('❌ Client image failed to load:', {
                url: actualImageUrl,
                error: error.nativeEvent?.error || error,
              });
            }
            setImageError(true);
          }}
          onLoad={() => {
            if (__DEV__) {
              console.log('✅ Client image loaded successfully');
            }
            setIsLoadingImage(false);
          }}
        />
      ) : (
        <View style={styles.clientImagePlaceholder}>
          {isLoadingImage ? (
            <AnimatedLogoLoader size={20} />
          ) : (
            <Icon name="account" size={24} color={colors.textSecondary} />
          )}
        </View>
      )}
      <Text style={styles.clientCount}>{client.enquiryCount || 0}</Text>
    </TouchableOpacity>
  );
};

const DashboardScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const insets = useSafeAreaInsets();

  // Redux hooks for data fetching
  // Pass both role and userId to get user-specific counts
  const { 
    data: dashboardData, 
    isLoading: dashboardLoading, 
    refetch: refetchDashboard 
  } = useGetDashboardDataQuery(
    { 
      role: user?.role || 'client',
      userId: user?.id || user?._id || user?.userId,
    },
    {
      skip: !user,
      refetchOnFocus: true, // Refetch when screen comes into focus
      refetchOnMountOrArgChange: true, // Refetch when arguments change
    }
  );

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
          <TouchableOpacity 
            onPress={() => navigation.navigate('StatusStatistics')}
            style={styles.viewAllButton}
          >
            <Text style={styles.viewAllText}>View All</Text>
            <Icon name="keyboard-arrow-up" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>
        <View style={styles.enquiryStatusGrid}>
          {(() => {
            const allValue = dashboardData?.totalEnquiries || dashboardData?.categorizedCounts?.['All'] || '0';
            const pendingValue = dashboardData?.pendingEnquiries || dashboardData?.categorizedCounts?.['Pending'] || '0';
            const approvalPendingValue = dashboardData?.approvalPendingEnquiries || dashboardData?.categorizedCounts?.['Approval Pending'] || '0';
            const completedValue = dashboardData?.completedEnquiries || dashboardData?.categorizedCounts?.['Completed'] || '0';
            
            console.log('📊 [UI DEBUG] ============================================');
            console.log('📊 [UI DEBUG] DISPLAYING STATUS CARDS:');
            console.log('📊 [UI DEBUG] - All:', allValue, '(from totalEnquiries:', dashboardData?.totalEnquiries, '| categorizedCounts.All:', dashboardData?.categorizedCounts?.['All'], ')');
            console.log('📊 [UI DEBUG] - Pending:', pendingValue, '(from pendingEnquiries:', dashboardData?.pendingEnquiries, '| categorizedCounts.Pending:', dashboardData?.categorizedCounts?.['Pending'], ')');
            console.log('📊 [UI DEBUG] - Approval Pending:', approvalPendingValue, '(from approvalPendingEnquiries:', dashboardData?.approvalPendingEnquiries, '| categorizedCounts["Approval Pending"]:', dashboardData?.categorizedCounts?.['Approval Pending'], ')');
            console.log('📊 [UI DEBUG] - Completed:', completedValue, '(from completedEnquiries:', dashboardData?.completedEnquiries, '| categorizedCounts.Completed:', dashboardData?.categorizedCounts?.['Completed'], ')');
            console.log('📊 [UI DEBUG] - Full dashboardData:', JSON.stringify(dashboardData, null, 2));
            console.log('📊 [UI DEBUG] - Sum Check (Pending + Approval Pending + Completed):', Number(pendingValue) + Number(approvalPendingValue) + Number(completedValue));
            console.log('📊 [UI DEBUG] - Does sum match All?', (Number(pendingValue) + Number(approvalPendingValue) + Number(completedValue)) === Number(allValue));
            console.log('📊 [UI DEBUG] ============================================');
            
            return null;
          })()}
          <EnquiryStatusCard
            status="All"
            value={dashboardData?.totalEnquiries || dashboardData?.categorizedCounts?.['All'] || '0'}
            color="#D4A574"
            borderColor="#D4A574"
            style={styles.enquiryStatusItem}
            onPress={() => navigation.navigate('Enquiries')}
          />
          <EnquiryStatusCard
            status="Pending"
            value={dashboardData?.pendingEnquiries || dashboardData?.categorizedCounts?.['Pending'] || '0'}
            color="#F97316"
            borderColor="#F97316"
            style={styles.enquiryStatusItem}
            onPress={() => navigation.navigate('Enquiries', { filter: 'pending' })}
          />
          <EnquiryStatusCard
            status="Approval Pending"
            value={dashboardData?.approvalPendingEnquiries || dashboardData?.categorizedCounts?.['Approval Pending'] || '0'}
            color="#EF4444"
            borderColor="#EF4444"
            style={styles.enquiryStatusItem}
            onPress={() => navigation.navigate('Enquiries', { filter: 'approval_pending' })}
          />
          <EnquiryStatusCard
            status="Completed"
            value={dashboardData?.completedEnquiries || dashboardData?.categorizedCounts?.['Completed'] || '0'}
            color="#14B8A6"
            borderColor="#14B8A6"
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
                  // Check if it's a Google redirect URL - ClientCardWithImage will handle it
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
        value={dashboardData?.myEnquiries || dashboardData?.categorizedCounts?.['All'] || '0'}
        icon={<Icon name="assignment" size={20} color={colors.textWhite} />}
        color={colors.primary}
        onPress={() => navigation.navigate('Enquiries')}
      />
      <StatusCard
        title="Pending"
        value={dashboardData?.pendingApprovals || dashboardData?.categorizedCounts?.['Pending'] || '0'}
        icon={<Icon name="schedule" size={20} color={colors.textWhite} />}
        color={colors.warning}
        onPress={() => navigation.navigate('Enquiries', { filter: 'pending' })}
      />
      <StatusCard
        title="Approval Pending"
        value={dashboardData?.approvalPending || dashboardData?.categorizedCounts?.['Approval Pending'] || '0'}
        icon={<Icon name="pending-actions" size={20} color={colors.textWhite} />}
        color={colors.info || colors.primary}
        onPress={() => navigation.navigate('Enquiries', { filter: 'approval_pending' })}
      />
      <StatusCard
        title="Completed Orders"
        value={dashboardData?.completedOrders || dashboardData?.categorizedCounts?.['Completed'] || '0'}
        icon={<Icon name="check-circle" size={20} color={colors.textWhite} />}
        color={colors.success}
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
        value={dashboardData?.assignedEnquiries || dashboardData?.categorizedCounts?.['All'] || '0'}
        icon={<Icon name="work" size={20} color={colors.textWhite} />}
        color={colors.primary}
        onPress={() => navigation.navigate('Enquiries', { filter: 'assigned' })}
      />
      <StatusCard
        title="Pending Designs"
        value={dashboardData?.pendingDesigns || dashboardData?.categorizedCounts?.['Pending'] || '0'}
        icon={<Icon name="pending" size={20} color={colors.textWhite} />}
        color={colors.primaryDark}
        onPress={() => navigation.navigate('Enquiries', { filter: 'pending' })}
      />
      <StatusCard
        title="Approval Pending"
        value={dashboardData?.approvalPendingDesigns || dashboardData?.categorizedCounts?.['Approval Pending'] || '0'}
        icon={<Icon name="pending-actions" size={20} color={colors.textWhite} />}
        color={colors.primaryLight}
        onPress={() => navigation.navigate('Enquiries', { filter: 'approval_pending' })}
      />
      <StatusCard
        title="Completed Designs"
        value={dashboardData?.completedDesigns || dashboardData?.categorizedCounts?.['Completed'] || '0'}
        icon={<Icon name="palette" size={20} color={colors.textWhite} />}
        color={colors.primary}
        onPress={() => navigation.navigate('Enquiries', { filter: 'completed' })}
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

        {/* Quick Actions - Hidden for coral and CAD designers */}
        {(user?.role !== 'coral' && user?.role !== 'cad') && (
          <View style={styles.quickActionsSection}>
            {renderQuickActions()}
          </View>
        )}

        {/* Recent Activity */}
        <View style={styles.recentActivitySection}>
          {renderRecentActivity()}
        </View>
      </ScrollView>

      {/* Floating Action Button - Add New Enquiry */}
      {(user?.role === 'admin' || user?.role === 'client') && (
        <TouchableOpacity
          style={[styles.fab, { bottom: insets.bottom + 5 }]} // Position just above bottom tab bar (tab bar is 60px + 10px spacing)
          onPress={() => navigation.navigate('AddEnquiryStep1')}
          activeOpacity={0.8}
        >
          <Icon name="add-circle" size={28} color={colors.textWhite} />
        </TouchableOpacity>
      )}
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
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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
    justifyContent: 'space-between',
    marginTop: 4,
    gap: 6,
  },
  enquiryStatusItem: {
    flex: 1,
    marginBottom: 12,
    marginHorizontal: 1,
    minWidth: 0, // Allow flex items to shrink below their content size
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
    justifyContent: 'space-between',
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
    marginBottom: 12,
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
  // Floating Action Button
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});

export default DashboardScreen;