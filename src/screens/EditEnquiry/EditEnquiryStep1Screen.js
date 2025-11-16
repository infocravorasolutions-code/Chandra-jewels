import React, { useState, useEffect, useMemo } from 'react';
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
import { useGetEnquiryByIdQuery, useGetClientsQuery, useGetUsersQuery, useUpdateEnquiryMutation } from '../../store/api';
import { useAuth } from '../../context/AuthContext';

const EditEnquiryStep1Screen = ({ route, navigation }) => {
  const { user } = useAuth();
  const enquiryToEdit = route.params?.enquiry || null;
  const enquiryIdFromRoute = route.params?.enquiryId || null;
  
  // API mutations
  const [updateEnquiry, { isLoading: isUpdating }] = useUpdateEnquiryMutation();
  
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
  const clients = useMemo(() => Array.isArray(clientsData) ? clientsData : [], [clientsData]);

  // Fetch users for Assigned To field
  const { data: usersData = [] } = useGetUsersQuery(undefined, {
    skip: false,
  });
  const users = useMemo(() => Array.isArray(usersData) ? usersData : [], [usersData]);
  
  // Create client options for dropdown - memoized to prevent recreation on every render
  const clientOptions = useMemo(() => clients.map(client => ({
    label: client.name || 'Unknown Client',
    value: client.id || client._id,
  })), [clients]);

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
        category: 'Ring',
        metalColor: 'Gold',
        metalQuality: '10K',
        stoneType: 'NaturalRegular',
        quantity: '1',
        stamping: '',
        gatiOrderNumber: '',
        styleNumber: '',
        metalWeightFrom: '',
        metalWeightTo: '',
        metalWeightExact: '',
        diamondWeightFrom: '',
        diamondWeightTo: '',
        diamondWeightExact: '',
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
    
    // Get status from enquiry - normalize to match statusOptions
    const rawStatus = originalData?.Status || enquiry?.Status || enquiry?.status || enquiry?.CurrentStatus || 'Enquiry Created';
    // Normalize status to match statusOptions values (case-insensitive match)
    let enquiryStatus = 'Enquiry Created'; // default
    const statusLower = String(rawStatus).toLowerCase();
    if (statusLower.includes('completed') || statusLower === 'completed') {
      enquiryStatus = 'Completed';
    } else if (statusLower.includes('approval') && statusLower.includes('pending')) {
      enquiryStatus = 'Design Approval Pending';
    } else if (statusLower === 'cad' || statusLower.includes('cad')) {
      enquiryStatus = 'CAD';
    } else if (statusLower === 'coral' || statusLower.includes('coral')) {
      enquiryStatus = 'Coral';
    } else if (statusLower.includes('progress') || statusLower === 'in progress') {
      enquiryStatus = 'In Progress';
    } else if (statusLower.includes('rejected') || statusLower === 'rejected') {
      enquiryStatus = 'Rejected';
    } else if (statusLower.includes('created') || statusLower.includes('pending')) {
      enquiryStatus = 'Enquiry Created';
    } else {
      // Try to match exactly if it's already in the correct format
      enquiryStatus = rawStatus;
    }
    
    // Get AssignedTo from enquiry - ensure it's a string ID
    const rawAssignedTo = originalData?.AssignedTo || enquiry?.AssignedTo || enquiry?.assignedTo || '';
    const enquiryAssignedTo = rawAssignedTo ? String(rawAssignedTo).trim() : '';
    
    // Extract weight data
    const metalWeight = originalData?.MetalWeight || enquiry.MetalWeight || enquiry.metalWeight || {};
    const diamondWeight = originalData?.DiamondWeight || enquiry.DiamondWeight || enquiry.diamondWeight || {};
    
    return {
      title: enquiry.title || enquiry.Name || originalData?.Name || '',
      description: enquiry.description || enquiry.Remarks || originalData?.Remarks || '',
      clientId: enquiryClientId,
      clientName: clientName,
      status: enquiryStatus,
      assignedTo: enquiryAssignedTo,
      priority: mappedPriority,
      category: enquiry.category || enquiry.Category || originalData?.Category || 'Ring',
      metalColor: originalData?.Metal?.Color || enquiry.Metal?.Color || originalData?.metal?.color || 'Gold',
      metalQuality: originalData?.Metal?.Quality || enquiry.Metal?.Quality || originalData?.metal?.quality || '10K',
      stoneType: enquiry.stoneType || enquiry.StoneType || originalData?.StoneType || originalData?.stoneType || 'NaturalRegular',
      quantity: safeToString(originalData?.Quantity || enquiry.Quantity || enquiry.quantity || '1'),
      stamping: safeToString(originalData?.Stamping || enquiry.stamping || enquiry.Stamping || ''),
      gatiOrderNumber: safeToString(originalData?.GatiOrderNumber || enquiry.GatiOrderNumber || enquiry.gatiOrderNumber || ''),
      styleNumber: safeToString(originalData?.StyleNumber || enquiry.StyleNumber || enquiry.styleNumber || ''),
      metalWeightFrom: safeToString(metalWeight.From || metalWeight.from || ''),
      metalWeightTo: safeToString(metalWeight.To || metalWeight.to || ''),
      metalWeightExact: safeToString(metalWeight.Exact || metalWeight.exact || ''),
      diamondWeightFrom: safeToString(diamondWeight.From || diamondWeight.from || ''),
      diamondWeightTo: safeToString(diamondWeight.To || diamondWeight.to || ''),
      diamondWeightExact: safeToString(diamondWeight.Exact || diamondWeight.exact || ''),
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
    category: 'Ring',
    metalColor: 'Gold',
    metalQuality: '10K',
    stoneType: 'NaturalRegular',
    quantity: '1',
    stamping: '',
    gatiOrderNumber: '',
    styleNumber: '',
    metalWeightFrom: '',
    metalWeightTo: '',
    metalWeightExact: '',
    diamondWeightFrom: '',
    diamondWeightTo: '',
    diamondWeightExact: '',
  });
  const [errors, setErrors] = useState({});
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showMetalColorDropdown, setShowMetalColorDropdown] = useState(false);
  const [showMetalQualityDropdown, setShowMetalQualityDropdown] = useState(false);
  const [showStoneTypeDropdown, setShowStoneTypeDropdown] = useState(false);
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showAssignedToDropdown, setShowAssignedToDropdown] = useState(false);


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
        console.log('  - Status:', initialData.status);
        console.log('  - Assigned To:', initialData.assignedTo);
        console.log('  - Category:', initialData.category);
        console.log('  - Metal Color:', initialData.metalColor);
        console.log('  - Metal Quality:', initialData.metalQuality);
        console.log('  - Quantity:', initialData.quantity);
        console.log('  - Status Options:', statusOptions.map(o => o.value));
        console.log('  - Assigned To Options:', assignedToOptions.map(o => ({ label: o.label, value: o.value })));
      }
    }
    // Removed 'clients' from dependencies - use clientsData.length instead to track when clients are loaded
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finalEnquiryToEdit?.id, finalEnquiryToEdit?._id, enquiryId, fetchingEnquiry, clientsData?.length]);

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

  const renderDropdown = (label, value, options, onSelect, isVisible, onToggle, usersList = []) => {
    // Find matching option - handle case-insensitive matching for status
    const findOption = (val) => {
      if (!val) return null;
      // Exact match first
      let option = options.find(opt => opt.value === val);
      if (option) return option;
      
      // Case-insensitive match (for status field)
      if (label.includes('Status')) {
        option = options.find(opt => 
          String(opt.value).toLowerCase() === String(val).toLowerCase()
        );
        if (option) return option;
      }
      
      // For Assigned To, try to find by ID even if format differs
      if (label.includes('Assigned')) {
        option = options.find(opt => 
          String(opt.value).trim() === String(val).trim()
        );
        if (option) return option;
      }
      
      return null;
    };
    
    const selectedOption = findOption(value);
    
    // Determine display text
    let displayText = selectedOption?.label;
    if (!displayText && value) {
      if (label.includes('Assigned')) {
        // For Assigned To, try to find user name from users list
        const user = usersList.find(u => 
          String(u.id || u._id).trim() === String(value).trim()
        );
        displayText = user ? (user.name || user.email || String(value)) : String(value);
      } else {
        // For other fields, just show the value
        displayText = String(value);
      }
    }
    if (!displayText) {
      displayText = `Select ${label}`;
    }
    
    if (__DEV__ && (label.includes('Status') || label.includes('Assigned'))) {
      console.log(`🔍 Dropdown "${label}":`, {
        value,
        displayText,
        hasMatch: !!selectedOption,
        optionsCount: options.length,
        allOptionValues: options.slice(0, 5).map(o => o.value), // Show first 5 for debugging
      });
    }
    
    return (
    <View style={styles.dropdownContainer}>
      <Text style={styles.dropdownLabel}>{label}</Text>
      <TouchableOpacity
        style={styles.dropdown}
        onPress={onToggle}
        activeOpacity={0.7}
      >
        <Text style={styles.dropdownText}>
            {displayText}
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
  };

  const handleNext = async () => {
    if (!validateForm()) {
      return;
    }

    if (!user?.id) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    if (!finalEnquiryToEdit?.id && !enquiryId) {
      Alert.alert('Error', 'Enquiry ID is missing');
      return;
    }

    const enquiryIdToUpdate = finalEnquiryToEdit?.id || enquiryId;

    try {
      // Priority mapping for API
      const priorityForAPI = formData.priority || 'Normal';

      // Prepare enquiry data according to API payload structure
      const enquiryData = {
        Id: enquiryIdToUpdate,
        Name: formData.title,
        ClientId: formData.clientId || finalEnquiryToEdit?.clientId || finalEnquiryToEdit?.ClientId,
        AssignedTo: formData.assignedTo || finalEnquiryToEdit?.AssignedTo || finalEnquiryToEdit?.assignedTo || null,
        Status: formData.status || finalEnquiryToEdit?.Status || finalEnquiryToEdit?.status || 'Enquiry Created',
        Priority: priorityForAPI,
        Quantity: formData.quantity && formData.quantity.trim() ? parseInt(formData.quantity) : null,
        Metal: {
          Color: formData.metalColor || 'Gold',
          Quality: formData.metalQuality || '10K',
        },
        StyleNumber: formData.styleNumber && formData.styleNumber.trim() ? formData.styleNumber : null,
        GatiOrderNumber: formData.gatiOrderNumber && formData.gatiOrderNumber.trim() ? formData.gatiOrderNumber : null,
        StoneType: formData.stoneType || 'NaturalRegular',
        MetalWeight: {
          From: formData.metalWeightFrom && formData.metalWeightFrom.trim() ? formData.metalWeightFrom.toString() : null,
          To: formData.metalWeightTo && formData.metalWeightTo.trim() ? formData.metalWeightTo.toString() : null,
          Exact: formData.metalWeightExact && formData.metalWeightExact.trim() ? formData.metalWeightExact.toString() : null,
        },
        DiamondWeight: {
          From: formData.diamondWeightFrom && formData.diamondWeightFrom.trim() ? formData.diamondWeightFrom.toString() : null,
          To: formData.diamondWeightTo && formData.diamondWeightTo.trim() ? formData.diamondWeightTo.toString() : null,
          Exact: formData.diamondWeightExact && formData.diamondWeightExact.trim() ? formData.diamondWeightExact.toString() : null,
        },
        Stamping: formData.stamping && formData.stamping.trim() ? formData.stamping : null,
        Remarks: formData.description && formData.description.trim() ? formData.description : null,
        ShippingDate: null, // Not in Step 1
        CoralCode: finalEnquiryToEdit?.CoralCode || finalEnquiryToEdit?.coralCode || null,
        CadCode: finalEnquiryToEdit?.CadCode || finalEnquiryToEdit?.cadCode || null,
        Category: formData.category || 'Ring',
      };

      if (__DEV__) {
        console.log('Updating enquiry with data:', enquiryData);
      }

      await updateEnquiry({ id: enquiryIdToUpdate, ...enquiryData }).unwrap();
      
      Alert.alert(
        'Enquiry Updated',
        'Your enquiry has been updated successfully!',
        [
          {
            text: 'OK',
            onPress: () => {
              // Go back to SingleEnquiry screen (removes EditEnquiryStep1 from stack)
              // The SingleEnquiry screen will automatically refresh due to cache invalidation
              navigation.goBack();
            },
          },
        ],
        { cancelable: false }
      );
    } catch (error) {
      console.error('Error updating enquiry:', error);
      Alert.alert(
        'Error',
        error?.data?.error || error?.message || 'Failed to update enquiry. Please try again.',
        [{ text: 'OK', onPress: () => {} }],
        { cancelable: false }
      );
      // Don't navigate on error - stay on the form
      return;
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

  // Create assigned-to options from users (exclude clients by role) - memoized to prevent recreation
  const assignedToOptions = useMemo(() => {
    const options = users
    .filter(user => {
      const roleString = String(user.role || '').toLowerCase();
      return roleString !== 'client';
    })
    .map(user => ({
      label: user.name || user.email || 'Unknown',
        value: String(user.id || user._id).trim(), // Ensure value is a string
      }));
    
    if (__DEV__) {
      console.log('🔍 Assigned To Options:', options);
      console.log('🔍 Users loaded:', users.length);
    }
    
    return options;
  }, [users]);

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
              () => setShowStatusDropdown(!showStatusDropdown),
              [] // No users needed for status
            )}
          </View>
          <View style={styles.formField}>
            {renderDropdown(
              'Assigned To',
              formData.assignedTo,
              assignedToOptions,
              (value) => handleInputChange('assignedTo', value),
              showAssignedToDropdown,
              () => setShowAssignedToDropdown(!showAssignedToDropdown),
              users // Pass users list to find name if ID doesn't match options
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
          </View>
        </View>

        {/* Row 6: Gati Order and Style Number */}
        <View style={styles.formRow}>
          <View style={styles.formField}>
            <Input
              label="Gati Order"
              placeholder="Gati Order"
              value={formData.gatiOrderNumber}
              onChangeText={(value) => handleInputChange('gatiOrderNumber', value)}
            />
          </View>
          <View style={styles.formField}>
            <Input
              label="Style Number"
              placeholder="Style Number"
              value={formData.styleNumber}
              onChangeText={(value) => handleInputChange('styleNumber', value)}
            />
          </View>
        </View>

        {/* Row 7: Metal Quality and Metal Color */}
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
          </View>
        </View>

        {/* Row 8: Metal Weight - From, To, Exact */}
        <View style={styles.formRow}>
          <View style={styles.formField}>
            <Input
              label="Metal Weight - From"
              placeholder="From (gms)"
              value={formData.metalWeightFrom}
              onChangeText={(value) => handleInputChange('metalWeightFrom', value)}
              keyboardType="decimal-pad"
            />
          </View>
          <View style={styles.formField}>
            <Input
              label="Metal Weight - To"
              placeholder="To (gms)"
              value={formData.metalWeightTo}
              onChangeText={(value) => handleInputChange('metalWeightTo', value)}
              keyboardType="decimal-pad"
            />
          </View>
          <View style={styles.formField}>
            <Input
              label="Metal Weight - Exact"
              placeholder="Exact (gms)"
              value={formData.metalWeightExact}
              onChangeText={(value) => handleInputChange('metalWeightExact', value)}
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        {/* Row 9: Diamond Weight - From, To, Exact */}
        <View style={styles.formRow}>
          <View style={styles.formField}>
            <Input
              label="Diamond Weight - From"
              placeholder="From (ct)"
              value={formData.diamondWeightFrom}
              onChangeText={(value) => handleInputChange('diamondWeightFrom', value)}
              keyboardType="decimal-pad"
            />
          </View>
          <View style={styles.formField}>
            <Input
              label="Diamond Weight - To"
              placeholder="To (ct)"
              value={formData.diamondWeightTo}
              onChangeText={(value) => handleInputChange('diamondWeightTo', value)}
              keyboardType="decimal-pad"
            />
          </View>
          <View style={styles.formField}>
            <Input
              label="Diamond Weight - Exact"
              placeholder="Exact (ct)"
              value={formData.diamondWeightExact}
              onChangeText={(value) => handleInputChange('diamondWeightExact', value)}
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        {/* Row 10: Remarks (full width textarea) */}
        <View style={styles.formRow}>
          <View style={[styles.formField, styles.fullWidthField]}>
            <Input
              label="Remarks"
              placeholder="Remarks"
              value={formData.description}
              onChangeText={(value) => handleInputChange('description', value)}
              multiline
              numberOfLines={4}
              error={errors.description}
            />
          </View>
        </View>

        <Button
          title={isUpdating ? "Saving..." : "Save"}
          onPress={handleNext}
          style={styles.nextButton}
          disabled={isUpdating}
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

