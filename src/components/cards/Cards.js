import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import { spacing, responsivePadding, imageSizes } from '../../utils';
import { formatCount } from '../../utils/helpers';
import Icon from '../common/Icon';
import { FILE_BASE_URL, API_BASE_URL } from '../../config/apiConfig';
import { getCachedImage, cacheImage } from '../../utils/imageCache';
import { getUserName } from '../../utils/userUtils';

export const Card = ({ children, style, onPress, ...props }) => {
  const CardComponent = onPress ? TouchableOpacity : View;
  
  return (
    <CardComponent
      style={[styles.card, style]}
      onPress={onPress}
      {...props}>
      {children}
    </CardComponent>
  );
};

export const StatusCard = ({ title, value, icon, color = colors.primary, valueColor, onPress }) => (
  <Card style={styles.statusCard} onPress={onPress}>
    <View style={styles.statusCardContent}>
      <View style={styles.statusHeader}>
        <View style={[styles.statusIcon, { backgroundColor: color }]}>
          {icon}
        </View>
        <Text style={styles.statusTitle}>
          {title}
        </Text>
      </View>
      <Text style={[styles.statusValue, valueColor && { color: valueColor }]}>
        {formatCount(value)}
      </Text>
    </View>
  </Card>
);

export const EnquiryStatusCard = ({ status, value, color, borderColor, icon, onPress, style }) => (
  <Card style={[styles.enquiryStatusCard, { borderColor: borderColor || color }, style]} onPress={onPress}>
    <Text style={styles.statusLabel} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.8}>
      {status}
    </Text>
    <Text style={styles.statusValue}>{formatCount(value)}</Text>
  </Card>
);

// Compact Enquiry Card - 2 per row design
export const CompactEnquiryCard = ({
  enquiry,
  onPress,
  getStatusColor,
  getStatusIcon,
  getPriorityColor,
  getPriorityIcon,
  formatCurrency,
  formatDate,
  userRole,
}) => {
  // Hooks must be called at the top level, before any conditional returns
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  // Safety checks to prevent undefined errors
  if (!enquiry) {
    return null;
  }

  const statusColor = getStatusColor ? getStatusColor(enquiry.status || 'pending') : colors.primary;
  const priorityColor = getPriorityColor ? getPriorityColor(enquiry.priority || 'medium') : colors.textSecondary;
  
  // Extract metal color and quality
  const metalColor = enquiry.Metal?.Color || enquiry.metal?.color || enquiry.metalColor || 'Gold';
  const metalQuality = enquiry.Metal?.Quality || enquiry.metal?.quality || enquiry.metalQuality || '';
  const metalDisplay = metalQuality ? `${metalColor} ${metalQuality}` : metalColor;
  
  // Get assigned to - resolve ID to name if needed
  const assignedToId = enquiry.AssignedTo || enquiry.assignedTo;
  const assignedToName = enquiry.assignedToName;
  // If we have an ID but no name, resolve it using getUserName utility
  const assignedTo = assignedToName || (assignedToId ? getUserName(assignedToId) : 'Unassigned');
  
  // Get stone type
  const stoneType = enquiry.StoneType || enquiry.stoneType || 'N/A';
  
  // Get category
  const category = enquiry.Category || enquiry.category || 'N/A';
  
  // Format dates
  const createdDate = formatDate ? formatDate(enquiry.createdAt || new Date().toISOString()) : (enquiry.createdAt ? new Date(enquiry.createdAt).toLocaleDateString() : 'N/A');
  const shippingDate = formatDate && enquiry.deadline ? formatDate(enquiry.deadline) : (enquiry.ShippingDate || enquiry.deadline ? new Date(enquiry.ShippingDate || enquiry.deadline).toLocaleDateString() : 'N/A');
  
  // Format price (only for client role)
  const showPrice = userRole === 'client';
  const price = formatCurrency ? formatCurrency(enquiry.budget || 0) : `₹${enquiry.budget || 0}`;
  
  // Check design progress stages
  const hasDesign = enquiry.Coral && Array.isArray(enquiry.Coral) && enquiry.Coral.length > 0;
  const hasCAD = enquiry.Cad && Array.isArray(enquiry.Cad) && enquiry.Cad.length > 0;
  const hasOrder = enquiry.status === 'completed' || enquiry.status === 'in_progress';

  // Get reference image - fetch latest from ReferenceImages array
  const getReferenceImage = () => {
    let referenceImages = [];
    
    // Priority 1: Check original data structure (before normalization) - most reliable
    if (enquiry?._originalData?.ReferenceImages && Array.isArray(enquiry._originalData.ReferenceImages)) {
      referenceImages = enquiry._originalData.ReferenceImages;
    }
    // Priority 2: Check direct ReferenceImages property
    else if (enquiry?.ReferenceImages && Array.isArray(enquiry.ReferenceImages)) {
      referenceImages = enquiry.ReferenceImages;
    }
    // Priority 3: Check normalized images (from API transform)
    else if (enquiry?.images && Array.isArray(enquiry.images) && enquiry.images.length > 0) {
      // Normalized images might be strings or objects
      referenceImages = enquiry.images;
    }
    // Priority 4: Check Images property (fallback)
    else if (enquiry?.Images && Array.isArray(enquiry.Images)) {
      referenceImages = enquiry.Images;
    }
    
    if (referenceImages.length === 0) {
      if (__DEV__) {
        console.log('No ReferenceImages found for enquiry:', enquiry?.id, {
          hasOriginalData: !!enquiry?._originalData,
          hasReferenceImages: !!enquiry?.ReferenceImages,
          hasImages: !!enquiry?.images,
          enquiryKeys: enquiry ? Object.keys(enquiry).slice(0, 15) : [],
        });
      }
      return null;
    }
    
    // Get the latest image (last item in array)
    const latestImage = referenceImages[referenceImages.length - 1];
    
    if (__DEV__) {
      console.log('Found ReferenceImages for enquiry:', enquiry?.id, {
        totalImages: referenceImages.length,
        latestImage: latestImage,
        imageType: typeof latestImage,
      });
    }
    
    // Handle object format (most common - has Key, Id, etc.)
    if (typeof latestImage === 'object' && latestImage !== null) {
      // Priority 1: Use Key property (most reliable)
      const imageKey = latestImage.Key || latestImage.key || latestImage.KeyName || latestImage.keyName || '';
      
      if (imageKey) {
        // Construct URL from key: /api/enquiries/files/{key}
        const encodedKey = encodeURIComponent(imageKey);
        const url = `${FILE_BASE_URL}/api/enquiries/files/${encodedKey}`;
        if (__DEV__) console.log('Constructed URL from Key:', url, 'Original Key:', imageKey);
        return url;
      }
      
      // Priority 2: Use Id property as fallback
      const imageId = latestImage.Id || latestImage.id || latestImage._id || latestImage.FileId || latestImage.fileId || '';
      if (imageId) {
        const url = `${FILE_BASE_URL}/api/enquiries/files/${imageId}`;
        if (__DEV__) console.log('Constructed URL from Id:', url);
        return url;
      }
      
      // Priority 3: Check for URL properties
      const imageUrl = latestImage.Url || latestImage.url || latestImage.URI || latestImage.uri || 
                      latestImage.Location || latestImage.location || latestImage.UrlPath || latestImage.urlPath || '';
      if (imageUrl) {
        if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
          if (__DEV__) console.log('Using full URL from object:', imageUrl);
          return imageUrl;
        }
        if (imageUrl.startsWith('/')) {
          const url = `${FILE_BASE_URL}${imageUrl}`;
          if (__DEV__) console.log('Constructed URL from object path:', url);
          return url;
        }
        const url = `${FILE_BASE_URL}/${imageUrl}`;
        if (__DEV__) console.log('Constructed URL from object relative path:', url);
        return url;
      }
      
      if (__DEV__) {
        console.warn('Image object has no Key/Id/Url:', JSON.stringify(latestImage));
      }
      return null;
    }
    
    // Handle string format
    if (typeof latestImage === 'string') {
      // If it's already a full URL, use it directly
      if (latestImage.startsWith('http://') || latestImage.startsWith('https://')) {
        if (__DEV__) console.log('Using full URL:', latestImage);
        return latestImage;
      }
      // If it starts with /, it's a path - construct full URL
      if (latestImage.startsWith('/')) {
        const url = `${FILE_BASE_URL}${latestImage}`;
        if (__DEV__) console.log('Constructed URL from path:', url);
        return url;
      }
      // Otherwise, treat as file key
      const encodedKey = encodeURIComponent(latestImage);
      const url = `${FILE_BASE_URL}/api/enquiries/files/${encodedKey}`;
      if (__DEV__) console.log('Constructed URL from string key:', url);
      return url;
    }
    
    if (__DEV__) {
      console.warn('Could not extract image URL from:', latestImage, 'Type:', typeof latestImage);
    }
    return null;
  };

  // Memoize the reference image URI to prevent unnecessary recalculations
  const referenceImageUri = useMemo(() => getReferenceImage(), [
    enquiry?._originalData?.ReferenceImages,
    enquiry?.ReferenceImages,
    enquiry?.images,
    enquiry?.Images,
  ]);
  
  const [imageDataUri, setImageDataUri] = useState(null);
  const fetchAbortController = useRef(null);
  
  // Log when referenceImageUri changes
  useEffect(() => {
    if (__DEV__ && enquiry?.id) {
      console.log('🔍 referenceImageUri changed:', {
        enquiryId: enquiry.id,
        referenceImageUri: referenceImageUri,
        willFetch: !!referenceImageUri,
      });
    }
  }, [referenceImageUri, enquiry?.id]);

  // Debug logging in development
  useEffect(() => {
    if (__DEV__ && enquiry?.id) {
      const originalRefImages = enquiry._originalData?.ReferenceImages;
      const directRefImages = enquiry?.ReferenceImages;
      
      console.log('📸 CompactEnquiryCard - Image Debug:', {
        enquiryId: enquiry.id,
        hasOriginalData: !!enquiry._originalData,
        originalRefImagesCount: originalRefImages?.length || 0,
        originalRefImages: originalRefImages,
        hasDirectRefImages: !!directRefImages,
        directRefImagesCount: directRefImages?.length || 0,
        directRefImages: directRefImages,
        hasNormalizedImages: !!enquiry.images,
        normalizedImagesCount: enquiry.images?.length || 0,
        referenceImageUri: referenceImageUri,
        imageDataUri: imageDataUri ? `data:... (${imageDataUri.length} chars)` : null,
        imageError: imageError,
        imageLoading: imageLoading,
        latestImageFromOriginal: originalRefImages?.[originalRefImages?.length - 1],
        latestImageFromDirect: directRefImages?.[directRefImages?.length - 1],
      });
    }
  }, [enquiry?.id, referenceImageUri, imageDataUri, imageError, imageLoading]);

  // Fetch image with authentication and convert to data URI (with caching)
  useEffect(() => {
    // Cleanup: abort any ongoing fetch when component unmounts or URI changes
    return () => {
      if (fetchAbortController.current) {
        fetchAbortController.current.abort();
        fetchAbortController.current = null;
      }
    };
  }, [referenceImageUri]);

  useEffect(() => {
    if (__DEV__) {
      console.log('🔄 Image fetch useEffect triggered:', {
        enquiryId: enquiry?.id,
        referenceImageUri: referenceImageUri,
        hasUri: !!referenceImageUri,
      });
    }

    if (!referenceImageUri) {
      if (__DEV__) {
        console.log('⏭️ No referenceImageUri, skipping image fetch');
      }
      setImageDataUri(null);
      setImageError(false);
      setImageLoading(false);
      return;
    }

    // Abort previous fetch if any
    if (fetchAbortController.current) {
      fetchAbortController.current.abort();
    }

    // Create new AbortController for this fetch
    fetchAbortController.current = new AbortController();
    const signal = fetchAbortController.current.signal;

    // Reset state
    setImageError(false);
    setImageLoading(true);
    setImageDataUri(null);

    // If it's already a data URI, use it directly
    if (referenceImageUri.startsWith('data:')) {
      setImageDataUri(referenceImageUri);
      setImageLoading(false);
      return;
    }

    // Check cache first
    const checkCacheAndFetch = async () => {
      try {
        // Try to get from cache
        const cachedImage = await getCachedImage(referenceImageUri);
        
        if (cachedImage) {
          if (__DEV__) {
            console.log('✅ Using cached image for:', referenceImageUri.substring(0, 50));
          }
          setImageDataUri(cachedImage);
          setImageLoading(false);
          setImageError(false);
          return;
        }

        // Cache miss - proceed with fetch
        if (__DEV__) {
          console.log('🔄 Cache miss, fetching image:', referenceImageUri);
        }

        // Fetch image with authentication
        const fetchImageWithAuth = async () => {
          try {
            const token = await AsyncStorage.getItem('token');
            if (!token) {
              if (__DEV__) console.warn('No token available for image fetch');
              setImageError(true);
              setImageLoading(false);
              return;
            }

            if (__DEV__) {
              console.log('🔄 Fetching card image with auth:', referenceImageUri);
            }

            const response = await fetch(referenceImageUri, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${token}`,
              },
              signal: signal, // Add abort signal
            });

            if (response.ok) {
              const contentType = response.headers.get('content-type') || '';
              
              if (__DEV__) {
                console.log('✅ Image fetch OK, content-type:', contentType);
              }

              // Check if response is JSON (API returns a URL object)
              if (contentType.includes('application/json')) {
            if (__DEV__) {
              console.log('📄 API returned JSON, parsing response...');
            }
            
            let jsonData;
            try {
              const responseText = await response.text();
              if (__DEV__) {
                console.log('📄 Raw JSON response text:', responseText.substring(0, 500));
              }
              jsonData = JSON.parse(responseText);
            } catch (parseError) {
              if (__DEV__) {
                console.error('❌ Failed to parse JSON:', parseError);
              }
              setImageError(true);
              setImageLoading(false);
              return;
            }
            
            if (__DEV__) {
              console.log('📄 JSON response:', JSON.stringify(jsonData, null, 2));
              console.log('📄 JSON keys:', Object.keys(jsonData));
            }
            
            // Try multiple possible URL fields - check nested structures too
            let actualImageUrl = null;
            
            // Check top-level fields
            actualImageUrl = jsonData.url || jsonData.imageUrl || jsonData.src || jsonData.location || 
                           jsonData.Url || jsonData.Location || jsonData.fileUrl || jsonData.fileURL ||
                           jsonData.image || jsonData.Image || jsonData.file || jsonData.File;
            
            // Check nested data object
            if (!actualImageUrl && jsonData.data) {
              actualImageUrl = jsonData.data.url || jsonData.data.imageUrl || jsonData.data.src || 
                             jsonData.data.location || jsonData.data.Url || jsonData.data.Location ||
                             jsonData.data.fileUrl || jsonData.data.fileURL;
            }
            
            // Check if it's an array with URL objects
            if (!actualImageUrl && Array.isArray(jsonData) && jsonData.length > 0) {
              const firstItem = jsonData[0];
              actualImageUrl = firstItem.url || firstItem.imageUrl || firstItem.src || firstItem.location ||
                             firstItem.Url || firstItem.Location || firstItem.fileUrl || firstItem.fileURL;
            }
            
            // Check if response has a message/error
            if (!actualImageUrl && jsonData.message) {
              if (__DEV__) {
                console.warn('⚠️ API returned message instead of URL:', jsonData.message);
              }
            }
            
            if (!actualImageUrl) {
              if (__DEV__) {
                console.error('❌ No image URL found in JSON response. Available keys:', Object.keys(jsonData));
              }
              setImageError(true);
              setImageLoading(false);
              return;
            }
            
            if (__DEV__) {
              console.log('🖼️ Found image URL in JSON:', actualImageUrl);
            }
            
            // If it's an S3 URL or public URL, use it directly (no need to convert to base64)
            // React Native Image component can handle HTTP/HTTPS URLs directly
            if (actualImageUrl.includes('amazonaws.com') || actualImageUrl.includes('s3.') || 
                actualImageUrl.startsWith('http://') || actualImageUrl.startsWith('https://')) {
              
              if (__DEV__) {
                console.log('✅ Using S3/public URL directly (no base64 conversion needed)');
              }
              
              // Cache the URL
              await cacheImage(referenceImageUri, actualImageUrl);
              
              // Use the URL directly - React Native Image can handle it
              setImageDataUri(actualImageUrl);
              setImageLoading(false);
              setImageError(false);
              
              if (__DEV__) {
                console.log('✅ Image URL set, should render now');
              }
              return;
            }
            
            // For non-public URLs, fetch and convert to base64
            if (__DEV__) {
              console.log('🔄 Fetching image for base64 conversion...');
            }
            
            const imageResponse = await fetch(actualImageUrl, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${token}`,
              },
            });
            
            if (!imageResponse.ok) {
              if (__DEV__) {
                console.error('❌ Failed to fetch actual image:', imageResponse.status, imageResponse.statusText);
              }
              setImageError(true);
              setImageLoading(false);
              return;
            }
            
            const imageContentType = imageResponse.headers.get('content-type') || 'image/jpeg';
            
            if (__DEV__) {
              console.log('✅ Actual image fetched, converting to base64. Content-type:', imageContentType);
            }
            
            // Convert to base64
            const arrayBuffer = await imageResponse.arrayBuffer();
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
                base64 = Buffer.from(bytes).toString('base64');
              } else {
                if (__DEV__) {
                  console.error('❌ Error converting to base64:', e);
                }
                throw e;
              }
            }
            
            const dataUri = `data:${imageContentType};base64,${base64}`;
            
            if (__DEV__) {
              console.log('✅ Image converted to data URI');
              console.log('   - Content type:', imageContentType);
              console.log('   - Base64 length:', base64.length);
              console.log('   - Data URI length:', dataUri.length);
            }
            
            // Cache the data URI
            await cacheImage(referenceImageUri, dataUri);
            
            // Set the image data URI
            setImageDataUri(dataUri);
            setImageLoading(false);
            setImageError(false);
            
            if (__DEV__) {
              console.log('✅ Image state updated, should render now');
            }
          } else {
            // Direct image response - convert to base64
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
                base64 = Buffer.from(bytes).toString('base64');
              } else {
                throw e;
              }
            }
            
            const dataUri = `data:${contentType || 'image/jpeg'};base64,${base64}`;
            
            if (__DEV__) {
              console.log('✅ Direct image converted to data URI');
              console.log('   - Content type:', contentType);
              console.log('   - Base64 length:', base64.length);
              console.log('   - Data URI length:', dataUri.length);
            }
            
            // Cache the data URI
            await cacheImage(referenceImageUri, dataUri);
            
            setImageDataUri(dataUri);
            setImageLoading(false);
            setImageError(false);
          }
        } else {
          if (__DEV__) {
            console.warn('Image fetch failed:', response.status, response.statusText);
          }
          setImageError(true);
          setImageLoading(false);
        }
      } catch (error) {
        // Don't set error if fetch was aborted
        if (error.name === 'AbortError') {
          if (__DEV__) {
            console.log('⏹️ Image fetch aborted for:', enquiry?.id);
          }
          return;
        }
        
        if (__DEV__) {
          console.error('Error fetching image:', error);
        }
            setImageError(true);
            setImageLoading(false);
          }
        };

        fetchImageWithAuth();
      } catch (error) {
        if (__DEV__) {
          console.error('Error in checkCacheAndFetch:', error);
        }
        setImageError(true);
        setImageLoading(false);
      }
    };

    checkCacheAndFetch();
    
    // Cleanup function
    return () => {
      if (fetchAbortController.current) {
        fetchAbortController.current.abort();
      }
    };
  }, [referenceImageUri, enquiry?.id]);

  return (
    <Card style={styles.compactEnquiryCard} onPress={onPress}>
      {/* Reference Image - Always show container */}
      <View style={styles.compactImageContainer}>
        {imageDataUri && !imageError ? (
          <Image
            source={{ uri: imageDataUri }}
            style={styles.compactImage}
            resizeMode="cover"
            onLoad={() => {
              if (__DEV__) {
                console.log('✅ Image loaded successfully in Image component');
              }
            }}
            onError={(error) => {
              if (__DEV__) {
                console.error('❌ Image component error:', error);
                console.error('❌ Failed imageDataUri length:', imageDataUri?.length);
                console.error('❌ Failed imageDataUri preview:', imageDataUri?.substring(0, 100));
              }
              setImageError(true);
            }}
          />
        ) : (
          <View style={styles.compactImagePlaceholder}>
            <Icon name="image" size={32} color={colors.textLight} />
            <Text style={styles.compactImagePlaceholderText}>No image available</Text>
            {__DEV__ && (
              <Text style={[styles.compactImagePlaceholderText, { fontSize: 6, marginTop: 2 }]}>
                {referenceImageUri ? 'Loading...' : 'No image'}
              </Text>
            )}
          </View>
        )}
        {imageLoading && referenceImageUri && !imageError && (
          <View style={styles.compactImageLoading}>
            <Icon name="sync" size={20} color={colors.textLight} />
          </View>
        )}
      </View>

      <View style={styles.compactCardContent}>
        {/* Row 1: Name and Priority */}
        <View style={styles.compactRow1}>
          <Text style={styles.compactName} numberOfLines={1}>
            {enquiry.title || enquiry.Name || 'Untitled Enquiry'}
          </Text>
          <View style={[styles.compactPriorityBadge, { backgroundColor: priorityColor + '15' }]}>
            <Text style={[styles.compactPriorityText, { color: priorityColor }]} numberOfLines={1}>
              {(enquiry.priority || 'medium').toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Row 2: Status (right aligned) */}
        <View style={styles.compactRow2}>
          <View style={[styles.compactStatusBadge, { backgroundColor: statusColor + '15' }]}>
            <Text style={[styles.compactStatusText, { color: statusColor }]} numberOfLines={1}>
              {(enquiry.status || 'pending').replace('_', ' ').toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Row 3: Assigned to and Created Date */}
        <View style={styles.compactRow3}>
          <View style={styles.compactFieldGroup}>
            <Text style={styles.compactLabelText}>Assigned to</Text>
            <Text style={styles.compactValueText} numberOfLines={1}>{assignedTo}</Text>
          </View>
          <View style={styles.compactFieldGroup}>
            <Text style={styles.compactLabelText}>Created</Text>
            <Text style={styles.compactValueText}>{createdDate}</Text>
          </View>
        </View>

        {/* Row 4: Shipping Date (right aligned) */}
        <View style={styles.compactRow4}>
          <View style={styles.compactFieldGroup}>
            <Text style={styles.compactLabelText}>Shipping</Text>
            <Text style={styles.compactValueText}>{shippingDate}</Text>
          </View>
        </View>

        {/* Row 5: Metal, Category, Stone type */}
        <View style={styles.compactRow5}>
          <View style={styles.compactMaterialItem}>
            <Text style={styles.compactMaterialLabel}>Metal</Text>
            <Text style={styles.compactMaterialValue} numberOfLines={1}>{metalDisplay}</Text>
          </View>
          <View style={styles.compactMaterialItem}>
            <Text style={styles.compactMaterialLabel}>Category</Text>
            <Text style={styles.compactMaterialValue} numberOfLines={1}>{category}</Text>
          </View>
          <View style={styles.compactMaterialItem}>
            <Text style={styles.compactMaterialLabel}>Stone type</Text>
            <Text style={styles.compactMaterialValue} numberOfLines={1}>{stoneType}</Text>
          </View>
        </View>

        {/* Row 6: Price (only for client) */}
        {showPrice && (
          <View style={styles.compactRow6}>
            <Text style={styles.compactPriceLabel}>Price</Text>
            <Text style={styles.compactPriceValue}>{price}</Text>
          </View>
        )}

        {/* Row 7: Design Progress - Design, CAD, Order placement */}
        {/* <View style={styles.compactRow7}>
          <View style={[styles.compactProgressItem, hasDesign && styles.compactProgressItemActive]}>
            <Text style={[styles.compactProgressText, hasDesign && styles.compactProgressTextActive]}>Design</Text>
          </View>
          <View style={[styles.compactProgressItem, hasCAD && styles.compactProgressItemActive]}>
            <Text style={[styles.compactProgressText, hasCAD && styles.compactProgressTextActive]}>CAD</Text>
          </View>
          <View style={[styles.compactProgressItem, hasOrder && styles.compactProgressItemActive]}>
            <Text style={[styles.compactProgressText, hasOrder && styles.compactProgressTextActive]}>Order placement</Text>
          </View>
        </View> */}
      </View>
    </Card>
  );
};

export const EnquiryCard = ({
  enquiry,
  onPress,
  getStatusColor,
  getStatusIcon,
  getPriorityColor,
  getPriorityIcon,
  formatCurrency,
  formatDate,
}) => {
  // Safety checks to prevent undefined errors
  if (!enquiry) {
    return null;
  }

  const statusColor = getStatusColor ? getStatusColor(enquiry.status || 'pending') : colors.primary;
  const statusIcon = getStatusIcon ? getStatusIcon(enquiry.status || 'pending') : 'help';
  const priorityColor = getPriorityColor ? getPriorityColor(enquiry.priority || 'medium') : colors.textSecondary;
  const priorityIcon = getPriorityIcon ? getPriorityIcon(enquiry.priority || 'medium') : 'help';
  const formattedPrice = formatCurrency ? formatCurrency(enquiry.budget || 0) : `₹${enquiry.budget || 0}`;
  const formattedDate = formatDate ? formatDate(enquiry.createdAt || new Date().toISOString()) : (enquiry.createdAt || 'Recently');

  return (
    <Card style={styles.enquiryCard} onPress={onPress}>
      {/* Header with Status and Priority */}
      <View style={styles.enquiryHeader}>
        <View style={styles.enquiryTitleContainer}>
          <Text style={styles.enquiryTitle} numberOfLines={2}>
            {enquiry.title || 'Untitled Enquiry'}
          </Text>
          <Text style={styles.enquiryClient}>
            {enquiry.clientName || 'Unknown Client'}
          </Text>
        </View>
        <View style={styles.enquiryBadges}>
          <View style={styles.statusIndicator}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {(enquiry.status || 'pending').replace('_', ' ').toUpperCase()}
            </Text>
          </View>
          <View style={styles.priorityIndicator}>
            <View style={[styles.priorityDot, { backgroundColor: priorityColor }]} />
            <Text style={[styles.priorityText, { color: priorityColor }]}>
              {(enquiry.priority || 'medium').toUpperCase()}
            </Text>
          </View>
        </View>
      </View>

      {/* Description */}
      <Text style={styles.enquiryDescription} numberOfLines={2}>
        {enquiry.description || 'No description available'}
      </Text>

      {/* Details Row */}
      <View style={styles.enquiryDetails}>
        <View style={styles.detailItem}>
          <Icon name="workspace-premium" size={14} color={colors.primary} />
          <Text style={styles.detailText}>{enquiry.metalType || 'Gold'}</Text>
        </View>
        <View style={styles.detailItem}>
          <Icon name="lens" size={14} color={colors.primary} />
          <Text style={styles.detailText}>{enquiry.category || 'General'}</Text>
        </View>
        <View style={styles.detailItem}>
          <Icon name="diamond" size={14} color={colors.primary} />
          <Text style={styles.detailText}>{enquiry.stoneType || 'Diamond'}</Text>
        </View>
      </View>

      {/* Footer with Price and Date */}
      <View style={styles.enquiryFooter}>
        <View style={styles.enquiryPriceContainer}>
          <Text style={styles.enquiryPriceLabel}>Budget</Text>
          <Text style={styles.enquiryPrice}>{formattedPrice}</Text>
        </View>
        <View style={styles.enquiryDateContainer}>
          <Icon name="schedule" size={14} color={colors.textLight} />
          <Text style={styles.enquiryDate}>{formattedDate}</Text>
        </View>
      </View>

      {/* Progress Indicator */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View 
            style={[
              styles.progressFill, 
              { 
                width: (enquiry.status || 'pending') === 'completed' ? '100%' : 
                      (enquiry.status || 'pending') === 'in_progress' ? '60%' : '20%',
                backgroundColor: statusColor 
              }
            ]} 
          />
        </View>
        <Text style={styles.progressText}>
          {(enquiry.status || 'pending') === 'completed' ? 'Completed' : 
           (enquiry.status || 'pending') === 'in_progress' ? 'In Progress' : 'Pending'}
        </Text>
      </View>
    </Card>
  );
};

const getStatusColor = (status) => {
  const colors = {
    pending: '#F59E0B',
    in_progress: '#3B82F6',
    completed: '#10B981',
    rejected: '#EF4444',
  };
  return colors[status] || '#6B7280';
};

const getPriorityColor = (priority) => {
  const colors = {
    high: '#EF4444',
    medium: '#F59E0B',
    low: '#10B981',
  };
  return colors[priority] || '#6B7280';
};

const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', {
    month: 'short',
    day: 'numeric',
  });
};

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
  }).format(amount);
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    padding: 16,
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
  
  // Status Card
  statusCard: {
    width: '48%',
    marginHorizontal: '1%',
    marginVertical: 4,
    aspectRatio: 1.2,
    minHeight: 100,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  statusCardContent: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: 15,
    paddingHorizontal: 10,
    height: '100%',
  },
  statusHeader: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  statusIcon: {
    width: 32,
    height: 32,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  statusTitle: {
    color: colors.textPrimary,
    fontSize: fonts.xs,
    fontFamily: fonts.medium,
    textAlign: 'left',
    maxWidth: '100%',
  },
  
  // Enquiry Status Card (like the image)
  enquiryStatusCard: {
    backgroundColor: colors.textWhite || '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#E5E5E5',
    shadowColor: colors.cardShadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    minHeight: 90,
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 1,
    maxWidth: '24%', // Ensure cards don't get too wide
  },
  enquiryStatusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusIndicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusIconContainer: {
    marginLeft: 2,
  },
  statusLabel: {
    fontSize: fonts.xs || 11,
    fontFamily: fonts.medium || fonts.regular,
    color: colors.textPrimary || '#000000',
    textAlign: 'center',
    marginBottom: 6,
    flexWrap: 'wrap',
  },
  statusValue: {
    fontSize: fonts.xl || 24,
    fontFamily: fonts.bold,
    color: colors.textPrimary || '#000000',
    textAlign: 'center',
  },
  
  // Modern Enquiry Card
  enquiryCard: {
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 16,
    padding: 20,
    backgroundColor: colors.background,
    shadowColor: colors.cardShadow,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  
  // Header Styles
  enquiryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  enquiryTitleContainer: {
    flex: 1,
    marginRight: 12,
  },
  enquiryTitle: {
    fontSize: fonts.lg,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    marginBottom: 4,
    lineHeight: 22,
  },
  enquiryClient: {
    fontSize: fonts.sm,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
  },
  enquiryBadges: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 6,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: fonts.xs,
    fontFamily: fonts.medium,
    letterSpacing: 0.5,
  },
  priorityIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  priorityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  priorityText: {
    fontSize: fonts.xs,
    fontFamily: fonts.medium,
    letterSpacing: 0.5,
  },
  
  // Description
  enquiryDescription: {
    fontSize: fonts.base,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  
  // Details Row
  enquiryDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingVertical: 12,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    gap: 4,
  },
  detailText: {
    fontSize: fonts.xs,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  
  // Footer
  enquiryFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  enquiryPriceContainer: {
    alignItems: 'flex-start',
  },
  enquiryPriceLabel: {
    fontSize: fonts.xs,
    fontFamily: fonts.regular,
    color: colors.textLight,
    marginBottom: 2,
  },
  enquiryPrice: {
    fontSize: fonts.lg,
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  enquiryDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  enquiryDate: {
    fontSize: fonts.sm,
    fontFamily: fonts.regular,
    color: colors.textLight,
  },
  
  // Progress Indicator
  progressContainer: {
    marginTop: 4,
  },
  progressBar: {
    height: 6,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: fonts.xs,
    fontFamily: fonts.medium,
    color: colors.textLight,
    textAlign: 'center',
  },
  
  // Compact Enquiry Card Styles (2 per row)
  compactEnquiryCard: {
    width: '48%',
    marginHorizontal: '1%',
    marginVertical: 8,
    borderRadius: 12,
    padding: 0,
    backgroundColor: colors.background,
    shadowColor: colors.cardShadow,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: 'hidden',
  },
  compactImageContainer: {
    width: '100%',
    height: 100,
    backgroundColor: colors.backgroundSecondary,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  compactImage: {
    width: '100%',
    height: '100%',
  },
  compactImagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.backgroundSecondary,
  },
  compactImagePlaceholderText: {
    fontSize: 8,
    fontFamily: fonts.regular,
    color: colors.textLight,
    marginTop: 4,
  },
  compactImageLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
  },
  compactCardContent: {
    padding: 8,
  },
  // Row 1: Name and Priority
  compactRow1: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  compactName: {
    fontSize: fonts.sm,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    flex: 1,
    marginRight: 4,
  },
  compactPriorityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  compactPriorityText: {
    fontSize: 8,
    fontFamily: fonts.bold,
    letterSpacing: 0.3,
  },
  // Row 2: Status
  compactRow2: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 6,
  },
  compactStatusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  compactStatusText: {
    fontSize: 8,
    fontFamily: fonts.bold,
    letterSpacing: 0.3,
  },
  // Row 3: Assigned to and Created
  compactRow3: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  compactFieldGroup: {
    flex: 1,
  },
  compactLabelText: {
    fontSize: 7,
    fontFamily: fonts.regular,
    color: colors.textLight,
    marginBottom: 1,
  },
  compactValueText: {
    fontSize: 7,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
  },
  // Row 4: Shipping
  compactRow4: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 6,
  },
  // Row 5: Metal, Category, Stone type
  compactRow5: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: 4,
  },
  compactMaterialItem: {
    flex: 1,
    alignItems: 'center',
  },
  compactMaterialLabel: {
    fontSize: 7,
    fontFamily: fonts.regular,
    color: colors.textLight,
    marginBottom: 2,
  },
  compactMaterialValue: {
    fontSize: 7,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  // Row 6: Price
  compactRow6: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  compactPriceLabel: {
    fontSize: 8,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
  },
  compactPriceValue: {
    fontSize: 9,
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  // Row 7: Design Progress
  compactRow7: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
    marginTop: 4,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  compactProgressItem: {
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderRadius: 4,
    backgroundColor: colors.backgroundSecondary,
    alignItems: 'center',
  },
  compactProgressItemActive: {
    backgroundColor: colors.primary + '20',
  },
  compactProgressText: {
    fontSize: 7,
    fontFamily: fonts.medium,
    color: colors.textLight,
  },
  compactProgressTextActive: {
    color: colors.primary,
    fontFamily: fonts.bold,
  },
});
