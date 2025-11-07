import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Button } from '../../components/common';
import { Heading, CustomText, BodyText } from '../../components/common/Text';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import { useUploadImageMutation, useCreateEnquiryMutation, useUpdateEnquiryMutation } from '../../store/api';
import { useAuth } from '../../context/AuthContext';

const AddEnquiryStep2Screen = ({ route, navigation }) => {
  const { formData, enquiry: enquiryToEdit, isEditMode } = route.params;
  const { user } = useAuth();
  const [selectedImages, setSelectedImages] = useState([]);
  
  // Redux mutations
  const [uploadImage, { isLoading: isUploading }] = useUploadImageMutation();
  const [createEnquiry, { isLoading: isCreating }] = useCreateEnquiryMutation();
  const [updateEnquiry, { isLoading: isUpdating }] = useUpdateEnquiryMutation();
  
  const loading = isUploading || isCreating || isUpdating;

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
        console.warn(err);
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
        console.warn(err);
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
        console.log('User cancelled camera picker');
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
        console.log('User cancelled image picker');
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
    if (!user?.id) {
      Alert.alert('Error', 'User not found. Please login again.');
      return;
    }
    
    let enquiryData = null; // Declare outside try block for error logging
    
    try {
      // Map Priority from lowercase to capitalized format
      const priorityMap = {
        'low': 'Low',
        'medium': 'Medium',
        'high': 'High',
        'urgent': 'Urgent',
      };
      
      // Upload images first if any are selected
      let uploadedImages = [];
      if (selectedImages.length > 0) {
        try {
          if (__DEV__) {
            console.log('Uploading images:', selectedImages.length);
            console.log('Selected images:', selectedImages);
          }
          
          // Upload each image
          for (let i = 0; i < selectedImages.length; i++) {
            const image = selectedImages[i];
            try {
              if (__DEV__) {
                console.log(`Uploading image ${i + 1}/${selectedImages.length}:`, image);
              }
              
              const uploadedImage = await uploadImage(image).unwrap();
              if (uploadedImage) {
                uploadedImages.push(uploadedImage);
                if (__DEV__) {
                  console.log(`Image ${i + 1} uploaded successfully:`, uploadedImage);
                }
              }
            } catch (imageError) {
              console.error(`Error uploading image ${i + 1}:`, imageError.message || imageError);
              // Continue with other images even if one fails
              if (__DEV__) {
                console.error('Full error:', imageError);
              }
            }
          }
          
          if (__DEV__) {
            console.log('All images upload attempts completed. Successfully uploaded:', uploadedImages.length, 'out of', selectedImages.length);
            if (uploadedImages.length > 0) {
              console.log('Uploaded images data:', uploadedImages);
            }
          }
          
          // Warn user if some images failed
          if (uploadedImages.length < selectedImages.length) {
            if (__DEV__) {
              console.warn(`Image upload: ${uploadedImages.length}/${selectedImages.length} images uploaded successfully`);
            }
            // Don't show alert for partial failures - just log it
            // The enquiry will be created with the successfully uploaded images
          }
        } catch (uploadError) {
          console.error('Error during image upload process:', uploadError);
          // Continue with enquiry creation even if image upload fails
          // Don't show alert - images are optional, enquiry creation should proceed
          if (__DEV__) {
            console.warn('Image upload failed, but continuing with enquiry creation without images');
          }
        }
      }
      
      // Prepare enquiry data according to API structure
      enquiryData = {
        // Only include Id for updates, not for new enquiries
        ...(isEditMode && enquiryToEdit?.id ? { Id: enquiryToEdit.id } : {}),
        Name: formData.title || '',
        ClientId: enquiryToEdit?.clientId || user.id, // Use existing ClientId if editing
        AssignedTo: enquiryToEdit?.AssignedTo || null,
        Status: enquiryToEdit?.status || 'Enquiry Created', // Keep existing status if editing
        Priority: priorityMap[formData.priority?.toLowerCase()] || 'Medium',
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
      
      // Only include ReferenceImages if we have uploaded images
      // If updating, we might want to preserve existing images, so only add if new images were uploaded
      if (uploadedImages.length > 0) {
        enquiryData.ReferenceImages = uploadedImages;
      }

      if (__DEV__) {
        console.log(isEditMode ? 'Updating enquiry with data:' : 'Submitting enquiry with data:', enquiryData);
      }

      if (isEditMode && enquiryToEdit?.id) {
        await updateEnquiry({ id: enquiryToEdit.id, ...enquiryData }).unwrap();
        
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
          ]
        );
      } else {
        await createEnquiry(enquiryData).unwrap();
        Alert.alert(
          'Enquiry Created',
          'Your enquiry has been submitted successfully!',
          [
            {
              text: 'OK',
              onPress: () => {
                // Navigate back to enquiries list
                navigation.navigate('MainTabs', { screen: 'Enquiries' });
              },
            },
          ]
        );
      }
    } catch (error) {
      console.error(`Error ${isEditMode ? 'updating' : 'creating'} enquiry:`, error);
      if (__DEV__) {
        console.error('========== ENQUIRY CREATION ERROR ==========');
        console.error('Error status:', error.status);
        console.error('Error data:', error.data);
        console.error('Error message:', error.message);
        if (enquiryData) {
          console.error('Enquiry data that was sent:', JSON.stringify(enquiryData, null, 2));
        } else {
          console.error('Enquiry data was not prepared (error occurred before data preparation)');
        }
        console.error('===========================================');
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
        errorMessage
      );
    }
  };

  const renderFormSummary = () => (
    <View style={styles.summaryCard}>
      <Heading level={4} style={styles.summaryTitle}>
        Enquiry Summary
      </Heading>
      
      <View style={styles.summaryItem}>
        <CustomText variant="label" color="secondary">
          Title
        </CustomText>
        <CustomText variant="body" color="primary">
          {formData.title}
        </CustomText>
      </View>

      <View style={styles.summaryItem}>
        <CustomText variant="label" color="secondary">
          Client
        </CustomText>
        <CustomText variant="body" color="primary">
          {formData.clientName}
        </CustomText>
      </View>

      <View style={styles.summaryItem}>
        <CustomText variant="label" color="secondary">
          Budget
        </CustomText>
        <CustomText variant="body" color="primary">
          ₹{formData.estimatedBudget}
        </CustomText>
      </View>

      <View style={styles.summaryItem}>
        <CustomText variant="label" color="secondary">
          Priority
        </CustomText>
        <CustomText variant="body" color="primary">
          {formData.priority.charAt(0).toUpperCase() + formData.priority.slice(1)}
        </CustomText>
      </View>

      <View style={styles.summaryItem}>
        <CustomText variant="label" color="secondary">
          Description
        </CustomText>
        <BodyText color="secondary" style={styles.descriptionText}>
          {formData.description}
        </BodyText>
      </View>
    </View>
  );

  const renderImageUpload = () => (
    <View style={styles.imageCard}>
      <Heading level={4} style={styles.sectionTitle}>
        Reference Images/Videos
      </Heading>
      
      <CustomText variant="caption" color="secondary" style={styles.sectionSubtitle}>
        Upload reference images or videos to help designers understand your requirements
      </CustomText>

      <TouchableOpacity style={styles.uploadButton} onPress={handleImagePicker}>
        <Icon name="add-a-photo" size={32} color={colors.primary} />
        <CustomText variant="body" color="primary" style={styles.uploadText}>
          Add Images/Videos
        </CustomText>
        <CustomText variant="caption" color="secondary">
          Tap to select from camera or gallery
        </CustomText>
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
      <Heading level={4} style={styles.sectionTitle}>
        Instructions
      </Heading>
      
      <View style={styles.instructionItem}>
        <Icon name="info" size={20} color={colors.info} />
        <CustomText variant="body" color="secondary" style={styles.instructionText}>
          Make sure to provide clear and detailed descriptions
        </CustomText>
      </View>

      <View style={styles.instructionItem}>
        <Icon name="photo-camera" size={20} color={colors.info} />
        <CustomText variant="body" color="secondary" style={styles.instructionText}>
          Upload high-quality reference images for better results
        </CustomText>
      </View>

      <View style={styles.instructionItem}>
        <Icon name="schedule" size={20} color={colors.info} />
        <CustomText variant="body" color="secondary" style={styles.instructionText}>
          Our team will review and respond within 24 hours
        </CustomText>
      </View>
    </View>
  );

  return (
    <ScrollView style={styles.container}>
            <View style={styles.header}>
              <Heading level={3}>{isEditMode ? 'Update References' : 'Upload References'}</Heading>
              <CustomText variant="caption" color="secondary">
                {isEditMode ? 'Update reference materials (optional)' : 'Step 2 of 2 - Add Reference Materials'}
              </CustomText>
            </View>

      {renderFormSummary()}
      {renderImageUpload()}
      {renderInstructions()}

            <View style={styles.footer}>
              <Button
                title={isEditMode ? "Update Enquiry" : "Submit Enquiry"}
                onPress={handleSubmit}
                loading={loading}
                style={styles.submitButton}
              />
              
              <Button
                title="Back to Step 1"
                variant="outline"
                onPress={() => navigation.goBack()}
                style={styles.backButton}
              />
            </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: 20,
    backgroundColor: colors.backgroundSecondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  summaryCard: {
    margin: 16,
    padding: 16,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 8,
  },
  summaryTitle: {
    marginBottom: 16,
  },
  summaryItem: {
    marginBottom: 12,
  },
  descriptionText: {
    marginTop: 4,
    fontStyle: 'italic',
  },
  imageCard: {
    margin: 16,
  },
  sectionTitle: {
    marginBottom: 8,
  },
  sectionSubtitle: {
    marginBottom: 16,
  },
  uploadButton: {
    alignItems: 'center',
    padding: 32,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: 8,
    backgroundColor: colors.backgroundSecondary,
  },
  uploadText: {
    marginTop: 8,
    marginBottom: 4,
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
    marginBottom: 12,
  },
  instructionText: {
    marginLeft: 12,
    flex: 1,
  },
  footer: {
    padding: 20,
    gap: 12,
  },
  submitButton: {
    marginBottom: 8,
  },
  backButton: {
    marginTop: 8,
  },
});

export default AddEnquiryStep2Screen;
