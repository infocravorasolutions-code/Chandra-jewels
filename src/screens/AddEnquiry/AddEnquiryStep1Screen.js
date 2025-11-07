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
import { validateEmail } from '../../utils/helpers';
import IconComponent from '../../components/common/Icon';
import { useGetClientsQuery } from '../../store/api';

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
      clientEmail: '',
      clientPhone: '',
      estimatedBudget: '',
      priority: 'medium',
      deadline: '',
      category: 'Ring',
      metalColor: 'Gold',
      metalQuality: '10K',
      stoneType: 'NaturalRegular',
      quantity: '1',
      metalWeightFrom: '',
      metalWeightTo: '',
      metalWeightExact: '',
      diamondWeightFrom: '',
      diamondWeightTo: '',
      diamondWeightExact: '',
      stamping: '',
      styleNumber: '',
      gatiOrderNumber: '',
    };
  };

  // Initialize form data - use empty form initially, will be populated in useEffect
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    clientId: '',
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    estimatedBudget: '',
    priority: 'medium',
    deadline: '',
    category: 'Ring',
    metalColor: 'Gold',
    metalQuality: '10K',
    stoneType: 'NaturalRegular',
    quantity: '1',
    metalWeightFrom: '',
    metalWeightTo: '',
    metalWeightExact: '',
    diamondWeightFrom: '',
    diamondWeightTo: '',
    diamondWeightExact: '',
    stamping: '',
    styleNumber: '',
    gatiOrderNumber: '',
  });
  const [errors, setErrors] = useState({});
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showMetalColorDropdown, setShowMetalColorDropdown] = useState(false);
  const [showMetalQualityDropdown, setShowMetalQualityDropdown] = useState(false);
  const [showStoneTypeDropdown, setShowStoneTypeDropdown] = useState(false);
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  
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
      newErrors.title = 'Title is required';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }

    if (!formData.clientId && !formData.clientName.trim()) {
      newErrors.clientId = 'Client is required';
    }

    // Validate client email and phone (required for new enquiries)
    if (!formData.clientEmail.trim()) {
      newErrors.clientEmail = 'Client email is required';
    } else if (!validateEmail(formData.clientEmail)) {
      newErrors.clientEmail = 'Please enter a valid email';
    }

    if (!formData.clientPhone.trim()) {
      newErrors.clientPhone = 'Client phone is required';
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
    { label: 'Low', value: 'low' },
    { label: 'Medium', value: 'medium' },
    { label: 'High', value: 'high' },
    { label: 'Urgent', value: 'urgent' },
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
        <Input
          label="Enquiry Title"
          placeholder="Enter enquiry title"
          value={formData.title}
          onChangeText={(value) => handleInputChange('title', value)}
          error={errors.title}
        />

        <Input
          label="Description"
          placeholder="Describe your jewellery requirements"
          value={formData.description}
          onChangeText={(value) => handleInputChange('description', value)}
          multiline
          numberOfLines={4}
          error={errors.description}
        />

        <View style={styles.section}>
          <CustomText variant="label" style={styles.sectionTitle}>
            Client Information
          </CustomText>
          
          {renderDropdown(
            'Client Name',
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

          <Input
            label="Client Email"
            placeholder="Enter client email"
            value={formData.clientEmail}
            onChangeText={(value) => handleInputChange('clientEmail', value)}
            keyboardType="email-address"
            autoCapitalize="none"
            error={errors.clientEmail}
          />

          <Input
            label="Client Phone"
            placeholder="Enter client phone number"
            value={formData.clientPhone}
            onChangeText={(value) => handleInputChange('clientPhone', value)}
            keyboardType="phone-pad"
            error={errors.clientPhone}
          />
        </View>

        <View style={styles.section}>
          <CustomText variant="label" style={styles.sectionTitle}>
            Project Details
          </CustomText>
          
          <Input
            label="Estimated Budget"
            placeholder="Enter estimated budget"
            value={formData.estimatedBudget}
            onChangeText={(value) => handleInputChange('estimatedBudget', value)}
            keyboardType="numeric"
            error={errors.estimatedBudget}
          />

          <View style={styles.priorityContainer}>
            <CustomText variant="label" style={styles.priorityLabel}>
              Priority Level
            </CustomText>
            <View style={styles.priorityOptions}>
              {priorityOptions.map(option => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.priorityOption,
                    formData.priority === option.value && styles.priorityOptionActive,
                  ]}
                  onPress={() => handleInputChange('priority', option.value)}>
                  <CustomText
                    variant="caption"
                    color={formData.priority === option.value ? 'white' : 'secondary'}>
                    {option.label}
                  </CustomText>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <Input
            label="Shipping Date (Optional)"
            placeholder="YYYY-MM-DD"
            value={formData.deadline}
            onChangeText={(value) => handleInputChange('deadline', value)}
          />
        </View>

        <View style={styles.section}>
          <CustomText variant="label" style={styles.sectionTitle}>
            Product Details
          </CustomText>
          
          {renderDropdown(
            'Category',
            formData.category,
            categoryOptions,
            (value) => handleInputChange('category', value),
            showCategoryDropdown,
            () => setShowCategoryDropdown(!showCategoryDropdown)
          )}

          {renderDropdown(
            'Metal Color',
            formData.metalColor,
            metalColorOptions,
            (value) => handleInputChange('metalColor', value),
            showMetalColorDropdown,
            () => setShowMetalColorDropdown(!showMetalColorDropdown)
          )}

          {renderDropdown(
            'Metal Quality',
            formData.metalQuality,
            metalQualityOptions,
            (value) => handleInputChange('metalQuality', value),
            showMetalQualityDropdown,
            () => setShowMetalQualityDropdown(!showMetalQualityDropdown)
          )}

          {renderDropdown(
            'Stone Type',
            formData.stoneType,
            stoneTypeOptions,
            (value) => handleInputChange('stoneType', value),
            showStoneTypeDropdown,
            () => setShowStoneTypeDropdown(!showStoneTypeDropdown)
          )}

          <Input
            label="Quantity"
            placeholder="Enter quantity"
            value={formData.quantity}
            onChangeText={(value) => handleInputChange('quantity', value)}
            keyboardType="numeric"
            error={errors.quantity}
          />
        </View>

        <View style={styles.section}>
          <CustomText variant="label" style={styles.sectionTitle}>
            Weight Details (Optional)
          </CustomText>
          
          <View style={styles.weightRow}>
            <Input
              label="Metal Weight (From)"
              placeholder="From"
              value={formData.metalWeightFrom}
              onChangeText={(value) => handleInputChange('metalWeightFrom', value)}
              keyboardType="numeric"
              style={styles.weightInput}
            />
            <Input
              label="Metal Weight (To)"
              placeholder="To"
              value={formData.metalWeightTo}
              onChangeText={(value) => handleInputChange('metalWeightTo', value)}
              keyboardType="numeric"
              style={styles.weightInput}
            />
          </View>

          <Input
            label="Metal Weight (Exact)"
            placeholder="Exact weight"
            value={formData.metalWeightExact}
            onChangeText={(value) => handleInputChange('metalWeightExact', value)}
            keyboardType="numeric"
          />

          <View style={styles.weightRow}>
            <Input
              label="Diamond Weight (From)"
              placeholder="From"
              value={formData.diamondWeightFrom}
              onChangeText={(value) => handleInputChange('diamondWeightFrom', value)}
              keyboardType="numeric"
              style={styles.weightInput}
            />
            <Input
              label="Diamond Weight (To)"
              placeholder="To"
              value={formData.diamondWeightTo}
              onChangeText={(value) => handleInputChange('diamondWeightTo', value)}
              keyboardType="numeric"
              style={styles.weightInput}
            />
          </View>

          <Input
            label="Diamond Weight (Exact)"
            placeholder="Exact weight"
            value={formData.diamondWeightExact}
            onChangeText={(value) => handleInputChange('diamondWeightExact', value)}
            keyboardType="numeric"
          />
        </View>

        <View style={styles.section}>
          <CustomText variant="label" style={styles.sectionTitle}>
            Additional Information (Optional)
          </CustomText>
          
          <Input
            label="Stamping"
            placeholder="Enter stamping details"
            value={formData.stamping}
            onChangeText={(value) => handleInputChange('stamping', value)}
          />

          <Input
            label="Style Number"
            placeholder="Enter style number"
            value={formData.styleNumber}
            onChangeText={(value) => handleInputChange('styleNumber', value)}
          />

          <Input
            label="Gati Order Number"
            placeholder="Enter Gati order number"
            value={formData.gatiOrderNumber}
            onChangeText={(value) => handleInputChange('gatiOrderNumber', value)}
          />
        </View>

        <Button
          title="Next Step"
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
  nextButton: {
    marginTop: 32,
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
