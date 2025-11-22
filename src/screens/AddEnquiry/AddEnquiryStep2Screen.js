import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  Platform,
  PermissionsAndroid,
  Text,
} from 'react-native';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Button } from '../../components/common';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import { useUploadReferenceImagesMutation, useUpdateEnquiryMutation } from '../../store/api';
import { useAuth } from '../../context/AuthContext';
import { useUsers } from '../../features/users/usersHooks';
import { getUserName } from '../../utils/userUtils';
import SuccessAnimation from '../../components/common/SuccessAnimation';

const AddEnquiryStep2Screen = ({ route, navigation }) => {
  const { formData, enquiry: enquiryToEdit, isEditMode, enquiryId } = route.params;
  const { user } = useAuth();
  const [selectedImages, setSelectedImages] = useState([]);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  
  // Fetch and cache users for name resolution
  useUsers();
  
  // Log when Step 2 screen loads
  useEffect(() => {
    console.log('📋 Received Form Data from Step 1:', JSON.stringify(formData, null, 2));
    console.log('📋 Enquiry ID from Step 1:', enquiryId);
    console.log('📋 Form Data Summary:', {
      'Title': formData?.title,
      'ClientId': formData?.clientId,
      'Priority': formData?.priority,
      'Category': formData?.category,
      'StoneType': formData?.stoneType,
      'EnquiryId': enquiryId,
    });
  }, []);
  
  // Redux mutations
  const [uploadReferenceImages, { isLoading: isUploading }] = useUploadReferenceImagesMutation();
  const [updateEnquiry, { isLoading: isUpdating }] = useUpdateEnquiryMutation();
  
  const loading = isUploading || isUpdating;

  // Request camera permission for Android
  const requestCameraPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: 'Camera Permission',
            message: 'App needs access to your camera to take photos',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        return false;
      }
    }
    return true;
  };

  // Request storage permission for Android
  const requestStoragePermission = async () => {
    if (Platform.OS === 'android') {
      try {
        // For Android 13+ (API 33+), use READ_MEDIA_IMAGES
        // For older versions, use READ_EXTERNAL_STORAGE
        const androidVersion = Platform.Version;
        let permission = PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;
        
        if (androidVersion >= 33) {
          permission = 'android.permission.READ_MEDIA_IMAGES';
        }
        
        const granted = await PermissionsAndroid.request(
          permission,
          {
            title: 'Storage Permission',
            message: 'App needs access to your storage to select images',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        // On newer Android versions, permission might not be needed
        return true;
      }
    }
    return true;
  };

  const handleCamera = async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) {
      Alert.alert('Permission Denied', 'Camera permission is required to take photos');
      return;
    }

    const options = {
      mediaType: 'photo',
      quality: 0.8,
      saveToPhotos: true,
    };

    launchCamera(options, (response) => {
      if (response.didCancel) {
      } else if (response.errorCode) {
        Alert.alert('Error', `Camera Error: ${response.errorMessage}`);
      } else if (response.assets && response.assets.length > 0) {
        const asset = response.assets[0];
        if (asset.uri) {
          setSelectedImages(prev => [...prev, {
            uri: asset.uri,
            type: asset.type || 'image/jpeg',
            name: asset.fileName || `camera_${Date.now()}.jpg`,
          }]);
        }
      }
    });
  };

  const handleGallery = async () => {
    const hasPermission = await requestStoragePermission();
    if (!hasPermission && Platform.OS === 'android') {
      Alert.alert('Permission Denied', 'Storage permission is required to select images');
      return;
    }

    const options = {
      mediaType: 'mixed', // Allow both images and videos
      quality: 0.8,
      selectionLimit: 10, // Allow multiple selection
      includeBase64: false,
    };

    launchImageLibrary(options, (response) => {
      if (response.didCancel) {
      } else if (response.errorCode) {
        Alert.alert('Error', `Image Picker Error: ${response.errorMessage}`);
      } else if (response.assets && response.assets.length > 0) {
        const newImages = response.assets.map(asset => ({
          uri: asset.uri || '',
          type: asset.type || 'image/jpeg',
          name: asset.fileName || `image_${Date.now()}.jpg`,
        })).filter(img => img.uri);
        
        setSelectedImages(prev => [...prev, ...newImages]);
      }
    });
  };

  const handleImagePicker = () => {
    Alert.alert(
      'Select Image Source',
      'Choose how you want to add images',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Camera',
          onPress: handleCamera,
        },
        {
          text: 'Gallery',
          onPress: handleGallery,
        },
      ]
    );
  };

  const removeImage = (index) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    console.log('Timestamp:', new Date().toISOString());
    console.log('Form Data from Step 1:', JSON.stringify(formData, null, 2));
    
    if (!user?.id) {
      Alert.alert('Error', 'User not found. Please login again.');
      return;
    }
    
    let enquiryData = null; // Declare outside try block for error logging
    
    try {
      // Map Priority from form values to API format
      const priorityMap = {
        'low': 'Low',
        'medium': 'Medium',
        'normal': 'Normal',
        'high': 'High',
        'super high': 'Super High',
        'urgent': 'Urgent',
        // Handle exact matches
        'Low': 'Low',
        'Medium': 'Medium',
        'Normal': 'Normal',
        'High': 'High',
        'Super High': 'Super High',
        'Urgent': 'Urgent',
      };
      
      const mappedPriority = priorityMap[formData.priority?.toLowerCase()] || priorityMap[formData.priority] || formData.priority || 'Medium';
      
      console.log('📋 Priority Mapping:', {
        'Input Priority': formData.priority,
        'Mapped Priority': mappedPriority,
      });
      
      // For new enquiries: Upload reference images and then show success
      if (!isEditMode && enquiryId) {
        // Upload images if any are selected
      if (selectedImages.length > 0) {
          console.log('📤 Uploading reference images to enquiry:', enquiryId);
          try {
            await uploadReferenceImages({
              enquiryId,
              images: selectedImages,
            }).unwrap();
            console.log('✅ Reference images uploaded successfully');
          } catch (uploadError) {
            console.error('❌ Error uploading reference images:', uploadError);
            Alert.alert(
              'Image Upload Failed',
              uploadError?.data?.message || uploadError?.data?.error || 'Failed to upload images. The enquiry was created but images could not be uploaded.',
              [
                {
                  text: 'Continue Anyway',
                  onPress: () => {
                    navigation.navigate('MainTabs', { screen: 'Enquiries' });
                  },
                },
              ]
            );
            return;
          }
        } else {
          console.log('ℹ️ No reference images selected - enquiry created without images');
        }

        // Success - show Lottie animation instead of Alert
        setShowSuccessAnimation(true);
        return;
          }
          
      // For edit mode: Upload new images if any are selected
      if (isEditMode && enquiryToEdit?.id && selectedImages.length > 0) {
        try {
          await uploadReferenceImages({
            enquiryId: enquiryToEdit.id,
            images: selectedImages,
          }).unwrap();
          console.log('✅ Reference images uploaded successfully for edit');
        } catch (uploadError) {
          console.error('❌ Error uploading reference images:', uploadError);
          // Continue with update even if image upload fails
        }
      }
      
      // Prepare enquiry data according to API structure (only for edit mode)
      
      enquiryData = {
        // Only include Id for updates, not for new enquiries
        ...(isEditMode && enquiryToEdit?.id ? { Id: enquiryToEdit.id } : {}),
        Name: formData.title || '',
        ClientId: formData.clientId || enquiryToEdit?.clientId || user.id, // Use formData.clientId first (from Step 1)
        AssignedTo: formData.assignedTo || enquiryToEdit?.AssignedTo || null,
        Status: formData.status || enquiryToEdit?.status || 'Enquiry Created', // Use formData.status first
        Priority: mappedPriority,
        Quantity: parseInt(formData.quantity) || 1, // Convert to number as per API
        Metal: {
          Color: formData.metalColor || 'Gold',
          Quality: formData.metalQuality || '10K',
        },
        StyleNumber: formData.styleNumber || null,
        GatiOrderNumber: formData.gatiOrderNumber || null,
        StoneType: formData.stoneType || 'NaturalRegular',
        MetalWeight: {
          From: formData.metalWeightFrom ? (() => {
            const cleaned = formData.metalWeightFrom.toString().replace(/[^0-9.]/g, '');
            const num = parseFloat(cleaned);
            return isNaN(num) ? null : num;
          })() : null,
          To: formData.metalWeightTo ? (() => {
            const cleaned = formData.metalWeightTo.toString().replace(/[^0-9.]/g, '');
            const num = parseFloat(cleaned);
            return isNaN(num) ? null : num;
          })() : null,
          Exact: formData.metalWeightExact ? (() => {
            const cleaned = formData.metalWeightExact.toString().replace(/[^0-9.]/g, '');
            const num = parseFloat(cleaned);
            return isNaN(num) ? null : num;
          })() : null,
        },
        DiamondWeight: {
          From: formData.diamondWeightFrom ? (() => {
            const cleaned = formData.diamondWeightFrom.toString().replace(/[^0-9.]/g, '');
            const num = parseFloat(cleaned);
            return isNaN(num) ? null : num;
          })() : null,
          To: formData.diamondWeightTo ? (() => {
            const cleaned = formData.diamondWeightTo.toString().replace(/[^0-9.]/g, '');
            const num = parseFloat(cleaned);
            return isNaN(num) ? null : num;
          })() : null,
          Exact: formData.diamondWeightExact ? (() => {
            const cleaned = formData.diamondWeightExact.toString().replace(/[^0-9.]/g, '');
            const num = parseFloat(cleaned);
            return isNaN(num) ? null : num;
          })() : null,
        },
        Stamping: formData.stamping || null,
        Remarks: formData.description || '',
        ShippingDate: formData.deadline || null,
        CoralCode: enquiryToEdit?.CoralCode || null,
        CadCode: enquiryToEdit?.CadCode || null,
        Category: formData.category || 'Ring',
      };
      
      // Note: ReferenceImages are now uploaded separately via uploadReferenceImages endpoint
      // No need to include them in enquiryData

      console.log('📤 Final Enquiry Data to be sent:', JSON.stringify(enquiryData, null, 2));
      console.log('📊 Enquiry Data Summary:', {
        'Name': enquiryData.Name,
        'ClientId': enquiryData.ClientId,
        'Priority': enquiryData.Priority,
        'Category': enquiryData.Category,
        'StoneType': enquiryData.StoneType,
        'Quantity': enquiryData.Quantity,
        'Metal Color': enquiryData.Metal?.Color,
        'Metal Quality': enquiryData.Metal?.Quality,
        'Has Metal Weight': !!(enquiryData.MetalWeight?.From || enquiryData.MetalWeight?.To || enquiryData.MetalWeight?.Exact),
        'Has Diamond Weight': !!(enquiryData.DiamondWeight?.From || enquiryData.DiamondWeight?.To || enquiryData.DiamondWeight?.Exact),
      });

      // Only proceed with update if in edit mode
      if (isEditMode && enquiryToEdit?.id) {
        const updateResult = await updateEnquiry({ id: enquiryToEdit.id, ...enquiryData }).unwrap();
        
        // Construct updated enquiry object from form data since API only returns _id
        // Normalize priority for display
        const normalizedPriority = priorityMap[formData.priority?.toLowerCase()] || 'Medium';
        const priorityForUI = formData.priority || 'medium';
        
        const updatedEnquiry = {
          ...enquiryToEdit,
          id: enquiryToEdit.id,
          // UI format fields (for display in cards/list)
          title: formData.title,
          description: formData.description,
          priority: priorityForUI,
          deadline: formData.deadline || null,
          category: formData.category,
          stoneType: formData.stoneType,
          metalType: `${formData.metalColor || 'Gold'} (${formData.metalQuality || '10K'})`,
          updatedAt: new Date().toISOString(),
          // API format fields (for consistency)
          Name: formData.title,
          Remarks: formData.description,
          Priority: normalizedPriority,
          ShippingDate: formData.deadline || null,
          Category: formData.category,
          StoneType: formData.stoneType,
          Quantity: parseInt(formData.quantity) || 1,
          Metal: {
            Color: formData.metalColor || 'Gold',
            Quality: formData.metalQuality || '10K',
          },
          MetalWeight: {
            From: formData.metalWeightFrom || null,
            To: formData.metalWeightTo || null,
            Exact: formData.metalWeightExact || null,
          },
          DiamondWeight: {
            From: formData.diamondWeightFrom || null,
            To: formData.diamondWeightTo || null,
            Exact: formData.diamondWeightExact || null,
          },
          Stamping: formData.stamping || null,
          StyleNumber: formData.styleNumber || null,
          GatiOrderNumber: formData.gatiOrderNumber || null,
          // Preserve original fields
          ClientId: enquiryToEdit.ClientId || enquiryToEdit.clientId,
          AssignedTo: enquiryToEdit.AssignedTo || enquiryToEdit.assignedTo,
          Status: enquiryToEdit.Status || enquiryToEdit.status,
          CoralCode: enquiryToEdit.CoralCode || enquiryToEdit.coralCode,
          CadCode: enquiryToEdit.CadCode || enquiryToEdit.cadCode,
          clientName: enquiryToEdit.clientName,
          clientId: enquiryToEdit.clientId,
          createdAt: enquiryToEdit.createdAt,
          status: enquiryToEdit.status,
          budget: enquiryToEdit.budget,
        };
        
        Alert.alert(
          'Enquiry Updated',
          'Your enquiry has been updated successfully!',
          [
            {
              text: 'OK',
              onPress: () => {
                // Navigate back to single enquiry screen with updated data
                navigation.navigate('SingleEnquiry', { 
                  enquiryId: enquiryToEdit.id, 
                  enquiry: updatedEnquiry,
                  shouldRefresh: true, // Flag to indicate data was updated
                });
              },
            },
          ],
          { cancelable: false }
        );
      } else {
        // This should not happen - new enquiries should return early above
        console.error('⚠️ Unexpected: Reached else block for new enquiry');
        Alert.alert(
          'Error',
          'Unexpected error occurred. Please try again.'
        );
      }
    } catch (error) {
      console.error('❌ Timestamp:', new Date().toISOString());
      console.error('❌ Error Data:', JSON.stringify(error.data, null, 2));
      console.error('❌ Full Error Object:', JSON.stringify(error, null, 2));
      
      if (enquiryData) {
        console.error('📤 Enquiry data that was sent:', JSON.stringify(enquiryData, null, 2));
        console.error('📊 Enquiry Data Summary:', {
          'Name': enquiryData.Name,
          'ClientId': enquiryData.ClientId,
          'Priority': enquiryData.Priority,
          'Category': enquiryData.Category,
          'Has Images': !!enquiryData.ReferenceImages,
          'Images Count': enquiryData.ReferenceImages?.length || 0,
        });
      } else {
        console.error('⚠️ Enquiry data was not prepared (error occurred before data preparation)');
        console.error('⚠️ Form Data available:', JSON.stringify(formData, null, 2));
      }
      
      
      // Provide more detailed error message
      let errorMessage = `Failed to ${isEditMode ? 'update' : 'create'} enquiry.`;
      
      // Check if it's a 500 error (backend server error)
      if (error.status === 500) {
        errorMessage = 'Server error (500). Please check:\n\n';
        errorMessage += '1. Backend server is running properly\n';
        errorMessage += '2. All required fields are provided\n';
        errorMessage += '3. Data format matches backend expectations\n\n';
        if (error.data) {
          if (typeof error.data === 'string') {
            errorMessage += `Error: ${error.data}`;
          } else if (error.data.error) {
            errorMessage += `Error: ${error.data.error}`;
          } else if (error.data.message) {
            errorMessage += `Error: ${error.data.message}`;
          } else {
            errorMessage += 'Check backend logs for details.';
          }
        }
      } else if (error.data) {
        if (typeof error.data === 'string') {
          errorMessage = error.data;
        } else if (error.data.error) {
          errorMessage = error.data.error;
        } else if (error.data.message) {
          errorMessage = error.data.message;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      Alert.alert(
        'Error',
        errorMessage,
        [{ text: 'OK', onPress: () => {} }],
        { cancelable: false }
      );
      // Don't navigate on error - stay on the form
      return;
    }
  };

  const renderFormSummary = () => {
    // Helper function to format weight values
    const formatWeight = (from, to, exact) => {
      if (exact) return `${exact} g`;
      if (from && to) return `${from} - ${to} g`;
      if (from) return `From ${from} g`;
      if (to) return `Up to ${to} g`;
      return 'Not specified';
    };

    // Helper function to format date
    const formatDate = (dateString) => {
      if (!dateString) return 'Not specified';
      try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
      } catch {
        return dateString;
      }
    };

    return (
      <View style={styles.summaryCard}>
        <Text style={styles.sectionTitle}>
          Enquiry Summary
        </Text>
        
        {formData.title && (
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Title</Text>
            <Text style={styles.summaryValue}>{formData.title}</Text>
          </View>
        )}

        {formData.clientName && (
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Client</Text>
            <Text style={styles.summaryValue}>{formData.clientName}</Text>
          </View>
        )}

        {formData.category && (
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Category</Text>
            <Text style={styles.summaryValue}>{formData.category}</Text>
          </View>
        )}

        {formData.priority && (
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Priority</Text>
            <Text style={styles.summaryValue}>
              {formData.priority.charAt(0).toUpperCase() + formData.priority.slice(1)}
            </Text>
          </View>
        )}

        {formData.status && (
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Status</Text>
            <Text style={styles.summaryValue}>{formData.status}</Text>
          </View>
        )}

        {formData.assignedTo && (
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Assigned To</Text>
            <Text style={styles.summaryValue}>
              {formData.assignedToName || getUserName(formData.assignedTo) || 'Not assigned'}
            </Text>
          </View>
        )}

        {formData.quantity && (
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Quantity</Text>
            <Text style={styles.summaryValue}>{formData.quantity}</Text>
          </View>
        )}

        {formData.stoneType && (
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Stone Type</Text>
            <Text style={styles.summaryValue}>{formData.stoneType}</Text>
          </View>
        )}

        {(formData.metalColor || formData.metalQuality) && (
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Metal</Text>
            <Text style={styles.summaryValue}>
              {formData.metalColor || 'N/A'} {formData.metalQuality ? `(${formData.metalQuality})` : ''}
            </Text>
          </View>
        )}

        {(formData.metalWeightFrom || formData.metalWeightTo || formData.metalWeightExact) && (
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Metal Weight</Text>
            <Text style={styles.summaryValue}>
              {formatWeight(formData.metalWeightFrom, formData.metalWeightTo, formData.metalWeightExact)}
            </Text>
          </View>
        )}

        {(formData.diamondWeightFrom || formData.diamondWeightTo || formData.diamondWeightExact) && (
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Diamond Weight</Text>
            <Text style={styles.summaryValue}>
              {formatWeight(formData.diamondWeightFrom, formData.diamondWeightTo, formData.diamondWeightExact)}
            </Text>
          </View>
        )}

        {formData.stamping && (
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Stamping</Text>
            <Text style={styles.summaryValue}>{formData.stamping}</Text>
          </View>
        )}

        {formData.styleNumber && (
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Style Number</Text>
            <Text style={styles.summaryValue}>{formData.styleNumber}</Text>
          </View>
        )}

        {formData.gatiOrderNumber && (
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Gati Order Number</Text>
            <Text style={styles.summaryValue}>{formData.gatiOrderNumber}</Text>
          </View>
        )}

        {formData.deadline && (
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Shipping Date</Text>
            <Text style={styles.summaryValue}>{formatDate(formData.deadline)}</Text>
          </View>
        )}

        {formData.description && (
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Description</Text>
            <Text style={styles.descriptionText}>{formData.description}</Text>
          </View>
        )}
      </View>
    );
  };

  const renderImageUpload = () => (
    <View style={styles.imageCard}>
      <Text style={styles.sectionTitle}>
        Reference Images/Videos
      </Text>
      
      <Text style={styles.sectionSubtitle}>
        Upload reference images or videos to help designers understand your requirements
      </Text>

      <TouchableOpacity style={styles.uploadButton} onPress={handleImagePicker}>
        <Icon name="add-a-photo" size={28} color={colors.primary} />
        <Text style={styles.uploadText}>
          Add Images/Videos
        </Text>
        <Text style={styles.uploadSubtext}>
          Tap to select from camera or gallery
        </Text>
      </TouchableOpacity>

      {selectedImages.length > 0 && (
        <View style={styles.imagesGrid}>
          {selectedImages.map((image, index) => (
            <View key={index} style={styles.imageContainer}>
              <Image
                source={{ uri: image.uri || image }}
                style={styles.image}
              />
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => removeImage(index)}>
                <Icon name="close" size={16} color={colors.textWhite} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  const renderInstructions = () => (
    <View style={styles.instructionsCard}>
      <Text style={styles.sectionTitle}>
        Instructions
      </Text>
      
      <View style={styles.instructionItem}>
        <Icon name="info" size={18} color={colors.info} />
        <Text style={styles.instructionText}>
          Make sure to provide clear and detailed descriptions
        </Text>
      </View>

      <View style={styles.instructionItem}>
        <Icon name="photo-camera" size={18} color={colors.info} />
        <Text style={styles.instructionText}>
          Upload high-quality reference images for better results
        </Text>
      </View>

      <View style={styles.instructionItem}>
        <Icon name="schedule" size={18} color={colors.info} />
        <Text style={styles.instructionText}>
          Our team will review and respond within 24 hours
        </Text>
      </View>
    </View>
  );

  return (
    <ScrollView style={styles.container}>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>{isEditMode ? 'Update References' : 'Upload References'}</Text>
              <Text style={styles.headerSubtitle}>
                {isEditMode ? 'Update reference materials (optional)' : 'Step 2 of 2 - Add Reference Materials'}
              </Text>
            </View>

      {renderFormSummary()}
      {renderImageUpload()}
      {renderInstructions()}

            <View style={styles.footer}>
              <TouchableOpacity
                onPress={handleSubmit}
                disabled={loading}
                style={[styles.adminActionButton, styles.adminActionButtonPrimary, loading && styles.btnDisabled]}
                activeOpacity={0.85}
              >
                {loading ? (
                  <>
                    <Icon name="hourglass-empty" size={18} color={colors.textWhite} />
                    <Text style={styles.adminActionText}>Submitting...</Text>
                  </>
                ) : (
                  <>
                    <Icon name="check-circle" size={18} color={colors.textWhite} />
                    <Text style={styles.adminActionText}>
                      {isEditMode ? "Update Enquiry" : "Submit Enquiry"}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
              
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                style={[styles.adminActionButton, styles.adminActionButtonOutline]}
                activeOpacity={0.85}
              >
                <Icon name="arrow-back" size={18} color={colors.primary} />
                <Text style={[styles.adminActionText, styles.adminActionOutlineText]}>
                  Back to Step 1
                </Text>
              </TouchableOpacity>
            </View>
      {/* Success Animation Modal */}
      <SuccessAnimation
        visible={showSuccessAnimation}
        onComplete={() => {
          setShowSuccessAnimation(false);
          // Navigate back to enquiries list
          navigation.navigate('MainTabs', { screen: 'Enquiries' });
        }}
        title="Enquiry Created"
        message="Your enquiry has been created successfully!"
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: 16,
    backgroundColor: colors.backgroundSecondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: fonts.lg,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: fonts.sm,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
  },
  summaryCard: {
    margin: 16,
    padding: 16,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 8,
  },
  summaryItem: {
    marginBottom: 10,
  },
  summaryLabel: {
    fontSize: fonts.sm,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: fonts.base,
    fontFamily: fonts.regular,
    color: colors.textPrimary,
  },
  descriptionText: {
    fontSize: fonts.sm,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    marginTop: 4,
    fontStyle: 'italic',
  },
  imageCard: {
    margin: 16,
  },
  sectionTitle: {
    fontSize: fonts.lg,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: fonts.sm,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  uploadButton: {
    alignItems: 'center',
    padding: 24,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: 8,
    backgroundColor: colors.backgroundSecondary,
  },
  uploadText: {
    fontSize: fonts.base,
    fontFamily: fonts.medium,
    color: colors.primary,
    marginTop: 8,
    marginBottom: 4,
  },
  uploadSubtext: {
    fontSize: fonts.sm,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
  },
  imagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 16,
    gap: 12,
  },
  imageContainer: {
    position: 'relative',
  },
  image: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  removeButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.error,
    justifyContent: 'center',
    alignItems: 'center',
  },
  instructionsCard: {
    margin: 16,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  instructionText: {
    fontSize: fonts.sm,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    marginLeft: 10,
    flex: 1,
  },
  footer: {
    padding: 20,
    gap: 12,
  },
  adminActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  adminActionButtonPrimary: {
    backgroundColor: colors.primary,
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
  btnDisabled: {
    opacity: 0.5,
  },
});

export default AddEnquiryStep2Screen;
