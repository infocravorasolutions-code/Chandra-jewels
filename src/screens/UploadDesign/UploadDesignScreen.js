import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Text,
  Image,
  Platform,
  Alert,
  PermissionsAndroid,
  Modal,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
// DocumentPicker is optional - will check if available
let DocumentPicker;
try {
  DocumentPicker = require('react-native-document-picker').default;
} catch (e) {
  DocumentPicker = null;
}
import { Card } from '../../components/cards/Cards';
import { Button, Input } from '../../components/common';
import Icon from '../../components/common/Icon';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import { CustomText } from '../../components/common/Text';
import { useUploadDesignMutation } from '../../store/api';
import { useAuth } from '../../context/AuthContext';

const UploadDesignScreen = ({ route, navigation }) => {
  const { designType, enquiry } = route.params || {}; // designType: 'coral' or 'cad'
  const { user } = useAuth();
  
  const originalData = enquiry?._originalData || enquiry;
  
  // Get the code for Coral or CAD (initial value)
  const initialDesignCode = designType === 'coral'
    ? (originalData?.CoralCode || enquiry?.CoralCode || enquiry?.coralCode || '')
    : (originalData?.CadCode || enquiry?.CadCode || enquiry?.cadCode || '');
  
  // Get existing versions to determine next version
  const designData = designType === 'coral' 
    ? (originalData?.Coral || enquiry?.Coral || [])
    : (originalData?.Cad || enquiry?.Cad || []);
  
  const nextVersion = designData.length + 1;
  
  // Generate versions 1 to 50
  const allVersions = Array.from({ length: 50 }, (_, i) => ({
    label: `Version ${i + 1}`,
    value: i + 1,
  }));
  
  const [designCode, setDesignCode] = useState(initialDesignCode);
  const [selectedVersion, setSelectedVersion] = useState(nextVersion);
  const [selectedImages, setSelectedImages] = useState([]);
  const [selectedExcel, setSelectedExcel] = useState(null);
  const [showVersionDropdown, setShowVersionDropdown] = useState(false);
  
  const [uploadDesign, { isLoading: isUploading }] = useUploadDesignMutation();
  
  // Request storage permission for Android
  const requestStoragePermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const androidVersion = Platform.Version;
        let permission = PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;
        
        if (androidVersion >= 33) {
          permission = 'android.permission.READ_MEDIA_IMAGES';
        }
        
        const granted = await PermissionsAndroid.request(permission, {
          title: 'Storage Permission',
          message: 'App needs access to your storage to select files',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        });
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        return true;
      }
    }
    return true;
  };

  const handleSelectImages = async () => {
    const hasPermission = await requestStoragePermission();
    if (!hasPermission) {
      Alert.alert('Permission Denied', 'Storage permission is required to select images');
      return;
    }

    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.8,
        allowsMultiple: true,
        selectionLimit: 20,
      });

      if (result.didCancel) {
        return;
      }

      if (result.assets && result.assets.length > 0) {
        const newImages = result.assets.map(asset => ({
          uri: asset.uri,
          type: asset.type || 'image/jpeg',
          name: asset.fileName || `image_${Date.now()}.jpg`,
          width: asset.width,
          height: asset.height,
        }));
        setSelectedImages(prev => [...prev, ...newImages]);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to select images');
    }
  };

  const handleSelectExcel = async () => {
    if (!DocumentPicker) {
      Alert.alert(
        'Feature Not Available',
        'Document picker is not installed. Please install react-native-document-picker to use this feature.',
        [{ text: 'OK' }]
      );
      return;
    }

    const hasPermission = await requestStoragePermission();
    if (!hasPermission) {
      Alert.alert('Permission Denied', 'Storage permission is required to select files');
      return;
    }

    try {
      const result = await DocumentPicker.pick({
        type: [DocumentPicker.types.xls, DocumentPicker.types.xlsx, DocumentPicker.types.csv],
        allowMultiSelection: false,
      });

      if (result && result.length > 0) {
        const file = result[0];
        setSelectedExcel({
          uri: file.uri,
          name: file.name,
          type: file.type || 'application/vnd.ms-excel',
          size: file.size,
        });
      }
    } catch (error) {
      if (DocumentPicker && DocumentPicker.isCancel && DocumentPicker.isCancel(error)) {
        return;
      }
      Alert.alert('Error', 'Failed to select Excel file');
    }
  };

  const handleRemoveImage = (index) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleRemoveExcel = () => {
    setSelectedExcel(null);
  };

  const handleUploadAll = async () => {
    if (!designCode || designCode.trim() === '') {
      Alert.alert('Validation Error', `Please enter ${designType === 'coral' ? 'Coral' : 'CAD'} Code`);
      return;
    }

    if (selectedImages.length === 0 && !selectedExcel) {
      Alert.alert('Warning', 'Please select at least one image or Excel file to upload');
      return;
    }

    if (!enquiry?.id && !enquiry?._id) {
      Alert.alert('Error', 'Enquiry ID is missing');
      return;
    }

    try {
      const enquiryId = enquiry.id || enquiry._id;
      
      const result = await uploadDesign({
        enquiryId,
        designType: designType, // 'coral' or 'cad'
        version: selectedVersion.toString(),
        images: selectedImages,
        excel: selectedExcel || null,
        designCode: designCode.trim(), // Pass the Coral/CAD code to save it
      }).unwrap();

      Alert.alert(
        'Success',
        `Successfully uploaded ${designType === 'coral' ? 'Coral' : 'CAD'} design${selectedImages.length > 0 ? ` with ${selectedImages.length} image(s)` : ''}${selectedExcel ? ' and Excel file' : ''}`,
        [
          {
            text: 'OK',
            onPress: () => {
              // Clear selections
              setSelectedImages([]);
              setSelectedExcel(null);
              // Navigate back
              navigation.goBack();
            },
          },
        ]
      );
    } catch (error) {
      const errorMessage = error?.data?.message || error?.data || error?.message || 'Failed to upload design. Please try again.';
      Alert.alert('Upload Failed', errorMessage);
    }
  };

  const renderVersionDropdown = () => {
    return (
      <View style={styles.dropdownContainer}>
        <TouchableOpacity
          style={styles.dropdown}
          onPress={() => setShowVersionDropdown(!showVersionDropdown)}
          activeOpacity={0.7}
        >
          <Text style={styles.dropdownText}>
            Version {selectedVersion}
          </Text>
          <Icon
            name="arrow-drop-down"
            size={24}
            color={colors.textSecondary}
          />
        </TouchableOpacity>
        
        <Modal
          visible={showVersionDropdown}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowVersionDropdown(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowVersionDropdown(false)}
          >
            <View style={styles.dropdownModal}>
              <ScrollView 
                style={styles.dropdownScrollView}
                nestedScrollEnabled={true}
                showsVerticalScrollIndicator={true}
              >
                {allVersions.map((version) => (
                  <TouchableOpacity
                    key={version.value}
                    style={[
                      styles.dropdownOption,
                      selectedVersion === version.value && styles.dropdownOptionSelected
                    ]}
                    onPress={() => {
                      setSelectedVersion(version.value);
                      setShowVersionDropdown(false);
                    }}
                  >
                    <Text style={[
                      styles.dropdownOptionText,
                      selectedVersion === version.value && styles.dropdownOptionTextSelected
                    ]}>
                      {version.label}
                    </Text>
                    {selectedVersion === version.value && (
                      <Icon name="check" size={20} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>
      </View>
    );
  };

  const renderUploadArea = (title, onPress, files, onRemove, isMultiple = false) => (
    <View style={styles.uploadSection}>
      <Text style={styles.uploadLabel}>{title}</Text>
      <TouchableOpacity
        style={styles.uploadArea}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <Icon name="cloud-upload" size={40} color={colors.primary} />
        <Text style={styles.uploadText}>Drag and Drop Here or</Text>
        <Text style={styles.uploadLink}>Upload {isMultiple ? 'Files' : 'File'}</Text>
      </TouchableOpacity>
      
      {/* Show selected files */}
      {isMultiple && files.length > 0 && (
        <View style={styles.selectedFilesContainer}>
          {files.map((file, index) => (
            <View key={index} style={styles.selectedFileItem}>
              <Image source={{ uri: file.uri }} style={styles.previewImage} />
              <Text style={styles.fileName} numberOfLines={1}>
                {file.name}
              </Text>
              <TouchableOpacity
                onPress={() => onRemove(index)}
                style={styles.removeButton}
              >
                <Icon name="close" size={20} color={colors.error} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
      
      {!isMultiple && files && (
        <View style={styles.selectedFilesContainer}>
          <View style={styles.selectedFileItem}>
            <Icon name="insert-drive-file" size={40} color={colors.primary} />
            <Text style={styles.fileName} numberOfLines={1}>
              {files.name}
            </Text>
            <TouchableOpacity
              onPress={onRemove}
              style={styles.removeButton}
            >
              <Icon name="close" size={20} color={colors.error} />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Card style={styles.card}>
          <Text style={styles.title}>
            Add {designType === 'coral' ? 'Coral' : 'CAD'}
          </Text>
          
          {/* Code Field */}
          <View style={styles.codeContainer}>
            <Text style={styles.label}>
              {designType === 'coral' ? 'Coral' : 'CAD'} Code:
            </Text>
            <View style={styles.codeInputContainer}>
              <Input
                value={designCode}
                onChangeText={setDesignCode}
                editable={true}
                placeholder={`Enter ${designType === 'coral' ? 'Coral' : 'CAD'} Code`}
                style={styles.codeInput}
              />
              <TouchableOpacity
                style={styles.copyButton}
                onPress={() => {
                  // TODO: Copy to clipboard
                  Alert.alert('Info', 'Code copied to clipboard');
                }}
              >
                <Icon name="content-copy" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Version Dropdown */}
          <View style={styles.versionContainer}>
            <Text style={styles.label}>Version:</Text>
            {renderVersionDropdown()}
          </View>

          {/* Upload Images */}
          {renderUploadArea(
            'Upload Images:',
            handleSelectImages,
            selectedImages,
            handleRemoveImage,
            true
          )}

          {/* Upload Excel */}
          {renderUploadArea(
            'Upload Excel:',
            handleSelectExcel,
            selectedExcel,
            handleRemoveExcel,
            false
          )}
        </Card>
      </ScrollView>

      {/* Upload All Button */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          onPress={handleUploadAll}
          disabled={isUploading}
          style={[styles.adminActionButton, styles.adminActionButtonPrimary, isUploading && styles.btnDisabled]}
          activeOpacity={0.85}
        >
          {isUploading ? (
            <>
              <Icon name="hourglass-empty" size={18} color={colors.textWhite} />
              <Text style={styles.adminActionText}>Uploading...</Text>
            </>
          ) : (
            <>
              <Icon name="cloud-upload" size={18} color={colors.textWhite} />
              <Text style={styles.adminActionText}>Upload All</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  card: {
    padding: 20,
  },
  title: {
    fontSize: fonts.xl,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    marginBottom: 24,
  },
  codeContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: fonts.md,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
    marginBottom: 8,
  },
  codeInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  codeInput: {
    flex: 1,
    marginRight: 8,
  },
  copyButton: {
    padding: 8,
  },
  versionContainer: {
    marginBottom: 20,
  },
  dropdownContainer: {
    marginBottom: 0,
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    backgroundColor: colors.surface,
  },
  dropdownText: {
    fontSize: fonts.md,
    fontFamily: fonts.regular,
    color: colors.textPrimary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownModal: {
    backgroundColor: colors.background,
    borderRadius: 12,
    minWidth: 200,
    maxWidth: '80%',
    maxHeight: '60%',
    shadowColor: colors.shadow || colors.textPrimary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  dropdownScrollView: {
    maxHeight: 400,
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight || colors.border,
  },
  dropdownOptionSelected: {
    backgroundColor: colors.backgroundSecondary || colors.surface,
  },
  dropdownOptionText: {
    fontSize: fonts.base,
    fontFamily: fonts.regular,
    color: colors.textPrimary,
  },
  dropdownOptionTextSelected: {
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  uploadSection: {
    marginBottom: 24,
  },
  uploadLabel: {
    fontSize: fonts.md,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
    marginBottom: 8,
  },
  uploadArea: {
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    minHeight: 150,
  },
  uploadText: {
    fontSize: fonts.sm,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    marginTop: 12,
    marginBottom: 4,
  },
  uploadLink: {
    fontSize: fonts.md,
    fontFamily: fonts.medium,
    color: colors.primary,
  },
  selectedFilesContainer: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectedFileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
    marginBottom: 8,
    maxWidth: '48%',
  },
  previewImage: {
    width: 40,
    height: 40,
    borderRadius: 4,
    marginRight: 8,
  },
  fileName: {
    flex: 1,
    fontSize: fonts.sm,
    fontFamily: fonts.regular,
    color: colors.textPrimary,
  },
  removeButton: {
    padding: 4,
    marginLeft: 4,
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
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
  adminActionText: {
    color: colors.textWhite,
    fontFamily: fonts.medium,
    fontSize: 14,
    marginLeft: 8,
  },
  btnDisabled: {
    opacity: 0.5,
  },
});

export default UploadDesignScreen;

