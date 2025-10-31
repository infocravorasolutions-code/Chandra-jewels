import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  Text,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/cards/Cards';
import { Button, Input, EnquiryImage } from '../../components/common';
import { AnimatedLogoLoader } from '../../components/common';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import Icon from '../../components/common/Icon';
import { formatCurrency, formatDate, getStatusColor, getPriorityColor, imageSizes, spacing } from '../../utils';

const SingleEnquiryScreen = ({ route, navigation }) => {
  const { user } = useAuth();
  const { enquiry: initialEnquiry } = route.params || {};
  const [enquiry, setEnquiry] = useState(initialEnquiry || {});
  const [loading, setLoading] = useState(false);
  const [approvalMessage, setApprovalMessage] = useState('');
  const [showApprovalModal, setShowApprovalModal] = useState(false);

  // Safety check - don't render if enquiry is not available
  if (!enquiry || !enquiry.id) {
    return (
      <View style={styles.container}>
        <Text style={[styles.errorText, { color: colors.textPrimary, fontSize: fonts.lg }]}>
          Enquiry not found
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
            setEnquiry(prev => ({ ...prev, status: 'approved' }));
            Alert.alert('Success', 'Enquiry approved successfully');
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

    setEnquiry(prev => ({ ...prev, status: 'rejected' }));
    setShowApprovalModal(false);
    setApprovalMessage('');
    Alert.alert('Success', 'Enquiry rejected successfully');
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
            // Simulate upload
            setEnquiry(prev => ({ ...prev, coralVersion: 'coral_v1.xlsx' }));
            Alert.alert('Success', 'Coral design uploaded successfully');
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
            // Simulate upload
            setEnquiry(prev => ({ ...prev, cadVersion: 'cad_v1.xlsx' }));
            Alert.alert('Success', 'CAD design uploaded successfully');
          },
        },
      ]
    );
  };

  const handleEditPricing = () => {
    Alert.alert(
      'Edit Pricing',
      'This would open pricing calculator',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Edit',
          onPress: () => {
            // Simulate pricing update
            setEnquiry(prev => ({ ...prev, estimatedPrice: 30000 }));
            Alert.alert('Success', 'Pricing updated successfully');
          },
        },
      ]
    );
  };

  const renderEnquiryDetails = () => (
    <Card style={styles.detailsCard}>
      <View style={styles.detailsHeader}>
        <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.textPrimary }}>
          {enquiry?.title || 'Untitled Enquiry'}
        </Text>
        <View style={styles.statusContainer}>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(enquiry?.status || 'pending') }]}>
            <Text style={{ color: colors.textWhite, fontSize: fonts.sm }}>
              {(enquiry?.status || 'pending').toUpperCase()}
            </Text>
          </View>
          <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(enquiry?.priority || 'medium') }]}>
            <Text style={{ color: colors.textWhite, fontSize: fonts.sm }}>
              {(enquiry?.priority || 'medium').toUpperCase()}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.detailsGrid}>
        <View style={styles.detailRow}>
          <Icon name="person" size={16} color={colors.primary} />
          <Text style={[styles.detailText, { color: colors.textSecondary, fontSize: 13 }]}>
            {enquiry?.client || 'Unknown Client'}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Icon name="schedule" size={16} color={colors.primary} />
          <Text style={[styles.detailText, { color: colors.textSecondary, fontSize: 13 }]}>
            {formatDate(enquiry?.createdAt || new Date().toISOString())}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Icon name="currency-rupee" size={16} color={colors.primary} />
          <Text style={[styles.detailText, { color: colors.textSecondary, fontSize: 13 }]}>
            {formatCurrency(enquiry?.estimatedPrice || enquiry?.budget || 0)}
          </Text>
        </View>
      </View>
    </Card>
  );

  const renderImages = () => {
    // Safety check for images array
    const images = enquiry?.images || [];
    
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
              {images.map((image, index) => (
                <View key={index} style={styles.imageContainer}>
                  <EnquiryImage
                    source={{ uri: `https://via.placeholder.com/150x150?text=${image}` }}
                  />
                </View>
              ))}
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

  const renderClientActions = () => (
    <Card style={styles.actionsCard}>
      <Text style={[styles.sectionTitle, { fontSize: 16, fontWeight: 'bold', color: colors.textPrimary }]}>
        Actions
        </Text>
      
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
      
      <Button
        title="Edit Pricing"
        onPress={handleEditPricing}
        style={styles.editButton}
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
    alignItems: 'center',
  },
  detailText: {
    marginLeft: 12,
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
