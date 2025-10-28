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
import { Button, Input } from '../../components/common';
import { Loader } from '../../components/common/Loader';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import Icon from '../../components/common/Icon';
import { formatCurrency, formatDate, getStatusColor, getPriorityColor } from '../../utils/helpers';

const SingleEnquiryScreen = ({ route, navigation }) => {
  const { user } = useAuth();
  const { enquiry: initialEnquiry } = route.params;
  const [enquiry, setEnquiry] = useState(initialEnquiry);
  const [loading, setLoading] = useState(false);
  const [approvalMessage, setApprovalMessage] = useState('');
  const [showApprovalModal, setShowApprovalModal] = useState(false);

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
        <Text style={{ fontSize: fonts['3xl'], fontWeight: 'bold', color: colors.textPrimary }}>
          {enquiry.title}
        </Text>
        <View style={styles.statusContainer}>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(enquiry.status) }]}>
            <Text style={{ color: colors.textWhite, fontSize: fonts.sm }}>
              {enquiry.status.toUpperCase()}
            </Text>
          </View>
          <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(enquiry.priority) }]}>
            <Text style={{ color: colors.textWhite, fontSize: fonts.sm }}>
              {enquiry.priority.toUpperCase()}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.detailsGrid}>
        <View style={styles.detailRow}>
          <Icon name="account" size={16} color={colors.textSecondary} />
          <Text style={[styles.detailText, { color: colors.textSecondary, fontSize: fonts.base }]}>
            {enquiry.client}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Icon name="warning" size={16} color={colors.textSecondary} />
          <Text style={[styles.detailText, { color: colors.textSecondary, fontSize: fonts.base }]}>
            {formatDate(enquiry.createdAt)}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Icon name="dashboard" size={16} color={colors.textSecondary} />
          <Text style={[styles.detailText, { color: colors.textSecondary, fontSize: fonts.base }]}>
            {formatCurrency(enquiry.estimatedPrice)}
          </Text>
        </View>
      </View>
    </Card>
  );

  const renderImages = () => (
    <Card style={styles.imagesCard}>
      <Text style={[styles.sectionTitle, { fontSize: fonts.xl, fontWeight: 'bold', color: colors.textPrimary }]}>
        Reference Images
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {enquiry.images.map((image, index) => (
          <View key={index} style={styles.imageContainer}>
            <Image
              source={{ uri: `https://via.placeholder.com/150x150?text=${image}` }}
              style={styles.image}
            />
          </View>
        ))}
      </ScrollView>
    </Card>
  );

  const renderVersions = () => (
    <Card style={styles.versionsCard}>
      <Text style={[styles.sectionTitle, { fontSize: fonts.xl, fontWeight: 'bold', color: colors.textPrimary }]}>
        Design Versions
      </Text>

      <View style={styles.versionItem}>
        <View style={styles.versionHeader}>
          <Text style={{ fontSize: 20, color: colors.primary }}>🎨</Text>
          <Text style={[styles.versionTitle, { color: colors.textPrimary, fontSize: fonts.base, fontWeight: '500' }]}>
            Coral Design
          </Text>
        </View>
        {enquiry.coralVersion ? (
          <TouchableOpacity style={styles.versionFile}>
            <Icon name="pdf" size={16} color={colors.success} />
            <Text style={[styles.fileName, { color: colors.success, fontSize: fonts.base }]}>
              {enquiry.coralVersion}
            </Text>
            <Text style={{ fontSize: 16, color: colors.textSecondary }}>⬇️</Text>
          </TouchableOpacity>
        ) : (
          <Text style={{ color: colors.textLight, fontSize: fonts.sm }}>
            No coral design uploaded yet
          </Text>
        )}
      </View>

      <View style={styles.versionItem}>
        <View style={styles.versionHeader}>
          <Text style={{ fontSize: 20, color: colors.primary }}>🏗️</Text>
          <Text style={[styles.versionTitle, { color: colors.textPrimary, fontSize: fonts.base, fontWeight: '500' }]}>
            CAD Design
          </Text>
        </View>
        {enquiry.cadVersion ? (
          <TouchableOpacity style={styles.versionFile}>
            <Icon name="pdf" size={16} color={colors.success} />
            <Text style={[styles.fileName, { color: colors.success, fontSize: fonts.base }]}>
              {enquiry.cadVersion}
            </Text>
            <Text style={{ fontSize: 16, color: colors.textSecondary }}>⬇️</Text>
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
      <Text style={[styles.sectionTitle, { fontSize: fonts.xl, fontWeight: 'bold', color: colors.textPrimary }]}>
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
        <Text style={[styles.chatButtonText, { color: colors.textPrimary, fontSize: fonts.base }]}>
          Open Chat
        </Text>
      </TouchableOpacity>
    </Card>
  );

  const renderDesignerActions = (role) => (
    <Card style={styles.actionsCard}>
      <Text style={[styles.sectionTitle, { fontSize: fonts.xl, fontWeight: 'bold', color: colors.textPrimary }]}>
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
        <Text style={[styles.chatButtonText, { color: colors.textPrimary, fontSize: fonts.base }]}>
          Open Chat
        </Text>
      </TouchableOpacity>
    </Card>
  );

  const renderAdminActions = () => (
    <Card style={styles.actionsCard}>
      <Text style={[styles.sectionTitle, { fontSize: fonts.xl, fontWeight: 'bold', color: colors.textPrimary }]}>
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
        <Text style={[styles.chatButtonText, { color: colors.textPrimary, fontSize: fonts.base }]}>
          Open Chat
        </Text>
      </TouchableOpacity>
    </Card>
  );

  const renderApprovalModal = () => (
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <Text style={{ fontSize: fonts['2xl'], fontWeight: 'bold', color: colors.textPrimary }}>Reject Enquiry</Text>
        <Text style={{ color: colors.textSecondary, fontSize: fonts.base }}>
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
  },
  detailsCard: {
    margin: 16,
  },
  detailsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  statusContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
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
    margin: 16,
  },
  sectionTitle: {
    marginBottom: 16,
  },
  imageContainer: {
    marginRight: 12,
  },
  image: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  versionsCard: {
    margin: 16,
  },
  versionItem: {
    marginBottom: 16,
  },
  versionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
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
    margin: 16,
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
    padding: 12,
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
