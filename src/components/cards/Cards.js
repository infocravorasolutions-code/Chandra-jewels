import React, { useState, useEffect, useRef, useMemo, memo, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Image, InteractionManager } from 'react-native';
import Video from 'react-native-video';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import { spacing, responsivePadding, imageSizes } from '../../utils';
import { formatCount } from '../../utils/helpers';
import Icon from '../common/Icon';
import { OptimizedImage } from '../common';
import { FILE_BASE_URL } from '../../config/apiConfig';
import { getUserName } from '../../utils/userUtils';
import { getCachedImage, cacheImage } from '../../utils/imageCache';
import { getCachedImageData, cacheImageData } from '../../utils/imageMemoryCache';

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
  const [imageDataUri, setImageDataUri] = useState(null);
  const [isVideo, setIsVideo] = useState(false);
  const [videoUrl, setVideoUrl] = useState(null);

  // Safety checks to prevent undefined errors
  if (!enquiry) {
    return null;
  }

  // Extract status from multiple possible field names
  let enquiryStatus = '';
  if (enquiry.StatusHistory && Array.isArray(enquiry.StatusHistory) && enquiry.StatusHistory.length > 0) {
    // Get the latest status from StatusHistory
    const sortedHistory = [...enquiry.StatusHistory].sort((a, b) => {
      const dateA = new Date(a.Date || a.date || a.CreatedDate || 0);
      const dateB = new Date(b.Date || b.date || b.CreatedDate || 0);
      return dateB - dateA;
    });
    enquiryStatus = sortedHistory[0]?.Status || sortedHistory[0]?.status || '';
  }
  if (!enquiryStatus) {
    enquiryStatus = enquiry.CurrentStatus || enquiry.Status || enquiry.status || 'Enquiry Created';
  }
  
  // Extract priority from multiple possible field names
  const enquiryPriority = enquiry.Priority || enquiry.priority || 'Normal';
  
  const statusColor = getStatusColor ? getStatusColor(enquiryStatus) : colors.primary;
  const priorityColor = getPriorityColor ? getPriorityColor(enquiryPriority) : colors.textSecondary;
  
  // Check if user is a designer (coral or cad)
  const isDesigner = userRole === 'coral' || userRole === 'cad';
  
  // Format status for display
  const formatStatusForDisplay = (status) => {
    if (!status) return 'ENQUIRY CREATED';
    return String(status).replace(/_/g, ' ').toUpperCase();
  };
  
  // Format priority for display
  const formatPriorityForDisplay = (priority) => {
    if (!priority) return 'NORMAL';
    const priorityStr = String(priority);
    // Handle "Super High" -> "SUPER HIGH"
    return priorityStr.toUpperCase();
  };
  
  // Metal color to abbreviation mapping
  const getMetalAbbreviation = (color) => {
    if (!color) return '';
    
    const colorStr = String(color).toLowerCase().trim();
    
    // Individual color abbreviations
    const colorMap = {
      // Yellow Gold variations
      'yellow gold': 'YG',
      'yellowgold': 'YG',
      'yg': 'YG',
      'gold': 'YG', // Default gold is yellow gold
      
      // Rose Gold variations
      'rose gold': 'RG',
      'rosegold': 'RG',
      'rg': 'RG',
      'pink gold': 'RG',
      'pinkgold': 'RG',
      'red gold': 'RG',
      'redgold': 'RG',
      
      // White Gold variations
      'white gold': 'WG',
      'whitegold': 'WG',
      'wg': 'WG',
      
      // Platinum
      'platinum': 'PT',
      'pt': 'PT',
      
      // Silver
      'silver': 'AG',
      'ag': 'AG',
      '925': 'AG', // Sterling silver
      'sterling silver': 'AG',
    };
    
    // Helper function to extract color abbreviation
    const extractColorAbbrev = (text) => {
      for (const [key, abbrev] of Object.entries(colorMap)) {
        if (text.includes(key)) {
          return abbrev;
        }
      }
      return null;
    };
    
    // Check for two tone (2 colors)
    if (colorStr.includes('two tone') || colorStr.includes('twotone') || colorStr.includes('two-tone')) {
      const colors = [];
      
      // Extract individual colors
      if (colorStr.includes('yellow') || colorStr.includes('gold') && !colorStr.includes('white') && !colorStr.includes('rose')) {
        colors.push('YG');
      }
      if (colorStr.includes('rose') || colorStr.includes('pink') || colorStr.includes('red gold')) {
        colors.push('RG');
      }
      if (colorStr.includes('white')) {
        colors.push('WG');
      }
      if (colorStr.includes('platinum')) {
        colors.push('PT');
      }
      if (colorStr.includes('silver') || colorStr.includes('925')) {
        colors.push('AG');
      }
      
      // If we found specific colors, show them
      if (colors.length >= 2) {
        return `2T ${colors.join('/')}`;
      } else if (colors.length === 1) {
        // Only one color found, but it's two tone - show as 2T with the color
        return `2T ${colors[0]}`;
      } else {
        // Generic two tone
        return '2T';
      }
    }
    
    // Check for three tone (3 colors)
    if (colorStr.includes('three tone') || colorStr.includes('threetone') || colorStr.includes('three-tone') || colorStr.includes('3 tone')) {
      const colors = [];
      
      // Extract individual colors
      if (colorStr.includes('yellow') || (colorStr.includes('gold') && !colorStr.includes('white') && !colorStr.includes('rose'))) {
        colors.push('YG');
      }
      if (colorStr.includes('rose') || colorStr.includes('pink') || colorStr.includes('red gold')) {
        colors.push('RG');
      }
      if (colorStr.includes('white')) {
        colors.push('WG');
      }
      if (colorStr.includes('platinum')) {
        colors.push('PT');
      }
      if (colorStr.includes('silver') || colorStr.includes('925')) {
        colors.push('AG');
      }
      
      // If we found specific colors, show them
      if (colors.length >= 2) {
        return `3T ${colors.join('/')}`;
      } else if (colors.length === 1) {
        // Only one color found, but it's three tone - show as 3T with the color
        return `3T ${colors[0]}`;
      } else {
        // Generic three tone
        return '3T';
      }
    }
    
    // Single color - direct match
    if (colorMap[colorStr]) {
      return colorMap[colorStr];
    }
    
    // Partial match for single colors
    for (const [key, abbrev] of Object.entries(colorMap)) {
      if (colorStr.includes(key)) {
        return abbrev;
      }
    }
    
    // If no match found, return original (or first 2 uppercase letters as fallback)
    return colorStr.length >= 2 ? colorStr.substring(0, 2).toUpperCase() : colorStr.toUpperCase();
  };
  
  // Extract metal color and quality
  const metalColor = enquiry.Metal?.Color || enquiry.metal?.color || enquiry.metalColor || 'Gold';
  const metalQuality = enquiry.Metal?.Quality || enquiry.metal?.quality || enquiry.metalQuality || '';
  const metalAbbreviation = getMetalAbbreviation(metalColor);
  const metalDisplay = metalQuality && metalAbbreviation 
    ? `${metalQuality} ${metalAbbreviation}` 
    : metalAbbreviation || metalColor;
  
  // Get assigned to - resolve ID to name if needed (only if not designer)
  const assignedToId = enquiry.AssignedTo || enquiry.assignedTo;
  const assignedToName = enquiry.assignedToName;
  // If we have an ID but no name, resolve it using getUserName utility
  const assignedTo = assignedToName || (assignedToId ? getUserName(assignedToId) : 'Unassigned');
  
  // Get stone type
  const stoneType = enquiry.StoneType || enquiry.stoneType || 'N/A';
  
  // Get category
  const category = enquiry.Category || enquiry.category || 'N/A';
  
  // Format dates - Created date should always show actual date, not relative
  const formatCreatedDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'N/A';
      
      // Format as dd/mm/yy
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = String(date.getFullYear()).slice(-2); // Last 2 digits of year
      
      return `${day}/${month}/${year}`;
    } catch (error) {
      return 'N/A';
    }
  };
  
  // Get created date from multiple possible fields
  const getCreatedDate = () => {
    // Check normalized field first
    if (enquiry.createdAt) {
      return enquiry.createdAt;
    }
    
    // Check original data fields
    if (enquiry._originalData) {
      // Check StatusHistory for earliest timestamp
      if (enquiry._originalData.StatusHistory && Array.isArray(enquiry._originalData.StatusHistory) && enquiry._originalData.StatusHistory.length > 0) {
        const sortedHistory = [...enquiry._originalData.StatusHistory].sort((a, b) => {
          const dateA = new Date(a.Timestamp || a.timestamp || a.Date || a.date || a.CreatedDate || 0);
          const dateB = new Date(b.Timestamp || b.timestamp || b.Date || b.date || b.CreatedDate || 0);
          return dateA - dateB; // Sort ascending to get earliest
        });
        const earliestTimestamp = sortedHistory[0]?.Timestamp || sortedHistory[0]?.timestamp || sortedHistory[0]?.Date || sortedHistory[0]?.date || sortedHistory[0]?.CreatedDate;
        if (earliestTimestamp) {
          return earliestTimestamp;
        }
      }
      
      // Check other possible date fields in original data
      if (enquiry._originalData.CreatedDate) {
        return enquiry._originalData.CreatedDate;
      }
      if (enquiry._originalData.createdAt) {
        return enquiry._originalData.createdAt;
      }
    }
    
    // Check StatusHistory directly on enquiry
    if (enquiry.StatusHistory && Array.isArray(enquiry.StatusHistory) && enquiry.StatusHistory.length > 0) {
      const sortedHistory = [...enquiry.StatusHistory].sort((a, b) => {
        const dateA = new Date(a.Timestamp || a.timestamp || a.Date || a.date || a.CreatedDate || 0);
        const dateB = new Date(b.Timestamp || b.timestamp || b.Date || b.date || b.CreatedDate || 0);
        return dateA - dateB; // Sort ascending to get earliest
      });
      const earliestTimestamp = sortedHistory[0]?.Timestamp || sortedHistory[0]?.timestamp || sortedHistory[0]?.Date || sortedHistory[0]?.date || sortedHistory[0]?.CreatedDate;
      if (earliestTimestamp) {
        return earliestTimestamp;
      }
    }
    
    // Check other possible fields
    if (enquiry.CreatedDate) {
      return enquiry.CreatedDate;
    }
    
    return null;
  };
  
  const createdDate = formatCreatedDate(getCreatedDate());
  const shippingDate = formatDate && enquiry.deadline ? formatDate(enquiry.deadline) : (enquiry.ShippingDate || enquiry.deadline ? new Date(enquiry.ShippingDate || enquiry.deadline).toLocaleDateString() : 'N/A');
  
  // Format price (only for client role)
  const showPrice = userRole === 'client';
  const price = formatCurrency ? formatCurrency(enquiry.budget || 0) : `₹${enquiry.budget || 0}`;
  
  // Check design progress stages
  const hasDesign = enquiry.Coral && Array.isArray(enquiry.Coral) && enquiry.Coral.length > 0;
  const hasCAD = enquiry.Cad && Array.isArray(enquiry.Cad) && enquiry.Cad.length > 0;
  const hasOrder = enquiry.status === 'completed';

  // Utility function to detect if a file is a video
  const isVideoFile = (imageKey, imageUri, image) => {
    // First check for explicit video flag
    if (image && typeof image === 'object' && (image._isVideo === true || image.isVideo === true)) {
      return true;
    }
    
    // Check file extension from key
    if (imageKey && typeof imageKey === 'string') {
      const videoExtensions = /\.(mp4|mov|avi|mkv|webm|wmv|flv|3gp|m4v)$/i;
      if (videoExtensions.test(imageKey)) {
        return true;
      }
    }
    
    // Check file extension from URI
    if (imageUri && typeof imageUri === 'string') {
      const videoExtensions = /\.(mp4|mov|avi|mkv|webm|wmv|flv|3gp|m4v)$/i;
      if (videoExtensions.test(imageUri)) {
        return true;
      }
    }
    
    // Check mime type from image object
    if (image && typeof image === 'object') {
      const contentType = image.ContentType || image.contentType || image.Type || image.type || image.MimeType || image.mimeType;
      if (contentType && typeof contentType === 'string' && contentType.startsWith('video/')) {
        return true;
      }
      
      // Check if it's marked as video type
      if (image.FileType === 'video' || image.fileType === 'video' || image.MediaType === 'video' || image.mediaType === 'video') {
        return true;
      }
    }
    
    return false;
  };

  // Get latest reference image/video URL (last media in array)
  const getLatestMediaUrl = () => {
    let referenceImages = [];
    let referenceVideos = [];
    
    // Check ReferenceImages array
    if (enquiry?._originalData?.ReferenceImages && Array.isArray(enquiry._originalData.ReferenceImages)) {
      referenceImages = enquiry._originalData.ReferenceImages;
    } else if (enquiry?.ReferenceImages && Array.isArray(enquiry.ReferenceImages)) {
      referenceImages = enquiry.ReferenceImages;
    } else if (enquiry?.images && Array.isArray(enquiry.images) && enquiry.images.length > 0) {
      referenceImages = enquiry.images;
    } else if (enquiry?.Images && Array.isArray(enquiry.Images)) {
      referenceImages = enquiry.Images;
    }
    
    // Check ReferenceVideos array
    if (enquiry?._originalData?.ReferenceVideos && Array.isArray(enquiry._originalData.ReferenceVideos)) {
      referenceVideos = enquiry._originalData.ReferenceVideos;
    } else if (enquiry?.ReferenceVideos && Array.isArray(enquiry.ReferenceVideos)) {
      referenceVideos = enquiry.ReferenceVideos;
    } else if (enquiry?.Videos && Array.isArray(enquiry.Videos)) {
      referenceVideos = enquiry.Videos;
    }
    
    // Also check CAD/Coral versions for videos
    const coralVersions = enquiry?._originalData?.Coral || enquiry?.Coral || [];
    const cadVersions = enquiry?._originalData?.Cad || enquiry?.Cad || [];
    
    coralVersions.forEach((version) => {
      if (version?.Videos && Array.isArray(version.Videos) && version.Videos.length > 0) {
        referenceVideos = [...referenceVideos, ...version.Videos];
      } else if (version?.videos && Array.isArray(version.videos) && version.videos.length > 0) {
        referenceVideos = [...referenceVideos, ...version.videos];
      }
    });
    
    cadVersions.forEach((version) => {
      if (version?.Videos && Array.isArray(version.Videos) && version.Videos.length > 0) {
        referenceVideos = [...referenceVideos, ...version.Videos];
      } else if (version?.videos && Array.isArray(version.videos) && version.videos.length > 0) {
        referenceVideos = [...referenceVideos, ...version.videos];
      }
    });
    
    // Merge images and videos, prioritizing videos
    const allMedia = [...referenceImages, ...referenceVideos];
    
    if (allMedia.length === 0) {
      return { url: null, isVideo: false, media: null };
    }
    
    // Get the last media (latest)
    const latestMedia = allMedia[allMedia.length - 1];
    
    // Extract URL and detect if it's a video
    let mediaUrl = null;
    let mediaKey = null;
    let mediaId = null;
    
    if (typeof latestMedia === 'object' && latestMedia !== null) {
      mediaKey = latestMedia.Key || latestMedia.key || latestMedia.KeyName || latestMedia.keyName || '';
      mediaId = latestMedia.Id || latestMedia.id || latestMedia._id || latestMedia.FileId || latestMedia.fileId || '';
      const mediaUri = latestMedia.Url || latestMedia.url || latestMedia.URI || latestMedia.uri || '';
      
      if (mediaKey) {
        mediaUrl = `${FILE_BASE_URL}/api/enquiries/files/${encodeURIComponent(mediaKey)}`;
      } else if (mediaId) {
        mediaUrl = `${FILE_BASE_URL}/api/enquiries/files/${mediaId}`;
      } else if (mediaUri) {
        if (mediaUri.startsWith('http://') || mediaUri.startsWith('https://')) {
          mediaUrl = mediaUri;
        } else {
          mediaUrl = mediaUri.startsWith('/') ? `${FILE_BASE_URL}${mediaUri}` : `${FILE_BASE_URL}/${mediaUri}`;
      }
      }
      
      const videoCheck = isVideoFile(mediaKey, mediaUri, latestMedia);
      return { url: mediaUrl, isVideo: videoCheck, media: latestMedia };
    }
    
    if (typeof latestMedia === 'string') {
      if (latestMedia.startsWith('http://') || latestMedia.startsWith('https://')) {
        mediaUrl = latestMedia;
      } else if (latestMedia.startsWith('/')) {
        mediaUrl = `${FILE_BASE_URL}${latestMedia}`;
      } else {
        mediaUrl = `${FILE_BASE_URL}/api/enquiries/files/${encodeURIComponent(latestMedia)}`;
    }
    
      const videoCheck = isVideoFile(latestMedia, latestMedia, null);
      return { url: mediaUrl, isVideo: videoCheck, media: latestMedia };
    }
    
    return { url: null, isVideo: false, media: null };
  };

  const mediaInfo = useMemo(() => getLatestMediaUrl(), [
    enquiry?._originalData?.ReferenceImages,
    enquiry?.ReferenceImages,
    enquiry?.images,
    enquiry?.Images,
    enquiry?._originalData?.ReferenceVideos,
    enquiry?.ReferenceVideos,
    enquiry?.Videos,
    enquiry?._originalData?.Coral,
    enquiry?.Coral,
    enquiry?._originalData?.Cad,
    enquiry?.Cad,
  ]);
  
  const imageUrl = mediaInfo.url;
  const mediaIsVideo = mediaInfo.isVideo;
  const latestMedia = mediaInfo.media;
  
  // Optimized async base64 conversion (non-blocking, chunked processing)
  const convertToBase64Async = useCallback(async (arrayBuffer) => {
    const bytes = new Uint8Array(arrayBuffer);
    const chunkSize = 16384; // Larger chunks for better performance
    let binary = '';
    
    // Process in chunks with yields to prevent blocking
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
      binary += String.fromCharCode.apply(null, chunk);
      
      // Yield to main thread every few chunks to keep UI responsive
      if (i > 0 && i % (chunkSize * 4) === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
    }
    }
    
    // Convert to base64
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
    
    return base64;
  }, []);

  // Update video state when media type changes
  useEffect(() => {
    setIsVideo(mediaIsVideo);
    if (!mediaIsVideo) {
      setVideoUrl(null);
    }
  }, [mediaIsVideo]);

  // Fetch video URL if it's a video
  useEffect(() => {
    if (!mediaIsVideo || !imageUrl) {
      return;
    }

    let cancelled = false;

    const fetchVideoUrl = async () => {
      try {
        setImageLoading(true);
        setImageError(false);

        const token = await AsyncStorage.getItem('token');
        if (!token) {
          setImageError(true);
          setImageLoading(false);
          return;
        }

        // Fetch presigned URL from API
        const response = await fetch(imageUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const contentType = response.headers.get('content-type') || '';

        // Check if response is JSON (presigned URL)
        if (contentType.includes('application/json')) {
          const jsonData = await response.json();
          const videoUrlToUse = jsonData.url || jsonData.videoUrl || jsonData.src || jsonData.location;
          if (videoUrlToUse && !cancelled) {
            setVideoUrl(videoUrlToUse);
            setImageLoading(false);
            setImageError(false);
          }
        } else {
          // Direct video response - use the URL directly
          if (!cancelled) {
            setVideoUrl(imageUrl);
            setImageLoading(false);
            setImageError(false);
          }
        }
      } catch (error) {
        if (!cancelled) {
          if (__DEV__) {
            console.error('Error loading video:', error);
          }
          setImageError(true);
          setImageLoading(false);
        }
      }
    };

    fetchVideoUrl();

    return () => {
      cancelled = true;
    };
  }, [mediaIsVideo, imageUrl]);

  // Fetch and load image with caching and deferred loading
  useEffect(() => {
    if (!imageUrl || mediaIsVideo) {
      // Skip image loading if it's a video (handled by video useEffect)
      if (mediaIsVideo) {
        return;
      }
      setImageDataUri(null);
      setImageError(false);
      setImageLoading(false);
      return;
    }

    let cancelled = false;

    // Check cache synchronously first (fast path)
    const memoryCached = getCachedImageData(imageUrl);
    if (memoryCached) {
        setImageDataUri(memoryCached);
        setImageLoading(false);
        setImageError(false);
        return;
      }

    // Defer async operations to avoid blocking scroll
    const handle = InteractionManager.runAfterInteractions(() => {
      if (cancelled) return;

      const loadImage = async () => {
        try {
      setImageLoading(true);
          setImageError(false);

          // Step 1: Check persistent cache (AsyncStorage)
          const persistentCached = await getCachedImage(imageUrl);
          if (persistentCached) {
            // Validate cached data is a base64 data URI, not an API endpoint
            if (persistentCached.startsWith('data:image/')) {
              // Store in memory cache for faster access next time
              cacheImageData(imageUrl, persistentCached);
              if (!cancelled) {
                setImageDataUri(persistentCached);
          setImageLoading(false);
          setImageError(false);
        }
              return;
            } else {
              // Invalid cache entry (API endpoint URL), clear it
        if (__DEV__) {
                console.warn('Invalid cache entry detected, clearing...');
              }
            }
        }

          // Step 2: Fetch from network (not in cache)
            const token = await AsyncStorage.getItem('token');
            if (!token) {
              setImageError(true);
              setImageLoading(false);
              return;
            }

          // Fetch from API endpoint
          const response = await fetch(imageUrl, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${token}`,
              },
            });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

              const contentType = response.headers.get('content-type') || '';

          // Handle JSON response (contains S3 URL)
              if (contentType.includes('application/json')) {
            const jsonData = await response.json();
            const s3Url = jsonData.url || jsonData.imageUrl || jsonData.Url || jsonData.Location;
            
            if (!s3Url) {
              throw new Error('No URL in JSON response');
            }
            
            // Fetch image from S3
            const imageResponse = await fetch(s3Url, {
              method: 'GET',
              headers: s3Url.includes('amazonaws.com') ? {} : {
                'Authorization': `Bearer ${token}`,
              },
            });
            
            if (!imageResponse.ok) {
              throw new Error(`Failed to fetch image: ${imageResponse.status}`);
            }

            // Convert to base64 asynchronously (non-blocking)
            const arrayBuffer = await imageResponse.arrayBuffer();
            const base64 = await convertToBase64Async(arrayBuffer);
            const imageContentType = imageResponse.headers.get('content-type') || 'image/jpeg';
            const dataUri = `data:${imageContentType};base64,${base64}`;
            
            // Cache the image (both memory and persistent)
            cacheImageData(imageUrl, dataUri);
            cacheImage(imageUrl, dataUri);
            
            if (!cancelled) {
            setImageDataUri(dataUri);
            setImageLoading(false);
            setImageError(false);
            }
          } else {
            // Direct image response - convert to base64 asynchronously
            const arrayBuffer = await response.arrayBuffer();
            const base64 = await convertToBase64Async(arrayBuffer);
            const dataUri = `data:${contentType || 'image/jpeg'};base64,${base64}`;
            
            // Cache the image (both memory and persistent)
            cacheImageData(imageUrl, dataUri);
            cacheImage(imageUrl, dataUri);
            
            if (!cancelled) {
            setImageDataUri(dataUri);
            setImageLoading(false);
            setImageError(false);
            }
        }
      } catch (error) {
          if (!cancelled) {
          if (__DEV__) {
              console.error('Error loading image:', error);
        }
            setImageError(true);
            setImageLoading(false);
          }
        }
        };

      loadImage();
    });
    
    return () => {
      cancelled = true;
      handle.cancel();
    };
  }, [imageUrl, convertToBase64Async, mediaIsVideo]);

  return (
    <Card style={styles.compactEnquiryCard} onPress={onPress}>
      {/* Reference Image/Video - Always show container */}
      <View style={styles.compactImageContainer}>
        {isVideo && videoUrl && !imageError ? (
          <View style={styles.compactVideoContainer}>
            <Video
              source={{ uri: videoUrl }}
              style={styles.compactVideo}
              resizeMode="cover"
              paused={true}
              controls={false}
              muted={true}
              repeat={false}
              onLoad={() => {
                // Ensure first frame is displayed
              }}
              onError={() => {
                setImageError(true);
              }}
            />
            <View style={styles.compactVideoPlayOverlay}>
              <Icon name="play-arrow" size={24} color={colors.textWhite} />
            </View>
          </View>
        ) : imageDataUri && !imageError ? (
          <OptimizedImage
            source={{ uri: imageDataUri }}
            style={styles.compactImage}
            resizeMode="cover"
            showLoader={false}
            cacheEnabled={true}
            onError={() => {
              setImageError(true);
            }}
          />
        ) : (
          <View style={styles.compactImagePlaceholder}>
            <Icon name={isVideo ? "videocam" : "image"} size={32} color={colors.textLight} />
            <Text style={styles.compactImagePlaceholderText}>
              {imageLoading ? 'Loading...' : (isVideo ? 'No video available' : 'No image available')}
              </Text>
          </View>
        )}
        {imageLoading && imageUrl && !imageError && (
          <View style={styles.compactImageLoading}>
            <Icon name="sync" size={20} color={colors.textLight} />
          </View>
        )}
      </View>

      <View style={styles.compactCardContent}>
        {/* Name, Priority and Status - Header section */}
        <View style={styles.compactHeaderSection}>
          <Text style={styles.compactName} numberOfLines={2}>
            {enquiry.title || enquiry.Name || 'Untitled Enquiry'}
          </Text>
          <View style={styles.compactBadgesRow}>
            <View style={[styles.compactPriorityBadge, { backgroundColor: priorityColor + '15' }]}>
              <Text style={[styles.compactPriorityText, { color: priorityColor }]} numberOfLines={1}>
                {formatPriorityForDisplay(enquiryPriority)}
              </Text>
            </View>
            <View style={[styles.compactStatusBadge, { backgroundColor: statusColor + '15' }]}>
              <Text style={[styles.compactStatusText, { color: statusColor }]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.7}>
                {formatStatusForDisplay(enquiryStatus)}
              </Text>
            </View>
          </View>
        </View>

        {/* Row 1: AssignedTo | Client */}
        <View style={styles.compactRow1}>
          <View style={styles.compactFieldGroup}>
            <Text style={styles.compactLabelText}>Assigned to</Text>
            <Text style={styles.compactValueText} numberOfLines={1}>{assignedTo}</Text>
          </View>
          <View style={styles.compactFieldGroup}>
            <Text style={styles.compactLabelText}>Client</Text>
            <Text style={styles.compactValueText} numberOfLines={1}>
              {enquiry.clientName || enquiry.ClientName || enquiry.client || 'Unknown Client'}
            </Text>
          </View>
        </View>

        {/* Row 2: CreatedDate | ShippingDate */}
        <View style={styles.compactRow2}>
          <View style={styles.compactFieldGroup}>
            <Text style={styles.compactLabelText}>Created</Text>
            <Text style={styles.compactValueText} numberOfLines={1}>{createdDate}</Text>
          </View>
          <View style={styles.compactFieldGroup}>
            <Text style={styles.compactLabelText}>Shipping</Text>
            <Text style={styles.compactValueText} numberOfLines={1}>
              {shippingDate !== 'N/A' ? shippingDate : 'N/A'}
            </Text>
          </View>
        </View>

        {/* Row 3: Metal | Category | Stone Type */}
        <View style={styles.compactRow3}>
          <View style={styles.compactFieldGroup}>
            <Text style={styles.compactLabelText}>Metal</Text>
            <Text style={styles.compactValueText} numberOfLines={1}>{metalDisplay}</Text>
          </View>
          <View style={styles.compactFieldGroup}>
            <Text style={styles.compactLabelText}>Category</Text>
            <Text style={styles.compactValueText} numberOfLines={1}>{category}</Text>
          </View>
          <View style={styles.compactFieldGroup}>
            <Text style={styles.compactLabelText}>Stone type</Text>
            <Text style={styles.compactValueText} numberOfLines={1}>{stoneType}</Text>
          </View>
        </View>

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

// Optimized memoization - only re-render when essential data changes
export const CompactEnquiryCardMemo = memo(CompactEnquiryCard, (prevProps, nextProps) => {
  // Fast path: same reference means no change
  if (prevProps.enquiry === nextProps.enquiry) {
    return true;
  }

  // Check essential fields only (avoid expensive JSON.stringify)
  const prevId = prevProps.enquiry?.id || prevProps.enquiry?._id;
  const nextId = nextProps.enquiry?.id || nextProps.enquiry?._id;
  
  if (prevId !== nextId) return false;
  if (prevProps.enquiry?.status !== nextProps.enquiry?.status) return false;
  if (prevProps.enquiry?.priority !== nextProps.enquiry?.priority) return false;
  
  // Check ReferenceImages length (cheaper than full comparison)
  const prevImages = prevProps.enquiry?._originalData?.ReferenceImages || prevProps.enquiry?.ReferenceImages || [];
  const nextImages = nextProps.enquiry?._originalData?.ReferenceImages || nextProps.enquiry?.ReferenceImages || [];
  
  if (prevImages.length !== nextImages.length) return false;
  
  // Only compare last image (the one we display)
  if (prevImages.length > 0 && nextImages.length > 0) {
    const prevLast = prevImages[prevImages.length - 1];
    const nextLast = nextImages[nextImages.length - 1];
    const prevKey = prevLast?.Key || prevLast?.key || prevLast?.Id || prevLast?.id || '';
    const nextKey = nextLast?.Key || nextLast?.key || nextLast?.Id || nextLast?.id || '';
    if (prevKey !== nextKey) return false;
  }
  
  return true;
});

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

  // Extract status from multiple possible field names
  let enquiryStatus = '';
  if (enquiry.StatusHistory && Array.isArray(enquiry.StatusHistory) && enquiry.StatusHistory.length > 0) {
    // Get the latest status from StatusHistory
    const sortedHistory = [...enquiry.StatusHistory].sort((a, b) => {
      const dateA = new Date(a.Date || a.date || a.CreatedDate || 0);
      const dateB = new Date(b.Date || b.date || b.CreatedDate || 0);
      return dateB - dateA;
    });
    enquiryStatus = sortedHistory[0]?.Status || sortedHistory[0]?.status || '';
  }
  if (!enquiryStatus) {
    enquiryStatus = enquiry.CurrentStatus || enquiry.Status || enquiry.status || 'Enquiry Created';
  }
  
  // Extract priority from multiple possible field names
  const enquiryPriority = enquiry.Priority || enquiry.priority || 'Normal';
  
  const statusColor = getStatusColor ? getStatusColor(enquiryStatus) : colors.primary;
  const statusIcon = getStatusIcon ? getStatusIcon(enquiryStatus) : 'help';
  const priorityColor = getPriorityColor ? getPriorityColor(enquiryPriority) : colors.textSecondary;
  const priorityIcon = getPriorityIcon ? getPriorityIcon(enquiryPriority) : 'help';
  const formattedPrice = formatCurrency ? formatCurrency(enquiry.budget || 0) : `₹${enquiry.budget || 0}`;
  const formattedDate = formatDate ? formatDate(enquiry.createdAt || new Date().toISOString()) : (enquiry.createdAt || 'Recently');
  
  // Format status for display
  const formatStatusForDisplay = (status) => {
    if (!status) return 'ENQUIRY CREATED';
    return String(status).replace(/_/g, ' ').toUpperCase();
  };
  
  // Format priority for display
  const formatPriorityForDisplay = (priority) => {
    if (!priority) return 'NORMAL';
    return String(priority).toUpperCase();
  };

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
              {formatStatusForDisplay(enquiryStatus)}
            </Text>
          </View>
          <View style={styles.priorityIndicator}>
            <View style={[styles.priorityDot, { backgroundColor: priorityColor }]} />
            <Text style={[styles.priorityText, { color: priorityColor }]}>
              {formatPriorityForDisplay(enquiryPriority)}
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
                width: String(enquiryStatus).toLowerCase().includes('completed') ? '100%' : '20%',
                backgroundColor: statusColor 
              }
            ]} 
          />
        </View>
        <Text style={styles.progressText}>
          {String(enquiryStatus).toLowerCase().includes('completed') ? 'Completed' : 'In Progress'}
        </Text>
      </View>
    </Card>
  );
};

const getStatusColor = (status) => {
  const colors = {
    pending: '#F59E0B',
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
  compactVideoContainer: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    position: 'relative',
    backgroundColor: colors.backgroundSecondary,
    overflow: 'hidden',
  },
  compactVideo: {
    width: '100%',
    height: '100%',
  },
  compactVideoPlayOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
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
  // Header Section: Name, Priority and Status
  compactHeaderSection: {
    marginBottom: 6,
  },
  compactName: {
    fontSize: fonts.sm,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  compactBadgesRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
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
  compactStatusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    flex: 1,
    minWidth: 0, // Allow shrinking
  },
  compactStatusText: {
    fontSize: 8,
    fontFamily: fonts.bold,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  // Row 1: AssignedTo | Client
  compactRow1: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
    gap: 4,
  },
  // Row 2: CreatedDate | ShippingDate
  compactRow2: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
    gap: 4,
  },
  // Row 3: Metal | Category | Stone Type
  compactRow3: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
    gap: 4,
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
  // Row 4: Assigned To and Shipping
  compactRow4: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
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
