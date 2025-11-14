import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  Text,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Input, Button } from '../../components/common';
import { Heading, CustomText } from '../../components/common/Text';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import IconComponent from '../../components/common/Icon';
import { useGetClientsQuery, useGetUsersQuery } from '../../store/api';

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
      metalColor: 'Gold',
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
    metalColor: 'Gold',
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
  
  // Fetch clients for dropdown
  const { data: clientsData = [] } = useGetClientsQuery(undefined, {
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
            {options.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.dropdownOption,
                  value === option.value && styles.dropdownOptionSelected,
                ]}
                onPress={() => {
                  onSelect(option.value);
                  onToggle();
                }}
              >
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
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );

  const handleNext = () => {
    if (validateForm()) {
      navigation.navigate('AddEnquiryStep2', { 
        formData,
        isEditMode: false,
      });
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
    { label: 'In Progress', value: 'In Progress' },
    { label: 'Completed', value: 'Completed' },
    { label: 'Rejected', value: 'Rejected' },
  ];

  const categoryOptions = [
    { label: 'Ring', value: 'Ring' },
    { label: 'Necklace', value: 'Necklace' },
    { label: 'Earrings', value: 'Earrings' },
    { label: 'Bracelet', value: 'Bracelet' },
    { label: 'Pendant', value: 'Pendant' },
    { label: 'Other', value: 'Other' },
  ];

  const metalColorOptions = [
    { label: 'Gold', value: 'Gold' },
    { label: 'White Gold', value: 'White Gold' },
    { label: 'Rose Gold', value: 'Rose Gold' },
    { label: 'Platinum', value: 'Platinum' },
    { label: 'Silver', value: 'Silver' },
  ];

  const metalQualityOptions = [
    { label: '10K', value: '10K' },
    { label: '14K', value: '14K' },
    { label: '18K', value: '18K' },
    { label: '22K', value: '22K' },
    { label: '24K', value: '24K' },
  ];

  const stoneTypeOptions = [
    { label: 'Natural Regular', value: 'NaturalRegular' },
    { label: 'CVD Lab Grown', value: 'CVDLabGrown' },
    { label: 'HPHT Lab Grown', value: 'HPHTLabGrown' },
    { label: 'Moissanite', value: 'Moissanite' },
    { label: 'Other', value: 'Other' },
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Heading level={3}>{isEditMode ? 'Edit Enquiry' : 'Enquiry Details'}</Heading>
        <CustomText variant="caption" color="secondary">
          {isEditMode ? 'Update enquiry information' : 'Step 1 of 2 - Basic Information'}
        </CustomText>
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
                {priorityOptions.map(option => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.priorityOption,
                      formData.priority === option.value && styles.priorityOptionActive,
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

        <Button
          title="Save"
          onPress={handleNext}
          style={styles.nextButton}
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
  form: {
    padding: 20,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    marginBottom: 16,
    fontSize: fonts.lg,
    fontWeight: fonts.medium,
  },
  priorityContainer: {
    marginTop: 16,
  },
  priorityLabel: {
    marginBottom: 12,
  },
  priorityOptions: {
    flexDirection: 'row',
    gap: 12,
  },
  priorityOption: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: colors.backgroundSecondary,
    alignItems: 'center',
  },
  priorityOptionActive: {
    backgroundColor: colors.primary,
  },
  priorityOptionText: {
    fontSize: fonts.base,
    color: colors.textPrimary,
  },
  priorityOptionTextActive: {
    color: colors.textWhite,
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  formField: {
    flex: 1,
  },
  fullWidthField: {
    flex: 1,
    width: '100%',
  },
  nextButton: {
    marginTop: 32,
  },
  errorText: {
    color: colors.error,
    fontSize: fonts.sm,
    marginTop: 4,
    marginLeft: 4,
  },
  dropdownContainer: {
    marginBottom: 16,
  },
  dropdownLabel: {
    fontSize: fonts.sm,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    minHeight: 48,
  },
  dropdownText: {
    fontSize: fonts.base,
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
    minWidth: 200,
    maxWidth: '80%',
    shadowColor: colors.shadow || colors.textPrimary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
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
    backgroundColor: colors.backgroundSecondary,
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
  weightRow: {
    flexDirection: 'row',
    gap: 12,
  },
  weightInput: {
    flex: 1,
  },
});

export default AddEnquiryStep1Screen;
