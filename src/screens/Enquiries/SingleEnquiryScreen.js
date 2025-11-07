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
import { useGetEnquiryByIdQuery, useDeleteEnquiryMutation, useGetClientsQuery, useApproveDesignVersionMutation, useRejectDesignVersionMutation } from '../../store/api';
import { Card } from '../../components/cards/Cards';
import { Button, Input, EnquiryImage } from '../../components/common';
import { AnimatedLogoLoader } from '../../components/common';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import Icon from '../../components/common/Icon';
import { formatCurrency, formatDate, getStatusColor, getPriorityColor, imageSizes, spacing } from '../../utils';
import { EnquiryHistoryModal } from '../../components/modals';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SingleEnquiryScreen = ({ route, navigation }) => {
  const { user } = useAuth();
  const { enquiry: initialEnquiry, enquiryId: routeEnquiryId, shouldRefresh } = route.params || {};
  
  // Use route enquiryId or initialEnquiry id
  const enquiryId = routeEnquiryId || initialEnquiry?.id || initialEnquiry?._id;
  
  // Redux hooks
  const { 
    data: enquiryData, 
    isLoading: loading, 
    error: queryError,
    refetch 
  } = useGetEnquiryByIdQuery(enquiryId, {
    skip: !enquiryId,
  });

  const [deleteEnquiry, { isLoading: isDeleting }] = useDeleteEnquiryMutation();
  
  // Fetch clients for name lookup
  const { data: clientsData = [], isLoading: clientsLoading } = useGetClientsQuery(undefined, {
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
      
      if (__DEV__) {
        console.log('Client Name Map created with', map.size, 'entries');
        console.log('Sample client IDs in map:', Array.from(map.keys()).slice(0, 10));
        console.log('Total clients loaded:', clients.length);
      }
    } else {
      if (__DEV__) {
        console.warn('No clients data available for name lookup');
      }
    }
    return map;
  }, [clients]);
  
  // Helper to get client name from ID - try multiple matching strategies
  const getClientName = (clientId) => {
    if (!clientId) {
      if (__DEV__) {
        console.log('getClientName: No clientId provided');
      }
      return 'Unknown Client';
    }
    
    const idStr = String(clientId).trim();
    
    // Try exact match first
    if (clientNameMap.has(idStr)) {
      if (__DEV__) {
        console.log(`getClientName: Found exact match for "${idStr}"`);
      }
      return clientNameMap.get(idStr);
    }
    
    // Try without spaces
    const noSpaces = idStr.replace(/\s/g, '');
    if (clientNameMap.has(noSpaces)) {
      if (__DEV__) {
        console.log(`getClientName: Found match (no spaces) for "${idStr}"`);
      }
      return clientNameMap.get(noSpaces);
    }
    
    // Try cleaned ObjectId format
    const cleanId = idStr.replace(/^ObjectId\(/, '').replace(/\)$/, '').trim();
    if (cleanId !== idStr && clientNameMap.has(cleanId)) {
      if (__DEV__) {
        console.log(`getClientName: Found match (cleaned ObjectId) for "${idStr}"`);
      }
      return clientNameMap.get(cleanId);
    }
    
    const cleanNoSpaces = cleanId.replace(/\s/g, '');
    if (clientNameMap.has(cleanNoSpaces)) {
      if (__DEV__) {
        console.log(`getClientName: Found match (cleaned no spaces) for "${idStr}"`);
      }
      return clientNameMap.get(cleanNoSpaces);
    }
    
    // Try lowercase
    if (clientNameMap.has(idStr.toLowerCase())) {
      if (__DEV__) {
        console.log(`getClientName: Found match (lowercase) for "${idStr}"`);
      }
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
          if (__DEV__) {
            console.log(`getClientName: Found via direct search for "${idStr}"`);
          }
          return name;
        }
      }
    }
    
    if (__DEV__) {
      console.warn(`getClientName: Could not find client name for ID "${idStr}"`);
      console.warn('Available client IDs in map:', Array.from(clientNameMap.keys()).slice(0, 10));
      if (clients && clients.length > 0) {
        console.warn('Sample client IDs from array:', clients.slice(0, 3).map(c => ({
          id: c.id,
          _id: c._id,
          name: c.name
        })));
      }
    }
    
    return 'Unknown Client';
  };
  
  // Local UI state
  const [approvalMessage, setApprovalMessage] = useState('');
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showVersionSelector, setShowVersionSelector] = useState(false);
  const [selectedDesignType, setSelectedDesignType] = useState(null); // 'coral' or 'cad'
  const [selectedVersionIndex, setSelectedVersionIndex] = useState(null);
  
  // API mutations
  const [approveDesignVersion, { isLoading: isApproving }] = useApproveDesignVersionMutation();
  const [rejectDesignVersion, { isLoading: isRejecting }] = useRejectDesignVersionMutation();

  // Use enquiry from query if available, otherwise use initialEnquiry
  const enquiry = enquiryData || initialEnquiry || {};
  
  // Get original data for accessing raw API fields
  const originalData = enquiry?._originalData || enquiry;
  
  // Debug: Log enquiry structure to understand data format
  useEffect(() => {
    if (__DEV__ && enquiry) {
      console.log('========== ENQUIRY DATA STRUCTURE DEBUG ==========');
      console.log('enquiry keys:', Object.keys(enquiry));
      console.log('enquiry._originalData exists:', !!enquiry._originalData);
      if (enquiry._originalData) {
        console.log('_originalData keys:', Object.keys(enquiry._originalData));
        console.log('_originalData.ReferenceImages:', enquiry._originalData.ReferenceImages);
        console.log('_originalData.Images:', enquiry._originalData.Images);
      }
      console.log('enquiry.ReferenceImages:', enquiry.ReferenceImages);
      console.log('enquiry.images:', enquiry.images);
      console.log('enquiry.Images:', enquiry.Images);
      console.log('Full enquiry object (first level):', JSON.stringify(enquiry, null, 2).substring(0, 2000));
      console.log('================================================');
    }
  }, [enquiry]);
  
  // Get priority from API (Priority field)
  const priority = originalData?.Priority || enquiry?.Priority || enquiry?.priority || 'Normal';
  
  // Get status from API (Status field or StatusHistory)
  const status = originalData?.Status || enquiry?.Status || enquiry?.status || 'pending';
  
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
  
  // Debug logging for client name resolution
  if (__DEV__) {
    console.log('SingleEnquiryScreen - Client Resolution:');
    console.log('  ClientId from enquiry:', clientId);
    console.log('  ClientId type:', typeof clientId);
    console.log('  Enquiry clientName:', enquiry?.clientName);
    console.log('  Enquiry client:', enquiry?.client);
    console.log('  Clients loading:', clientsLoading);
    console.log('  Clients loaded:', clients.length);
    console.log('  Client name map size:', clientNameMap.size);
    console.log('  Final resolved client name:', clientName);
    if (clientId && clientName === 'Unknown Client' && !clientsLoading && clients.length > 0) {
      console.warn('⚠️ Client name lookup failed!');
      console.warn('  Searching for ClientId:', JSON.stringify(clientId));
      console.warn('  Available client IDs in map:', Array.from(clientNameMap.keys()).slice(0, 10));
      console.warn('  Sample client from array:', clients[0] ? {
        id: clients[0].id,
        _id: clients[0]._id,
        name: clients[0].name
      } : 'No clients');
    }
  }
  
  // Get dates - check multiple possible fields
  const createdAt = enquiry?.createdAt || originalData?.createdAt || new Date().toISOString();
  const updatedAt = enquiry?.updatedAt || originalData?.updatedAt || enquiry?.createdAt || createdAt;

  // Refresh enquiry data when screen comes into focus (if needed)
  useFocusEffect(
    React.useCallback(() => {
      if (shouldRefresh && enquiryId) {
        refetch();
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
    if (__DEV__) {
      console.log('========== APPROVE BUTTON CLICKED ==========');
    }
    
    // Get available design versions
    const originalData = enquiry?._originalData || enquiry;
    const coralVersions = originalData?.Coral || enquiry?.Coral || [];
    const cadVersions = originalData?.Cad || enquiry?.Cad || [];
    
    if (__DEV__) {
      console.log('Coral versions:', coralVersions.length);
      console.log('CAD versions:', cadVersions.length);
    }
    
    // Determine which design type and version to approve
    // Priority: Latest coral version, or latest cad version if no coral
    let designType = 'coral';
    let versionIndex = coralVersions.length > 0 ? coralVersions.length - 1 : (cadVersions.length > 0 ? cadVersions.length - 1 : null);
    
    if (coralVersions.length === 0 && cadVersions.length > 0) {
      designType = 'cad';
    }
    
    if (versionIndex === null) {
      if (__DEV__) {
        console.error('No design versions available to approve');
      }
      Alert.alert('Error', 'No design versions available to approve');
      return;
    }
    
    const version = designType === 'coral' 
      ? (coralVersions[versionIndex]?.Version || `Version ${versionIndex + 1}`)
      : (cadVersions[versionIndex]?.Version || `Version ${versionIndex + 1}`);
    
    if (__DEV__) {
      console.log('Will approve:', { designType, version, versionIndex });
    }
    
    Alert.alert(
      'Approve Design Version',
      `Are you sure you want to approve ${designType.toUpperCase()} ${version}?`,
      [
        { 
          text: 'Cancel', 
          style: 'cancel',
          onPress: () => {
            if (__DEV__) {
              console.log('Approve cancelled by user');
            }
          }
        },
        {
          text: 'Approve',
          onPress: async () => {
            if (__DEV__) {
              console.log('========== APPROVING DESIGN VERSION ==========');
              console.log('Design Type:', designType);
              console.log('Version:', version);
            }
            
            try {
              const enquiryId = enquiry.id || enquiry._id;
              
              if (__DEV__) {
                console.log('Enquiry ID:', enquiryId);
                console.log('Calling approveDesignVersion API...');
              }
              
              const result = await approveDesignVersion({
                enquiryId,
                designType,
                version,
              }).unwrap();
              
              if (__DEV__) {
                console.log('✅ Approve API response:', result);
              }
              
              Alert.alert('Success', `${designType.toUpperCase()} ${version} approved successfully`);
              // Refetch enquiry data to get updated approval status
              refetch();
            } catch (error) {
              console.error('========== ERROR APPROVING DESIGN VERSION ==========');
              console.error('Error object:', error);
              console.error('Error status:', error.status);
              console.error('Error data:', error.data);
              console.error('Error message:', error.message);
              console.error('Full error:', JSON.stringify(error, null, 2));
              console.error('======================================================');
              
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
      console.error('Error rejecting design version:', error);
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
    if (!value && !showIfEmpty) return null;
    return (
      <View style={styles.detailRow}>
        <Icon name={icon} size={16} color={colors.primary} />
        <View style={styles.detailTextContainer}>
          <Text style={[styles.detailLabel, { color: colors.textSecondary, fontSize: 11 }]}>
            {label}
          </Text>
          <Text style={[styles.detailText, { color: colors.textPrimary, fontSize: 13 }]}>
            {value || 'N/A'}
          </Text>
        </View>
      </View>
    );
  };

  const renderEnquiryDetails = () => {
    // Extract metal details - prefer originalData first
    const metal = originalData?.Metal || enquiry?.Metal || enquiry?.metal || {};
    const metalColor = metal.Color || metal.color || 'N/A';
    const metalQuality = metal.Quality || metal.quality || '';
    const metalWeight = originalData?.MetalWeight || enquiry?.MetalWeight || enquiry?.metalWeight || {};
    const diamondWeight = originalData?.DiamondWeight || enquiry?.DiamondWeight || enquiry?.diamondWeight || {};
    
    // Format metal weight
    let metalWeightText = 'N/A';
    if (metalWeight.Exact || metalWeight.exact) {
      metalWeightText = `${metalWeight.Exact || metalWeight.exact} gms`;
    } else if (metalWeight.From || metalWeight.from) {
      const from = metalWeight.From || metalWeight.from || '';
      const to = metalWeight.To || metalWeight.to || '';
      metalWeightText = `${from}${to ? ` - ${to}` : ''} gms`;
    }
    
    // Format diamond weight
    let diamondWeightText = 'N/A';
    if (diamondWeight.Exact || diamondWeight.exact) {
      diamondWeightText = `${diamondWeight.Exact || diamondWeight.exact} carats`;
    } else if (diamondWeight.From || diamondWeight.from) {
      const from = diamondWeight.From || diamondWeight.from || '';
      const to = diamondWeight.To || diamondWeight.to || '';
      diamondWeightText = `${from}${to ? ` - ${to}` : ''} carats`;
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
                <Text style={{ color: colors.textWhite, fontSize: fonts.sm }}>
                  {status.toUpperCase()}
                </Text>
              </View>
              <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(priority) }]}>
                <Text style={{ color: colors.textWhite, fontSize: fonts.sm }}>
                  {priority.toUpperCase()}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.detailsGrid}>
            {renderDetailItem('person', 'Client', clientName)}
            {renderDetailItem('schedule', 'Created', formatDate(createdAt))}
            {renderDetailItem('update', 'Last Updated', formatDate(updatedAt))}
            {renderDetailItem('calendar-today', 'Shipping Date', originalData?.ShippingDate || enquiry?.ShippingDate || enquiry?.deadline ? formatDate(originalData?.ShippingDate || enquiry?.ShippingDate || enquiry?.deadline) : 'Not set')}
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
            {renderDetailItem('category', 'Category', originalData?.Category || enquiry?.Category || enquiry?.category)}
            {renderDetailItem('inventory', 'Quantity', originalData?.Quantity || enquiry?.Quantity ? `${originalData?.Quantity || enquiry?.Quantity}` : 'N/A')}
            {renderDetailItem('grain', 'Stone Type', originalData?.StoneType || enquiry?.StoneType || enquiry?.stoneType)}
            {renderDetailItem('label', 'Style Number', originalData?.StyleNumber || enquiry?.StyleNumber)}
            {renderDetailItem('receipt', 'Gati Order Number', originalData?.GatiOrderNumber || enquiry?.GatiOrderNumber)}
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
            {renderDetailItem('label', 'Stamping', originalData?.Stamping || enquiry?.Stamping || null, true)}
          </View>
        </Card>

        {/* Assignment & Codes Card (for admin/viewing) */}
        {(enquiry?.AssignedTo || enquiry?.CoralCode || enquiry?.CadCode) && (
          <Card style={styles.detailsCard}>
            <Text style={[styles.sectionTitle, { fontSize: 16, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 12 }]}>
              Assignment & Codes
            </Text>
            <View style={styles.detailsGrid}>
            {renderDetailItem('person', 'Assigned To', enquiry?.AssignedTo)}
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
    const BASE_URL = 'https://workflowapi-quhn.onrender.com';
    
    // Fetch image with authentication
    const fetchImageWithAuth = async (imageUrl) => {
      if (!imageUrl) {
        if (__DEV__) {
          console.warn(`ImageWithFallback[${index}] - fetchImageWithAuth called without imageUrl`);
        }
        return;
      }
      
      // Don't fetch if we already have the data URI
      if (imageDataUri) {
        if (__DEV__) {
          console.log(`ImageWithFallback[${index}] - Already have data URI, skipping fetch`);
        }
        return;
      }
      
      try {
        setImageLoading(true);
        setImageError(false);
        
        const token = await AsyncStorage.getItem('token');
        if (!token) {
          console.warn(`⚠️ No token available for image[${index}]`);
          setImageError(true);
          setImageLoading(false);
          return;
        }

        console.log(`🔄 Fetching reference image[${index}] with authentication...`);
        console.log(`URL: ${imageUrl}`);
        
        const response = await fetch(imageUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const contentType = response.headers.get('content-type') || '';
          console.log(`✅ Reference image[${index}] fetch OK, content-type:`, contentType);
          
          // Check if response is JSON (API returns a URL object)
          if (contentType.includes('application/json')) {
            console.log(`📄 Reference image[${index}] response is JSON, parsing...`);
            const jsonData = await response.json();
            console.log(`JSON response:`, jsonData);
            
            // Extract the actual image URL from JSON
            const actualImageUrl = jsonData.url || jsonData.imageUrl || jsonData.src || jsonData.location;
            
            if (!actualImageUrl) {
              console.error(`❌ No image URL found in JSON response for image[${index}]`);
              setImageError(true);
              setImageLoading(false);
              return;
            }
            
            console.log(`🖼️ Found image URL in JSON for image[${index}], fetching actual image...`);
            
            // Fetch the actual image from the URL (likely S3)
            const imageResponse = await fetch(actualImageUrl, {
              method: 'GET',
              headers: actualImageUrl.includes('amazonaws.com') ? {} : {
                'Authorization': `Bearer ${token}`,
              },
            });
            
            if (!imageResponse.ok) {
              console.error(`❌ Failed to fetch actual image[${index}]:`, imageResponse.status);
              setImageError(true);
              setImageLoading(false);
              return;
            }
            
            console.log(`✅ Actual image[${index}] fetched, converting to base64...`);
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
            
            console.log(`✅ Reference image[${index}] fetched and converted to data URI`);
            setImageDataUri(dataUri);
            setImageLoading(false);
            setImageError(false);
          } else {
            // Direct image response
            console.log(`✅ Reference image[${index}] response is direct image, converting...`);
            
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
            
            console.log(`✅ Reference image[${index}] fetched and converted to data URI`);
            setImageDataUri(dataUri);
            setImageLoading(false);
            setImageError(false);
          }
        } else {
          console.error(`❌ Reference image[${index}] fetch failed:`, response.status, response.statusText);
          setImageError(true);
          setImageLoading(false);
        }
      } catch (error) {
        console.error(`❌ Error fetching reference image[${index}]:`, error);
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
        if (__DEV__) {
          console.log(`ImageWithFallback[${index}] - Using provided full URL:`, imageUrl);
        }
      } else if (imageKey) {
        const encodedKey = encodeURIComponent(imageKey);
        imageUrl = `${BASE_URL}/api/enquiries/files/${encodedKey}`;
        if (__DEV__) {
          console.log(`ImageWithFallback[${index}] - Generated URL from key:`, imageUrl);
          console.log(`ImageWithFallback[${index}] - Original key:`, imageKey);
        }
      } else if (imageId) {
        imageUrl = `${BASE_URL}/api/enquiries/files/${imageId}`;
        if (__DEV__) {
          console.log(`ImageWithFallback[${index}] - Generated URL from ID:`, imageUrl);
          console.log(`ImageWithFallback[${index}] - Original ID:`, imageId);
        }
      }
      
      if (imageUrl) {
        // Check if it's an S3 URL (public, no auth needed) - try direct load first
        if (imageUrl.includes('amazonaws.com') || imageUrl.includes('s3.')) {
          if (__DEV__) {
            console.log(`ImageWithFallback[${index}] - Detected S3 URL, trying direct load first`);
          }
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
        if (__DEV__) {
          console.error(`ImageWithFallback[${index}] - No valid image URL generated.`);
          console.error(`  - imageKey: ${imageKey}`);
          console.error(`  - imageId: ${imageId}`);
          console.error(`  - imageUri: ${imageUri}`);
          console.error(`  - image object:`, JSON.stringify(image, null, 2));
        }
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
      <View style={styles.imageContainer}>
        <EnquiryImage
          source={{ uri: imageDataUri }}
          onError={() => {
            console.error(`❌ Reference image[${index}] data URI load error`);
            setImageError(true);
          }}
          onLoad={() => {
            console.log(`✅ Reference image[${index}] loaded successfully`);
          }}
        />
      </View>
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
    
    if (__DEV__) {
      console.log('========== REFERENCE IMAGES DEBUG ==========');
      console.log('originalData exists:', !!originalData);
      console.log('originalData.ReferenceImages:', originalData?.ReferenceImages);
      console.log('originalData.Images:', originalData?.Images);
      console.log('enquiry.ReferenceImages:', enquiry?.ReferenceImages);
      console.log('enquiry.images:', enquiry?.images);
      console.log('enquiry.Images:', enquiry?.Images);
      console.log('Final images array:', images);
      console.log('Images length:', images.length);
      console.log('Images type:', Array.isArray(images) ? 'Array' : typeof images);
      if (images.length > 0) {
        console.log('First image structure:', images[0]);
        console.log('First image keys:', typeof images[0] === 'object' ? Object.keys(images[0]) : 'Not an object');
      }
      console.log('==========================================');
    }
    
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
            
            if (__DEV__) {
              console.log(`renderImages - image[${index}]:`, image, 'type:', typeof image);
            }
            
            // Extract key/ID from image object if it's an object
            if (typeof image === 'object' && image !== null) {
              imageKey = image.Key || image.key || image.KeyName || image.keyName || '';
              imageId = image.Id || image.id || image._id || image.FileId || image.fileId || '';
              imageUri = image.Url || image.url || image.URI || image.uri || image.Location || image.location || image.UrlPath || image.urlPath || '';
              
              if (__DEV__) {
                console.log(`renderImages - image[${index}] extraction:`);
                console.log(`  - Full object:`, JSON.stringify(image, null, 2));
                console.log(`  - Extracted Key: ${imageKey}`);
                console.log(`  - Extracted Id: ${imageId}`);
                console.log(`  - Extracted Url: ${imageUri}`);
              }
            } else if (typeof image === 'string') {
              // If it's already a full URL, use it
              if (image.startsWith('http') || image.startsWith('https')) {
                imageUri = image;
                if (__DEV__) {
                  console.log(`renderImages - image[${index}] is full URL:`, imageUri);
                }
              } else {
                imageKey = image;
                if (__DEV__) {
                  console.log(`renderImages - image[${index}] is string key:`, imageKey);
                }
              }
            }
            
            if (__DEV__) {
              console.log(`renderImages - image[${index}] final values:`, {
                imageKey,
                imageId,
                imageUri,
                willUseImageWithFallback: !imageUri || !imageUri.startsWith('http')
              });
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
        
        if (__DEV__) {
          console.log('handleEditEnquiry - Passing enquiry to edit screen:', {
            id: fullEnquiry?.id,
            title: fullEnquiry?.title || fullEnquiry?.Name,
            hasOriginalData: !!fullEnquiry?._originalData,
            originalDataKeys: fullEnquiry?._originalData ? Object.keys(fullEnquiry._originalData) : [],
            enquiryKeys: Object.keys(fullEnquiry || {}),
            hasName: !!fullEnquiry?.Name,
            hasRemarks: !!fullEnquiry?.Remarks,
            hasMetal: !!fullEnquiry?.Metal,
          });
        }
        
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
      console.error('Error refetching enquiry for edit:', error);
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
              if (__DEV__) {
                console.log('Enquiry deleted successfully');
              }
            } catch (error) {
              console.error('Error deleting enquiry:', error);
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

      <Button
        title="Enquiry History"
        onPress={() => setShowHistoryModal(true)}
        style={[styles.actionButton, styles.historyButton]}
      />

      <View style={styles.actionButtons}>
        <Button
          title={isApproving ? "Approving..." : "Approve"}
          onPress={handleApprove}
          style={[styles.actionButton, styles.approveButton]}
          disabled={isApproving || isRejecting}
        />
        <Button
          title={isRejecting ? "Rejecting..." : "Reject"}
          variant="outline"
          onPress={handleReject}
          style={[styles.actionButton, styles.rejectButton]}
          disabled={isApproving || isRejecting}
        />
      </View>

      <TouchableOpacity
        style={styles.chatButton}
        onPress={() => navigation.navigate('ChatDetail', { enquiry })}>
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
      
      <Button
        title={`Upload ${role === 'coral' ? 'Coral' : 'CAD'} Design`}
        onPress={role === 'coral' ? handleUploadCoral : handleUploadCAD}
        style={styles.uploadButton}
      />

      <Button
        title="Enquiry History"
        onPress={() => setShowHistoryModal(true)}
        style={[styles.actionButton, styles.historyButton]}
      />

      <TouchableOpacity
        style={styles.chatButton}
        onPress={() => navigation.navigate('ChatDetail', { enquiry })}>
        <Icon name="chat" size={16} color={colors.primary} />
        <Text style={[styles.chatButtonText, { color: colors.textPrimary, fontSize: 13 }]}>
          Open Chat
        </Text>
      </TouchableOpacity>
    </Card>
  );

  const handleViewCoral = () => {
    // Get all Coral versions
    const coralVersions = originalData?.Coral || enquiry?.Coral || [];
    
    if (coralVersions.length === 0) {
      Alert.alert('No Versions', 'No Coral versions available');
      return;
    }
    
    // If only one version, go directly
    if (coralVersions.length === 1) {
      navigation.navigate('DesignViewer', {
        designType: 'coral',
        enquiry: enquiry,
        versionIndex: 0,
      });
      return;
    }
    
    // Show version selector for multiple versions
    setSelectedDesignType('coral');
    setShowVersionSelector(true);
  };

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
    // Check if Coral or CAD data exists
    const hasCoral = originalData?.CoralCode || enquiry?.CoralCode || enquiry?.coralCode || 
                     (originalData?.Coral && Array.isArray(originalData.Coral) && originalData.Coral.length > 0) ||
                     (enquiry?.Coral && Array.isArray(enquiry.Coral) && enquiry.Coral.length > 0);
    
    const hasCAD = originalData?.CadCode || enquiry?.CadCode || enquiry?.cadCode || 
                   (originalData?.Cad && Array.isArray(originalData.Cad) && originalData.Cad.length > 0) ||
                   (enquiry?.Cad && Array.isArray(enquiry.Cad) && enquiry.Cad.length > 0);

    return (
      <Card style={styles.actionsCard}>
        <Text style={[styles.sectionTitle, { fontSize: 16, fontWeight: 'bold', color: colors.textPrimary }]}>
          Admin Actions
          </Text>
        
        <Button
          title="Edit Enquiry"
          onPress={handleEditEnquiry}
          style={[styles.actionButton, styles.editButton]}
        />

        <Button
          title="Enquiry History"
          onPress={() => setShowHistoryModal(true)}
          style={[styles.actionButton, styles.historyButton]}
        />

        {/* Coral and CAD Design Viewers */}
        {(hasCoral || hasCAD) && (
          <View style={styles.actionButtons}>
            {hasCoral && (
              <Button
                title="Coral"
                onPress={handleViewCoral}
                style={[styles.actionButton, styles.coralButton]}
              />
            )}
            {hasCAD && (
              <Button
                title="CAD"
                onPress={handleViewCAD}
                style={[styles.actionButton, styles.cadButton]}
              />
            )}
          </View>
        )}

        <View style={styles.actionButtons}>
          <Button
            title="Delete Enquiry"
            onPress={handleDeleteEnquiry}
            style={[styles.actionButton, styles.deleteButton]}
          />
        </View>

        <TouchableOpacity
          style={styles.chatButton}
          onPress={() => navigation.navigate('ChatDetail', { enquiry })}>
          <Icon name="chat" size={16} color={colors.primary} />
          <Text style={[styles.chatButtonText, { color: colors.textPrimary, fontSize: 13 }]}>
            Open Chat
          </Text>
        </TouchableOpacity>
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
      <ScrollView style={styles.scrollView}>
        {renderEnquiryDetails()}
        {renderImages()}
        {renderVersions()}

        {user.role === 'client' && renderClientActions()}
        {(user.role === 'coral' || user.role === 'cad') && renderDesignerActions(user.role)}
        {user.role === 'admin' && renderAdminActions()}
      </ScrollView>

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
    paddingHorizontal: 16,
  },
  detailsCard: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 12,
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
    minWidth: 80,
    alignItems: 'center',
  },
  priorityBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    minWidth: 80,
    alignItems: 'center',
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
    marginHorizontal: 16,
    marginVertical: 12,
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
    marginHorizontal: 16,
    marginVertical: 12,
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
    marginHorizontal: 16,
    marginVertical: 12,
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
});

export default SingleEnquiryScreen;
