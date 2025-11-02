import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  Text,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useGetEnquiryByIdQuery, useDeleteEnquiryMutation } from '../../store/api';
import { Card } from '../../components/cards/Cards';
import { Button, Input, EnquiryImage } from '../../components/common';
import { AnimatedLogoLoader } from '../../components/common';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import Icon from '../../components/common/Icon';
import { formatCurrency, formatDate, getStatusColor, getPriorityColor, imageSizes, spacing } from '../../utils';
import { downloadEnquiryPDF } from '../../utils/pdfGenerator';

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
  
  // Local UI state
  const [approvalMessage, setApprovalMessage] = useState('');
  const [showApprovalModal, setShowApprovalModal] = useState(false);

  // Use enquiry from query if available, otherwise use initialEnquiry
  const enquiry = enquiryData || initialEnquiry || {};

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
    Alert.alert(
      'Approve Enquiry',
      'Are you sure you want to approve this enquiry?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: () => {
            // TODO: Implement approve mutation when API is available
            Alert.alert('Info', 'Approve functionality not yet implemented');
          },
        },
      ]
    );
  };

  const handleReject = () => {
    setShowApprovalModal(true);
  };

  const confirmReject = () => {
    if (!approvalMessage.trim()) {
      Alert.alert('Error', 'Please provide a reason for rejection');
      return;
    }

    // TODO: Implement reject mutation when API is available
    setShowApprovalModal(false);
    setApprovalMessage('');
    Alert.alert('Info', 'Reject functionality not yet implemented');
  };

  const handleUploadCoral = () => {
    Alert.alert(
      'Upload Coral Design',
      'This would open file picker to upload Coral Excel/Images',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Upload',
          onPress: () => {
            // TODO: Implement upload mutation when API is available
            Alert.alert('Info', 'Coral design upload functionality not yet implemented');
          },
        },
      ]
    );
  };

  const handleUploadCAD = () => {
    Alert.alert(
      'Upload CAD Design',
      'This would open file picker to upload CAD Excel/Images',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Upload',
          onPress: () => {
            // TODO: Implement upload mutation when API is available
            Alert.alert('Info', 'CAD design upload functionality not yet implemented');
          },
        },
      ]
    );
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
    // Extract metal details
    const metal = enquiry?.Metal || enquiry?.metal || {};
    const metalColor = metal.Color || metal.color || 'N/A';
    const metalQuality = metal.Quality || metal.quality || '';
    const metalWeight = enquiry?.MetalWeight || enquiry?.metalWeight || {};
    const diamondWeight = enquiry?.DiamondWeight || enquiry?.diamondWeight || {};
    
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
              {enquiry?.title || enquiry?.Name || 'Untitled Enquiry'}
            </Text>
            <View style={styles.statusContainer}>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(enquiry?.status || 'pending') }]}>
                <Text style={{ color: colors.textWhite, fontSize: fonts.sm }}>
                  {(enquiry?.status || 'pending').toUpperCase()}
                </Text>
              </View>
              <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(enquiry?.priority || 'medium') }]}>
                <Text style={{ color: colors.textWhite, fontSize: fonts.sm }}>
                  {(enquiry?.priority || enquiry?.Priority || 'medium').toUpperCase()}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.detailsGrid}>
            {renderDetailItem('person', 'Client', enquiry?.client || enquiry?.clientName || 'Unknown Client')}
            {renderDetailItem('schedule', 'Created', formatDate(enquiry?.createdAt || new Date().toISOString()))}
            {renderDetailItem('update', 'Last Updated', formatDate(enquiry?.updatedAt || enquiry?.createdAt || new Date().toISOString()))}
            {renderDetailItem('calendar-today', 'Shipping Date', enquiry?.deadline || enquiry?.ShippingDate ? formatDate(enquiry.deadline || enquiry.ShippingDate) : 'Not set')}
            {renderDetailItem('currency-rupee', 'Budget', formatCurrency(enquiry?.estimatedPrice || enquiry?.budget || 0))}
          </View>
        </Card>

        {/* Description Card */}
        {(enquiry?.description || enquiry?.Remarks) && (
          <Card style={styles.detailsCard}>
            <Text style={[styles.sectionTitle, { fontSize: 16, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 12 }]}>
              Description
            </Text>
            <Text style={[styles.descriptionText, { color: colors.textSecondary, fontSize: 13, lineHeight: 20 }]}>
              {enquiry?.description || enquiry?.Remarks || ''}
            </Text>
          </Card>
        )}

        {/* Product Details Card */}
        <Card style={styles.detailsCard}>
          <Text style={[styles.sectionTitle, { fontSize: 16, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 12 }]}>
            Product Details
          </Text>
          <View style={styles.detailsGrid}>
            {renderDetailItem('category', 'Category', enquiry?.category || enquiry?.Category)}
            {renderDetailItem('inventory', 'Quantity', enquiry?.Quantity ? `${enquiry.Quantity}` : 'N/A')}
            {renderDetailItem('grain', 'Stone Type', enquiry?.stoneType || enquiry?.StoneType)}
            {renderDetailItem('label', 'Style Number', enquiry?.StyleNumber)}
            {renderDetailItem('receipt', 'Gati Order Number', enquiry?.GatiOrderNumber)}
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
            {renderDetailItem('label', 'Stamping', enquiry?.Stamping)}
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

  // Component to render image with fallback logic
  const ImageWithFallback = ({ image, imageKey, imageId, index }) => {
    const [currentUriIndex, setCurrentUriIndex] = useState(0);
    const [imageUri, setImageUri] = useState(null);
    const [possibleUris, setPossibleUris] = useState([]);
    
    useEffect(() => {
      // Generate all possible URIs to try
      const BASE_URL = __DEV__ 
        ? (Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000')
        : 'http://localhost:3000';
      
      const uris = [];
      
      // Try Key-based endpoints first (more reliable) - filename-based endpoints often work better
      if (imageKey) {
        const encodedKey = encodeURIComponent(imageKey);
        uris.push(
          `${BASE_URL}/api/images/${encodedKey}`,
          `${BASE_URL}/api/files/${encodedKey}`,
          `${BASE_URL}/uploads/${encodedKey}`,
          `${BASE_URL}/api/files/download/${encodedKey}`
        );
      }
      
      // Try ID-based endpoints
      if (imageId) {
        uris.push(
          `${BASE_URL}/api/files/${imageId}`,
          `${BASE_URL}/api/images/${imageId}`,
          `${BASE_URL}/api/files/download/${imageId}`
        );
      }
      
      setPossibleUris(uris);
      
      // Set the first URI to try
      if (uris.length > 0) {
        setImageUri(uris[0]);
        setCurrentUriIndex(0);
      } else {
        // Fallback to placeholder
        setImageUri(`https://via.placeholder.com/150x150?text=Image+${index + 1}`);
      }
    }, [imageKey, imageId, index]);
    
    const handleError = (error) => {
      // Try next URI
      const nextIndex = currentUriIndex + 1;
      if (nextIndex < possibleUris.length) {
        if (__DEV__) {
          console.log(`Image[${index}] failed with URI ${currentUriIndex}, trying next:`, possibleUris[nextIndex]);
        }
        setCurrentUriIndex(nextIndex);
        setImageUri(possibleUris[nextIndex]);
      } else {
        // All URIs failed, use placeholder
        if (__DEV__) {
          console.error(`Image[${index}] - All URIs failed. Key: ${imageKey}, ID: ${imageId}`);
          console.error(`Tried ${possibleUris.length} different endpoints. Please check your backend configuration.`);
        }
        setImageUri(`https://via.placeholder.com/150x150?text=Image+${index + 1}`);
      }
    };
    
    if (!imageUri) {
      return (
        <View style={styles.imageContainer}>
          <View style={styles.imagePlaceholder}>
            <Icon name="image" size={24} color={colors.textSecondary} />
          </View>
        </View>
      );
    }
    
    return (
      <View key={`${index}-${currentUriIndex}`} style={styles.imageContainer}>
        <EnquiryImage
          source={{ uri: imageUri }}
          onError={handleError}
          onLoad={() => {
            if (__DEV__ && currentUriIndex > 0) {
              console.log(`Image[${index}] loaded successfully on attempt ${currentUriIndex + 1} with URI:`, imageUri);
            }
          }}
        />
      </View>
    );
  };

  const renderImages = () => {
    // Safety check for images array
    const images = enquiry?.images || [];
    
    if (__DEV__) {
      console.log('renderImages - enquiry images:', images);
      console.log('renderImages - images length:', images.length);
    }
    
    if (images.length === 0) {
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
              imageKey = image.Key || image.key || '';
              imageId = image.Id || image.id || image._id || '';
              imageUri = image.Url || image.url || image.URI || image.uri || image.Location || image.location || '';
              
              if (__DEV__) {
                console.log(`renderImages - extracted from object - Key: ${imageKey}, Id: ${imageId}, Url: ${imageUri}`);
              }
            } else if (typeof image === 'string') {
              // If it's already a full URL, use it
              if (image.startsWith('http') || image.startsWith('https')) {
                imageUri = image;
              } else {
                imageKey = image;
              }
            }
            
            // If we have a full URL, use ImageWithFallback with that URL
            if (imageUri && (imageUri.startsWith('http') || imageUri.startsWith('https'))) {
              return (
                <View key={index} style={styles.imageContainer}>
                  <EnquiryImage
                    source={{ uri: imageUri }}
                    onError={(error) => {
                      if (__DEV__) {
                        console.error(`Image[${index}] load error:`, error.nativeEvent.error);
                        console.error(`Failed URI:`, imageUri);
                      }
                    }}
                  />
                </View>
              );
            }
            
            // Use ImageWithFallback component to try multiple endpoints
            return (
              <ImageWithFallback
                key={index}
                image={image}
                imageKey={imageKey}
                imageId={imageId}
                index={index}
              />
            );
          })}
        </ScrollView>
      </Card>
    );
  };

  const renderVersions = () => (
    <Card style={styles.versionsCard}>
      <Text style={[styles.sectionTitle, { fontSize: 16, fontWeight: 'bold', color: colors.textPrimary }]}>
        Design Versions
      </Text>

      <View style={styles.versionItem}>
        <View style={styles.versionHeader}>
          <Icon name="design-services" size={20} color={colors.primary} />
          <Text style={[styles.versionTitle, { color: colors.textPrimary, fontSize: 13, fontWeight: '500' }]}>
            Coral Design
          </Text>
        </View>
        {enquiry?.coralVersion ? (
          <TouchableOpacity style={styles.versionFile}>
            <Icon name="description" size={16} color={colors.primary} />
            <Text style={[styles.fileName, { color: colors.success, fontSize: 13 }]}>
              {enquiry.coralVersion}
            </Text>
            <Icon name="download" size={16} color={colors.primary} />
          </TouchableOpacity>
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
            CAD Design
          </Text>
        </View>
        {enquiry?.cadVersion ? (
          <TouchableOpacity style={styles.versionFile}>
            <Icon name="description" size={16} color={colors.primary} />
            <Text style={[styles.fileName, { color: colors.success, fontSize: 13 }]}>
              {enquiry.cadVersion}
            </Text>
            <Icon name="download" size={16} color={colors.primary} />
          </TouchableOpacity>
        ) : (
          <Text style={{ color: colors.textLight, fontSize: fonts.sm }}>
            No CAD design uploaded yet
          </Text>
        )}
      </View>
    </Card>
  );

  const handleEditEnquiry = () => {
    navigation.navigate('AddEnquiryStep1', { enquiry });
  };

  const handleDownloadPDF = async () => {
    try {
      Alert.alert(
        'Generating PDF',
        'Please wait while we generate the PDF...',
        [],
        { cancelable: false }
      );

      await downloadEnquiryPDF(enquiry);
      
      Alert.alert(
        'Success',
        'Enquiry PDF is ready! Check your share/download options.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error generating PDF:', error);
      Alert.alert(
        'Error',
        'Failed to generate PDF. Please try again.',
        [{ text: 'OK' }]
      );
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
      
      <View style={styles.actionButtons}>
        <Button
          title="Edit Enquiry"
          onPress={handleEditEnquiry}
          style={[styles.actionButton, styles.editButton]}
        />
        <Button
          title="Download PDF"
          onPress={handleDownloadPDF}
          style={[styles.actionButton, styles.downloadButton]}
        />
      </View>

      <View style={styles.actionButtons}>
        <Button
          title="Approve"
          onPress={handleApprove}
          style={[styles.actionButton, styles.approveButton]}
        />
        <Button
          title="Reject"
          variant="outline"
          onPress={handleReject}
          style={[styles.actionButton, styles.rejectButton]}
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
        title="Download PDF"
        onPress={handleDownloadPDF}
        style={[styles.actionButton, styles.downloadButton]}
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

  const renderAdminActions = () => (
    <Card style={styles.actionsCard}>
      <Text style={[styles.sectionTitle, { fontSize: 16, fontWeight: 'bold', color: colors.textPrimary }]}>
        Admin Actions
        </Text>
      
      <View style={styles.actionButtons}>
        <Button
          title="Edit Enquiry"
          onPress={handleEditEnquiry}
          style={[styles.actionButton, styles.editButton]}
        />
        <Button
          title="Download PDF"
          onPress={handleDownloadPDF}
          style={[styles.actionButton, styles.downloadButton]}
        />
      </View>

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

  const renderApprovalModal = () => (
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.textPrimary }}>Reject Enquiry</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
          Please provide a reason for rejecting this enquiry:
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
  uploadButton: {
    marginBottom: 16,
  },
  editButton: {
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
