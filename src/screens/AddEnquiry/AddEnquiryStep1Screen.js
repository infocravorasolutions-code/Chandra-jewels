import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  Text,
  Image,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Input, Button } from '../../components/common';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import IconComponent from '../../components/common/Icon';
import { useGetUsersQuery } from '../../store/api';
import { useClients } from '../../features/clients/clientsHooks';

const AddEnquiryStep1Screen = ({ route, navigation }) => {
  // This screen is only for creating new enquiries
  const isEditMode = false;
  
  // Initialize form data for new enquiry
  const getInitialFormData = () => {
    return {
      title: '',
      description: '',
      clientId: '',
      clientName: '',
      priority: 'Normal',
      category: 'Ring',
      metalColor: 'White Gold',
      metalQuality: '10K',
      stoneType: 'NaturalRegular',
      quantity: '1',
      stamping: '',
      status: 'Enquiry Created',
      assignedTo: '',
    };
  };

  // Initialize form data - use empty form initially, will be populated in useEffect
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    clientId: '',
    clientName: '',
    priority: 'Normal',
    category: 'Ring',
    metalColor: 'White Gold',
    metalQuality: '10K',
    stoneType: 'NaturalRegular',
    quantity: '1',
    stamping: '',
    status: 'Enquiry Created',
    assignedTo: '',
  });
  const [errors, setErrors] = useState({});
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showMetalColorDropdown, setShowMetalColorDropdown] = useState(false);
  const [showMetalQualityDropdown, setShowMetalQualityDropdown] = useState(false);
  const [showStoneTypeDropdown, setShowStoneTypeDropdown] = useState(false);
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showAssignedToDropdown, setShowAssignedToDropdown] = useState(false);
  
  // Fetch clients for dropdown (using cached hook)
  const { clients: clientsData = [] } = useClients({
    skip: false,
  });
  
  const clients = Array.isArray(clientsData) ? clientsData : [];
  
  // Create client options for dropdown
  const clientOptions = clients.map(client => ({
    label: client.name || 'Unknown Client',
    value: client.id || client._id,
  }));

  // Fetch users for Assigned To field
  const { data: usersData = [] } = useGetUsersQuery(undefined, {
    skip: false,
  });
  const users = Array.isArray(usersData) ? usersData : [];

  // Create assigned-to options from users (exclude clients by role)
  const assignedToOptions = users
    .filter(user => {
      const roleString = String(user.role || '').toLowerCase();
      return roleString !== 'client';
    })
    .map(user => ({
      label: user.name || user.email || 'Unknown',
      value: user.id || user._id,
    }));


  // Initialize form on mount (only for creating new enquiries)
  useEffect(() => {
    const initialData = getInitialFormData();
    setFormData(initialData);
  }, []); // Only run once on mount

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Name is required';
    }

    if (!formData.clientId && !formData.clientName.trim()) {
      newErrors.clientId = 'Client is required';
    }

    if (!formData.status) {
      newErrors.status = 'Status is required';
    }

    if (!formData.stoneType) {
      newErrors.stoneType = 'Stone Type is required';
    }

    if (!formData.metalQuality) {
      newErrors.metalQuality = 'Metal Quality is required';
    }

    if (!formData.metalColor) {
      newErrors.metalColor = 'Metal Color is required';
    }

    if (!formData.quantity.trim()) {
      newErrors.quantity = 'Quantity is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const renderDropdown = (label, value, options, onSelect, isVisible, onToggle) => (
    <View style={styles.dropdownContainer}>
      <Text style={styles.dropdownLabel}>{label}</Text>
      <TouchableOpacity
        style={styles.dropdown}
        onPress={onToggle}
        activeOpacity={0.7}
      >
        <Text style={styles.dropdownText}>
          {options.find(opt => opt.value === value)?.label || `Select ${label}`}
        </Text>
        <IconComponent name="arrow-drop-down" size={24} color={colors.textSecondary} />
      </TouchableOpacity>

      <Modal
        visible={isVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={onToggle}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={onToggle}
        >
          <View style={styles.dropdownModal}>
            <ScrollView showsVerticalScrollIndicator={false}  style={{height: '100%'}}   >
            {options.map((option) => (
              <TouchableOpacity
                key={option.value}
                activeOpacity={0.7}
                style={[
                  styles.dropdownOption,
                  value === option.value && styles.dropdownOptionSelected,
                ]}
                onPress={() => {
                  onSelect(option.value);
                  onToggle();
                }}
              >
                {/* <Image source={} /> */}
                <Text
                  style={[
                    styles.dropdownOptionText,
                    value === option.value && styles.dropdownOptionTextSelected,
                  ]}
                >
                  {option.label}
                </Text>
                {value === option.value && (
                  <IconComponent name="check" size={20} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))}
              </ScrollView>
            
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );

  const handleNext = () => {
    if (validateForm()) {
      console.log('📝 ========== ADD ENQUIRY STEP 1 COMPLETED ==========');
      console.log('📝 Navigating to Step 2 with form data:');
      console.log('📝 Form Data:', JSON.stringify(formData, null, 2));
      console.log('📝 Form Data Summary:', {
        'Title': formData.title,
        'ClientId': formData.clientId,
        'ClientName': formData.clientName,
        'Priority': formData.priority,
        'Category': formData.category,
        'StoneType': formData.stoneType,
        'Metal Color': formData.metalColor,
        'Metal Quality': formData.metalQuality,
        'Quantity': formData.quantity,
        'Status': formData.status,
        'AssignedTo': formData.assignedTo,
      });
      console.log('📝 ===========================================');
      
      navigation.navigate('AddEnquiryStep2', { 
        formData,
        isEditMode: false,
      });
    } else {
      console.warn('⚠️ Form validation failed - cannot proceed to Step 2');
      console.warn('⚠️ Validation Errors:', errors);
    }
  };

  const priorityOptions = [
    { label: 'Normal', value: 'Normal' },
    { label: 'High', value: 'High' },
    { label: 'Super High', value: 'Super High' },
  ];

  const statusOptions = [
    { label: 'Enquiry Created', value: 'Enquiry Created' },
    { label: 'Design Approval Pending', value: 'Design Approval Pending' },
    { label: 'CAD', value: 'CAD' },
    { label: 'Coral', value: 'Coral' },
    { label: 'Approved Cad', value: 'Approved Cad' },
    { label: 'Order Placement', value: 'Order Placement' },
    { label: 'CAM Pending', value: 'CAM Pending' },
    { label: 'Production', value: 'Production' },
    { label: 'Completed', value: 'Completed' },
    { label: 'Rejected', value: 'Rejected' },
  ];

  const categoryOptions = [
    { label: 'Necklace', value: 'Necklace' },
    { label: 'Ring', value: 'Ring' },
    { label: 'Earring', value: 'Earring' },
    { label: 'Bracelet', value: 'Bracelet' },
    { label: 'Pendant', value: 'Pendant' },
    { label: 'Hoops', value: 'Hoops' },
    { label: 'Chain', value: 'Chain' },
    { label: 'Bangle', value: 'Bangle' },
    { label: 'Belt Buckle', value: 'Belt Buckle' },
    { label: 'Custom', value: 'Custom' },
  ];

  const metalColorOptions = [
    { label: 'White Gold', value: 'White Gold' },
    { label: 'Rose Gold', value: 'Rose Gold' },
    { label: 'Yellow Gold', value: 'Yellow Gold' },
    { label: 'Two Tone Rose White Gold', value: 'Two Tone Rose White Gold' },
    { label: 'Two Tone Yellow White Gold', value: 'Two Tone Yellow White Gold' },
    { label: 'Three Tone Rose Yellow White Gold', value: 'Three Tone Rose Yellow White Gold' },
  ];

  const metalQualityOptions = [
    { label: '10K', value: '10K' },
    { label: '14K', value: '14K' },
    { label: '18K', value: '18K' },
    { label: '22K', value: '22K' },
    { label: 'Silver 925', value: 'Silver 925' },
    { label: 'Platinum', value: 'Platinum' },
  ];

  const stoneTypeOptions = [
    { label: 'LabGrown', value: 'LabGrown' },
    { label: 'CVDLabGrown', value: 'CVDLabGrown' },
    { label: 'NaturalRegular', value: 'NaturalRegular' },
    { label: 'NaturalLower', value: 'NaturalLower' },
    { label: 'Synthetic', value: 'Synthetic' },
    { label: 'LabTreatedDiamond', value: 'LabTreatedDiamond' },
    { label: 'ColoredLabTreatedNat', value: 'ColoredLabTreatedNat' },
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{isEditMode ? 'Edit Enquiry' : 'Enquiry Details'}</Text>
        <Text style={styles.headerSubtitle}>
          {isEditMode ? 'Update enquiry information' : 'Step 1 of 2 - Basic Information'}
        </Text>
      </View>

      <View style={styles.form}>
        {/* Row 1: Name and Client */}
        <View style={styles.formRow}>
          <View style={styles.formField}>
            <Input
              label="Name*"
              placeholder="Name*"
              value={formData.title}
              onChangeText={(value) => handleInputChange('title', value)}
              error={errors.title}
            />
          </View>
          <View style={styles.formField}>
            {renderDropdown(
              'Client*',
              formData.clientId,
              clientOptions,
              (clientId) => {
                const selectedClient = clients.find(c => (c.id || c._id) === clientId);
                handleInputChange('clientId', clientId);
                handleInputChange('clientName', selectedClient?.name || '');
              },
              showClientDropdown,
              () => setShowClientDropdown(!showClientDropdown)
            )}
            {errors.clientId && (
              <Text style={styles.errorText}>{errors.clientId}</Text>
            )}
          </View>
        </View>

        {/* Row 2: Priority and Category */}
        <View style={styles.formRow}>
          <View style={styles.formField}>
            <View style={styles.priorityContainer}>
              <Text style={styles.priorityLabel}>Priority</Text>
              <View style={styles.priorityOptions}>
                {priorityOptions.map((option, index) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.priorityOption,
                      formData.priority === option.value && styles.priorityOptionActive,
                      index === priorityOptions.length - 1 && styles.priorityOptionLast,
                    ]}
                    onPress={() => handleInputChange('priority', option.value)}>
                    <Text
                      style={[
                        styles.priorityOptionText,
                        formData.priority === option.value && styles.priorityOptionTextActive,
                      ]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
          <View style={styles.formField}>
            {renderDropdown(
              'Category',
              formData.category,
              categoryOptions,
              (value) => handleInputChange('category', value),
              showCategoryDropdown,
              () => setShowCategoryDropdown(!showCategoryDropdown)
            )}
          </View>
        </View>

        {/* Row 3: Stamping and Quantity */}
        <View style={styles.formRow}>
          <View style={styles.formField}>
            <Input
              label="Stamping"
              placeholder="Stamping"
              value={formData.stamping}
              onChangeText={(value) => handleInputChange('stamping', value)}
            />
          </View>
          <View style={styles.formField}>
            <Input
              label="Quantity"
              placeholder="Quantity"
              value={formData.quantity}
              onChangeText={(value) => handleInputChange('quantity', value)}
              keyboardType="numeric"
              error={errors.quantity}
            />
          </View>
        </View>

        {/* Row 4: Status and Assigned To */}
        <View style={styles.formRow}>
          <View style={styles.formField}>
            {renderDropdown(
              'Status*',
              formData.status,
              statusOptions,
              (value) => handleInputChange('status', value),
              showStatusDropdown,
              () => setShowStatusDropdown(!showStatusDropdown)
            )}
            {errors.status && (
              <Text style={styles.errorText}>{errors.status}</Text>
            )}
          </View>
          <View style={styles.formField}>
            {renderDropdown(
              'Assigned To',
              formData.assignedTo,
              assignedToOptions,
              (value) => handleInputChange('assignedTo', value),
              showAssignedToDropdown,
              () => setShowAssignedToDropdown(!showAssignedToDropdown)
            )}
          </View>
        </View>

        {/* Row 5: Stone Type (full width) */}
        <View style={styles.formRow}>
          <View style={[styles.formField, styles.fullWidthField]}>
            {renderDropdown(
              'Stone Type*',
              formData.stoneType,
              stoneTypeOptions,
              (value) => handleInputChange('stoneType', value),
              showStoneTypeDropdown,
              () => setShowStoneTypeDropdown(!showStoneTypeDropdown)
            )}
            {errors.stoneType && (
              <Text style={styles.errorText}>{errors.stoneType}</Text>
            )}
          </View>
        </View>

        {/* Row 6: Metal Quality and Metal Color */}
        <View style={styles.formRow}>
          <View style={styles.formField}>
            {renderDropdown(
              'Metal Quality*',
              formData.metalQuality,
              metalQualityOptions,
              (value) => handleInputChange('metalQuality', value),
              showMetalQualityDropdown,
              () => setShowMetalQualityDropdown(!showMetalQualityDropdown)
            )}
            {errors.metalQuality && (
              <Text style={styles.errorText}>{errors.metalQuality}</Text>
            )}
          </View>
          <View style={styles.formField}>
            {renderDropdown(
              'Metal Color*',
              formData.metalColor,
              metalColorOptions,
              (value) => handleInputChange('metalColor', value),
              showMetalColorDropdown,
              () => setShowMetalColorDropdown(!showMetalColorDropdown)
            )}
            {errors.metalColor && (
              <Text style={styles.errorText}>{errors.metalColor}</Text>
            )}
          </View>
        </View>

        {/* Row 7: Remarks (full width textarea) */}
        <View style={styles.formRow}>
          <View style={[styles.formField, styles.fullWidthField]}>
            <Input
              label="Remarks"
              placeholder="Remarks"
              value={formData.description}
              onChangeText={(value) => handleInputChange('description', value)}
              multiline
              numberOfLines={4}
            />
          </View>
        </View>

        <TouchableOpacity
          onPress={handleNext}
          style={[styles.adminActionButton, styles.adminActionButtonPrimary]}
          activeOpacity={0.85}
        >
          <IconComponent name="save" size={18} color={colors.textWhite} />
          <Text style={styles.adminActionText}>Save</Text>
        </TouchableOpacity>
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
  form: {
    padding: 16,
  },
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    marginBottom: 12,
    fontSize: fonts.base,
    fontFamily: fonts.medium,
  },
  priorityContainer: {
    marginTop: 12,
  },
  priorityLabel: {
    fontSize: fonts.sm,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  priorityOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  priorityOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
    marginBottom: 8,
  },
  priorityOptionLast: {
    marginRight: 0,
  },
  priorityOptionActive: {
    backgroundColor: colors.background, // Light background for black text readability
    borderColor: colors.primary,
    borderWidth: 2, // Thicker border to indicate selection
  },
  priorityOptionText: {
    fontSize: fonts.sm,
    color: colors.textPrimary, // Black text
    fontWeight: '500',
  },
  priorityOptionTextActive: {
    fontSize: fonts.sm,
    color: colors.textPrimary, // Black text when selected
    fontWeight: '600',
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  formField: {
    flex: 1,
  },
  fullWidthField: {
    flex: 1,
    width: '100%',
  },
  adminActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 24,
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
  errorText: {
    color: colors.error,
    fontSize: fonts.sm,
    marginTop: 4,
    marginLeft: 4,
  },
  dropdownContainer: {
    marginBottom: 12,
  },
  dropdownLabel: {
    fontSize: fonts.sm,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
    minHeight: 44,
  },
  dropdownText: {
    fontSize: fonts.sm,
    fontFamily: fonts.regular,
    color: colors.textPrimary,
    flex: 1,
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
    // padding: 10,
    minWidth: 300,
    maxWidth: '80%',
    height: '50%',
    overflow: 'scroll',
    shadowColor: colors.shadow || colors.textPrimary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 10 },
    
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight || colors.border,
  },
  dropdownOptionSelected: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 10,
    margin: 10,
   borderBottomColor: colors.primary,
   borderBottomWidth: 2,
   borderRadius: 10,
   shadowColor: colors.shadow || colors.textPrimary,
  },
  dropdownOptionText: {
    fontSize: fonts.sm,
    fontFamily: fonts.regular,
    color: colors.textPrimary,
    marginLeft: 10,
  },
  dropdownOptionTextSelected: {
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  weightRow: {
    flexDirection: 'row',
    gap: 12,
  },
  weightInput: {
    flex: 1,
  },
});

export default AddEnquiryStep1Screen;
