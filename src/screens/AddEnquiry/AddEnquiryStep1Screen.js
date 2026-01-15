import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  Text,
  Image,
  ActivityIndicator,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Input, Button } from '../../components/common';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import IconComponent from '../../components/common/Icon';
import { useGetUsersQuery, useCreateEnquiryMutation, useGetStoneTypesQuery } from '../../store/api';
import { useClients } from '../../features/clients/clientsHooks';
import { useStatusOptions } from '../../features/statuses/statusesHooks';
import { useAuth } from '../../context/AuthContext';

const AddEnquiryStep1Screen = ({ route, navigation }) => {
  // This screen is only for creating new enquiries
  const isEditMode = false;
  const { user } = useAuth();
  const [createEnquiry, { isLoading: isCreatingEnquiry }] = useCreateEnquiryMutation();
  
  // Check if user is a client
  const roleLower = user?.role?.toLowerCase();
  const isClient = 
    roleLower === 'client' ||
    roleLower === 'cl' ||
    user?.roleId === 4 ||
    user?.roleNumber === 4;
  
  // Initialize form data for new enquiry
  const getInitialFormData = () => {
    return {
      title: '',
      description: '',
      clientId: '',
      clientName: '',
      priority: 'Normal',
      category: 'Ring',
      metalColor: '', // Empty by default - optional field
      metalQuality: '10K',
      stoneType: '', // Optional field - no default
      quantity: '1',
      stamping: '',
      status: 'Enquiry Created',
      assignedTo: '',
      budget: '',
      specialRemarks: '',
      approvedDate: '',
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
    metalColor: '', // Empty by default - optional field
    metalQuality: '10K',
    stoneType: '', // Optional field - no default
    quantity: '1',
    stamping: '',
    status: 'Enquiry Created',
    assignedTo: '',
    budget: '',
    specialRemarks: '',
    approvedDate: '',
  });
  const [errors, setErrors] = useState({});
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showMetalColorDropdown, setShowMetalColorDropdown] = useState(false);
  const [showMetalQualityDropdown, setShowMetalQualityDropdown] = useState(false);
  const [showStoneTypeDropdown, setShowStoneTypeDropdown] = useState(false);
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showAssignedToDropdown, setShowAssignedToDropdown] = useState(false);
  const [showApprovedDatePicker, setShowApprovedDatePicker] = useState(false);
  const [tempApprovedDate, setTempApprovedDate] = useState(new Date());
  
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
  // Filter based on selected status:
  // - If status is "CAD", show only users with role === 3
  // - If status is "Coral", show only users with role === 2
  // - Otherwise, show all non-client users
  const assignedToOptions = useMemo(() => {
    const statusLower = String(formData.status || '').toLowerCase();
    
    return users
      .filter(user => {
        const roleString = String(user.role || '').toLowerCase();
        const roleNumber = typeof user.role === 'number' ? user.role : parseInt(user.role);
        
        // Always exclude clients
        if (roleString === 'client' || roleNumber === 4) {
          return false;
        }
        
        // Filter based on status
        if (statusLower=='cad') {
          // Show only users with role === 3 for CAD status
          return roleNumber === 3;
        } else if (statusLower=='coral') {
          // Show only users with role === 2 for Coral status
          return roleNumber === 2;
        }
        
        // For other statuses, show all non-client users
        return true;
      })
      .map(user => ({
        label: user.name || user.email || 'Unknown',
        value: user.id || user._id,
      }));
  }, [users, formData.status]);

  // Get status options from API (cached)
  const statusOptionsFromAPI = useStatusOptions();
  
  // Fetch stone types from API
  const { data: stoneTypesData = [] } = useGetStoneTypesQuery();
  
  // Filter out "All Status" option for create/edit forms (only needed in filters)
  const statusOptions = statusOptionsFromAPI.filter(opt => opt.value !== 'all');

  console.log('🔍 Status Options:', statusOptionsFromAPI);

  // Initialize form on mount (only for creating new enquiries)
  useEffect(() => {
    const initialData = getInitialFormData();
    setFormData(initialData);
  }, []); // Only run once on mount

  // Pre-select client for Client users (Role 4) based on their clientId
  useEffect(() => {
    if (isClient && user?.clientId && clients.length > 0) {
      // Find the client that matches the user's clientId
      const userClient = clients.find(c => {
        const clientId = c.id || c._id;
        return String(clientId).trim() === String(user.clientId).trim();
      });
      
      if (userClient) {
        const clientId = userClient.id || userClient._id;
        const clientName = userClient.name || userClient.Name || '';
        
     
        
        setFormData(prev => ({
          ...prev,
          clientId: clientId,
          clientName: clientName,
        }));
      } else {
        if (__DEV__) {
          console.warn('⚠️ [ADD ENQUIRY] Client user clientId not found in clients list:', {
            userClientId: user.clientId,
            availableClients: clients.map(c => ({ id: c.id || c._id, name: c.name })),
          });
        }
      }
    }
  }, [isClient, user?.clientId, clients]);

  // Ensure status is always "Enquiry Created" for client users
  useEffect(() => {
    if (isClient && formData.status !== 'Enquiry Created') {
      setFormData(prev => ({ ...prev, status: 'Enquiry Created' }));
    }
  }, [isClient, formData.status]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  // Handle status change - clear assignedTo if current user is not valid for new status
  const handleStatusChange = (newStatus) => {
    handleInputChange('status', newStatus);
    
    // If there's a currently assigned user, check if they're still valid for the new status
    if (formData.assignedTo) {
      const statusLower = String(newStatus || '').toLowerCase();
      const assignedUser = users.find(u => (u.id || u._id) === formData.assignedTo);
      
      if (assignedUser) {
        const roleNumber = typeof assignedUser.role === 'number' 
          ? assignedUser.role 
          : parseInt(assignedUser.role);
        
        // Check if assigned user is still valid for the new status
        let isValid = true;
        if (statusLower.includes('cad')) {
          isValid = roleNumber === 3;
        } else if (statusLower.includes('coral')) {
          isValid = roleNumber === 2;
        }
        
        // Clear assignedTo if user is not valid for the new status
        if (!isValid) {
          handleInputChange('assignedTo', '');
        }
      }
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

    // For client users, status is always "Enquiry Created" (set automatically)
    // For other users, status is required
    if (!isClient && !formData.status) {
      newErrors.status = 'Status is required';
    }

    if (!formData.metalQuality) {
      newErrors.metalQuality = 'Metal Quality is required';
    }

    // Metal Color is optional - no validation needed

    if (!formData.quantity.trim()) {
      newErrors.quantity = 'Quantity is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const renderDropdown = (label, value, options, onSelect, isVisible, onToggle) => {
    const selectedOption = value ? options.find(opt => opt.value === value) : null;
    const displayText = selectedOption?.label || `Select ${label}`;
    
    return (
    <View style={styles.dropdownContainer}>
      <Text style={styles.dropdownLabel}>{label}</Text>
      <TouchableOpacity
        style={styles.dropdown}
        onPress={onToggle}
        activeOpacity={0.7}
      >
        <Text style={[styles.dropdownText, !value && styles.dropdownPlaceholder]}>
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
            <ScrollView showsVerticalScrollIndicator={false}  style={{height: '100%'}}   >
            {options.map((option) => {
              const isSelected = value === option.value || (!value && option.value === '');
              return (
              <TouchableOpacity
                key={option.value || 'none'}
                activeOpacity={0.7}
                style={[
                  styles.dropdownOption,
                  isSelected && styles.dropdownOptionSelected,
                ]}
                onPress={() => {
                  // If "None" is selected, pass empty string
                  onSelect(option.value === 'None' ? '' : option.value);
                  onToggle();
                }}
              >
                {/* <Image source={} /> */}
                <Text
                  style={[
                    styles.dropdownOptionText,
                    isSelected && styles.dropdownOptionTextSelected,
                  ]}
                >
                  {option.label}
                </Text>
                {isSelected && (
                  <IconComponent name="check" size={20} color={colors.primary} />
                )}
              </TouchableOpacity>
            );
            })}
              </ScrollView>
            
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
      Alert.alert('Error', 'User not found. Please login again.');
      return;
    }

    try {
      // Map Priority from form values to API format
      const priorityMap = {
        'low': 'Low',
        'medium': 'Medium',
        'normal': 'Normal',
        'high': 'High',
        'super high': 'Super High',
        'urgent': 'Urgent',
        'Low': 'Low',
        'Medium': 'Medium',
        'Normal': 'Normal',
        'High': 'High',
        'Super High': 'Super High',
        'Urgent': 'Urgent',
      };
      
      const mappedPriority = priorityMap[formData.priority?.toLowerCase()] || priorityMap[formData.priority] || formData.priority || 'Normal';

      // For client users, status is always "Enquiry Created"
      const enquiryStatus = isClient ? 'Enquiry Created' : (formData.status || 'Enquiry Created');

      // Prepare enquiry data according to API structure (without images)
      const enquiryData = {
        Name: formData.title || '',
        ClientId: formData.clientId || user.id,
        AssignedTo: isClient ? null : (formData.assignedTo || null), // Client users can't assign
        Status: enquiryStatus,
        Priority: mappedPriority,
        Quantity: parseInt(formData.quantity) || 1,
        Metal: {
          Color: formData.metalColor && formData.metalColor.trim() ? formData.metalColor.trim() : null,
          Quality: formData.metalQuality || '10K',
        },
        StyleNumber: null,
        GatiOrderNumber: null,
        StoneType: formData.stoneType && formData.stoneType.trim() ? formData.stoneType.trim() : null,
        MetalWeight: {
          From: null,
          To: null,
          Exact: null,
        },
        DiamondWeight: {
          From: null,
          To: null,
          Exact: null,
        },
        Stamping: formData.stamping || null,
        Remarks: formData.description || '',
        ShippingDate: null,
        CoralCode: null,
        CadCode: null,
        Category: formData.category || 'Ring',
        Budget: formData.budget && formData.budget.trim() ? parseFloat(formData.budget) || null : null,
        SpecialRemarks: formData.specialRemarks && formData.specialRemarks.trim() ? formData.specialRemarks.trim() : null,
        ApprovedDate: formData.approvedDate && formData.approvedDate.trim() ? formData.approvedDate : null,
        // Do NOT include ReferenceImages here - they will be uploaded in Step 2
      };

      console.log('📤 Creating enquiry (Step 1):', JSON.stringify(enquiryData, null, 2));
      console.log('📋 [ENQUIRY CREATION] Initial Status:', enquiryStatus);
      console.log('📋 [ENQUIRY CREATION] User Role:', user?.role);
      console.log('📋 [ENQUIRY CREATION] Is Client:', isClient);
      console.log('📋 [ENQUIRY CREATION] Status Flow: Enquiry Created → Coral → CAD → Design Approval Pending → Completed');

      // Create enquiry first - show loading spinner
      const createResult = await createEnquiry(enquiryData).unwrap();
      
      // Get enquiry ID from response
      // The API can return either:
      // 1. Just the ID as a string: "6920d151d1b48a5c0c082d52"
      // 2. An object with id/_id: { id: "...", ... }
      let enquiryId = null;
      
      if (typeof createResult === 'string') {
        // Response is directly the ID string
        enquiryId = createResult;
      } else if (createResult?.id) {
        enquiryId = createResult.id;
      } else if (createResult?._id) {
        enquiryId = createResult._id;
      }
      
      if (!enquiryId) {
        console.error('❌ Failed to extract enquiry ID from response:', createResult);
        Alert.alert('Error', 'Failed to create enquiry. Enquiry ID not returned.');
        return;
      }

      console.log('✅ Enquiry created successfully:', {
        'Enquiry ID': enquiryId,
        'Name': createResult?.Name || createResult?.name || enquiryData.Name,
      });

      // Navigate to Step 2 with enquiry ID and form data
      navigation.navigate('AddEnquiryStep2', { 
        formData,
        enquiryId, // Pass the enquiry ID to Step 2
        isEditMode: false,
      });
    } catch (error) {
      console.error('❌ Error creating enquiry:', error);
      Alert.alert(
        'Error',
        error?.data?.message || error?.data?.error || 'Failed to create enquiry. Please try again.'
      );
    }
  };

  const priorityOptions = [
    { label: 'Normal', value: 'Normal' },
    { label: 'High', value: 'High' },
    { label: 'Super High', value: 'Super High' },
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
    { label: 'None', value: '' }, // Option to clear selection
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

  // Stone type options from API - add "None" option at the beginning for optional field
  const stoneTypeOptions = [{ label: 'None', value: '' }, ...(stoneTypesData || [])];

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
            {isClient ? (
              // For Client users, show as read-only input (pre-selected)
              <View style={styles.dropdownContainer}>
                <Text style={styles.dropdownLabel}>Client*</Text>
                <View style={[styles.dropdown, styles.disabledDropdown]}>
                  <Text style={[styles.dropdownText, styles.disabledText]}>
                    {formData.clientName || 'Loading...'}
                  </Text>
                  <IconComponent name="lock" size={20} color={colors.textSecondary} />
                </View>
              </View>
            ) : (
              // For other users, show as dropdown
              renderDropdown(
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
              )
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

        {/* Row 3.5: Budget (full width) */}
        <View style={styles.formRow}>
          <View style={[styles.formField, styles.fullWidthField]}>
            <Input
              label="Budget"
              placeholder="Enter budget amount"
              value={formData.budget}
              onChangeText={(value) => handleInputChange('budget', value)}
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        {/* Row 4: Status and Assigned To - Hidden for client users */}
        {!isClient && (
          <View style={styles.formRow}>
            <View style={styles.formField}>
              {renderDropdown(
                'Status*',
                formData.status,
                statusOptions,
                (value) => handleStatusChange(value),
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
        )}

        {/* Row 5: Stone Type (full width) */}
        <View style={styles.formRow}>
          <View style={[styles.formField, styles.fullWidthField]}>
            {renderDropdown(
              'Stone Type',
              formData.stoneType,
              stoneTypeOptions,
              (value) => handleInputChange('stoneType', value),
              showStoneTypeDropdown,
              () => setShowStoneTypeDropdown(!showStoneTypeDropdown)
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
              'Metal Color',
              formData.metalColor,
              metalColorOptions,
              (value) => handleInputChange('metalColor', value),
              showMetalColorDropdown,
              () => setShowMetalColorDropdown(!showMetalColorDropdown)
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

        {/* Row 8: Special Remarks (full width textarea) - Hidden for clients */}
        {!isClient && (
          <View style={styles.formRow}>
            <View style={[styles.formField, styles.fullWidthField]}>
              <Input
                label="Special Remarks"
                placeholder="Special Remarks"
                value={formData.specialRemarks}
                onChangeText={(value) => handleInputChange('specialRemarks', value)}
                multiline
                numberOfLines={4}
              />
            </View>
          </View>
        )}

        {/* Row 9: Approved Date (full width) - Hidden for clients */}
        {!isClient && (
          <View style={styles.formRow}>
            <View style={[styles.formField, styles.fullWidthField]}>
              <Text style={styles.dropdownLabel}>Approved Date</Text>
              <TouchableOpacity
                style={[styles.dropdown, { minHeight: 44 }]}
                onPress={() => {
                  if (formData.approvedDate) {
                    try {
                      setTempApprovedDate(new Date(formData.approvedDate));
                    } catch (e) {
                      setTempApprovedDate(new Date());
                    }
                  } else {
                    setTempApprovedDate(new Date());
                  }
                  setShowApprovedDatePicker(true);
                }}
                activeOpacity={0.7}>
                <Text style={[
                  styles.dropdownText,
                  !formData.approvedDate && styles.dropdownPlaceholder,
                ]}>
                  {formData.approvedDate || 'Select Approved Date'}
                </Text>
                <IconComponent 
                  name="calendar-today" 
                  size={20} 
                  color={colors.primary} 
                />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Date Picker Modal for Approved Date - Hidden for clients */}
        {!isClient && showApprovedDatePicker && Platform.OS === 'ios' && (
          <Modal
            transparent={true}
            animationType="slide"
            visible={showApprovedDatePicker}
            onRequestClose={() => setShowApprovedDatePicker(false)}>
            <TouchableOpacity
              style={styles.modalOverlay}
              activeOpacity={1}
              onPress={() => setShowApprovedDatePicker(false)}>
              <TouchableOpacity
                activeOpacity={1}
                onPress={(e) => e.stopPropagation()}
                style={styles.datePickerContainer}>
                <View style={styles.datePickerHeader}>
                  <TouchableOpacity
                    onPress={() => setShowApprovedDatePicker(false)}
                    style={styles.datePickerCancel}>
                    <Text style={styles.datePickerCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <Text style={styles.datePickerTitle}>Select Approved Date</Text>
                  <TouchableOpacity
                    onPress={() => {
                      const formattedDate = tempApprovedDate.toISOString().split('T')[0];
                      handleInputChange('approvedDate', formattedDate);
                      setShowApprovedDatePicker(false);
                    }}
                    style={styles.datePickerDone}>
                    <Text style={styles.datePickerDoneText}>Done</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={tempApprovedDate}
                  mode="date"
                  display="spinner"
                  onChange={(event, date) => {
                    if (date) setTempApprovedDate(date);
                  }}
                  style={styles.datePicker}
                />
              </TouchableOpacity>
            </TouchableOpacity>
          </Modal>
        )}
        {!isClient && showApprovedDatePicker && Platform.OS === 'android' && (
          <DateTimePicker
            value={tempApprovedDate}
            mode="date"
            display="default"
            onChange={(event, date) => {
              setShowApprovedDatePicker(false);
              if (event.type === 'set' && date) {
                const formattedDate = date.toISOString().split('T')[0];
                handleInputChange('approvedDate', formattedDate);
              }
            }}
          />
        )}

        <TouchableOpacity
          onPress={handleNext}
          style={[styles.adminActionButton, styles.adminActionButtonPrimary, isCreatingEnquiry && styles.disabledButton]}
          activeOpacity={0.85}
          disabled={isCreatingEnquiry}
        >
          {isCreatingEnquiry ? (
            <>
              <ActivityIndicator size="small" color={colors.textWhite} style={{ marginRight: 8 }} />
              <Text style={styles.adminActionText}>Creating Enquiry...</Text>
            </>
          ) : (
            <>
              <IconComponent name="save" size={18} color={colors.textWhite} />
              <Text style={styles.adminActionText}>Next</Text>
            </>
          )}
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
  disabledButton: {
    opacity: 0.6,
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
  dropdownPlaceholder: {
    color: colors.textSecondary,
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
  disabledDropdown: {
    backgroundColor: colors.backgroundSecondary,
    opacity: 0.6,
  },
  disabledText: {
    color: colors.textSecondary,
  },
  weightRow: {
    flexDirection: 'row',
    gap: 12,
  },
  weightInput: {
    flex: 1,
  },
  datePickerContainer: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  datePickerCancel: {
    padding: 8,
  },
  datePickerCancelText: {
    fontSize: fonts.base,
    color: colors.textSecondary,
  },
  datePickerTitle: {
    fontSize: fonts.lg,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  datePickerDone: {
    padding: 8,
  },
  datePickerDoneText: {
    fontSize: fonts.base,
    color: colors.primary,
    fontWeight: '600',
  },
  datePicker: {
    width: '100%',
    height: 200,
  },
});

export default AddEnquiryStep1Screen;
