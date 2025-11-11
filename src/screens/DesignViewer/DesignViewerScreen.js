import React, { useState, useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Text,
  Image,
  Dimensions,
  Platform,
  Alert,
} from 'react-native';
import { Card } from '../../components/cards/Cards';
import { Button, Input, AnimatedLogoLoader } from '../../components/common';
import Icon from '../../components/common/Icon';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import { CustomText } from '../../components/common/Text';
import { useAuth } from '../../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUpdateAssetDescriptionMutation, useGetEnquiryByIdQuery } from '../../store/api';
import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import { API_BASE_URL } from '../../config/apiConfig';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const IMAGE_CONTAINER_HEIGHT = SCREEN_HEIGHT * 0.5;

const DesignViewerScreen = ({ route, navigation }) => {
  const { designType, enquiry: routeEnquiry, versionIndex } = route.params || {}; // designType: 'coral' or 'cad', versionIndex: optional index
  const enquiry = routeEnquiry;
  const { user } = useAuth();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [comment, setComment] = useState('');
  const [imageHeaders, setImageHeaders] = useState({});
  const [imageDataUri, setImageDataUri] = useState(null);
  const [imageLoadingError, setImageLoadingError] = useState(false);
  const [useFetchDirectly, setUseFetchDirectly] = useState(Platform.OS === 'android');
  const [isDownloadingExcel, setIsDownloadingExcel] = useState(false);
  const [isDownloadingImage, setIsDownloadingImage] = useState(false);
  
  // API mutation for updating asset description
  const [updateAssetDescription, { isLoading: isUpdatingDescription }] = useUpdateAssetDescriptionMutation();
  
  // Check if user is Coral or CAD designer (hide admin features)
  const isDesigner = user?.role === 'coral' || user?.role === 'cad';
  const isAdmin = user?.role === 'admin';

  // Load auth token for image headers
  useEffect(() => {
    const loadAuthToken = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        if (token) {
          setImageHeaders({
            'Authorization': `Bearer ${token}`,
          });
          console.log('✅ Auth token loaded for image headers');
        } else {
          console.warn('⚠️ No auth token found in AsyncStorage');
        }
      } catch (error) {
        console.error('❌ Error loading auth token:', error);
      }
    };
    loadAuthToken();
  }, []);

  // Fetch image with authentication as fallback (for Android compatibility)
  const fetchImageWithAuth = async () => {
    if (!currentImageUrl || imageDataUri) return;
    
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        console.warn('⚠️ No token available for authenticated image fetch');
        return;
      }

      console.log('🔄 Attempting to fetch image with authentication...');
      console.log('URL:', currentImageUrl);
      
      const response = await fetch(currentImageUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const contentType = response.headers.get('content-type') || '';
        console.log('✅ Fetch response OK, content-type:', contentType);
        
        // Check if response is JSON (API returns a URL object)
        if (contentType.includes('application/json')) {
          console.log('📄 Response is JSON, parsing to extract image URL...');
          const jsonData = await response.json();
          console.log('JSON response:', jsonData);
          
          // Extract the actual image URL from JSON (could be 'url', 'imageUrl', 'src', etc.)
          const actualImageUrl = jsonData.url || jsonData.imageUrl || jsonData.src || jsonData.location;
          
          if (!actualImageUrl) {
            console.error('❌ No image URL found in JSON response:', jsonData);
            setImageLoadingError(true);
            return;
          }
          
          console.log('🖼️ Found image URL in JSON, fetching actual image...');
          console.log('Actual image URL:', actualImageUrl);
          
          // Fetch the actual image from the URL (likely S3, may not need auth)
          const imageResponse = await fetch(actualImageUrl, {
            method: 'GET',
            // Some S3 URLs might need headers, but usually public URLs don't
            headers: actualImageUrl.includes('amazonaws.com') ? {} : {
              'Authorization': `Bearer ${token}`,
            },
          });
          
          if (!imageResponse.ok) {
            console.error('❌ Failed to fetch actual image:', imageResponse.status, imageResponse.statusText);
            setImageLoadingError(true);
            return;
          }
          
          console.log('✅ Actual image fetched, converting to base64...');
          const arrayBuffer = await imageResponse.arrayBuffer();
          console.log('ArrayBuffer received, size:', arrayBuffer.byteLength);
          
          // Convert arrayBuffer to base64
          const bytes = new Uint8Array(arrayBuffer);
          let binary = '';
          const chunkSize = 8192;
          
          for (let i = 0; i < bytes.length; i += chunkSize) {
            const chunk = bytes.subarray(i, i + chunkSize);
            binary += String.fromCharCode.apply(null, chunk);
          }
          
          console.log('Binary string created, length:', binary.length);
          
          let base64;
          try {
            base64 = btoa(binary);
            console.log('Base64 conversion successful using btoa');
          } catch (e) {
            console.log('btoa failed, trying Buffer...', e.message);
            if (typeof Buffer !== 'undefined') {
              base64 = Buffer.from(binary, 'binary').toString('base64');
              console.log('Base64 conversion successful using Buffer');
            } else {
              throw new Error('Neither btoa nor Buffer available');
            }
          }
          
          const imageContentType = imageResponse.headers.get('content-type') || 'image/jpeg';
          const dataUri = `data:${imageContentType};base64,${base64}`;
          
          console.log('✅ Image fetched and converted to data URI');
          console.log('Data URI length:', dataUri.length);
          console.log('Content type:', imageContentType);
          console.log('Base64 length:', base64.length);
          
          setImageDataUri(dataUri);
          setImageLoadingError(false);
        } else {
          // Direct image response
          console.log('✅ Response is direct image, converting to base64...');
          
          const arrayBuffer = await response.arrayBuffer();
          console.log('ArrayBuffer received, size:', arrayBuffer.byteLength);
          
          // Convert arrayBuffer to base64 - chunked for large images
          const bytes = new Uint8Array(arrayBuffer);
          let binary = '';
          const chunkSize = 8192;
          
          for (let i = 0; i < bytes.length; i += chunkSize) {
            const chunk = bytes.subarray(i, i + chunkSize);
            binary += String.fromCharCode.apply(null, chunk);
          }
          
          console.log('Binary string created, length:', binary.length);
          
          let base64;
          try {
            base64 = btoa(binary);
            console.log('Base64 conversion successful using btoa');
          } catch (e) {
            console.log('btoa failed, trying Buffer...', e.message);
            if (typeof Buffer !== 'undefined') {
              base64 = Buffer.from(binary, 'binary').toString('base64');
              console.log('Base64 conversion successful using Buffer');
            } else {
              throw new Error('Neither btoa nor Buffer available');
            }
          }
          
          const imageContentType = contentType || 'image/jpeg';
          const dataUri = `data:${imageContentType};base64,${base64}`;
          
          console.log('✅ Image fetched and converted to data URI');
          console.log('Data URI length:', dataUri.length);
          console.log('Content type:', imageContentType);
          console.log('Base64 length:', base64.length);
          
          setImageDataUri(dataUri);
          setImageLoadingError(false);
        }
      } else {
        console.error('❌ Image fetch failed:', response.status, response.statusText);
        console.error('Response headers:', response.headers);
        setImageLoadingError(true);
      }
    } catch (error) {
      console.error('❌ Error fetching image with auth:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      setImageLoadingError(true);
    }
  };

  // Comprehensive logging on mount and when data changes
  useEffect(() => {
    console.log('========== DesignViewerScreen INITIALIZATION ==========');
    console.log('Route params:', JSON.stringify(route.params, null, 2));
    console.log('designType:', designType);
    console.log('enquiry exists:', !!enquiry);
    console.log('enquiry keys:', enquiry ? Object.keys(enquiry) : 'null');
    
    if (enquiry) {
      console.log('Enquiry._originalData exists:', !!enquiry._originalData);
      console.log('Enquiry.Cad exists:', !!enquiry.Cad);
      console.log('Enquiry.Coral exists:', !!enquiry.Coral);
      console.log('Enquiry.CadCode:', enquiry.CadCode);
      console.log('Enquiry.CoralCode:', enquiry.CoralCode);
      
      if (enquiry.Cad) {
        console.log('Enquiry.Cad type:', Array.isArray(enquiry.Cad) ? 'Array' : typeof enquiry.Cad);
        console.log('Enquiry.Cad length:', Array.isArray(enquiry.Cad) ? enquiry.Cad.length : 'N/A');
        if (Array.isArray(enquiry.Cad) && enquiry.Cad.length > 0) {
          console.log('First Cad item:', JSON.stringify(enquiry.Cad[0], null, 2));
        }
      }
      
      if (enquiry.Coral) {
        console.log('Enquiry.Coral type:', Array.isArray(enquiry.Coral) ? 'Array' : typeof enquiry.Coral);
        console.log('Enquiry.Coral length:', Array.isArray(enquiry.Coral) ? enquiry.Coral.length : 'N/A');
      }
    }
    console.log('======================================================');
  }, []);

  // Get enquiry ID for refetching
  const enquiryId = enquiry?.id || enquiry?._id;
  
  // Refetch enquiry data when screen comes into focus (to get updated descriptions)
  const { data: fetchedEnquiryData, refetch: refetchEnquiry } = useGetEnquiryByIdQuery(enquiryId, {
    skip: !enquiryId,
  });
  
  // Use fetched enquiry data if available, otherwise use route params
  const currentEnquiry = fetchedEnquiryData || enquiry;
  
  // Get design data based on type
  const originalData = currentEnquiry?._originalData || currentEnquiry;
  const designData = designType === 'coral' 
    ? (originalData?.Coral || currentEnquiry?.Coral || [])
    : (originalData?.Cad || currentEnquiry?.Cad || []);

  // Get selected design version (use versionIndex if provided, otherwise use latest)
  const selectedDesign = versionIndex !== undefined && versionIndex >= 0 && versionIndex < designData.length
    ? designData[versionIndex]
    : (designData && designData.length > 0 ? designData[designData.length - 1] : null);
    
  // Get current version number for display
  const currentVersionNumber = versionIndex !== undefined && versionIndex >= 0
    ? versionIndex + 1
    : (designData && designData.length > 0 ? designData.length : null);

  // Get images from selected design
  const images = selectedDesign?.Images || selectedDesign?.images || [];
  
  // Comprehensive debug logging
  useEffect(() => {
    console.log('========== DesignViewerScreen DATA STRUCTURE ==========');
    console.log('designType:', designType);
    console.log('originalData exists:', !!originalData);
    console.log('designData type:', Array.isArray(designData) ? 'Array' : typeof designData);
    console.log('designData length:', Array.isArray(designData) ? designData.length : 'N/A');
    
    if (Array.isArray(designData)) {
      console.log('designData array:', JSON.stringify(designData, null, 2));
    }
    
    console.log('selectedDesign exists:', !!selectedDesign);
    console.log('versionIndex:', versionIndex);
    console.log('currentVersionNumber:', currentVersionNumber);
    if (selectedDesign) {
      console.log('selectedDesign keys:', Object.keys(selectedDesign));
      console.log('selectedDesign.Images exists:', !!selectedDesign.Images);
      console.log('selectedDesign.images exists:', !!selectedDesign.images);
      console.log('selectedDesign.Version:', selectedDesign.Version);
      console.log('selectedDesign full object:', JSON.stringify(selectedDesign, null, 2));
    }
    
    console.log('images type:', Array.isArray(images) ? 'Array' : typeof images);
    console.log('images length:', images.length);
    
    if (images.length > 0) {
      console.log('All images:', JSON.stringify(images, null, 2));
      console.log('Current image index:', currentImageIndex);
      if (currentImageIndex < images.length) {
        console.log('Current image object:', JSON.stringify(images[currentImageIndex], null, 2));
      }
    } else {
      console.warn('⚠️ NO IMAGES FOUND!');
      console.log('selectedDesign?.Images:', selectedDesign?.Images);
      console.log('selectedDesign?.images:', selectedDesign?.images);
    }
    console.log('======================================================');
  }, [designType, designData, selectedDesign, images, currentImageIndex]);
  
  // Get code for Excel filename
  const designCode = designType === 'coral'
    ? (originalData?.CoralCode || currentEnquiry?.CoralCode || currentEnquiry?.coralCode || '')
    : (originalData?.CadCode || currentEnquiry?.CadCode || currentEnquiry?.cadCode || '');
  
  // Refetch enquiry when screen comes into focus to get updated data
  useFocusEffect(
    React.useCallback(() => {
      if (enquiryId) {
        refetchEnquiry();
      }
    }, [enquiryId, refetchEnquiry])
  );

  // Initialize comment with current image description or filename and reset image data URI
  useEffect(() => {
    if (images.length > 0 && currentImageIndex < images.length) {
      const currentImage = images[currentImageIndex];
      let imageName = '';
      
      if (typeof currentImage === 'object' && currentImage !== null) {
        // Use Description first (user-edited name), then fall back to Key (filename)
        imageName = currentImage.Description || 
                    currentImage.description || 
                    currentImage.Key || 
                    currentImage.key || 
                    currentImage.Name || 
                    currentImage.name || 
                    '';
      } else if (typeof currentImage === 'string') {
        // Extract filename from URL or key
        imageName = currentImage.split('/').pop() || currentImage;
      }
      
      setComment(imageName);
      // Reset image data URI when image changes
      setImageDataUri(null);
      setImageLoadingError(false);
    }
  }, [currentImageIndex, images]);

  // Navigate to previous image
  const handlePreviousImage = () => {
    if (currentImageIndex > 0) {
      setCurrentImageIndex(currentImageIndex - 1);
    }
  };

  // Navigate to next image
  const handleNextImage = () => {
    if (currentImageIndex < images.length - 1) {
      setCurrentImageIndex(currentImageIndex + 1);
    }
  };

  // Get current image URL - try multiple endpoint patterns
  const getCurrentImageUrl = () => {
    console.log('========== getCurrentImageUrl CALLED ==========');
    console.log('images.length:', images.length);
    console.log('currentImageIndex:', currentImageIndex);
    
    if (images.length === 0 || currentImageIndex >= images.length) {
      console.warn('❌ No images available or index out of range');
      console.log('images.length:', images.length);
      console.log('currentImageIndex:', currentImageIndex);
      return null;
    }
    
    const currentImage = images[currentImageIndex];
    console.log('Current image object:', JSON.stringify(currentImage, null, 2));
    
    // Use centralized API base URL
    console.log('API_BASE_URL:', API_BASE_URL);

    if (typeof currentImage === 'object' && currentImage !== null) {
      const imageKey = currentImage.Key || currentImage.key || '';
      const imageId = currentImage.Id || currentImage.id || currentImage._id || '';
      const imageUrl = currentImage.Url || currentImage.url || currentImage.URI || currentImage.uri || '';
      
      console.log('Extracted values:');
      console.log('- imageKey:', imageKey);
      console.log('- imageId:', imageId);
      console.log('- imageUrl:', imageUrl);
      console.log('- Full object keys:', Object.keys(currentImage));
      
      // If full URL is provided, use it directly
      if (imageUrl && (imageUrl.startsWith('http') || imageUrl.startsWith('https'))) {
        console.log('✅ Using full URL from object:', imageUrl);
        return imageUrl;
      }
      
      // Try Key-based endpoints first (more reliable for filenames)
      if (imageKey) {
        const encodedKey = encodeURIComponent(imageKey);
        console.log('Encoded Key:', encodedKey);
        
        // Try multiple endpoint patterns
        const possibleUrls = [
          `${API_BASE_URL}/api/enquiries/files/${encodedKey}`,
          `${API_BASE_URL}/api/files/${encodedKey}`,
          `${API_BASE_URL}/api/images/${encodedKey}`,
          `${API_BASE_URL}/api/enquiries/${enquiry?.id || enquiry?._id}/files/${encodedKey}`,
        ];
        
        console.log('Possible URLs to try:');
        possibleUrls.forEach((url, index) => {
          console.log(`  ${index + 1}. ${url}`);
        });
        
        // Return first URL (most likely)
        const url = possibleUrls[0];
        console.log('✅ Generated image URL (using Key):', url);
        return url;
      }
      
      // Try ID-based endpoints
      if (imageId) {
        const possibleUrls = [
          `${API_BASE_URL}/api/files/${imageId}`,
          `${API_BASE_URL}/api/images/${imageId}`,
          `${API_BASE_URL}/api/enquiries/files/${imageId}`,
        ];
        
        console.log('Possible URLs (using Id):');
        possibleUrls.forEach((url, index) => {
          console.log(`  ${index + 1}. ${url}`);
        });
        
        const url = possibleUrls[0];
        console.log('✅ Generated image URL (using Id):', url);
        return url;
      }
      
      console.warn('❌ No image Key or Id found in object:', currentImage);
      console.log('Available keys:', Object.keys(currentImage));
    } else if (typeof currentImage === 'string') {
      console.log('Current image is a string:', currentImage);
      
      if (currentImage.startsWith('http') || currentImage.startsWith('https')) {
        console.log('✅ Using string as full URL:', currentImage);
        return currentImage;
      }
      
      // Try enquiries/files endpoint for string keys
      const encodedKey = encodeURIComponent(currentImage);
      const url = `${API_BASE_URL}/api/enquiries/files/${encodedKey}`;
      console.log('✅ Generated image URL (from string):', url);
      return url;
    }
    
    console.warn('❌ Unable to generate image URL - unknown type:', typeof currentImage);
    console.log('Current image value:', currentImage);
    console.log('======================================================');
    return null;
  };

  // Get Excel download URL - use backend endpoint directly (more reliable)
  const getExcelDownloadUrl = () => {
    if (!designCode) return null;
    
    const excelFilename = designCode.includes('.xlsx') 
      ? designCode 
      : `${designCode}.xlsx`;
    
    return `${API_BASE_URL}/api/enquiries/files/${excelFilename}?download=true`;
  };

  const handleDownloadImage = async () => {
    if (isDownloadingImage) {
      return; // Prevent multiple simultaneous downloads
    }

    if (images.length === 0 || currentImageIndex >= images.length) {
      Alert.alert('Error', 'No image available to download');
      return;
    }

    const currentImage = images[currentImageIndex];
    if (!currentImage) {
      Alert.alert('Error', 'Current image not found');
      return;
    }

    // Extract image key
    let imageKey = '';
    if (typeof currentImage === 'object' && currentImage !== null) {
      imageKey = currentImage.Key || currentImage.key || '';
    } else if (typeof currentImage === 'string') {
      // Extract filename from URL or key
      imageKey = currentImage.split('/').pop() || currentImage;
    }

    if (!imageKey) {
      Alert.alert('Error', 'Image key not available');
      return;
    }

    setIsDownloadingImage(true);

    try {
      // Get auth token
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      // Build download URL with ?download=true parameter
      const encodedKey = encodeURIComponent(imageKey);
      const downloadUrl = `${API_BASE_URL}/api/enquiries/files/${encodedKey}?download=true`;

      if (__DEV__) {
        console.log('========== DOWNLOADING IMAGE ==========');
        console.log('Image Key:', imageKey);
        console.log('Encoded Key:', encodedKey);
        console.log('Download URL:', downloadUrl);
        console.log('=======================================');
      }

      // Get image filename (use Description if available, otherwise use Key)
      const imageName = currentImage.Description || 
                       currentImage.description || 
                       imageKey;
      
      // Determine file extension from image key or default to jpeg
      let fileExtension = 'jpeg';
      if (imageKey.includes('.')) {
        const ext = imageKey.split('.').pop()?.toLowerCase();
        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) {
          fileExtension = ext || 'jpeg';
        }
      }
      
      const imageFilename = imageName.includes('.') 
        ? imageName 
        : `${imageName}.${fileExtension}`;
      
      // Determine download path
      const downloadPath = `${RNFS.DownloadDirectoryPath}/${imageFilename}`;

      if (__DEV__) {
        console.log('Downloading image to:', downloadPath);
      }

      // Fetch the image from backend
      const response = await fetch(downloadUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get download URL: HTTP ${response.status}`);
      }

      // Check if response is JSON (signed URL) or image file stream
      const contentType = response.headers.get('content-type') || '';
      
      if (contentType.includes('application/json')) {
        // Backend returned signed URL - need to download from S3
        const jsonData = await response.json();
        if (!jsonData.url) {
          throw new Error('Backend did not return a valid download URL');
        }

        if (__DEV__) {
          console.log('Backend returned signed URL, downloading from S3:', jsonData.url);
        }
        
        // Download from S3 using fetch
        const s3Response = await fetch(jsonData.url, {
          method: 'GET',
          // No headers for S3 signed URLs
        });

        if (!s3Response.ok) {
          throw new Error(`S3 download failed: HTTP ${s3Response.status} ${s3Response.statusText}`);
        }

        // Get the file as array buffer (binary data)
        const arrayBuffer = await s3Response.arrayBuffer();
        
        if (arrayBuffer.byteLength === 0) {
          throw new Error('Downloaded image is empty');
        }

        // Convert to base64 for React Native file system
        const bytes = new Uint8Array(arrayBuffer);
        const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
        let base64 = '';
        let i = 0;
        
        while (i < bytes.length) {
          const a = bytes[i++];
          const b = i < bytes.length ? bytes[i++] : 0;
          const c = i < bytes.length ? bytes[i++] : 0;
          
          const bitmap = (a << 16) | (b << 8) | c;
          
          base64 += base64Chars.charAt((bitmap >> 18) & 63);
          base64 += base64Chars.charAt((bitmap >> 12) & 63);
          base64 += i - 2 < bytes.length ? base64Chars.charAt((bitmap >> 6) & 63) : '=';
          base64 += i - 1 < bytes.length ? base64Chars.charAt(bitmap & 63) : '=';
        }

        // Write binary file to device
        await RNFS.writeFile(downloadPath, base64, 'base64');

        // Verify the file was written correctly
        const fileExists = await RNFS.exists(downloadPath);
        if (!fileExists) {
          throw new Error('Failed to save downloaded image');
        }

        const fileStats = await RNFS.stat(downloadPath);
        if (fileStats.size === 0) {
          throw new Error('Downloaded image file is empty');
        }

        if (__DEV__) {
          console.log('✅ Image downloaded successfully to:', downloadPath);
          console.log('File size:', fileStats.size, 'bytes');
        }

        // Share/open the file
        try {
          // Determine MIME type based on extension
          let mimeType = 'image/jpeg';
          if (fileExtension === 'png') mimeType = 'image/png';
          else if (fileExtension === 'gif') mimeType = 'image/gif';
          else if (fileExtension === 'webp') mimeType = 'image/webp';

          await Share.open({
            url: `file://${downloadPath}`,
            type: mimeType,
            filename: imageFilename,
            title: 'Open Image',
            message: `Downloaded: ${imageFilename}`,
          });
        } catch (shareError) {
          if (shareError.message !== 'User did not share') {
            console.warn('Share dialog error (non-critical):', shareError);
          }
          Alert.alert(
            'Success',
            `Image downloaded successfully!\n\nSaved to: Downloads/${imageFilename}`,
            [{ text: 'OK' }]
          );
        }
        return; // Success
      } else {
        // Backend is streaming the image directly - save it
        const arrayBuffer = await response.arrayBuffer();
        
        if (arrayBuffer.byteLength === 0) {
          throw new Error('Downloaded image is empty');
        }

        // Convert array buffer to base64 for React Native
        const bytes = new Uint8Array(arrayBuffer);
        const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
        let base64 = '';
        let i = 0;
        
        while (i < bytes.length) {
          const a = bytes[i++];
          const b = i < bytes.length ? bytes[i++] : 0;
          const c = i < bytes.length ? bytes[i++] : 0;
          
          const bitmap = (a << 16) | (b << 8) | c;
          
          base64 += base64Chars.charAt((bitmap >> 18) & 63);
          base64 += base64Chars.charAt((bitmap >> 12) & 63);
          base64 += i - 2 < bytes.length ? base64Chars.charAt((bitmap >> 6) & 63) : '=';
          base64 += i - 1 < bytes.length ? base64Chars.charAt(bitmap & 63) : '=';
        }

        // Write binary file to device
        await RNFS.writeFile(downloadPath, base64, 'base64');

        // Verify the file was written correctly
        const fileExists = await RNFS.exists(downloadPath);
        if (!fileExists) {
          throw new Error('Failed to save downloaded image');
        }

        const fileStats = await RNFS.stat(downloadPath);
        if (fileStats.size === 0) {
          throw new Error('Downloaded image file is empty');
        }

        if (__DEV__) {
          console.log('✅ Image downloaded successfully to:', downloadPath);
          console.log('File size:', fileStats.size, 'bytes');
        }

        // Share/open the file
        try {
          // Determine MIME type based on extension
          let mimeType = 'image/jpeg';
          if (fileExtension === 'png') mimeType = 'image/png';
          else if (fileExtension === 'gif') mimeType = 'image/gif';
          else if (fileExtension === 'webp') mimeType = 'image/webp';

          await Share.open({
            url: `file://${downloadPath}`,
            type: mimeType,
            filename: imageFilename,
            title: 'Open Image',
            message: `Downloaded: ${imageFilename}`,
          });
        } catch (shareError) {
          if (shareError.message !== 'User did not share') {
            console.warn('Share dialog error (non-critical):', shareError);
          }
          Alert.alert(
            'Success',
            `Image downloaded successfully!\n\nSaved to: Downloads/${imageFilename}`,
            [{ text: 'OK' }]
          );
        }
      }
    } catch (error) {
      console.error('Error downloading image:', error);
      Alert.alert(
        'Download Failed',
        error?.message || 'Failed to download image. Please try again.'
      );
    } finally {
      setIsDownloadingImage(false);
    }
  };

  const handleDeleteImage = () => {
    Alert.alert(
      'Delete Image',
      'Are you sure you want to delete this image?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            // TODO: Implement delete functionality
            Alert.alert('Info', 'Delete functionality will be implemented');
          },
        },
      ]
    );
  };

  const handleDownloadExcel = async () => {
    if (!designCode) {
      Alert.alert('Error', 'Excel file not available - design code missing');
      return;
    }

    if (isDownloadingExcel) {
      return; // Prevent multiple simultaneous downloads
    }

    setIsDownloadingExcel(true);

    try {
      // Get download URL from backend endpoint (more reliable than S3 direct)
      const downloadUrl = getExcelDownloadUrl();
      if (!downloadUrl) {
        throw new Error('Failed to get Excel file URL');
      }

      // Get auth token
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      // Create filename
      const excelFilename = designCode.includes('.xlsx') 
        ? designCode 
        : `${designCode}.xlsx`;
      
      // Determine download path
      const downloadPath = `${RNFS.DownloadDirectoryPath}/${excelFilename}`;

      if (__DEV__) {
        console.log('Downloading Excel from URL:', downloadUrl);
        console.log('Downloading to:', downloadPath);
      }

      // First, check what the backend returns (JSON with URL or file stream)
      const response = await fetch(downloadUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get download URL: HTTP ${response.status}`);
      }

      // Check if response is JSON (signed URL) or file stream
      const contentType = response.headers.get('content-type') || '';
      
      if (contentType.includes('application/json')) {
        // Backend returned signed URL - need to download from S3
        const jsonData = await response.json();
        if (!jsonData.url) {
          throw new Error('Backend did not return a valid download URL');
        }

        if (__DEV__) {
          console.log('Backend returned signed URL, downloading from S3:', jsonData.url);
        }
        
        // Download from S3 using fetch (more reliable than RNFS.downloadFile for S3)
        // RNFS.downloadFile sometimes saves the URL as text instead of downloading the file
        const s3Response = await fetch(jsonData.url, {
          method: 'GET',
          // No headers for S3 signed URLs
        });

        if (!s3Response.ok) {
          throw new Error(`S3 download failed: HTTP ${s3Response.status} ${s3Response.statusText}`);
        }

        // Get the file as array buffer (binary data)
        const arrayBuffer = await s3Response.arrayBuffer();
        
        if (arrayBuffer.byteLength === 0) {
          throw new Error('Downloaded file is empty');
        }

        // Convert to base64 for React Native file system
        const bytes = new Uint8Array(arrayBuffer);
        const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
        let base64 = '';
        let i = 0;
        
        while (i < bytes.length) {
          const a = bytes[i++];
          const b = i < bytes.length ? bytes[i++] : 0;
          const c = i < bytes.length ? bytes[i++] : 0;
          
          const bitmap = (a << 16) | (b << 8) | c;
          
          base64 += base64Chars.charAt((bitmap >> 18) & 63);
          base64 += base64Chars.charAt((bitmap >> 12) & 63);
          base64 += i - 2 < bytes.length ? base64Chars.charAt((bitmap >> 6) & 63) : '=';
          base64 += i - 1 < bytes.length ? base64Chars.charAt(bitmap & 63) : '=';
        }

        // Write binary file to device
        await RNFS.writeFile(downloadPath, base64, 'base64');

        // Verify the file was written correctly
        const fileExists = await RNFS.exists(downloadPath);
        if (!fileExists) {
          throw new Error('Failed to save downloaded file');
        }

        const fileStats = await RNFS.stat(downloadPath);
        if (fileStats.size < 1000) {
          // File is suspiciously small - check if it's text
          const fileContent = await RNFS.readFile(downloadPath, 'utf8');
          if (fileContent.includes('http') || fileContent.includes('amazonaws') || fileContent.includes('X-Amz-')) {
            throw new Error('Downloaded file appears to contain a URL instead of Excel data. The file may not exist on S3 or the URL may be invalid.');
          }
        }

        if (__DEV__) {
          console.log('✅ Excel file downloaded successfully from S3 to:', downloadPath);
          console.log('File size:', fileStats.size, 'bytes');
          console.log('Original array buffer size:', arrayBuffer.byteLength, 'bytes');
        }

        // Share/open the file
        try {
          await Share.open({
            url: `file://${downloadPath}`,
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            filename: excelFilename,
            title: 'Open Excel File',
            message: `Downloaded: ${excelFilename}`,
          });
        } catch (shareError) {
          if (shareError.message !== 'User did not share') {
            console.warn('Share dialog error (non-critical):', shareError);
          }
          Alert.alert(
            'Success',
            `Excel file downloaded successfully!\n\nSaved to: Downloads/${excelFilename}`,
            [{ text: 'OK' }]
          );
        }
        return; // Success
      } else {
        // Backend is streaming the file directly - save it
        const arrayBuffer = await response.arrayBuffer();
      
        // Convert array buffer to base64 for React Native
        const bytes = new Uint8Array(arrayBuffer);
        const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
        let base64 = '';
        let i = 0;
        
        while (i < bytes.length) {
          const a = bytes[i++];
          const b = i < bytes.length ? bytes[i++] : 0;
          const c = i < bytes.length ? bytes[i++] : 0;
          
          const bitmap = (a << 16) | (b << 8) | c;
          
          base64 += base64Chars.charAt((bitmap >> 18) & 63);
          base64 += base64Chars.charAt((bitmap >> 12) & 63);
          base64 += i - 2 < bytes.length ? base64Chars.charAt((bitmap >> 6) & 63) : '=';
          base64 += i - 1 < bytes.length ? base64Chars.charAt(bitmap & 63) : '=';
        }

        // Write file to device
        await RNFS.writeFile(downloadPath, base64, 'base64');

        if (__DEV__) {
          console.log('✅ Excel file downloaded successfully to:', downloadPath);
          console.log('File size:', arrayBuffer.byteLength, 'bytes');
        }

        // Share/open the file
        try {
          await Share.open({
            url: `file://${downloadPath}`,
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            filename: excelFilename,
            title: 'Open Excel File',
            message: `Downloaded: ${excelFilename}`,
          });
        } catch (shareError) {
          if (shareError.message !== 'User did not share') {
            console.warn('Share dialog error (non-critical):', shareError);
          }
          Alert.alert(
            'Success',
            `Excel file downloaded successfully!\n\nSaved to: Downloads/${excelFilename}`,
            [{ text: 'OK' }]
          );
        }
      }
    } catch (error) {
      console.error('Error downloading Excel file:', error);
      console.error('Error details:', {
        message: error.message,
        statusCode: error.statusCode,
        fullError: error,
      });
      
      // Provide more helpful error message
      let errorMessage = 'Failed to download Excel file.';
      if (error.statusCode === 400) {
        errorMessage = 'Invalid download URL. The file link may have expired. Please try again.';
      } else if (error.statusCode === 403) {
        errorMessage = 'Access denied. You may not have permission to download this file.';
      } else if (error.statusCode === 404) {
        errorMessage = 'File not found. The Excel file may have been deleted.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      Alert.alert(
        'Download Failed',
        errorMessage
      );
    } finally {
      setIsDownloadingExcel(false);
    }
  };

  const handleSaveComment = async () => {
    if (!comment || comment.trim() === '') {
      Alert.alert('Error', 'Please enter a description');
      return;
    }

    if (!enquiry?.id && !enquiry?._id) {
      Alert.alert('Error', 'Enquiry ID is missing');
      return;
    }

    // Get current image to extract asset ID
    if (images.length === 0 || currentImageIndex >= images.length) {
      Alert.alert('Error', 'No image selected');
      return;
    }

    const currentImage = images[currentImageIndex];
    const assetId = currentImage?.Id || currentImage?.id || currentImage?._id || currentImage?.Key || currentImage?.key;
    
    if (!assetId) {
      Alert.alert('Error', 'Image ID not found');
      return;
    }

    // Get version from selected design
    const selectedDesignIndex = versionIndex !== undefined && versionIndex >= 0 && versionIndex < designData.length
      ? versionIndex
      : (designData && designData.length > 0 ? designData.length - 1 : 0);
    const version = selectedDesign?.version || selectedDesign?.Version || `Version ${selectedDesignIndex + 1}`;

    try {
      const enquiryId = enquiry.id || enquiry._id;
      
      if (__DEV__) {
        console.log('========== UPDATING ASSET DESCRIPTION ==========');
        console.log('Enquiry ID:', enquiryId);
        console.log('Design Type:', designType);
        console.log('Version:', version);
        console.log('Asset ID:', assetId);
        console.log('Description:', comment);
        console.log('================================================');
      }

      await updateAssetDescription({
        enquiryId,
        designType, // 'coral' or 'cad'
        version,
        assetId,
        description: comment.trim(),
      }).unwrap();

      // Update the local image object with the new description
      // This ensures the UI reflects the change immediately
      if (images[currentImageIndex]) {
        const updatedImages = [...images];
        updatedImages[currentImageIndex] = {
          ...updatedImages[currentImageIndex],
          Description: comment.trim(),
        };
        // Note: We can't directly update images state as it comes from props
        // But we can update the comment state to reflect the saved value
        // The invalidatesTags will trigger a refetch when navigating back
      }

      Alert.alert('Success', 'Image description updated successfully');
    } catch (error) {
      console.error('Error updating asset description:', error);
      const errorMessage = error?.data?.error || error?.data?.message || error?.message || 'Failed to update description. Please try again.';
      Alert.alert('Error', errorMessage);
    }
  };

  if (images.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <Icon name="image" size={60} color={colors.textSecondary} />
          <CustomText variant="body" style={styles.emptyText}>
            No {designType === 'coral' ? 'Coral' : 'CAD'} images available
          </CustomText>
          <Button
            title="Go Back"
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          />
        </View>
      </View>
    );
  }

  const currentImageUrl = getCurrentImageUrl();
  const showNavigation = images.length > 1;

  // Reset data URI when image changes
  useEffect(() => {
    setImageDataUri(null);
    setImageLoadingError(false);
  }, [currentImageIndex]);

  // Log when URL is generated and trigger fetch if needed
  useEffect(() => {
    console.log('========== IMAGE URL GENERATION ==========');
    console.log('currentImageUrl:', currentImageUrl);
    console.log('currentImageIndex:', currentImageIndex);
    console.log('images.length:', images.length);
    console.log('Will render image:', !!currentImageUrl);
    console.log('Platform:', Platform.OS);
    console.log('Use fetch directly:', useFetchDirectly);
    console.log('==========================================');
    
    // On Android, skip Image component and use fetch directly to avoid 401 errors
    if (currentImageUrl && useFetchDirectly && !imageDataUri) {
      console.log('📱 Android detected - Using fetch directly to avoid Image component errors');
      fetchImageWithAuth();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentImageUrl, currentImageIndex, images.length, useFetchDirectly, imageDataUri]);

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Image Slider Section */}
        <View style={styles.imageSection}>
          <View style={styles.imageContainer}>
            {currentImageUrl ? (
              <>
                {/* Try Image component with headers first (iOS only, Android uses fetch directly) */}
                {!imageDataUri && !useFetchDirectly && (
                  <Image
                    source={{
                      uri: currentImageUrl,
                      headers: imageHeaders,
                    }}
                    style={styles.image}
                    resizeMode="contain"
                    onLoadStart={() => {
                      console.log('🖼️ Image component load started for URL:', currentImageUrl);
                      console.log('🖼️ Using headers:', imageHeaders);
                      setImageLoadingError(false);
                    }}
                    onLoad={() => {
                      console.log('✅ Image loaded successfully via Image component:', currentImageUrl);
                      setImageLoadingError(false);
                    }}
                    onError={(error) => {
                      const errorObj = error.nativeEvent?.error || {};
                      const is401 = errorObj.code === 401 || 
                                   errorObj.message?.includes('401') ||
                                   String(errorObj).includes('401');
                      
                      console.error('❌ Image component load ERROR:', {
                        error: errorObj,
                        errorCode: errorObj.code,
                        errorMessage: errorObj.message,
                        fullError: String(errorObj),
                        httpCode: is401 ? '401 Unauthorized' : 'Unknown',
                        url: currentImageUrl,
                        headers: imageHeaders,
                        imageIndex: currentImageIndex,
                        imageObject: images[currentImageIndex],
                      });
                      
                      // If 401, trigger fetch fallback immediately
                      if (is401) {
                        console.error('❌ 401 Unauthorized - Triggering fetch fallback immediately');
                        setImageLoadingError(true);
                        fetchImageWithAuth();
                      }
                    }}
                    onLoadEnd={() => {
                      console.log('🖼️ Image component load ended');
                    }}
                  />
                )}
                
                {/* Use data URI (fetched image) - for both Android (direct) and iOS (fallback) */}
                {imageDataUri && (
                  <Image
                    source={{ uri: imageDataUri }}
                    style={styles.image}
                    resizeMode="contain"
                    onLoadStart={() => {
                      console.log('🖼️ Data URI image load started');
                      console.log('Data URI length:', imageDataUri.length);
                      console.log('Data URI starts with:', imageDataUri.substring(0, 50));
                      console.log('Data URI format check:', imageDataUri.startsWith('data:image'));
                    }}
                    onLoad={() => {
                      console.log('✅ Image loaded successfully via data URI');
                      setImageLoadingError(false);
                    }}
                    onError={(error) => {
                      const errorObj = error.nativeEvent?.error || {};
                      console.error('❌ Data URI image load ERROR:', {
                        error: errorObj,
                        errorCode: errorObj.code,
                        errorMessage: errorObj.message,
                        fullErrorString: String(errorObj),
                        dataUriLength: imageDataUri?.length,
                        dataUriPreview: imageDataUri?.substring(0, 150),
                        dataUriStartsWith: imageDataUri?.substring(0, 50),
                        isValidDataUri: imageDataUri?.startsWith('data:image'),
                      });
                      setImageLoadingError(true);
                    }}
                    onLoadEnd={() => {
                      console.log('🖼️ Data URI image load ended');
                    }}
                  />
                )}
                
                {/* Show loading/error state */}
                {((useFetchDirectly && !imageDataUri) || (imageLoadingError && !imageDataUri)) && (
                  <View style={styles.imagePlaceholder}>
                    {imageLoadingError ? (
                      <>
                        <Icon name="image" size={60} color={colors.textSecondary} />
                        <CustomText variant="caption" style={styles.placeholderText}>
                          Failed to load image
                        </CustomText>
                      </>
                    ) : (
                      <AnimatedLogoLoader size={60} />
                    )}
                  </View>
                )}
              </>
            ) : (
              <View style={styles.imagePlaceholder}>
                <Icon name="image" size={60} color={colors.textSecondary} />
                <CustomText variant="caption" style={styles.placeholderText}>
                  Image not available
                </CustomText>
                {__DEV__ && (
                  <CustomText variant="caption" style={[styles.placeholderText, { marginTop: 8, fontSize: 10 }]}>
                    URL: {currentImageUrl || 'null'}
                  </CustomText>
                )}
              </View>
            )}
            
            {/* Navigation Arrows */}
            {showNavigation && (
              <>
                {currentImageIndex > 0 && (
                  <TouchableOpacity
                    style={[styles.navButton, styles.prevButton]}
                    onPress={handlePreviousImage}
                  >
                    <Icon name="chevron-left" size={30} color={colors.textWhite} />
                  </TouchableOpacity>
                )}
                {currentImageIndex < images.length - 1 && (
                  <TouchableOpacity
                    style={[styles.navButton, styles.nextButton]}
                    onPress={handleNextImage}
                  >
                    <Icon name="chevron-right" size={30} color={colors.textWhite} />
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>

          {/* Image Counter */}
          <View style={styles.imageCounter}>
            <CustomText style={styles.counterText}>
              Total Images: {images.length} | Current Image: {currentImageIndex + 1}
            </CustomText>
          </View>
        </View>

        {/* Design Code Display */}
        {designCode && (
          <Card style={styles.codeCard}>
            <CustomText variant="heading" style={styles.codeText}>
              {designCode}
            </CustomText>
          </Card>
        )}

        {/* Actions Section */}
        <Card style={styles.actionsCard}>
          {/* Comment Field - Show for all users */}
          <View style={styles.commentSection}>
            {isDesigner ? (
              // Designer view: Read-only comment display
              <>
                <View style={styles.commentHeader}>
                  <CustomText variant="label" style={styles.label}>
                    Comments:
                  </CustomText>
                  <Icon name="edit" size={16} color={colors.textSecondary} />
                </View>
                <CustomText variant="body" style={styles.commentText}>
                  {comment || designCode || 'No comments'}
                </CustomText>
              </>
            ) : (
              // Admin view: Editable comment input
              <>
                <CustomText variant="label" style={styles.label}>
                  Comments
                </CustomText>
                <Input
                  value={comment}
                  onChangeText={setComment}
                  placeholder="Enter image comment..."
                  multiline
                  numberOfLines={2}
                  style={styles.commentInput}
                />
                <Button
                  title={isUpdatingDescription ? "Saving..." : "Save Comment"}
                  onPress={handleSaveComment}
                  style={styles.saveButton}
                  variant="outline"
                  disabled={isUpdatingDescription}
                />
              </>
            )}
          </View>

          {/* Action Buttons - Different for designers vs admin */}
          {isDesigner ? (
            // Designer view: Only Download buttons
            <View style={styles.designerActions}>
              <Button
                title={isDownloadingImage ? "Downloading..." : "Download"}
                onPress={handleDownloadImage}
                style={[styles.actionButton, styles.downloadButton]}
                disabled={isDownloadingImage}
              />
              <Button
                title={isDownloadingExcel ? "Downloading..." : `Download Excel - ${designCode || 'N/A'}.xlsx`}
                onPress={handleDownloadExcel}
                style={[styles.excelButton]}
                disabled={isDownloadingExcel}
              />
            </View>
          ) : (
            // Admin view: All buttons including Delete and Pricing
            <>
              <View style={styles.actionButtons}>
                <Button
                  title={isDownloadingImage ? "Downloading..." : "Download Image"}
                  onPress={handleDownloadImage}
                  style={[styles.actionButton, styles.downloadButton]}
                  disabled={isDownloadingImage}
                />
                <Button
                  title="Delete"
                  onPress={handleDeleteImage}
                  style={[styles.actionButton, styles.deleteButton]}
                />
              </View>

              {/* Download Excel Button */}
              <Button
                title={isDownloadingExcel ? "Downloading..." : `Download Excel - ${designCode || 'N/A'}`}
                onPress={handleDownloadExcel}
                style={[styles.excelButton]}
                disabled={isDownloadingExcel}
              />

              {/* Pricing Button - Admin only */}
              {isAdmin && (
                <Button
                  title="Pricing"
                  onPress={() => navigation.navigate('Pricing', {
                    enquiry: enquiry,
                    designType: designType,
                  })}
                  style={[styles.pricingButton]}
                />
              )}
            </>
          )}
        </Card>
      </ScrollView>
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
    paddingBottom: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    marginTop: 16,
    marginBottom: 24,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  backButton: {
    marginTop: 20,
  },
  imageSection: {
    width: '100%',
    backgroundColor: colors.background,
    marginBottom: 16,
  },
  imageContainer: {
    width: '100%',
    height: IMAGE_CONTAINER_HEIGHT,
    backgroundColor: colors.backgroundSecondary,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.backgroundSecondary,
  },
  placeholderText: {
    marginTop: 12,
    color: colors.textSecondary,
  },
  navButton: {
    position: 'absolute',
    top: '50%',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  prevButton: {
    left: 16,
  },
  nextButton: {
    right: 16,
  },
  imageCounter: {
    padding: 12,
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  counterText: {
    color: colors.textPrimary,
    fontSize: fonts.sm,
    fontFamily: fonts.regular,
  },
  codeCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 20,
    alignItems: 'center',
  },
  codeText: {
    fontSize: fonts.xl,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
  },
  actionsCard: {
    marginHorizontal: 16,
    padding: 20,
  },
  commentSection: {
    marginBottom: 24,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  label: {
    fontSize: fonts.base,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  commentText: {
    color: colors.textPrimary,
    fontSize: fonts.base,
  },
  commentInput: {
    marginBottom: 12,
  },
  saveButton: {
    alignSelf: 'flex-start',
  },
  designerActions: {
    gap: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
  },
  downloadButton: {
    backgroundColor: colors.info || '#2196F3',
  },
  deleteButton: {
    backgroundColor: colors.error,
  },
  excelButton: {
    backgroundColor: colors.success,
    width: '100%',
    marginBottom: 12,
  },
  pricingButton: {
    backgroundColor: colors.primary,
    width: '100%',
  },
});

export default DesignViewerScreen;


