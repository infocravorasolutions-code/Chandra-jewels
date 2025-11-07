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
import { useGetEnquiryByIdQuery, useGetClientsQuery } from '../../store/api';

const EditEnquiryStep1Screen = ({ route, navigation }) => {
  const enquiryToEdit = route.params?.enquiry || null;
  const enquiryIdFromRoute = route.params?.enquiryId || null;
  
  // Fetch full enquiry data if we only have an ID or incomplete data
  const enquiryId = enquiryToEdit?.id || enquiryToEdit?._id || enquiryIdFromRoute;
  const { data: fetchedEnquiry, isLoading: fetchingEnquiry } = useGetEnquiryByIdQuery(enquiryId, {
    skip: !enquiryId || (enquiryToEdit?._originalData && Object.keys(enquiryToEdit._originalData).length > 1),
  });
  
  // Use fetched enquiry if available and more complete, otherwise use route enquiry
  const finalEnquiryToEdit = (fetchedEnquiry && fetchedEnquiry._originalData && Object.keys(fetchedEnquiry._originalData).length > 1) 
    ? fetchedEnquiry 
    : enquiryToEdit;
  
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

  // Map enquiry data to form format
  const getInitialFormData = () => {
    const enquiry = finalEnquiryToEdit;
    
    if (!enquiry || !enquiry.id) {
      return {
        title: '',
        description: '',
        clientId: '',
        clientName: '',
        status: 'Enquiry Created',
        assignedTo: '',
        priority: 'Normal',
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
    }
    
    // Map API data to form format
    const priorityMap = {
      'Low': 'Normal',
      'Medium': 'Normal',
      'Normal': 'Normal',
      'High': 'High',
      'Urgent': 'High',
      'Super Urgent': 'Super High',
      'Super High': 'Super High',
      // Handle lowercase variations
      'low': 'Normal',
      'medium': 'Normal',
      'normal': 'Normal',
      'high': 'High',
      'urgent': 'High',
      'super urgent': 'Super High',
      'super high': 'Super High',
    };
    
    // Use original data if available, otherwise use normalized
    const originalData = enquiry._originalData || enquiry;
    
    // Get client ID from enquiry
    const enquiryClientId = enquiry.clientId || originalData?.ClientId || enquiry.ClientId || '';
    
    // Find client name from ID if we have clients loaded
    let clientName = enquiry.clientName || enquiry.client || originalData?.ClientName || '';
    if (enquiryClientId && clients && Array.isArray(clients) && clients.length > 0) {
      const foundClient = clients.find(c => {
        const clientId = String(c.id || c._id || '').trim();
        const enquiryId = String(enquiryClientId).trim();
        return clientId === enquiryId || 
               clientId.replace(/\s/g, '') === enquiryId.replace(/\s/g, '');
      });
      if (foundClient) {
        clientName = foundClient.name;
      }
    }
    
    // Helper to safely convert values to string, handling null/undefined
    const safeToString = (value) => {
      if (value === null || value === undefined) return '';
      return value.toString();
    };
    
    // Format date to YYYY-MM-DD
    const formatDateForInput = (dateValue) => {
      if (!dateValue) return '';
      try {
        const dateStr = dateValue.toString();
        if (dateStr.includes('T')) {
          return dateStr.split('T')[0];
        }
        return dateStr.substring(0, 10); // Take first 10 chars (YYYY-MM-DD)
      } catch (e) {
        return '';
      }
    };
    
    if (__DEV__) {
      console.log('EditEnquiryStep1 - Mapping enquiry data');
      console.log('  Full enquiry object:', JSON.stringify(enquiry, null, 2));
      console.log('  Original data:', JSON.stringify(originalData, null, 2));
      console.log('  Title:', enquiry.title, enquiry.Name, originalData?.Name);
      console.log('  Metal:', originalData?.Metal, enquiry.Metal);
      console.log('  MetalWeight:', originalData?.MetalWeight, enquiry.MetalWeight);
      console.log('  Priority:', originalData?.Priority, enquiry.Priority, enquiry.priority);
      console.log('  Category:', originalData?.Category, enquiry.Category, enquiry.category);
      console.log('  ClientId:', enquiryClientId);
      console.log('  ClientName:', clientName);
      console.log('  Available clients:', clients.length);
    }
    
    // Priority mapping - check all possible sources
    const rawPriority = originalData?.Priority || enquiry.Priority || enquiry.priority || 'Normal';
    const mappedPriority = priorityMap[rawPriority] || priorityMap[rawPriority?.toLowerCase()] || 'Normal';
    
    // Get status from enquiry
    const enquiryStatus = originalData?.Status || enquiry?.Status || enquiry?.status || 'Enquiry Created';
    
    // Get AssignedTo from enquiry
    const enquiryAssignedTo = originalData?.AssignedTo || enquiry?.AssignedTo || enquiry?.assignedTo || '';
    
    return {
      title: enquiry.title || enquiry.Name || originalData?.Name || '',
      description: enquiry.description || enquiry.Remarks || originalData?.Remarks || '',
      clientId: enquiryClientId,
      clientName: clientName,
      status: enquiryStatus,
      assignedTo: enquiryAssignedTo,
      priority: mappedPriority,
      deadline: formatDateForInput(enquiry.deadline || enquiry.ShippingDate || originalData?.ShippingDate || originalData?.Deadline),
      category: enquiry.category || enquiry.Category || originalData?.Category || 'Ring',
      metalColor: originalData?.Metal?.Color || enquiry.Metal?.Color || originalData?.metal?.color || 'Gold',
      metalQuality: originalData?.Metal?.Quality || enquiry.Metal?.Quality || originalData?.metal?.quality || '10K',
      stoneType: enquiry.stoneType || enquiry.StoneType || originalData?.StoneType || originalData?.stoneType || 'NaturalRegular',
      quantity: safeToString(originalData?.Quantity || enquiry.Quantity || enquiry.quantity || '1'),
      metalWeightFrom: safeToString(originalData?.MetalWeight?.From || enquiry.MetalWeight?.From || originalData?.metalWeight?.from || enquiry.metalWeightFrom || ''),
      metalWeightTo: safeToString(originalData?.MetalWeight?.To || enquiry.MetalWeight?.To || originalData?.metalWeight?.to || enquiry.metalWeightTo || ''),
      metalWeightExact: safeToString(originalData?.MetalWeight?.Exact || enquiry.MetalWeight?.Exact || originalData?.metalWeight?.exact || enquiry.metalWeightExact || ''),
      diamondWeightFrom: safeToString(originalData?.DiamondWeight?.From || enquiry.DiamondWeight?.From || originalData?.diamondWeight?.from || enquiry.diamondWeightFrom || ''),
      diamondWeightTo: safeToString(originalData?.DiamondWeight?.To || enquiry.DiamondWeight?.To || originalData?.diamondWeight?.to || enquiry.diamondWeightTo || ''),
      diamondWeightExact: safeToString(originalData?.DiamondWeight?.Exact || enquiry.DiamondWeight?.Exact || originalData?.diamondWeight?.exact || enquiry.diamondWeightExact || ''),
      stamping: safeToString(originalData?.Stamping || enquiry.stamping || enquiry.Stamping || ''),
      styleNumber: safeToString(originalData?.StyleNumber || enquiry.styleNumber || enquiry.StyleNumber || ''),
      gatiOrderNumber: safeToString(originalData?.GatiOrderNumber || enquiry.gatiOrderNumber || enquiry.GatiOrderNumber || ''),
    };
  };

  // Initialize form data - use empty form initially, will be populated in useEffect
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    clientId: '',
    clientName: '',
    status: 'Enquiry Created',
    assignedTo: '',
    priority: 'Normal',
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
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showAssignedToDropdown, setShowAssignedToDropdown] = useState(false);

  // Helper function to check if a field should be displayed
  const shouldDisplayField = (fieldPath) => {
    const originalData = finalEnquiryToEdit?._originalData || finalEnquiryToEdit;
    if (!originalData) return false;
    
    // Handle nested paths like Metal.Color, MetalWeight.From, etc.
    const pathParts = fieldPath.split('.');
    let value = originalData;
    
    for (const part of pathParts) {
      if (value === null || value === undefined) return false;
      value = value[part];
    }
    
    // Return true if value exists and is not null
    return value !== null && value !== undefined;
  };
  
  // Check if weight sections should be displayed
  const shouldDisplayMetalWeight = (
    shouldDisplayField('MetalWeight.From') || 
    shouldDisplayField('MetalWeight.To') || 
    shouldDisplayField('MetalWeight.Exact')
  );
  
  const shouldDisplayDiamondWeight = (
    shouldDisplayField('DiamondWeight.From') || 
    shouldDisplayField('DiamondWeight.To') || 
    shouldDisplayField('DiamondWeight.Exact')
  );
  
  // Check if additional information section should be displayed
  const shouldDisplayAdditionalInfo = (
    shouldDisplayField('Stamping') || 
    shouldDisplayField('StyleNumber') || 
    shouldDisplayField('GatiOrderNumber')
  );

  // Update form data when enquiry changes or when fetched data arrives
  useEffect(() => {
    // Wait for fetched enquiry if we're fetching
    if (fetchingEnquiry) {
      return;
    }
    
    // Use a unique identifier to detect changes - use enquiry ID or timestamp
    const currentEnquiryId = finalEnquiryToEdit?.id || finalEnquiryToEdit?._id || enquiryId;
    
    if (currentEnquiryId && finalEnquiryToEdit) {
      if (__DEV__) {
        console.log('EditEnquiryStep1 - Editing enquiry ID:', currentEnquiryId);
        console.log('EditEnquiryStep1 - Editing enquiry:', finalEnquiryToEdit);
        console.log('EditEnquiryStep1 - Enquiry keys:', Object.keys(finalEnquiryToEdit || {}));
        console.log('EditEnquiryStep1 - Original data:', finalEnquiryToEdit._originalData);
        console.log('EditEnquiryStep1 - Original data keys:', finalEnquiryToEdit._originalData ? Object.keys(finalEnquiryToEdit._originalData) : []);
      }
      
      const initialData = getInitialFormData();
      setFormData(initialData);
      
      if (__DEV__) {
        console.log('EditEnquiryStep1 - Form data populated:', initialData);
        console.log('EditEnquiryStep1 - Check form fields:');
        console.log('  - Title:', initialData.title);
        console.log('  - Description:', initialData.description);
        console.log('  - Client:', initialData.clientName);
        console.log('  - Category:', initialData.category);
        console.log('  - Metal Color:', initialData.metalColor);
        console.log('  - Metal Quality:', initialData.metalQuality);
        console.log('  - Quantity:', initialData.quantity);
      }
    }
  }, [finalEnquiryToEdit?.id, finalEnquiryToEdit?._id, enquiryId, fetchingEnquiry, clients]);

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

    if (!formData.clientId && !formData.clientName.trim()) {
      newErrors.clientId = 'Client is required';
    }

    if (formData.quantity && formData.quantity.trim() && isNaN(parseInt(formData.quantity))) {
      newErrors.quantity = 'Quantity must be a number';
    }

    // Note: Client email and phone are not part of enquiry payload, so they're not included in the form

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
      navigation.navigate('EditEnquiryStep2', { 
        formData,
        enquiry: finalEnquiryToEdit,
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

  // Create assigned to options from clients (includes all users)
  const assignedToOptions = clients.map(client => ({
    label: client.name || 'Unknown',
    value: client.id || client._id,
  }));

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
    { label: 'Yellow Gold', value: 'Yellow Gold' },
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
    { label: 'Natural Lower', value: 'NaturalLower' },
    { label: 'CVD Lab Grown', value: 'CVDLabGrown' },
    { label: 'HPHT Lab Grown', value: 'HPHTLabGrown' },
    { label: 'Moissanite', value: 'Moissanite' },
    { label: 'Other', value: 'Other' },
  ];

  if (fetchingEnquiry) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading enquiry data...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Heading level={3}>Edit Enquiry</Heading>
        <CustomText variant="caption" color="secondary">
          Update enquiry information
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

        {shouldDisplayField('Remarks') && (
          <Input
            label="Description"
            placeholder="Describe your jewellery requirements"
            value={formData.description}
            onChangeText={(value) => handleInputChange('description', value)}
            multiline
            numberOfLines={4}
            error={errors.description}
          />
        )}

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
        </View>

        <View style={styles.section}>
          <CustomText variant="label" style={styles.sectionTitle}>
            Project Details
          </CustomText>

          {renderDropdown(
            'Status',
            formData.status,
            statusOptions,
            (value) => handleInputChange('status', value),
            showStatusDropdown,
            () => setShowStatusDropdown(!showStatusDropdown)
          )}

          {renderDropdown(
            'Assigned To',
            formData.assignedTo,
            assignedToOptions,
            (value) => handleInputChange('assignedTo', value),
            showAssignedToDropdown,
            () => setShowAssignedToDropdown(!showAssignedToDropdown)
          )}

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

          {shouldDisplayField('ShippingDate') && (
            <Input
              label="Shipping Date (Optional)"
              placeholder="YYYY-MM-DD"
              value={formData.deadline}
              onChangeText={(value) => handleInputChange('deadline', value)}
            />
          )}
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

          {shouldDisplayField('Quantity') && (
            <Input
              label="Quantity"
              placeholder="Enter quantity"
              value={formData.quantity}
              onChangeText={(value) => handleInputChange('quantity', value)}
              keyboardType="numeric"
              error={errors.quantity}
            />
          )}
        </View>

        {shouldDisplayMetalWeight && (
          <View style={styles.section}>
            <CustomText variant="label" style={styles.sectionTitle}>
              Weight Details (Optional)
            </CustomText>
            
            {(shouldDisplayField('MetalWeight.From') || shouldDisplayField('MetalWeight.To')) && (
              <View style={styles.weightRow}>
                {shouldDisplayField('MetalWeight.From') && (
                  <Input
                    label="Metal Weight (From)"
                    placeholder="From"
                    value={formData.metalWeightFrom}
                    onChangeText={(value) => handleInputChange('metalWeightFrom', value)}
                    keyboardType="numeric"
                    style={styles.weightInput}
                  />
                )}
                {shouldDisplayField('MetalWeight.To') && (
                  <Input
                    label="Metal Weight (To)"
                    placeholder="To"
                    value={formData.metalWeightTo}
                    onChangeText={(value) => handleInputChange('metalWeightTo', value)}
                    keyboardType="numeric"
                    style={styles.weightInput}
                  />
                )}
              </View>
            )}

            {shouldDisplayField('MetalWeight.Exact') && (
              <Input
                label="Metal Weight (Exact)"
                placeholder="Exact weight"
                value={formData.metalWeightExact}
                onChangeText={(value) => handleInputChange('metalWeightExact', value)}
                keyboardType="numeric"
              />
            )}

            {(shouldDisplayField('DiamondWeight.From') || shouldDisplayField('DiamondWeight.To')) && (
              <View style={styles.weightRow}>
                {shouldDisplayField('DiamondWeight.From') && (
                  <Input
                    label="Diamond Weight (From)"
                    placeholder="From"
                    value={formData.diamondWeightFrom}
                    onChangeText={(value) => handleInputChange('diamondWeightFrom', value)}
                    keyboardType="numeric"
                    style={styles.weightInput}
                  />
                )}
                {shouldDisplayField('DiamondWeight.To') && (
                  <Input
                    label="Diamond Weight (To)"
                    placeholder="To"
                    value={formData.diamondWeightTo}
                    onChangeText={(value) => handleInputChange('diamondWeightTo', value)}
                    keyboardType="numeric"
                    style={styles.weightInput}
                  />
                )}
              </View>
            )}

            {shouldDisplayField('DiamondWeight.Exact') && (
              <Input
                label="Diamond Weight (Exact)"
                placeholder="Exact weight"
                value={formData.diamondWeightExact}
                onChangeText={(value) => handleInputChange('diamondWeightExact', value)}
                keyboardType="numeric"
              />
            )}
          </View>
        )}

        {shouldDisplayAdditionalInfo && (
          <View style={styles.section}>
            <CustomText variant="label" style={styles.sectionTitle}>
              Additional Information (Optional)
            </CustomText>
            
            {shouldDisplayField('Stamping') && (
              <Input
                label="Stamping"
                placeholder="Enter stamping details"
                value={formData.stamping}
                onChangeText={(value) => handleInputChange('stamping', value)}
              />
            )}

            {shouldDisplayField('StyleNumber') && (
              <Input
                label="Style Number"
                placeholder="Enter style number"
                value={formData.styleNumber}
                onChangeText={(value) => handleInputChange('styleNumber', value)}
              />
            )}

            {shouldDisplayField('GatiOrderNumber') && (
              <Input
                label="Gati Order Number"
                placeholder="Enter Gati order number"
                value={formData.gatiOrderNumber}
                onChangeText={(value) => handleInputChange('gatiOrderNumber', value)}
              />
            )}
          </View>
        )}

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
    backgroundColor: colors.backgroundSecondary,
  },
  header: {
    padding: 20,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  form: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    marginBottom: 16,
    fontSize: fonts.base,
    fontWeight: '600',
  },
  dropdownContainer: {
    marginBottom: 16,
  },
  dropdownLabel: {
    marginBottom: 8,
    fontSize: fonts.sm,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  dropdown: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
  },
  dropdownText: {
    fontSize: fonts.base,
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
    padding: 16,
    width: '80%',
    maxHeight: '70%',
  },
  dropdownOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  dropdownOptionSelected: {
    backgroundColor: colors.primary + '20',
  },
  dropdownOptionText: {
    fontSize: fonts.base,
    color: colors.textPrimary,
  },
  dropdownOptionTextSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  priorityContainer: {
    marginBottom: 16,
  },
  priorityLabel: {
    marginBottom: 8,
    fontSize: fonts.sm,
    fontWeight: '500',
  },
  priorityOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  priorityOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  priorityOptionActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  weightRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  weightInput: {
    flex: 1,
  },
  nextButton: {
    marginTop: 24,
  },
  errorText: {
    color: colors.error,
    fontSize: fonts.sm,
    marginTop: 4,
    marginLeft: 4,
  },
  loadingText: {
    textAlign: 'center',
    padding: 20,
    color: colors.textSecondary,
  },
});

export default EditEnquiryStep1Screen;

