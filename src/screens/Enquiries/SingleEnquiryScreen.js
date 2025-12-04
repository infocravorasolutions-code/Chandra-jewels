import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
  FlatList,
  Dimensions,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import ImageZoom from 'react-native-image-pan-zoom';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useGetEnquiryByIdQuery, useDeleteEnquiryMutation, useApproveDesignVersionMutation, useRejectDesignVersionMutation, useUploadReferenceImagesMutation } from '../../store/api';
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
  
  // Automatic cache cleanup on screen mount (runs once per app session)
  useEffect(() => {
    let cleanupTimer;
    const performCleanup = async () => {
      try {
        // Clean up expired entries and old cache on screen load
        const allKeys = await AsyncStorage.getAllKeys();
        const cacheKeys = allKeys.filter(key => key.startsWith('image_cache_'));
        
        if (cacheKeys.length > 0) {
          const now = Date.now();
          const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
          const cacheEntries = await AsyncStorage.multiGet(cacheKeys);
          
          const expiredKeys = cacheEntries
            .map(([key, value]) => {
              try {
                const data = JSON.parse(value);
                const age = now - (data.timestamp || 0);
                return age > maxAge ? key : null;
              } catch {
                return key; // Remove invalid entries
              }
            })
            .filter(Boolean);
          
          if (expiredKeys.length > 0) {
            await AsyncStorage.multiRemove(expiredKeys);
          }
          
          // If we still have more than 100 cached images, remove oldest 30%
          const remainingKeys = cacheKeys.filter(k => !expiredKeys.includes(k));
          if (remainingKeys.length > 100) {
            const remainingEntries = cacheEntries
              .filter(([key]) => !expiredKeys.includes(key))
              .map(([key, value]) => {
                try {
                  const data = JSON.parse(value);
                  return { key, timestamp: data.timestamp || 0 };
                } catch {
                  return { key, timestamp: 0 };
                }
              })
              .sort((a, b) => a.timestamp - b.timestamp);
            
            const toRemove = Math.floor(remainingEntries.length * 0.3);
            const oldestKeys = remainingEntries.slice(0, toRemove).map(e => e.key);
            
            if (oldestKeys.length > 0) {
              await AsyncStorage.multiRemove(oldestKeys);
            }
          }
        }
      } catch (error) {
        // Silently handle cache cleanup errors
      }
    };
    
    // Run cleanup after a short delay to not block initial render
    cleanupTimer = setTimeout(performCleanup, 2000);
    
    return () => {
      if (cleanupTimer) clearTimeout(cleanupTimer);
    };
  }, []); // Run once on mount
  
  // Use route enquiryId or initialEnquiry id
  const enquiryId = routeEnquiryId || initialEnquiry?.id || initialEnquiry?._id;
  
  // Log enquiryId
  useEffect(() => {
    
  }, [enquiryId]);
  
  // Redux hooks - refetch when screen comes into focus to get latest pricing updates
  const { 
    data: enquiryData, 
    isLoading: loading, 
    error: queryError,
    refetch 
  } = useGetEnquiryByIdQuery(enquiryId, {
    skip: !enquiryId,
    refetchOnFocus: true, // Refetch when screen comes into focus to get latest data (including pricing)
    refetchOnMountOrArgChange: true, // Refetch when enquiryId changes
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
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isImageModalVisible, setImageModalVisible] = useState(false);
  const [modalImages, setModalImages] = useState([]); // Store image objects for modal
  const modalFlatListRef = useRef(null);
  const [modalCurrentIndex, setModalCurrentIndex] = useState(0);
  const [isModalZoomed, setIsModalZoomed] = useState(false);
  
  const handleImagePress = (uri, index, allImages) => {
    if (!uri) {
      return;
    }
    if (__DEV__) {
    }
    const imagesForModal = allImages || [];
    setSelectedImageIndex(index);
    setModalImages(imagesForModal);
    setIsModalZoomed(false);
    setSelectedImageUri(uri);
    setModalCurrentIndex(index);
    setImageModalVisible(true);
  };

  const closeImageModal = () => {
    setImageModalVisible(false);
    setSelectedImageUri(null);
    setModalImages([]);
    setModalCurrentIndex(0);
    setIsModalZoomed(false);
  };
  
  // Scroll to selected image when modal opens
  useEffect(() => {
    if (isImageModalVisible && modalImages.length > 1) {
      // Ensure selected index image URI is set (prevents flicker)
      const targetImage = modalImages[modalCurrentIndex];
      if (targetImage) {
        setSelectedImageUri(targetImage.cachedUri || targetImage.imageUri || null);
      }
      
      if (modalFlatListRef.current) {
        requestAnimationFrame(() => {
        modalFlatListRef.current?.scrollToIndex({
          index: modalCurrentIndex,
          animated: false,
        });
        });
    }
    }
  }, [isImageModalVisible, modalCurrentIndex, modalImages]);
  
  // State for image modal slider - must be at top level of component
  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;

  useEffect(() => {
    if (!isImageModalVisible) {
      setIsModalZoomed(false);
    }
  }, [isImageModalVisible]);
  const ZOOM_ON_THRESHOLD = 1.05;
  const ZOOM_OFF_THRESHOLD = 1.02;

  const handleZoomMove = useCallback((event) => {
    const scale = event?.scale ?? 1;
    setIsModalZoomed((prev) => {
      if (!prev && scale >= ZOOM_ON_THRESHOLD) {
        return true;
      }
      if (prev && scale <= ZOOM_OFF_THRESHOLD) {
        return false;
      }
      return prev;
    });
  }, [ZOOM_ON_THRESHOLD, ZOOM_OFF_THRESHOLD]);
  
  // Viewability config for modal FlatList - must be at component level
  const updateModalIndex = useCallback((index, scrollList = true) => {
    const boundedIndex = Math.max(0, Math.min((modalImages?.length || 1) - 1, index));
    if (modalFlatListRef.current && scrollList && modalImages.length > 1) {
      modalFlatListRef.current.scrollToIndex({
        index: boundedIndex,
        animated: true,
      });
    }

    requestAnimationFrame(() => {
      setModalCurrentIndex((prev) => (prev === boundedIndex ? prev : boundedIndex));
      const targetImage = modalImages?.[boundedIndex];
      if (targetImage) {
        setSelectedImageUri(targetImage.cachedUri || targetImage.imageUri || null);
      }
      setIsModalZoomed(false);
    });
  }, [modalImages]);

  const getModalImageKey = useCallback((item, index) => {
    return item?.imageKey || item?.imageId || item?.imageUri || `modal-image-${index}`;
  }, []);

  const handleModalPrev = useCallback(() => {
    if (!modalImages || modalImages.length <= 1) return;
    updateModalIndex(modalCurrentIndex - 1);
  }, [modalImages, modalCurrentIndex, updateModalIndex]);

  const handleModalNext = useCallback(() => {
    if (!modalImages || modalImages.length <= 1) return;
    updateModalIndex(modalCurrentIndex + 1);
  }, [modalImages, modalCurrentIndex, updateModalIndex]);

  const modalOnViewableItemsChanged = useCallback(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      const nextIndex = viewableItems[0].index || 0;
      if (nextIndex !== modalCurrentIndex) {
        updateModalIndex(nextIndex, false);
    }
    }
  }, [modalCurrentIndex, updateModalIndex]);

  const modalViewabilityConfig = useMemo(() => ({
    itemVisiblePercentThreshold: 50,
  }), []);
  
  // API mutations
  const [approveDesignVersion, { isLoading: isApproving }] = useApproveDesignVersionMutation();
  const [rejectDesignVersion, { isLoading: isRejecting }] = useRejectDesignVersionMutation();
  const [uploadReferenceImages, { isLoading: isUploadingReference }] = useUploadReferenceImagesMutation();

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
  
  // Get priority from API (show as badge)
  const priority = originalData?.Priority || enquiry?.Priority || enquiry?.priority || 'Normal';

  // Get status from API - use original value, not normalized
  // Resolution order:
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
  const lastShouldRefreshRef = useRef(shouldRefresh);
  
  // Refresh enquiry data when screen comes into focus (if needed)
  useFocusEffect(
    useCallback(() => {
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

  const showAllDetails = user?.role === 'admin';

  const handleOpenChat = useCallback(() => {
    const currentEnquiry = enquiry || initialEnquiry || {};
    const currentEnquiryId = enquiryId || currentEnquiry?.id || currentEnquiry?._id;

    if (!currentEnquiryId) {
      Alert.alert('Error', 'Cannot open chat: Enquiry ID is missing');
      return;
    }

    navigation.navigate('ChatGroups', {
      enquiry: currentEnquiry,
      enquiryId: currentEnquiryId,
    });
  }, [enquiry, initialEnquiry, enquiryId, navigation]);

  const canShowChatFab = user?.role === 'client' ||
    user?.role === 'admin' ||
    user?.role === 'coral' ||
    user?.role === 'cad';

  // In-memory cache as fallback when AsyncStorage is full
  const memoryCacheRef = useRef(new Map());
  const storageFullRef = useRef(false);
  const MAX_MEMORY_CACHE_SIZE = 20; // Keep max 20 images in memory

  // Image cache utility functions - MUST be defined before any conditional returns
  const getImageCacheKey = useCallback((imageKey, imageId, imageUri) => {
    // Create a unique cache key from image identifier
    if (imageKey) return `image_cache_${imageKey}`;
    if (imageId) return `image_cache_${imageId}`;
    if (imageUri) {
      // Use a hash of the URI for cache key
      const uriHash = imageUri.split('/').pop().split('?')[0];
      return `image_cache_${uriHash}`;
    }
    return null;
  }, []);

  const getCachedImage = useCallback(async (cacheKey) => {
    if (!cacheKey) return null;
    
    // First check in-memory cache (works even when storage is full)
    if (memoryCacheRef.current.has(cacheKey)) {
      const cached = memoryCacheRef.current.get(cacheKey);
      const cacheAge = Date.now() - (cached.timestamp || 0);
      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
      if (cacheAge < maxAge) {
        return cached.dataUri;
      } else {
        memoryCacheRef.current.delete(cacheKey);
      }
    }
    
    // If storage is known to be full, skip AsyncStorage check
    if (storageFullRef.current) {
      return null;
    }
    
    // Try AsyncStorage cache
    try {
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) {
        const cacheData = JSON.parse(cached);
        // Check if cache is still valid (7 days)
        const cacheAge = Date.now() - (cacheData.timestamp || 0);
        const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
        if (cacheAge < maxAge) {
          // Also store in memory cache for faster access
          memoryCacheRef.current.set(cacheKey, cacheData);
          // Limit memory cache size
          if (memoryCacheRef.current.size > MAX_MEMORY_CACHE_SIZE) {
            const firstKey = memoryCacheRef.current.keys().next().value;
            memoryCacheRef.current.delete(firstKey);
          }
          return cacheData.dataUri;
        } else {
          // Cache expired, remove it
          await AsyncStorage.removeItem(cacheKey);
        }
      }
    } catch (error) {
      // Silently handle cache read errors
    }
    return null;
  }, []);

  // Automatic cache cleanup function - removes old entries
  const cleanupImageCache = useCallback(async (aggressive = false) => {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const cacheKeys = allKeys.filter(key => key.startsWith('image_cache_'));
      
      if (cacheKeys.length === 0) {
        return { removed: 0, remaining: 0 };
      }
      
      // Get all cache entries with timestamps
      const cacheEntries = await AsyncStorage.multiGet(cacheKeys);
      const now = Date.now();
      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
      
      const entriesWithTimestamps = cacheEntries
        .map(([key, value]) => {
          try {
            const data = JSON.parse(value);
            const age = now - (data.timestamp || 0);
            return { 
              key, 
              timestamp: data.timestamp || 0,
              age,
              expired: age > maxAge
            };
          } catch {
            return { key, timestamp: 0, age: Infinity, expired: true };
          }
        })
        .sort((a, b) => a.timestamp - b.timestamp); // Oldest first
      
      // Determine what to remove
      let keysToRemove = [];
      
      if (aggressive) {
        // Aggressive cleanup: Remove 50% of oldest entries + all expired
        const expiredKeys = entriesWithTimestamps.filter(e => e.expired).map(e => e.key);
        const toRemove = Math.max(1, Math.floor(entriesWithTimestamps.length * 0.5));
        const oldestKeys = entriesWithTimestamps.slice(0, toRemove).map(e => e.key);
        keysToRemove = [...new Set([...expiredKeys, ...oldestKeys])];
      } else {
        // Normal cleanup: Remove expired entries + 30% of oldest
        const expiredKeys = entriesWithTimestamps.filter(e => e.expired).map(e => e.key);
        const toRemove = Math.max(1, Math.floor(entriesWithTimestamps.length * 0.3));
        const oldestKeys = entriesWithTimestamps.slice(0, toRemove).map(e => e.key);
        keysToRemove = [...new Set([...expiredKeys, ...oldestKeys])];
      }
      
      if (keysToRemove.length > 0) {
        await AsyncStorage.multiRemove(keysToRemove);
        const remaining = cacheKeys.length - keysToRemove.length;
        return { removed: keysToRemove.length, remaining };
      }
      
      return { removed: 0, remaining: cacheKeys.length };
    } catch (error) {
      return { removed: 0, remaining: 0 };
    }
  }, []);

  const saveImageToCache = useCallback(async (cacheKey, dataUri) => {
    if (!cacheKey || !dataUri) return false;
    try {
      const cacheData = {
        dataUri,
        timestamp: Date.now(),
      };
      await AsyncStorage.setItem(cacheKey, JSON.stringify(cacheData));
      return true; // Success
    } catch (error) {
      // Storage is full - try to clean up old cache entries
      if (error?.code === '13' || error?.message?.includes('SQLITE_FULL')) {
        if (__DEV__) {
          console.warn('⚠️ Storage full, attempting aggressive cache cleanup...');
        }
        
        // Get all cache keys first to check how many we have
        const allKeys = await AsyncStorage.getAllKeys();
        const cacheKeys = allKeys.filter(key => key.startsWith('image_cache_'));
        
        // If we have very few cache entries but storage is full, clear ALL cache
        // This suggests other data is filling storage, not image cache
        if (cacheKeys.length <= 5) {
          if (__DEV__) {
            console.warn(`⚠️ Storage full but only ${cacheKeys.length} cache entries - clearing ALL image cache`);
          }
          if (cacheKeys.length > 0) {
            await AsyncStorage.multiRemove(cacheKeys);
            if (__DEV__) {
              console.log(`🧹 Cleared all ${cacheKeys.length} image cache entries`);
            }
          }
          
          // Try saving after clearing all cache
          try {
            await AsyncStorage.setItem(cacheKey, JSON.stringify({
              dataUri,
              timestamp: Date.now(),
            }));
            if (__DEV__) {
              console.log('✅ Cache saved after clearing all image cache');
            }
            return true;
              } catch (clearAllError) {
                // Storage is consistently full - disable AsyncStorage caching and use memory cache only
                storageFullRef.current = true;
                if (__DEV__) {
                  console.warn('⚠️ Storage STILL full after clearing all image cache - switching to memory-only cache');
                  console.warn('💡 Consider clearing other AsyncStorage data (tokens, user data, etc.)');
                }
                
                // Store in memory cache as fallback
                memoryCacheRef.current.set(cacheKey, {
                  dataUri,
                  timestamp: Date.now(),
                });
                // Limit memory cache size
                if (memoryCacheRef.current.size > MAX_MEMORY_CACHE_SIZE) {
                  const firstKey = memoryCacheRef.current.keys().next().value;
                  memoryCacheRef.current.delete(firstKey);
                }
                if (__DEV__) {
                  console.log('💾 Stored in memory cache (AsyncStorage full):', cacheKey);
                }
                return true; // Consider it "saved" in memory cache
              }
        }
        
        // Try normal cleanup first
        let cleanupResult = await cleanupImageCache(false);
        
        // If still full after normal cleanup, try aggressive cleanup
        if (cleanupResult.remaining > 0) {
          try {
            await AsyncStorage.setItem(cacheKey, JSON.stringify({
              dataUri,
              timestamp: Date.now(),
            }));
            if (__DEV__) {
              console.log('✅ Cache saved after normal cleanup');
            }
            return true; // Success after normal cleanup
          } catch (retryError) {
            if (__DEV__) {
              console.warn('⚠️ Still full after normal cleanup, trying aggressive cleanup...');
            }
            // Try aggressive cleanup (removes 50%)
            cleanupResult = await cleanupImageCache(true);
            
            // Try saving again after aggressive cleanup
            try {
              await AsyncStorage.setItem(cacheKey, JSON.stringify({
                dataUri,
                timestamp: Date.now(),
              }));
              if (__DEV__) {
                console.log('✅ Cache saved after aggressive cleanup');
              }
              return true; // Success after aggressive cleanup
            } catch (finalError) {
              // Last resort: clear ALL remaining cache
              const remainingCacheKeys = allKeys.filter(key => key.startsWith('image_cache_'));
              if (remainingCacheKeys.length > 0) {
                if (__DEV__) {
                  console.warn(`⚠️ Last resort: clearing ALL ${remainingCacheKeys.length} remaining cache entries`);
                }
                await AsyncStorage.multiRemove(remainingCacheKeys);
                try {
                  await AsyncStorage.setItem(cacheKey, JSON.stringify({
                    dataUri,
                    timestamp: Date.now(),
                  }));
                  if (__DEV__) {
                    console.log('✅ Cache saved after clearing all remaining cache');
                  }
                  return true;
                } catch (lastError) {
                  // Storage is consistently full - use memory cache
                  storageFullRef.current = true;
                  if (__DEV__) {
                    console.warn('⚠️ Storage still full after clearing ALL cache - switching to memory-only cache');
                  }
                  
                  // Store in memory cache as fallback
                  memoryCacheRef.current.set(cacheKey, {
                    dataUri,
                    timestamp: Date.now(),
                  });
                  // Limit memory cache size
                  if (memoryCacheRef.current.size > MAX_MEMORY_CACHE_SIZE) {
                    const firstKey = memoryCacheRef.current.keys().next().value;
                    memoryCacheRef.current.delete(firstKey);
                  }
                  if (__DEV__) {
                    console.log('💾 Stored in memory cache (all cleanup failed):', cacheKey);
                  }
                  return true; // Consider it "saved" in memory cache
                }
              }
            }
          }
        }
      } else if (__DEV__) {
        console.warn('⚠️ Error saving image cache:', error);
      }
      
      // If storage is known to be full, use memory cache as fallback
      if (storageFullRef.current) {
        memoryCacheRef.current.set(cacheKey, {
          dataUri,
          timestamp: Date.now(),
        });
        // Limit memory cache size
        if (memoryCacheRef.current.size > MAX_MEMORY_CACHE_SIZE) {
          const firstKey = memoryCacheRef.current.keys().next().value;
          memoryCacheRef.current.delete(firstKey);
        }
        if (__DEV__) {
          console.log('💾 Stored in memory cache (AsyncStorage disabled):', cacheKey);
        }
        return true;
      }
      
      return false; // Failed
    }
  }, [cleanupImageCache]);

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

  const handleUploadReferenceImages = () => {
    const currentEnquiryId = enquiry.id || enquiry._id;
    if (!currentEnquiryId) {
      Alert.alert('Error', 'Unable to find this enquiry. Please refresh and try again.');
      return;
    }

    const pickerOptions = {
      mediaType: 'photo',
      selectionLimit: 10,
      includeBase64: false,
    };

    launchImageLibrary(pickerOptions, async (response) => {
      if (response.didCancel) {
        return;
      }

      if (response.errorCode) {
        Alert.alert('Image Picker Error', response.errorMessage || 'Failed to open gallery. Please try again.');
        return;
      }

      const assets = response.assets?.filter((asset) => asset?.uri) || [];
      if (assets.length === 0) {
        Alert.alert('No Images Selected', 'Please choose at least one reference image to upload.');
        return;
      }

      const imagesPayload = assets.map((asset, index) => ({
        uri: asset.uri,
        type: asset.type || 'image/jpeg',
        name: asset.fileName || `reference_${Date.now()}_${index}.jpg`,
      }));

      try {
        await uploadReferenceImages({
          enquiryId: currentEnquiryId,
          images: imagesPayload,
        }).unwrap();

        Alert.alert('Success', 'Reference images uploaded successfully.');
        refetch();
      } catch (error) {
        const message =
          error?.data?.message ||
          error?.data?.error ||
          error?.data ||
          error?.error ||
          'Failed to upload reference images. Please try again.';
        Alert.alert('Upload Failed', message);
      }
    });
  };

  const hasDetailValue = (cell) => {
    if (!cell) return false;
    const value = cell.value;
    return value !== null && value !== undefined && String(value).trim() !== '';
  };

  const renderDetailCell = (cell) => {
    if (!cell) {
      return <View style={styles.detailCellPlaceholder} />;
    }

    const valueExists = hasDetailValue(cell);
    if (!valueExists && !cell.showIfEmpty && !showAllDetails) {
      return <View style={styles.detailCellPlaceholder} />;
    }

    return (
      <View style={styles.detailCell}>
        <View style={styles.detailCellLabelRow}>
          {cell.icon && (
            <Icon name={cell.icon} size={14} color={colors.primary} style={styles.detailCellIcon} />
          )}
          <Text style={styles.detailCellLabel}>{cell.label}</Text>
        </View>
        <Text style={styles.detailCellValue}>
          {valueExists ? cell.value : (cell.placeholder ?? 'N/A')}
        </Text>
      </View>
    );
  };

  const renderDetailRow = (leftCell, rightCell, options = {}) => {
    const shouldRender =
      hasDetailValue(leftCell) ||
      hasDetailValue(rightCell) ||
      leftCell?.showIfEmpty ||
      rightCell?.showIfEmpty ||
      showAllDetails ||
      options.showIfEmpty;

    if (!shouldRender) {
      return null;
    }

    return (
      <View style={styles.detailRowTwoColumn}>
        {renderDetailCell(leftCell)}
        {renderDetailCell(rightCell)}
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
    const shippingDate = originalData?.ShippingDate || 
                         enquiry?.ShippingDate || 
                         enquiry?.deadline ||
                         originalData?.deadline ||
                         null;
    // Extract AssignedTo - check ALL possible locations with comprehensive fallback
    const assignedToId = originalData?.AssignedTo || 
                        enquiry?.AssignedTo || 
                        enquiry?.assignedTo ||
                        originalData?.assignedTo ||
                        null;
    const assignedTo = getUserName(assignedToId);
    
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
            {renderDetailRow(
              { icon: 'person', label: 'Client', value: clientName },
              { icon: 'supervisor-account', label: 'Assigned To', value: assignedTo, showIfEmpty: true }
            )}
          </View>
        </Card>

        {/* Description Card - remarks + stamping */}
        <Card style={styles.detailsCard}>
          <Text style={[styles.sectionTitle, { fontSize: 16, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 12 }]}>
            Description
          </Text>
          <Text style={[styles.descriptionText, { color: colors.textSecondary, fontSize: 13, lineHeight: 20 }]}>
            {originalData?.Remarks || enquiry?.Remarks || enquiry?.description || 'No description available'}
          </Text>
          {renderDetailRow(
            { icon: 'label', label: 'Stamping', value: stamping, showIfEmpty: true },
            null,
            { showIfEmpty: !!stamping }
          )}
        </Card>

        {/* Metal Details Card */}
        <Card style={styles.detailsCard}>
          <Text style={[styles.sectionTitle, { fontSize: 16, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 12 }]}>
            Metal Details
          </Text>
          <View style={styles.detailsGrid}>
            {renderDetailRow(
              { icon: 'palette', label: 'Metal Color', value: metalColor },
              { icon: 'verified', label: 'Metal Quality', value: metalQuality }
            )}
          </View>
        </Card>

        {/* Product Details Card */}
        <Card style={styles.detailsCard}>
          <Text style={[styles.sectionTitle, { fontSize: 16, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 12 }]}>
            Product Details
          </Text>
          <View style={styles.detailsGrid}>
            {renderDetailRow(
              { icon: 'category', label: 'Category', value: category },
              { icon: 'inventory', label: 'Quantity', value: quantity ? `${quantity}` : null }
            )}
            {renderDetailRow(
              { icon: 'grain', label: 'Stone Type', value: stoneType },
              { icon: 'label', label: 'Style Number', value: styleNumber }
            )}
            {renderDetailRow(
              { icon: 'scale', label: 'Metal Weight', value: metalWeightText },
              { icon: 'grain', label: 'Diamond Weight', value: diamondWeightText }
            )}
            {renderDetailRow(
              { icon: 'label', label: 'Stamping', value: stamping, showIfEmpty: true },
              { icon: 'receipt', label: 'Gati Order Number', value: gatiOrderNumber, showIfEmpty: true },
              { showIfEmpty: !!stamping || !!gatiOrderNumber }
            )}
          </View>
        </Card>

        {/* Dates Card */}
        <Card style={styles.detailsCard}>
          <Text style={[styles.sectionTitle, { fontSize: 16, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 12 }]}>
            Dates
          </Text>
          <View style={styles.detailsGrid}>
            {renderDetailRow(
              { icon: 'schedule', label: 'Created', value: formatDate(createdAt) },
              { icon: 'update', label: 'Last Updated', value: formatDate(updatedAt) }
            )}
            {renderDetailRow(
              { icon: 'calendar-today', label: 'Shipping Date', value: shippingDate ? formatDate(shippingDate) : null },
              null
            )}
          </View>
        </Card>

        {/* Assignment & Codes Card (for admin/viewing) */}
        {(assignedToId || enquiry?.CoralCode || enquiry?.CadCode || originalData?.CoralCode || originalData?.CadCode) && (
          <Card style={styles.detailsCard}>
            <Text style={[styles.sectionTitle, { fontSize: 16, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 12 }]}>
              Assignment & Codes
            </Text>
            <View style={styles.detailsGrid}>
              {renderDetailRow(
                { icon: 'person', label: 'Assigned To', value: assignedTo, showIfEmpty: true },
                { icon: 'description', label: 'Coral Code', value: enquiry?.CoralCode || enquiry?.coralVersion || originalData?.CoralCode || originalData?.coralVersion }
              )}
              {renderDetailRow(
                { icon: 'description', label: 'CAD Code', value: enquiry?.CadCode || enquiry?.cadVersion },
                null
              )}
            </View>
          </Card>
        )}
      </>
    );
  };

  // Component to render image with fetch authentication and caching
  const ImageWithFallback = React.memo(({ image, imageKey, imageId, imageUri, index, onPress, initialDataUri }) => {
    const [imageDataUri, setImageDataUri] = useState(initialDataUri || null);
    const [imageLoading, setImageLoading] = useState(false);
    const [imageError, setImageError] = useState(false);
    const lastImageKeyRef = useRef(null);
    const isFetchingRef = useRef(false);
    const mountedRef = useRef(true);
    
    // Reset mounted flag on mount
    useEffect(() => {
      mountedRef.current = true;
      return () => {
        mountedRef.current = false;
      };
    }, []);
    
    useEffect(() => {
      if (initialDataUri && initialDataUri !== imageDataUri) {
        setImageDataUri(initialDataUri);
      }
    }, [initialDataUri, imageDataUri]);
    
    // Fetch image with authentication and caching
    const fetchImageWithAuth = useCallback(async (imageUrl, cacheKey) => {
      if (!imageUrl) {
        return;
      }
      
      // Don't fetch if we already have the data URI or if already fetching
      if (imageDataUri || isFetchingRef.current) {
        return;
      }
      
      isFetchingRef.current = true;
      
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
            
            // Save to cache (fire-and-forget, don't block on storage errors)
            if (cacheKey) {
              memoryCacheRef.current.set(cacheKey, {
                dataUri,
                timestamp: Date.now(),
              });
              if (memoryCacheRef.current.size > MAX_MEMORY_CACHE_SIZE) {
                const firstKey = memoryCacheRef.current.keys().next().value;
                memoryCacheRef.current.delete(firstKey);
              }
              saveImageToCache(cacheKey, dataUri).catch(() => {
                // Silently fail - cache is optional
              });
            }
            
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
            
            // Save to cache (fire-and-forget, don't block on storage errors)
            if (cacheKey) {
              saveImageToCache(cacheKey, dataUri).catch(() => {
                // Silently fail - cache is optional
              });
            }
            
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
      } finally {
        isFetchingRef.current = false;
      }
    }, [imageDataUri, getCachedImage, saveImageToCache]);
    
    useEffect(() => {
      // Generate unique key for this image
      const currentImageKey = imageKey || imageId || imageUri || `image_${index}`;
      
      // If a preloaded URI is provided, use it immediately and skip further work
      if (initialDataUri) {
        lastImageKeyRef.current = currentImageKey;
        setImageDataUri(initialDataUri);
        setImageLoading(false);
        setImageError(false);
        return;
      }
      
      // Generate image URL and cache key first
      let imageUrl = null;
      const cacheKey = getImageCacheKey(imageKey, imageId, imageUri);
      
      if (imageUri && (imageUri.startsWith('http') || imageUri.startsWith('https'))) {
        imageUrl = imageUri;
      } else if (imageKey) {
        const encodedKey = encodeURIComponent(imageKey);
        imageUrl = `${API_BASE_URL}/api/enquiries/files/${encodedKey}`;
      } else if (imageId) {
        imageUrl = `${API_BASE_URL}/api/enquiries/files/${imageId}`;
      }
      
      if (!imageUrl) {
        setImageError(true);
        return;
      }
      
      // Check if this is the same image we already loaded
      if (lastImageKeyRef.current === currentImageKey && imageDataUri) {
        // Same image already loaded, don't reload
        return;
      }
      
      // Check memory cache FIRST (synchronously, before any async operations)
      if (cacheKey && memoryCacheRef.current.has(cacheKey)) {
        const cached = memoryCacheRef.current.get(cacheKey);
        const cacheAge = Date.now() - (cached.timestamp || 0);
        const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
        if (cacheAge < maxAge) {
          lastImageKeyRef.current = currentImageKey;
          setImageDataUri(cached.dataUri);
          setImageLoading(false);
          setImageError(false);
          return; // Exit early - found in memory cache
      } else {
          memoryCacheRef.current.delete(cacheKey);
        }
      }
      
      // Check cache (AsyncStorage) and fetch if needed
      const loadImage = async () => {
        if (!mountedRef.current) return;
        
        // Try AsyncStorage cache (if not in memory-only mode)
        if (cacheKey && !storageFullRef.current) {
          try {
            const cached = await getCachedImage(cacheKey);
            if (cached && mountedRef.current) {
              // Cache hit - set directly without loading state
              lastImageKeyRef.current = currentImageKey;
              setImageDataUri(cached);
              setImageLoading(false);
              setImageError(false);
              return;
            }
          } catch (error) {
            // Cache read failed, continue with fetch
          }
        }
        
        // Cache miss - reset state and fetch
        if (!mountedRef.current) return;
        
        lastImageKeyRef.current = currentImageKey;
        setImageDataUri(null);
        setImageError(false);
        isFetchingRef.current = false;
        setImageLoading(true);
        
        fetchImageWithAuth(imageUrl, cacheKey);
      };
      
      loadImage();
    }, [imageKey, imageId, imageUri, index, onPress, initialDataUri, getImageCacheKey, getCachedImage, fetchImageWithAuth]);
    
    // Use modal styles if onPress is null (modal context)
    const containerStyle = onPress === null ? styles.modalImageWrapper : styles.imageContainer;
    const placeholderStyle = onPress === null ? styles.modalImagePlaceholder : styles.imagePlaceholder;
    
    if (imageError) {
      return (
        <View style={containerStyle}>
          <View style={placeholderStyle}>
            <Icon name="image" size={onPress === null ? 48 : 24} color={onPress === null ? colors.textWhite : colors.textSecondary} />
          </View>
        </View>
      );
    }
    
    if (imageLoading || !imageDataUri) {
      return (
        <View style={containerStyle}>
          <View style={placeholderStyle}>
            {imageLoading && (
              <View style={{ marginBottom: 12 }}>
                <AnimatedLogoLoader size="small" />
              </View>
            )}
            <Icon name="image" size={onPress === null ? 48 : 24} color={onPress === null ? colors.textWhite : colors.textSecondary} />
            {imageLoading && onPress === null && (
              <Text style={{ color: colors.textWhite, marginTop: 8, fontSize: fonts.sm }}>
                Loading image...
              </Text>
            )}
          </View>
        </View>
      );
    }
    
    // If onPress is null, render without TouchableOpacity (for modal - zoom handled by parent ScrollView)
    if (onPress === null) {
      return (
        <View style={styles.modalImageWrapper}>
          <Image
            source={{ uri: imageDataUri }}
            style={styles.fullscreenImage}
            resizeMode="contain"
            onError={() => {
              setImageError(true);
            }}
          />
        </View>
      );
    }
    
    return (
      <TouchableOpacity
        style={styles.imageContainer}
        activeOpacity={0.9}
        onPress={() => {
          if (onPress) {
            onPress(imageDataUri);
          } else {
            handleImagePress(imageDataUri, index, [imageDataUri]);
          }
        }}
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
  }, (prevProps, nextProps) => {
    // Custom comparison to prevent unnecessary re-renders
    return (
      prevProps.imageKey === nextProps.imageKey &&
      prevProps.imageId === nextProps.imageId &&
      prevProps.imageUri === nextProps.imageUri &&
      prevProps.index === nextProps.index &&
      prevProps.onPress === nextProps.onPress
    );
  });

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

    const buildImageMeta = (image) => {
      let imageKey = null;
      let imageId = null;
      let imageUri = null;
      
      if (typeof image === 'object' && image !== null) {
        imageKey = image.Key || image.key || image.KeyName || image.keyName || '';
        imageId = image.Id || image.id || image._id || image.FileId || image.fileId || '';
        imageUri = image.Url || image.url || image.URI || image.uri || image.Location || image.location || image.UrlPath || image.urlPath || '';
      } else if (typeof image === 'string') {
        if (image.startsWith('http') || image.startsWith('https')) {
          imageUri = image;
        } else {
          imageKey = image;
        }
    }

      const cacheKey = getImageCacheKey(imageKey, imageId, imageUri);
      let cachedUri = null;
      if (cacheKey && memoryCacheRef.current.has(cacheKey)) {
        cachedUri = memoryCacheRef.current.get(cacheKey)?.dataUri || null;
      }

      return { image, imageKey, imageId, imageUri, cacheKey, cachedUri };
    };

    // If only one image, show it without slider
    if (images.length === 1) {
      const meta = buildImageMeta(images[0]);

    return (
      <Card style={styles.imagesCard}>
        <Text style={[styles.sectionTitle, { fontSize: 16, fontWeight: 'bold', color: colors.textPrimary }]}>
          Reference Images
          </Text>
          <ImageWithFallback
            image={meta.image}
            imageKey={meta.imageKey}
            imageId={meta.imageId}
            imageUri={meta.imageUri}
            index={0}
            initialDataUri={meta.cachedUri}
            onPress={(uri) => handleImagePress(uri, 0, [meta])}
          />
        </Card>
      );
    }

    // Build array of image data for the modal slider
    const imageDataForModal = images.map(buildImageMeta);

    return (
      <Card style={styles.imagesCard}>
        <Text style={[styles.sectionTitle, { fontSize: 16, fontWeight: 'bold', color: colors.textPrimary }]}>
          Reference Images {images.length > 1 ? `(${images.length})` : ''}
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {images.map((image, index) => {
            const meta = imageDataForModal[index] || buildImageMeta(image);
            return (
              <ImageWithFallback
                key={index}
                image={meta.image}
                imageKey={meta.imageKey}
                imageId={meta.imageId}
                imageUri={meta.imageUri}
                index={index}
                initialDataUri={meta.cachedUri}
                onPress={(uri) => {
                  // Pass all image data to modal for slider
                  handleImagePress(uri, index, imageDataForModal);
                }}
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

      {/* Reference upload for clients */}
      <View style={styles.adminActionsRow}>
        <TouchableOpacity
          style={[styles.adminActionButton, styles.adminActionButtonSecondary]}
          activeOpacity={0.85}
          onPress={handleUploadReferenceImages}
          disabled={isUploadingReference}
        >
          <Icon name="cloud-upload" size={18} color={colors.textWhite} />
          <Text style={styles.adminActionText}>
            {isUploadingReference ? 'Uploading...' : 'Upload Reference Image'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Hide enquiry history for clients (role 4) */}
      {(user?.roleId !== 4 && user?.roleNumber !== 4 && user?.role !== 'client') && (
        <Button
          title="Enquiry History"
          onPress={() => setShowHistoryModal(true)}
          style={[styles.actionButton, styles.historyButton]}
        />
      )}

      {/* Approve and Reject buttons removed for clients - clients don't have permission for these actions */}
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

        {/* Upload Buttons for Admin */}
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
            style={[styles.adminActionButton, styles.adminActionButtonSecondary]}
            activeOpacity={0.85}
            onPress={handleUploadReferenceImages}
            disabled={isUploadingReference}
          >
            <Icon name="photo-library" size={18} color={colors.textWhite} />
            <Text style={styles.adminActionText}>
              {isUploadingReference ? 'Uploading...' : 'Upload Reference Image'}
            </Text>
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

      {isImageModalVisible && (
        <Modal
          visible={isImageModalVisible}
          transparent
          animationType="fade"
          onRequestClose={closeImageModal}
        >
          <View style={styles.fullscreenImageBackdrop}>
            {/* Close button - positioned with high z-index */}
            <TouchableOpacity 
              style={styles.fullscreenImageCloseButton} 
              onPress={closeImageModal}
              activeOpacity={0.7}
            >
              <Icon name="close" size={24} color={colors.textWhite} />
            </TouchableOpacity>
            
            {modalImages.length > 1 ? (
              <>
                {/* Image Counter */}
                <View style={styles.modalImageCounter}>
                  <Text style={styles.modalImageCounterText}>
                    {modalCurrentIndex + 1} / {modalImages.length}
                  </Text>
                </View>
                
                {/* Slider for multiple images with zoom */}
                <FlatList
                  ref={modalFlatListRef}
                  data={modalImages}
                  renderItem={({ item, index }) => (
                    <View style={styles.modalImageContainer}>
                      <ImageZoom
                        cropWidth={screenWidth}
                        cropHeight={screenHeight}
                        imageWidth={screenWidth}
                        imageHeight={screenHeight}
                        enableCenterFocus
                        useNativeDriver
                        enableSwipeDown={false}
                        pinchToZoom
                        panToMove={isModalZoomed}
                        onMove={handleZoomMove}
                      >
                      <ImageWithFallback
                        image={item.image}
                        imageKey={item.imageKey}
                        imageId={item.imageId}
                        imageUri={item.imageUri}
                        index={index}
                          initialDataUri={item.cachedUri}
                        onPress={null} // No click handler in modal
                      />
                      </ImageZoom>
                    </View>
                  )}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  initialScrollIndex={modalCurrentIndex}
                  onViewableItemsChanged={modalOnViewableItemsChanged}
                  viewabilityConfig={modalViewabilityConfig}
                  getItemLayout={(data, index) => ({
                    length: screenWidth,
                    offset: screenWidth * index,
                    index,
                  })}
                  scrollEnabled={!isModalZoomed}
                  onMomentumScrollEnd={() => setIsModalZoomed(false)}
                  onScrollBeginDrag={() => setIsModalZoomed(false)}
                  keyExtractor={getModalImageKey}
                  removeClippedSubviews={false}
                  windowSize={3}
                  initialNumToRender={3}
                  maxToRenderPerBatch={3}
                />

                {modalImages.length > 1 && (
                  <>
                    <TouchableOpacity
                      style={[styles.modalNavButton, styles.modalNavButtonLeft, modalCurrentIndex === 0 && styles.modalNavButtonDisabled]}
                      onPress={handleModalPrev}
                      disabled={modalCurrentIndex === 0}
                      activeOpacity={0.8}
                    >
                      <Icon name="chevron-left" size={28} color={colors.textWhite} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalNavButton, styles.modalNavButtonRight, modalCurrentIndex === modalImages.length - 1 && styles.modalNavButtonDisabled]}
                      onPress={handleModalNext}
                      disabled={modalCurrentIndex === modalImages.length - 1}
                      activeOpacity={0.8}
                    >
                      <Icon name="chevron-right" size={28} color={colors.textWhite} />
                    </TouchableOpacity>
                  </>
                )}
                
                {/* Pagination Dots */}
                <View style={styles.modalPaginationContainer}>
                  {modalImages.map((_, index) => (
                    <View
                      key={index}
                      style={[
                        styles.modalPaginationDot,
                        index === modalCurrentIndex && styles.modalPaginationDotActive,
                      ]}
                    />
                  ))}
                </View>
              </>
            ) : (
              /* Single image with zoom */
              <View style={styles.modalImageContainer}>
                <ImageZoom
                  cropWidth={screenWidth}
                  cropHeight={screenHeight}
                  imageWidth={screenWidth}
                  imageHeight={screenHeight}
                  enableCenterFocus
                  useNativeDriver
                  enableSwipeDown={false}
                  pinchToZoom
                  panToMove={isModalZoomed}
                  onMove={handleZoomMove}
                >
            <Image
              source={{ uri: selectedImageUri }}
              style={styles.fullscreenImage}
              resizeMode="contain"
            />
                </ImageZoom>
              </View>
            )}
          </View>
        </Modal>
      )}

      {showApprovalModal && renderApprovalModal()}
      
      <EnquiryHistoryModal
        visible={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        enquiry={enquiry}
      />

      {canShowChatFab && (
        <TouchableOpacity style={styles.chatFab} onPress={handleOpenChat} activeOpacity={0.85}>
          <Icon name="chat" size={20} color={colors.textWhite} />
          <Text style={styles.chatFabText}>Open Chat</Text>
        </TouchableOpacity>
      )}
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
  detailRowTwoColumn: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  detailCell: {
    flex: 1,
    paddingVertical: 4,
  },
  detailCellPlaceholder: {
    flex: 1,
    paddingVertical: 4,
  },
  detailCellLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 4,
  },
  detailCellIcon: {
    marginRight: 4,
  },
  detailCellLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: colors.textSecondary,
  },
  detailCellValue: {
    fontSize: 13,
    color: colors.textPrimary,
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
  sliderImageContainer: {
    paddingHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
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
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    paddingVertical: 8,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border || '#E0E0E0',
    marginHorizontal: 4,
  },
  paginationDotActive: {
    backgroundColor: colors.primary || '#2196F3',
    width: 10,
    height: 10,
    borderRadius: 5,
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
  chatFab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.xl,
    backgroundColor: colors.primary,
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  chatFabText: {
    color: colors.textWhite,
    marginLeft: 8,
    fontFamily: fonts.medium,
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
    position: 'relative',
  },
  fullscreenImage: {
    width: '100%',
    height: '100%',
  },
  modalImageContainer: {
    width: Dimensions.get('window').width,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImageWrapper: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomScrollView: {
    flex: 1,
    width: Dimensions.get('window').width,
  },
  zoomScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalNavButton: {
    position: 'absolute',
    top: '50%',
    marginTop: -28,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 12,
    borderRadius: 28,
    zIndex: 15,
  },
  modalNavButtonLeft: {
    left: 12,
  },
  modalNavButtonRight: {
    right: 12,
  },
  modalNavButtonDisabled: {
    opacity: 0.35,
  },
  modalImageCounter: {
    position: 'absolute',
    top: 60,
    left: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    zIndex: 10,
  },
  modalImageCounterText: {
    color: colors.textWhite,
    fontSize: fonts.sm,
    fontFamily: fonts.medium,
  },
  modalPaginationContainer: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  modalPaginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    marginHorizontal: 4,
  },
  modalPaginationDotActive: {
    backgroundColor: colors.textWhite,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  fullscreenImageCloseButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    padding: 12,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    zIndex: 1000,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
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
