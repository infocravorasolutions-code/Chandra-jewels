import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  Text,
  Platform,
  Modal,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useGetEnquiryByIdQuery, useDeleteEnquiryMutation, useApproveDesignVersionMutation, useRejectDesignVersionMutation } from '../../store/api';
import { useClients } from '../../features/clients/clientsHooks';
import { Card } from '../../components/cards/Cards';
import { Button, Input, EnquiryImage } from '../../components/common';
import { AnimatedLogoLoader } from '../../components/common';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import Icon from '../../components/common/Icon';
import { formatCurrency, formatDate, getStatusColor, getPriorityColor, imageSizes, spacing } from '../../utils';
import { EnquiryHistoryModal } from '../../components/modals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../../config/apiConfig';
import { useUsers } from '../../features/users/usersHooks';
import { getUserName } from '../../utils/userUtils';

const SingleEnquiryScreen = ({ route, navigation }) => {
  const { user } = useAuth();
  const { enquiry: initialEnquiry, enquiryId: routeEnquiryId, shouldRefresh } = route.params || {};
  
  
  // Log route params when screen loads or params change
  useEffect(() => {
    
  }, [route.params, initialEnquiry, routeEnquiryId, shouldRefresh]);
  
  // Fetch and cache users for name resolution
  useUsers();
  
  // Use route enquiryId or initialEnquiry id
  const enquiryId = routeEnquiryId || initialEnquiry?.id || initialEnquiry?._id;
  
  // Log enquiryId
  useEffect(() => {
    
  }, [enquiryId]);
  
  // Redux hooks
  const { 
    data: enquiryData, 
    isLoading: loading, 
    error: queryError,
    refetch 
  } = useGetEnquiryByIdQuery(enquiryId, {
    skip: !enquiryId,
  });
  

  // Watch for status changes and log them
  useEffect(() => {
    if (enquiryData && enquiryId) {
      const currentStatus = enquiryData?.status || enquiryData?.Status || enquiryData?._originalData?.Status;
      
    }
  }, [enquiryData, enquiryId]);
  
  // Log enquiryData changes - reduced logging to prevent performance issues
  useEffect(() => {
    
  }, [enquiryData?.id, enquiryData?.StoneType, enquiryData?.StyleNumber, enquiryData?.GatiOrderNumber, shouldRefresh]);

  const [deleteEnquiry, { isLoading: isDeleting }] = useDeleteEnquiryMutation();
  
  // Fetch clients for name lookup (using cached hook)
  const { clients: clientsData = [], isLoading: clientsLoading } = useClients({
    skip: false,
  });
  
  const clients = Array.isArray(clientsData) ? clientsData : [];
  
  // Create client ID to name lookup map - handle all possible ID formats
  const clientNameMap = useMemo(() => {
    const map = new Map();
    if (clients && clients.length > 0) {
      clients.forEach(client => {
        // Get ID from multiple possible fields
        const clientId = client.id || client._id || client.Id;
        const clientName = client.name || client.Name;
        
        if (clientId && clientName) {
          // Normalize ID to string and create multiple lookup keys
          const idStr = String(clientId).trim();
          
          // Store with original format
          map.set(idStr, clientName);
          
          // Remove spaces
          const noSpaces = idStr.replace(/\s/g, '');
          map.set(noSpaces, clientName);
          
          // Handle MongoDB ObjectId format variations
          const cleanId = idStr.replace(/^ObjectId\(/, '').replace(/\)$/, '').trim();
          if (cleanId !== idStr) {
            map.set(cleanId, clientName);
            map.set(cleanId.replace(/\s/g, ''), clientName);
          }
          
          // Also try lowercase version (in case of case sensitivity issues)
          map.set(idStr.toLowerCase(), clientName);
          map.set(noSpaces.toLowerCase(), clientName);
        }
      });
      
    } else {
      
    }
    return map;
  }, [clients]);
  
  // Helper to get client name from ID - try multiple matching strategies
  const getClientName = (clientId) => {
    if (!clientId) {
      
      return 'Unknown Client';
    }
    
    const idStr = String(clientId).trim();
    
    // Try exact match first
    if (clientNameMap.has(idStr)) {
      
      return clientNameMap.get(idStr);
    }
    
    // Try without spaces
    const noSpaces = idStr.replace(/\s/g, '');
    if (clientNameMap.has(noSpaces)) {
      return clientNameMap.get(noSpaces);
    }
    
    // Try cleaned ObjectId format
    const cleanId = idStr.replace(/^ObjectId\(/, '').replace(/\)$/, '').trim();
    if (cleanId !== idStr && clientNameMap.has(cleanId)) {
      return clientNameMap.get(cleanId);
    }
    
    const cleanNoSpaces = cleanId.replace(/\s/g, '');
    if (clientNameMap.has(cleanNoSpaces)) {
      return clientNameMap.get(cleanNoSpaces);
    }
    
    // Try lowercase
    if (clientNameMap.has(idStr.toLowerCase())) {
      return clientNameMap.get(idStr.toLowerCase());
    }
    
    // Fallback: Direct search in clients array (more flexible matching)
    if (clients && clients.length > 0) {
      const foundClient = clients.find(c => {
        const cId = String(c.id || c._id || c.Id || '').trim();
        const cIdNoSpaces = cId.replace(/\s/g, '');
        const enquiryIdNoSpaces = idStr.replace(/\s/g, '');
        
        return cId === idStr || 
               cIdNoSpaces === enquiryIdNoSpaces ||
               cId.toLowerCase() === idStr.toLowerCase() ||
               cIdNoSpaces.toLowerCase() === enquiryIdNoSpaces.toLowerCase();
      });
      
      if (foundClient) {
        const name = foundClient.name || foundClient.Name;
        if (name && name !== 'Unknown Client') {
          
          return name;
        }
      }
    }
    
    // Removed console.warn from render - it causes performance issues
    // Logging moved to useEffect to avoid blocking render
    
    return 'Unknown Client';
  };
  
  // Local UI state
  const [approvalMessage, setApprovalMessage] = useState('');
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showVersionSelector, setShowVersionSelector] = useState(false);
  const [selectedDesignType, setSelectedDesignType] = useState(null); // 'coral' or 'cad'
  const [selectedVersionIndex, setSelectedVersionIndex] = useState(null);
  const [selectedImageUri, setSelectedImageUri] = useState(null);
  const [isImageModalVisible, setImageModalVisible] = useState(false);
  
  const handleImagePress = (uri) => {
    if (!uri) {
      return;
    }
    setSelectedImageUri(uri);
    setImageModalVisible(true);
  };

  const closeImageModal = () => {
    setImageModalVisible(false);
    setSelectedImageUri(null);
  };
  
  // API mutations
  const [approveDesignVersion, { isLoading: isApproving }] = useApproveDesignVersionMutation();
  const [rejectDesignVersion, { isLoading: isRejecting }] = useRejectDesignVersionMutation();

  // Use enquiry from query if available, otherwise use initialEnquiry
  const enquiry = enquiryData || initialEnquiry || {};
  
  // Log which enquiry source is being used
  useEffect(() => {
  }, [enquiryData, initialEnquiry, enquiry]);
  
  // Get original data for accessing raw API fields
  const originalData = enquiry?._originalData || enquiry;
  
  // Log originalData for debugging - Enhanced to show all fields
  useEffect(() => {
  }, [enquiry, originalData]);
  
  // Debug: Log enquiry structure to understand data format
  useEffect(() => {
  }, [enquiry]);
  
  // Get priority from API (Priority field) - use original value, not normalized
  // Check _originalData first to get the full priority value (e.g., "Super High" not "high")
  const priority = originalData?.Priority || enquiry?.Priority || enquiry?.priority || 'Normal';
  
  // Get status from API - use original value, not normalized
  // Priority order:
  // 1. Extract from StatusHistory (latest status entry) - most accurate source
  // 2. CurrentStatus from originalData (if API provides it)
  // 3. Status from originalData (direct Status field)
  // 4. Fallback to normalized status fields
  // This ensures we display the full status like "Design Approval Pending" instead of just "pending"
  let status = null;
  
  // First, try to get status from StatusHistory (most accurate source)
  const statusHistory = originalData?.StatusHistory || enquiry?.StatusHistory || [];
  if (Array.isArray(statusHistory) && statusHistory.length > 0) {
    // Sort by timestamp (newest first) and get the latest status
    const sortedHistory = [...statusHistory].sort((a, b) => {
      const dateA = new Date(a.Timestamp || a.timestamp || 0);
      const dateB = new Date(b.Timestamp || b.timestamp || 0);
      return dateB - dateA;
    });
    const latestStatus = sortedHistory[0];
    status = latestStatus?.Status || latestStatus?.status || null;
  }
  
  // If not found in StatusHistory, check other fields
  if (!status) {
    status = originalData?.CurrentStatus || 
             originalData?.Status || 
             enquiry?.CurrentStatus ||
             enquiry?.Status;
  }
  
  // Final fallback to normalized status
  if (!status) {
    status = enquiry?.status || 'pending';
  }
  
  // Get client name from ClientId - prioritize already resolved name, then lookup
  const clientId = originalData?.ClientId || enquiry?.ClientId || enquiry?.clientId;
  
  // First check if enquiry already has a valid client name (not "Unknown Client")
  let clientName = enquiry?.clientName || enquiry?.client;
  if (!clientName || clientName === 'Unknown Client') {
    // Only lookup if clients are loaded and we have a ClientId
    if (!clientsLoading && clientId && clients.length > 0) {
      clientName = getClientName(clientId);
    } else if (clientId && (clientsLoading || clients.length === 0)) {
      // If clients are still loading, keep "Unknown Client" for now
      // It will update when clients finish loading due to useMemo dependency
      clientName = 'Unknown Client';
    } else {
      clientName = 'Unknown Client';
    }
  }
  
  // Debug logging for client name resolution - moved to useEffect to avoid blocking render
  useEffect(() => {
  }, [clientId, clientName, clientsLoading, clients.length, clientNameMap]);
  
  // Get dates - check multiple possible fields
  const createdAt = enquiry?.createdAt || originalData?.createdAt || new Date().toISOString();
  const updatedAt = enquiry?.updatedAt || originalData?.updatedAt || enquiry?.createdAt || createdAt;

  // Use ref to track last shouldRefresh value to prevent duplicate refetches
  const lastShouldRefreshRef = React.useRef(shouldRefresh);
  
  // Refresh enquiry data when screen comes into focus (if needed)
  useFocusEffect(
    React.useCallback(() => {
      // Always refetch when screen comes into focus to get latest updates
      // This ensures client sees status changes made by admin AND fields added during editing
      if (enquiryId && refetch) {
        
        // Use a small delay to ensure navigation is complete
        const timeoutId = setTimeout(() => {
          refetch()
            .then((result) => {
              if (__DEV__) {
                const data = result?.data;
              }
            })
            .catch((error) => {
              
            });
        }, 100);
        
        return () => clearTimeout(timeoutId);
      } else {
        // Update ref even if not refetching
        lastShouldRefreshRef.current = shouldRefresh;
      }
    }, [shouldRefresh, enquiryId, refetch])
  );

  // Handle error state
  const error = queryError ? (queryError.data?.error || queryError.message || 'Failed to load enquiry') : null;

  // Show loading state
  if (loading) {
    return (
      <View style={styles.container}>
        <AnimatedLogoLoader size={80} />
      </View>
    );
  }

  // Safety check - don't render if enquiry is not available
  if (error || !enquiry || !enquiry.id) {
    return (
      <View style={styles.container}>
        <Text style={[styles.errorText, { color: colors.textPrimary, fontSize: fonts.lg }]}>
          {error || 'Enquiry not found'}
        </Text>
        <Button
          title="Go Back"
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        />
      </View>
    );
  }

  const handleApprove = () => {
    
    
    // Get available design versions
    const originalData = enquiry?._originalData || enquiry;
    const coralVersions = originalData?.Coral || enquiry?.Coral || [];
    const cadVersions = originalData?.Cad || enquiry?.Cad || [];
    
    
    
    // Determine which design type and version to approve
    // Priority: Latest coral version, or latest cad version if no coral
    let designType = 'coral';
    let versionIndex = coralVersions.length > 0 ? coralVersions.length - 1 : (cadVersions.length > 0 ? cadVersions.length - 1 : null);
    
    if (coralVersions.length === 0 && cadVersions.length > 0) {
      designType = 'cad';
    }
    
    if (versionIndex === null) {
      
      Alert.alert('Error', 'No design versions available to approve');
      return;
    }
    
    const version = designType === 'coral' 
      ? (coralVersions[versionIndex]?.Version || `Version ${versionIndex + 1}`)
      : (cadVersions[versionIndex]?.Version || `Version ${versionIndex + 1}`);
    
    
    
    Alert.alert(
      'Approve Design Version',
      `Are you sure you want to approve ${designType.toUpperCase()} ${version}?`,
      [
        { 
          text: 'Cancel', 
          style: 'cancel',
          onPress: () => {
            
          }
        },
        {
          text: 'Approve',
          onPress: async () => {
            
            
            try {
              const enquiryId = enquiry.id || enquiry._id;
              
              
              
              const result = await approveDesignVersion({
                enquiryId,
                designType,
                version,
              }).unwrap();
              
              
              
              Alert.alert('Success', `${designType.toUpperCase()} ${version} approved successfully`);
              // Refetch enquiry data to get updated approval status
              refetch();
            } catch (error) {
              
              Alert.alert(
                'Error',
                error?.data?.error || error?.message || 'Failed to approve design version. Please try again.'
              );
            }
          },
        },
      ]
    );
  };

  const handleReject = () => {
    // Get available design versions
    const originalData = enquiry?._originalData || enquiry;
    const coralVersions = originalData?.Coral || enquiry?.Coral || [];
    const cadVersions = originalData?.Cad || enquiry?.Cad || [];
    
    // Determine which design type and version to reject
    let designType = 'coral';
    let versionIndex = coralVersions.length > 0 ? coralVersions.length - 1 : (cadVersions.length > 0 ? cadVersions.length - 1 : null);
    
    if (coralVersions.length === 0 && cadVersions.length > 0) {
      designType = 'cad';
    }
    
    if (versionIndex === null) {
      Alert.alert('Error', 'No design versions available to reject');
      return;
    }
    
    // Store design type and version for rejection
    setSelectedDesignType(designType);
    setSelectedVersionIndex(versionIndex);
    setShowApprovalModal(true);
  };

  const confirmReject = async () => {
    if (!approvalMessage.trim()) {
      Alert.alert('Error', 'Please provide a reason for rejection');
      return;
    }

    if (!selectedDesignType || selectedVersionIndex === null) {
      Alert.alert('Error', 'Design version information is missing');
      return;
    }

    try {
      const originalData = enquiry?._originalData || enquiry;
      const versions = selectedDesignType === 'coral'
        ? (originalData?.Coral || enquiry?.Coral || [])
        : (originalData?.Cad || enquiry?.Cad || []);
      
      if (selectedVersionIndex >= versions.length) {
        Alert.alert('Error', 'Selected version not found');
        return;
      }
      
      const version = versions[selectedVersionIndex]?.Version || `Version ${selectedVersionIndex + 1}`;
      const enquiryId = enquiry.id || enquiry._id;
      
      await rejectDesignVersion({
        enquiryId,
        designType: selectedDesignType,
        version,
        reason: approvalMessage.trim(),
      }).unwrap();
      
      Alert.alert('Success', `${selectedDesignType.toUpperCase()} ${version} rejected successfully`);
      
      // Reset state
      setShowApprovalModal(false);
      setApprovalMessage('');
      setSelectedDesignType(null);
      setSelectedVersionIndex(null);
      
      // Refetch enquiry data to get updated rejection status
      refetch();
    } catch (error) {
      Alert.alert(
        'Error',
        error?.data?.error || error?.message || 'Failed to reject design version. Please try again.'
      );
    }
  };

  const handleUploadCoral = () => {
    navigation.navigate('UploadDesign', {
      designType: 'coral',
      enquiry: enquiry,
    });
  };

  const handleUploadCAD = () => {
    navigation.navigate('UploadDesign', {
      designType: 'cad',
      enquiry: enquiry,
    });
  };

  const renderDetailItem = (icon, label, value, showIfEmpty = false) => {
    // Check if value exists (not null, undefined, or empty string after trim)
    const hasValue = value !== null && value !== undefined && String(value).trim() !== '';
    
    // Only render if value exists OR showIfEmpty is true
    if (!hasValue && !showIfEmpty) return null;
    
    return (
      <View style={styles.detailRow}>
        <Icon name={icon} size={16} color={colors.primary} />
        <View style={styles.detailTextContainer}>
          <Text style={[styles.detailLabel, { color: colors.textSecondary, fontSize: 11 }]}>
            {label}
          </Text>
          <Text style={[styles.detailText, { color: colors.textPrimary, fontSize: 13 }]}>
            {hasValue ? value : 'N/A'}
          </Text>
        </View>
      </View>
    );
  };

  const renderEnquiryDetails = () => {
    
    // Extract metal details - check ALL possible locations (originalData, enquiry normalized, enquiry raw)
    const metal = originalData?.Metal || enquiry?.Metal || enquiry?.metal || {};
    const metalColor = metal.Color || metal.color || null;
    const metalQuality = metal.Quality || metal.quality || null;
    
    // Extract weights - check ALL possible locations with comprehensive fallback
    const metalWeight = originalData?.MetalWeight || 
                       enquiry?.MetalWeight || 
                       enquiry?.metalWeight || 
                       originalData?.metalWeight ||
                       {};
    const diamondWeight = originalData?.DiamondWeight || 
                         enquiry?.DiamondWeight || 
                         enquiry?.diamondWeight || 
                         originalData?.diamondWeight ||
                         {};
    
    // Extract other fields - comprehensive fallback chain
    const styleNumber = originalData?.StyleNumber || 
                       enquiry?.StyleNumber || 
                       enquiry?.styleNumber ||
                       originalData?.styleNumber ||
                       null;
    // Extract Gati Order Number - check ALL possible locations and variations
    const gatiOrderNumber = originalData?.GatiOrderNumber || 
                            originalData?.gatiOrderNumber ||
                            originalData?.Gati_Order_Number ||
                            originalData?.gati_order_number ||
                            enquiry?._originalData?.GatiOrderNumber ||
                            enquiry?._originalData?.gatiOrderNumber ||
                            enquiry?.GatiOrderNumber || 
                            enquiry?.gatiOrderNumber ||
                            enquiry?.Gati_Order_Number ||
                            enquiry?.gati_order_number ||
                            null;
    
    const stamping = originalData?.Stamping || 
                     enquiry?.Stamping || 
                     enquiry?.stamping ||
                     originalData?.stamping ||
                     null;
    const category = originalData?.Category || 
                     enquiry?.Category || 
                     enquiry?.category ||
                     originalData?.category ||
                     null;
    const stoneType = originalData?.StoneType || 
                      enquiry?.StoneType || 
                      enquiry?.stoneType ||
                      originalData?.stoneType ||
                      null;
    const quantity = originalData?.Quantity || 
                     enquiry?.Quantity || 
                     enquiry?.quantity ||
                     originalData?.quantity ||
                     null;
    const priority = originalData?.Priority || 
                     enquiry?.Priority || 
                     enquiry?.priority ||
                     originalData?.priority ||
                     null;
    const shippingDate = originalData?.ShippingDate || 
                         enquiry?.ShippingDate || 
                         enquiry?.deadline ||
                         originalData?.deadline ||
                         null;
    
    // Format metal weight - only return value if exists, otherwise null (so field won't display)
    let metalWeightText = null;
    if (metalWeight.Exact || metalWeight.exact) {
      metalWeightText = `Exact: ${metalWeight.Exact || metalWeight.exact} gms`;
    } else if (metalWeight.From || metalWeight.from) {
      const from = metalWeight.From || metalWeight.from || '';
      const to = metalWeight.To || metalWeight.to || '';
      if (from) {
        metalWeightText = `From: ${from}${to ? ` To: ${to}` : ''} gms`;
      }
    }
    
    // Format diamond weight - only return value if exists, otherwise null (so field won't display)
    let diamondWeightText = null;
    if (diamondWeight.Exact || diamondWeight.exact) {
      diamondWeightText = `Exact: ${diamondWeight.Exact || diamondWeight.exact} ct`;
    } else if (diamondWeight.From || diamondWeight.from) {
      const from = diamondWeight.From || diamondWeight.from || '';
      const to = diamondWeight.To || diamondWeight.to || '';
      if (from) {
        diamondWeightText = `From: ${from}${to ? ` To: ${to}` : ''} ct`;
      }
    }

    return (
      <>
        {/* Basic Information Card */}
        <Card style={styles.detailsCard}>
          <View style={styles.detailsHeader}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 8 }}>
              {originalData?.Name || enquiry?.Name || enquiry?.title || 'Untitled Enquiry'}
            </Text>
            <View style={styles.statusContainer}>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(status) }]}>
                <Text 
                  style={{ color: colors.textWhite, fontSize: fonts.sm, textAlign: 'center' }}
                  numberOfLines={2}
                  adjustsFontSizeToFit={false}
                >
                  {status.toUpperCase()}
                </Text>
              </View>
              <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(priority) }]}>
                <Text 
                  style={{ color: colors.textWhite, fontSize: fonts.sm }}
                  numberOfLines={1}
                  adjustsFontSizeToFit={true}
                  minimumFontScale={0.8}
                >
                  {priority.toUpperCase()}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.detailsGrid}>
            {renderDetailItem('person', 'Client', clientName)}
            {renderDetailItem('schedule', 'Created', formatDate(createdAt))}
            {renderDetailItem('update', 'Last Updated', formatDate(updatedAt))}
            {renderDetailItem('flag', 'Priority', priority)}
            {renderDetailItem('calendar-today', 'Shipping Date', shippingDate ? formatDate(shippingDate) : null)}
            {/* Budget field removed - not in API response */}
          </View>
        </Card>

        {/* Description Card - Always show */}
        <Card style={styles.detailsCard}>
          <Text style={[styles.sectionTitle, { fontSize: 16, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 12 }]}>
            Description
          </Text>
          <Text style={[styles.descriptionText, { color: colors.textSecondary, fontSize: 13, lineHeight: 20 }]}>
            {originalData?.Remarks || enquiry?.Remarks || enquiry?.description || 'No description available'}
          </Text>
        </Card>

        {/* Product Details Card */}
        <Card style={styles.detailsCard}>
          <Text style={[styles.sectionTitle, { fontSize: 16, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 12 }]}>
            Product Details
          </Text>
          <View style={styles.detailsGrid}>
            {renderDetailItem('category', 'Category', category)}
            {renderDetailItem('inventory', 'Quantity', quantity ? `${quantity}` : null)}
            {renderDetailItem('grain', 'Stone Type', stoneType)}
            {renderDetailItem('label', 'Style Number', styleNumber)}
            {renderDetailItem('receipt', 'Gati Order Number', gatiOrderNumber, true)}
          </View>
        </Card>

        {/* Metal Details Card */}
        <Card style={styles.detailsCard}>
          <Text style={[styles.sectionTitle, { fontSize: 16, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 12 }]}>
            Metal Details
          </Text>
          <View style={styles.detailsGrid}>
            {renderDetailItem('palette', 'Metal Color', metalColor)}
            {renderDetailItem('verified', 'Metal Quality', metalQuality)}
            {renderDetailItem('scale', 'Metal Weight', metalWeightText)}
            {renderDetailItem('grain', 'Diamond Weight', diamondWeightText)}
            {renderDetailItem('label', 'Stamping', stamping)}
          </View>
        </Card>

        {/* Assignment & Codes Card (for admin/viewing) */}
        {(enquiry?.AssignedTo || enquiry?.CoralCode || enquiry?.CadCode) && (
          <Card style={styles.detailsCard}>
            <Text style={[styles.sectionTitle, { fontSize: 16, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 12 }]}>
              Assignment & Codes
            </Text>
            <View style={styles.detailsGrid}>
            {renderDetailItem('person', 'Assigned To', getUserName(enquiry?.AssignedTo))}
            {renderDetailItem('description', 'Coral Code', enquiry?.CoralCode || enquiry?.coralVersion)}
            {renderDetailItem('description', 'CAD Code', enquiry?.CadCode || enquiry?.cadVersion)}
            </View>
          </Card>
        )}
      </>
    );
  };

  // Component to render image with fetch authentication (same approach as DesignViewerScreen)
  const ImageWithFallback = ({ image, imageKey, imageId, imageUri, index }) => {
    const [imageDataUri, setImageDataUri] = useState(null);
    const [imageLoading, setImageLoading] = useState(false);
    const [imageError, setImageError] = useState(false);
    
    // Fetch image with authentication
    const fetchImageWithAuth = async (imageUrl) => {
      if (!imageUrl) {
        
        return;
      }
      
      // Don't fetch if we already have the data URI
      if (imageDataUri) {
        
        return;
      }
      
      try {
        setImageLoading(true);
        setImageError(false);
        
        const token = await AsyncStorage.getItem('token');
        if (!token) {
          setImageError(true);
          setImageLoading(false);
          return;
        }

        
        const response = await fetch(imageUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const contentType = response.headers.get('content-type') || '';
          
          // Check if response is JSON (API returns a URL object)
          if (contentType.includes('application/json')) {
            const jsonData = await response.json();
            
            // Extract the actual image URL from JSON
            const actualImageUrl = jsonData.url || jsonData.imageUrl || jsonData.src || jsonData.location;
            
            if (!actualImageUrl) {
              setImageError(true);
              setImageLoading(false);
              return;
            }
            
            
            // Fetch the actual image from the URL (likely S3)
            const imageResponse = await fetch(actualImageUrl, {
              method: 'GET',
              headers: actualImageUrl.includes('amazonaws.com') ? {} : {
                'Authorization': `Bearer ${token}`,
              },
            });
            
            if (!imageResponse.ok) {
              setImageError(true);
              setImageLoading(false);
              return;
            }
            
            const arrayBuffer = await imageResponse.arrayBuffer();
            
            // Convert arrayBuffer to base64
            const bytes = new Uint8Array(arrayBuffer);
            let binary = '';
            const chunkSize = 8192;
            
            for (let i = 0; i < bytes.length; i += chunkSize) {
              const chunk = bytes.subarray(i, i + chunkSize);
              binary += String.fromCharCode.apply(null, chunk);
            }
            
            let base64;
            try {
              base64 = btoa(binary);
            } catch (e) {
              if (typeof Buffer !== 'undefined') {
                base64 = Buffer.from(binary, 'binary').toString('base64');
              } else {
                throw new Error('Unable to convert to base64');
              }
            }
            
            const imageContentType = imageResponse.headers.get('content-type') || 'image/jpeg';
            const dataUri = `data:${imageContentType};base64,${base64}`;
            
            setImageDataUri(dataUri);
            setImageLoading(false);
            setImageError(false);
          } else {
            // Direct image response
            
            const arrayBuffer = await response.arrayBuffer();
            const bytes = new Uint8Array(arrayBuffer);
            let binary = '';
            const chunkSize = 8192;
            
            for (let i = 0; i < bytes.length; i += chunkSize) {
              const chunk = bytes.subarray(i, i + chunkSize);
              binary += String.fromCharCode.apply(null, chunk);
            }
            
            let base64;
            try {
              base64 = btoa(binary);
            } catch (e) {
              if (typeof Buffer !== 'undefined') {
                base64 = Buffer.from(binary, 'binary').toString('base64');
              } else {
                throw new Error('Unable to convert to base64');
              }
            }
            
            const imageContentType = contentType || 'image/jpeg';
            const dataUri = `data:${imageContentType};base64,${base64}`;
            
            setImageDataUri(dataUri);
            setImageLoading(false);
            setImageError(false);
          }
        } else {
          setImageError(true);
          setImageLoading(false);
        }
      } catch (error) {
        setImageError(true);
        setImageLoading(false);
      }
    };
    
    useEffect(() => {
      // Reset state when image props change
      setImageDataUri(null);
      setImageLoading(false);
      setImageError(false);
      
      // Generate image URL - prioritize full URL, then key, then ID
      let imageUrl = null;
      
      if (imageUri && (imageUri.startsWith('http') || imageUri.startsWith('https'))) {
        // Full URL provided - use it directly
        imageUrl = imageUri;
        
      } else if (imageKey) {
        const encodedKey = encodeURIComponent(imageKey);
        imageUrl = `${API_BASE_URL}/api/enquiries/files/${encodedKey}`;
        
      } else if (imageId) {
        imageUrl = `${API_BASE_URL}/api/enquiries/files/${imageId}`;
        
      }
      
      if (imageUrl) {
        // Check if it's an S3 URL (public, no auth needed) - try direct load first
        if (imageUrl.includes('amazonaws.com') || imageUrl.includes('s3.')) {
          
          // Try direct Image component load first for S3 (no auth needed)
          // If that fails, fall back to fetch
          setImageLoading(true);
          // For S3 URLs, we'll still use fetch to convert to data URI for consistency
          fetchImageWithAuth(imageUrl);
        } else {
          // Use fetch directly on both platforms for consistency and authentication
          fetchImageWithAuth(imageUrl);
        }
      } else {
        setImageError(true);
      }
    }, [imageKey, imageId, imageUri, index]);
    
    if (imageError) {
      return (
        <View style={styles.imageContainer}>
          <View style={styles.imagePlaceholder}>
            <Icon name="image" size={24} color={colors.textSecondary} />
          </View>
        </View>
      );
    }
    
    if (imageLoading || !imageDataUri) {
      return (
        <View style={styles.imageContainer}>
          <View style={styles.imagePlaceholder}>
            <Icon name="image" size={24} color={colors.textSecondary} />
          </View>
        </View>
      );
    }
    
    return (
      <TouchableOpacity
        style={styles.imageContainer}
        activeOpacity={0.9}
        onPress={() => handleImagePress(imageDataUri)}
      >
        <EnquiryImage
          source={{ uri: imageDataUri }}
          onError={() => {
            setImageError(true);
          }}
          onLoad={() => {
          }}
        />
      </TouchableOpacity>
    );
  };

  const renderImages = () => {
    // Safety check for images array - prioritize enquiry.images since it's the normalized data
    // Check multiple possible locations for images, but prioritize arrays with actual content
    let images = [];
    
    // Check enquiry.images first (normalized data from API)
    if (enquiry?.images && Array.isArray(enquiry.images) && enquiry.images.length > 0) {
      images = enquiry.images;
    } else if (enquiry?.ReferenceImages && Array.isArray(enquiry.ReferenceImages) && enquiry.ReferenceImages.length > 0) {
      images = enquiry.ReferenceImages;
    } else if (enquiry?.Images && Array.isArray(enquiry.Images) && enquiry.Images.length > 0) {
      images = enquiry.Images;
    } else if (originalData?.ReferenceImages && Array.isArray(originalData.ReferenceImages) && originalData.ReferenceImages.length > 0) {
      images = originalData.ReferenceImages;
    } else if (originalData?.Images && Array.isArray(originalData.Images) && originalData.Images.length > 0) {
      images = originalData.Images;
    }
    
    // Removed excessive logging from render - causes performance issues
    
    if (!Array.isArray(images) || images.length === 0) {
      return (
        <Card style={styles.imagesCard}>
          <Text style={[styles.sectionTitle, { fontSize: 16, fontWeight: 'bold', color: colors.textPrimary }]}>
            Reference Images
          </Text>
          <View style={styles.noImagesContainer}>
            <Icon name="photo-library" size={40} color={colors.primary} />
            <Text style={[styles.noImagesText, { color: colors.textSecondary, fontSize: fonts.base }]}>
              No reference images available
            </Text>
          </View>
        </Card>
      );
    }

    return (
      <Card style={styles.imagesCard}>
        <Text style={[styles.sectionTitle, { fontSize: 16, fontWeight: 'bold', color: colors.textPrimary }]}>
          Reference Images
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {images.map((image, index) => {
            // Handle image - could be a string URL, image object with Key/Id, or need to construct URL
            let imageKey = null;
            let imageId = null;
            let imageUri = null;
            
            // Extract key/ID from image object if it's an object
            if (typeof image === 'object' && image !== null) {
              imageKey = image.Key || image.key || image.KeyName || image.keyName || '';
              imageId = image.Id || image.id || image._id || image.FileId || image.fileId || '';
              imageUri = image.Url || image.url || image.URI || image.uri || image.Location || image.location || image.UrlPath || image.urlPath || '';
            } else if (typeof image === 'string') {
              // If it's already a full URL, use it
              if (image.startsWith('http') || image.startsWith('https')) {
                imageUri = image;
              } else {
                imageKey = image;
              }
            }
            
            // Always use ImageWithFallback component for consistent authentication handling
            // It can handle both full URLs and key/ID-based lookups
            return (
              <ImageWithFallback
                key={index}
                image={image}
                imageKey={imageKey}
                imageId={imageId}
                imageUri={imageUri}
                index={index}
              />
            );
          })}
        </ScrollView>
      </Card>
    );
  };

  const renderVersions = () => {
    // Get Coral and CAD codes from original data
    const coralCode = originalData?.CoralCode || enquiry?.CoralCode || enquiry?.coralCode || enquiry?.coralVersion;
    const cadCode = originalData?.CadCode || enquiry?.CadCode || enquiry?.cadCode || enquiry?.cadVersion;
    
    // Get all versions
    const coralVersions = originalData?.Coral || enquiry?.Coral || [];
    const cadVersions = originalData?.Cad || enquiry?.Cad || [];
    
    // Check if Coral/CAD data exists
    const hasCoral = coralCode || coralVersions.length > 0;
    const hasCAD = cadCode || cadVersions.length > 0;

    return (
      <Card style={styles.versionsCard}>
        <Text style={[styles.sectionTitle, { fontSize: 16, fontWeight: 'bold', color: colors.textPrimary }]}>
          Design Versions
        </Text>

        <View style={styles.versionItem}>
          <View style={styles.versionHeader}>
            <Icon name="design-services" size={20} color={colors.primary} />
            <Text style={[styles.versionTitle, { color: colors.textPrimary, fontSize: 13, fontWeight: '500' }]}>
              Coral Design {coralVersions.length > 0 ? `(${coralVersions.length} ${coralVersions.length === 1 ? 'version' : 'versions'})` : ''}
            </Text>
          </View>
          {hasCoral ? (
            <View>
              {coralVersions.map((version, index) => (
                <TouchableOpacity 
                  key={index}
                  style={[styles.versionFile, { marginBottom: index < coralVersions.length - 1 ? 8 : 0 }]}
                  onPress={() => handleVersionSelect(index, 'coral')}
                >
                  <Icon name="description" size={16} color={colors.primary} />
                  <Text style={[styles.fileName, { color: colors.success, fontSize: 13 }]}>
                    {version.Version || `Version ${index + 1}`} {index === coralVersions.length - 1 && '(Latest)'}
                  </Text>
                  <Icon name="visibility" size={16} color={colors.primary} />
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <Text style={{ color: colors.textLight, fontSize: fonts.sm }}>
              No coral design uploaded yet
            </Text>
          )}
        </View>

        <View style={styles.versionItem}>
          <View style={styles.versionHeader}>
            <Icon name="precision-manufacturing" size={20} color={colors.primary} />
            <Text style={[styles.versionTitle, { color: colors.textPrimary, fontSize: 13, fontWeight: '500' }]}>
              CAD Design {cadVersions.length > 0 ? `(${cadVersions.length} ${cadVersions.length === 1 ? 'version' : 'versions'})` : ''}
            </Text>
          </View>
          {hasCAD ? (
            <View>
              {cadVersions.map((version, index) => (
                <TouchableOpacity 
                  key={index}
                  style={[styles.versionFile, { marginBottom: index < cadVersions.length - 1 ? 8 : 0 }]}
                  onPress={() => handleVersionSelect(index, 'cad')}
                >
                  <Icon name="description" size={16} color={colors.primary} />
                  <Text style={[styles.fileName, { color: colors.success, fontSize: 13 }]}>
                    {version.Version || `Version ${index + 1}`} {index === cadVersions.length - 1 && '(Latest)'}
                  </Text>
                  <Icon name="visibility" size={16} color={colors.primary} />
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <Text style={{ color: colors.textLight, fontSize: fonts.sm }}>
              No CAD design uploaded yet
            </Text>
          )}
        </View>
      </Card>
    );
  };
  
  const handleVersionSelect = (versionIndex, designType) => {
    navigation.navigate('DesignViewer', {
      designType: designType,
      enquiry: enquiry,
      versionIndex: versionIndex,
    });
  };

  const handleEditEnquiry = async () => {
    // Refetch the full enquiry data to ensure we have all fields
    try {
      if (enquiryId && enquiryData) {
        // Refetch to get latest data
        const result = await refetch();
        const fullEnquiry = result?.data || enquiryData || enquiry;
        
        navigation.navigate('EditEnquiryStep1', { 
          enquiry: fullEnquiry,
          enquiryId: enquiryId, // Pass ID as fallback
        });
      } else {
        // Fallback if refetch fails
        navigation.navigate('EditEnquiryStep1', { 
          enquiry: enquiry,
          enquiryId: enquiryId,
        });
      }
    } catch (error) {
      // Navigate with what we have
      navigation.navigate('EditEnquiryStep1', { 
        enquiry: enquiry,
        enquiryId: enquiryId,
      });
    }
  };


  const handleDeleteEnquiry = () => {
    Alert.alert(
      'Delete Enquiry',
      `Are you sure you want to delete "${enquiry?.title || 'this enquiry'}"? This action cannot be undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Navigate back immediately for better UX (optimistic update handles cache removal)
              navigation.navigate('MainTabs', { screen: 'Enquiries' });
              
              // Delete enquiry (optimistic update removes it from cache immediately)
              await deleteEnquiry(enquiryId || enquiry?.id).unwrap();
              
              // Success - no need for alert since user already navigated
              
            } catch (error) {
              // Show error alert
              Alert.alert(
                'Error',
                error.data?.error || error.message || 'Failed to delete enquiry. Please try again.'
              );
            }
          },
        },
      ]
    );
  };

  const renderClientActions = () => (
    <Card style={styles.actionsCard}>
      <Text style={[styles.sectionTitle, { fontSize: 16, fontWeight: 'bold', color: colors.textPrimary }]}>
        Actions
        </Text>
      
      <Button
        title="Edit Enquiry"
        onPress={handleEditEnquiry}
        style={[styles.actionButton, styles.editButton]}
      />

      {/* Hide enquiry history for clients (role 4) */}
      {(user?.roleId !== 4 && user?.roleNumber !== 4 && user?.role !== 'client') && (
        <Button
          title="Enquiry History"
          onPress={() => setShowHistoryModal(true)}
          style={[styles.actionButton, styles.historyButton]}
        />
      )}

      {/* Approve and Reject buttons removed for clients - clients don't have permission for these actions */}

      <TouchableOpacity
        style={styles.chatButton}
        onPress={() => {
          const currentEnquiry = enquiry || initialEnquiry || {};
          const currentEnquiryId = enquiryId || currentEnquiry?.id || currentEnquiry?._id;
          
          if (!currentEnquiryId) {
            
            Alert.alert('Error', 'Cannot open chat: Enquiry ID is missing');
            return;
          }
          
          navigation.navigate('ChatGroups', { 
            enquiry: currentEnquiry, 
            enquiryId: currentEnquiryId 
          });
        }}>
        <Icon name="chat" size={16} color={colors.primary} />
        <Text style={[styles.chatButtonText, { color: colors.textPrimary, fontSize: 13 }]}>
          Open Chat
        </Text>
      </TouchableOpacity>
    </Card>
  );

  const renderDesignerActions = (role) => (
    <Card style={styles.actionsCard}>
      <Text style={[styles.sectionTitle, { fontSize: 16, fontWeight: 'bold', color: colors.textPrimary }]}>
        Designer Actions
        </Text>
      
      <View style={styles.adminActionsRow}>
        <TouchableOpacity
          onPress={role === 'coral' ? handleUploadCoral : handleUploadCAD}
          style={[styles.adminActionButton, styles.adminActionButtonPrimary]}
          activeOpacity={0.85}
        >
          <Icon name="cloud-upload" size={18} color={colors.textWhite} />
          <Text style={styles.adminActionText}>
            Upload {role === 'coral' ? 'Coral' : 'CAD'} Design
          </Text>
        </TouchableOpacity>
      </View>

      {/* Enquiry History button removed for coral and CAD designers - only visible for admin */}

      <View style={styles.adminActionsRow}>
        <TouchableOpacity
          style={[styles.adminActionButton, styles.adminActionButtonOutline]}
          onPress={() => navigation.navigate('ChatGroups', { enquiry, enquiryId: enquiry?.id || enquiry?._id })}
          activeOpacity={0.85}
        >
          <Icon name="chat" size={18} color={colors.primary} />
          <Text style={[styles.adminActionText, styles.adminActionOutlineText]}>
            Open Chat
          </Text>
        </TouchableOpacity>
      </View>
    </Card>
  );

  const handleViewCAD = () => {
    // Get all CAD versions
    const cadVersions = originalData?.Cad || enquiry?.Cad || [];
    
    if (cadVersions.length === 0) {
      Alert.alert('No Versions', 'No CAD versions available');
      return;
    }
    
    // If only one version, go directly
    if (cadVersions.length === 1) {
      navigation.navigate('DesignViewer', {
        designType: 'cad',
        enquiry: enquiry,
        versionIndex: 0,
      });
      return;
    }
    
    // Show version selector for multiple versions
    setSelectedDesignType('cad');
    setShowVersionSelector(true);
  };

  const renderAdminActions = () => {
    const hasCAD = originalData?.CadCode || enquiry?.CadCode || enquiry?.cadCode || 
                   (originalData?.Cad && Array.isArray(originalData.Cad) && originalData.Cad.length > 0) ||
                   (enquiry?.Cad && Array.isArray(enquiry.Cad) && enquiry.Cad.length > 0);

    return (
      <Card style={[styles.actionsCard, styles.adminActionsCard]}>
        <View style={styles.adminActionsHeader}>
          <Icon name="admin-panel-settings" size={18} color={colors.primary} />
          <Text style={styles.adminActionsTitle}>Admin Controls</Text>
        </View>

        <View style={styles.adminActionsRow}>
          <TouchableOpacity
            style={[styles.adminActionButton, styles.adminActionButtonPrimary]}
            activeOpacity={0.85}
            onPress={handleEditEnquiry}
          >
            <Icon name="edit" size={18} color={colors.textWhite} />
            <Text style={styles.adminActionText}>Edit Enquiry</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.adminActionButton, styles.adminActionButtonSecondary]}
            activeOpacity={0.85}
            onPress={() => setShowHistoryModal(true)}
          >
            <Icon name="history" size={18} color={colors.textWhite} />
            <Text style={styles.adminActionText}>Enquiry History</Text>
          </TouchableOpacity>
        </View>

        {/* Upload Design Buttons for Admin */}
          <View style={styles.adminActionsRow}>
            <TouchableOpacity
              style={[styles.adminActionButton, styles.adminActionButtonSecondary]}
              activeOpacity={0.85}
            onPress={handleUploadCoral}
            >
            <Icon name="cloud-upload" size={18} color={colors.textWhite} />
            <Text style={styles.adminActionText}>Upload Coral</Text>
            </TouchableOpacity>

          <TouchableOpacity
            style={[styles.adminActionButton, styles.adminActionButtonSecondary]}
            activeOpacity={0.85}
            onPress={handleUploadCAD}
          >
            <Icon name="cloud-upload" size={18} color={colors.textWhite} />
            <Text style={styles.adminActionText}>Upload CAD</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.adminActionsRow}>
          <TouchableOpacity
            style={[styles.adminActionButton, styles.adminActionButtonDanger]}
            activeOpacity={0.85}
            onPress={handleDeleteEnquiry}
          >
            <Icon name="delete-outline" size={18} color={colors.textWhite} />
            <Text style={styles.adminActionText}>Delete Enquiry</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.adminActionsRow}>
          <TouchableOpacity
            style={[styles.adminActionButton, styles.adminActionButtonOutline]}
            activeOpacity={0.85}
            onPress={() =>  navigation.navigate('ChatGroups', { enquiry, enquiryId: enquiry?.id || enquiry?._id })}
          >
            <Icon name="chat" size={18} color={colors.primary} />
            <Text style={[styles.adminActionText, styles.adminActionOutlineText]}>Open Chat</Text>
          </TouchableOpacity>
        </View>
      </Card>
    );
  };

  const renderApprovalModal = () => {
    // Get version info for display
    const originalData = enquiry?._originalData || enquiry;
    const versions = selectedDesignType === 'coral'
      ? (originalData?.Coral || enquiry?.Coral || [])
      : (originalData?.Cad || enquiry?.Cad || []);
    const version = selectedVersionIndex !== null && selectedVersionIndex < versions.length
      ? (versions[selectedVersionIndex]?.Version || `Version ${selectedVersionIndex + 1}`)
      : 'this version';
    
    return (
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.textPrimary }}>
            Reject Design Version
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 8 }}>
            {selectedDesignType ? `${selectedDesignType.toUpperCase()} ${version}` : 'Design version'}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 8 }}>
            Please provide a reason for rejection:
          </Text>
        
        <Input
          placeholder="Enter rejection reason..."
          value={approvalMessage}
          onChangeText={setApprovalMessage}
          multiline
          numberOfLines={3}
          style={styles.modalInput}
        />

        <View style={styles.modalButtons}>
          <Button
            title="Cancel"
            variant="outline"
            onPress={() => setShowApprovalModal(false)}
            style={styles.modalButton}
          />
          <Button
            title="Reject"
            onPress={confirmReject}
            style={[styles.modalButton, styles.rejectButton]}
          />
        </View>
      </View>
    </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {renderImages()}
        {renderEnquiryDetails()}
        {renderVersions()}

        {user.role === 'client' && renderClientActions()}
        {(user.role === 'coral' || user.role === 'cad') && renderDesignerActions(user.role)}
        {user.role === 'admin' && renderAdminActions()}
      </ScrollView>

      {selectedImageUri && (
        <Modal
          visible={isImageModalVisible}
          transparent
          animationType="fade"
          onRequestClose={closeImageModal}
        >
          <View style={styles.fullscreenImageBackdrop}>
            <TouchableOpacity style={styles.fullscreenImageCloseButton} onPress={closeImageModal}>
              <Icon name="close" size={24} color={colors.textWhite} />
            </TouchableOpacity>
            <Image
              source={{ uri: selectedImageUri }}
              style={styles.fullscreenImage}
              resizeMode="contain"
            />
          </View>
        </Modal>
      )}

      {showApprovalModal && renderApprovalModal()}
      
      <EnquiryHistoryModal
        visible={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        enquiry={enquiry}
      />
    </View>
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
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  detailsCard: {
    marginBottom: spacing.lg,
  },
  detailsHeader: {
    flexDirection: 'column',
    marginBottom: 16,
  },
  statusContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    minWidth: 120,
    maxWidth: '90%',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 1,
  },
  priorityBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    minWidth: 100,
    maxWidth: '100%',
    alignItems: 'center',
    flexShrink: 1,
  },
  detailsGrid: {
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  detailTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  detailLabel: {
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailText: {
    flex: 1,
  },
  descriptionText: {
    textAlign: 'left',
  },
  imagesCard: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    marginBottom: 12,
  },
  imageContainer: {
    marginRight: 12,
  },
  imagePlaceholder: {
    width: 150,
    height: 150,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noImagesContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noImagesText: {
    marginTop: 12,
    textAlign: 'center',
  },
  errorText: {
    textAlign: 'center',
    marginBottom: 20,
  },
  backButton: {
    marginTop: 20,
  },
  versionsCard: {
    marginBottom: spacing.lg,
  },
  versionItem: {
    marginBottom: 16,
  },
  versionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  versionTitle: {
    marginLeft: 8,
    fontWeight: fonts.medium,
  },
  versionFile: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundSecondary,
    padding: 12,
    borderRadius: 8,
  },
  fileName: {
    flex: 1,
    marginLeft: 8,
  },
  actionsCard: {
    marginBottom: spacing.lg,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
  },
  approveButton: {
    backgroundColor: colors.success,
  },
  rejectButton: {
    borderColor: colors.error,
  },
  deleteButton: {
    backgroundColor: colors.error,
  },
  downloadButton: {
    backgroundColor: colors.info || '#2196F3',
  },
  coralButton: {
    backgroundColor: colors.warning || '#F59E0B',
  },
  cadButton: {
    backgroundColor: colors.info || '#2196F3',
  },
  uploadButton: {
    marginBottom: 16,
  },
  editButton: {
    marginBottom: 16,
  },
  historyButton: {
    backgroundColor: colors.info || '#2196F3',
    marginBottom: 16,
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 8,
  },
  chatButtonText: {
    marginLeft: 8,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.modalOverlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.modalBackground,
    borderRadius: 12,
    padding: 20,
    width: '100%',
  },
  modalText: {
    marginBottom: 16,
  },
  modalInput: {
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
  },
  fullscreenImageBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenImage: {
    width: '90%',
    height: '80%',
  },
  fullscreenImageCloseButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    padding: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  adminActionsCard: {
    borderWidth: 1,
    borderColor: 'rgba(16, 53, 52, 0.1)',
    backgroundColor: '#F2F5F4',
    padding: 20,
    borderRadius: 16,
  },
  adminActionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  adminActionsTitle: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  adminActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 12,
  },
  adminActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
  },
  adminActionButtonPrimary: {
    backgroundColor: colors.primary,
  },
  adminActionButtonSecondary: {
    backgroundColor: colors.primaryLight,
  },
  adminActionButtonDanger: {
    backgroundColor: colors.error,
  },
  adminActionButtonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  adminActionText: {
    color: colors.textWhite,
    fontFamily: fonts.medium,
    fontSize: 14,
    marginLeft: 8,
  },
  adminActionOutlineText: {
    color: colors.primary,
  },
});

export default SingleEnquiryScreen;
