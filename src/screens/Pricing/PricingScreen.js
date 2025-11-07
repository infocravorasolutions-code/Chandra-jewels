import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Text,
  Alert,
  Switch,
  Modal,
  TextInput,
} from 'react-native';
import { Card } from '../../components/cards/Cards';
import { Button, Input } from '../../components/common';
import { CustomText, Heading } from '../../components/common/Text';
import Icon from '../../components/common/Icon';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import { formatCurrency } from '../../utils/helpers';
import { useGetMetalPricesQuery, useCalculatePricingMutation, useApproveDesignVersionMutation, useRejectDesignVersionMutation } from '../../store/api';

const PricingScreen = ({ route, navigation }) => {
  const { enquiry, designType } = route.params || {}; // designType: 'coral' or 'cad'
  const originalData = enquiry?._originalData || enquiry;

  // Get design data
  const designData = designType === 'coral' 
    ? (originalData?.Coral || enquiry?.Coral || [])
    : (originalData?.Cad || enquiry?.Cad || []);
  
  const latestDesign = designData && designData.length > 0 
    ? designData[designData.length - 1] 
    : null;
  
  const existingPricing = latestDesign?.Pricing || latestDesign?.pricing || {};

  // Form state
  const [formData, setFormData] = useState({
    metalPrice: existingPricing?.MetalPrice?.toString() || '0',
    diamondPrice: existingPricing?.DiamondPrice?.toString() || '0',
    totalPrice: existingPricing?.TotalPrice?.toString() || '0',
    metalWeight: existingPricing?.MetalWeight?.toString() || '0',
    diamondWeight: existingPricing?.DiamondWeight?.toString() || '0',
    totalPieces: existingPricing?.TotalPieces?.toString() || '0',
    lossPercent: existingPricing?.LossPercent?.toString() || '0',
    labour: existingPricing?.Labour?.toString() || '0',
    duties: existingPricing?.Duties?.toString() || '0',
    extraCharges: existingPricing?.ExtraCharges?.toString() || '0',
    undercutPrice: existingPricing?.UndercutPrice?.toString() || '0',
    clientPricingMessage: existingPricing?.ClientPricingMessage || latestDesign?.ClientPricingMessage || '',
  });

  const [undercutEnabled, setUndercutEnabled] = useState(!!existingPricing?.UndercutPrice);
  const [stones, setStones] = useState(existingPricing?.Stones || latestDesign?.Stones || []);

  // Fetch latest metal prices - API is called automatically when component mounts
  const { data: metalPricesData, isLoading: loadingMetalPrices, refetch: refetchMetalPrices } = useGetMetalPricesQuery(false);
  const metalPrices = metalPricesData?.prices || metalPricesData || {};
  
  // Pricing calculation mutation
  const [calculatePricing, { isLoading: isCalculating }] = useCalculatePricingMutation();
  
  // Approve/Reject mutations
  const [approveDesignVersion, { isLoading: isApproving }] = useApproveDesignVersionMutation();
  const [rejectDesignVersion, { isLoading: isRejecting }] = useRejectDesignVersionMutation();
  
  // State for rejection reason
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  
  // Determine metal type from enquiry (default to gold)
  const metalColor = originalData?.Metal?.Color || enquiry?.Metal?.Color || 'Gold';
  const metalType = metalColor.toLowerCase().includes('gold') ? 'gold' 
    : metalColor.toLowerCase().includes('silver') ? 'silver'
    : metalColor.toLowerCase().includes('platinum') ? 'platinum'
    : 'gold'; // Default to gold
  
  // Get metal rate from API
  const apiMetalRate = metalPrices[metalType]?.price || 0;
  
  // Metal Rate considered for quotation - use existing pricing data if available, otherwise use API rate
  const [metalRateConsidered, setMetalRateConsidered] = useState(
    existingPricing?.MetalRateConsidered || 0
  );
  
  // Latest Metal Rate - always from current API call
  const latestMetalRate = apiMetalRate || 0;
  
  // Refetch metal prices when screen loads (when Pricing button is pressed)
  useEffect(() => {
    refetchMetalPrices();
  }, [refetchMetalPrices]);
  
  // Update metalRateConsidered from API if it's not set from existing pricing
  useEffect(() => {
    if (apiMetalRate > 0 && !existingPricing?.MetalRateConsidered) {
      setMetalRateConsidered(apiMetalRate);
    }
  }, [apiMetalRate, existingPricing?.MetalRateConsidered]);

  // Get design code for Excel filename
  const designCode = designType === 'coral'
    ? (originalData?.CoralCode || enquiry?.CoralCode || enquiry?.coralCode || '')
    : (originalData?.CadCode || enquiry?.CadCode || enquiry?.cadCode || '');

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCalculate = async () => {
    let payload = null; // Declare outside try block for error logging
    
    try {
      // Get metal details from enquiry
      const metalColor = originalData?.Metal?.Color || enquiry?.Metal?.Color || 'Gold';
      const metalQuality = originalData?.Metal?.Quality || enquiry?.Metal?.Quality || '10K';
      const metalWeight = parseFloat(formData.metalWeight) || 0;
      
      // Validate metal weight is a positive number
      if (metalWeight < 0) {
        Alert.alert('Validation Error', 'Metal weight cannot be negative');
        return;
      }
      
      // Transform stones array to match API format with validation
      const transformedStones = stones.map((stone, index) => {
        // Validate stone type is provided
        if (!stone.Type || stone.Type.trim() === '') {
          if (__DEV__) {
            console.warn(`Stone at index ${index} is missing Type, skipping`);
          }
          return null;
        }
        
        // Validate stone type is a known type (optional check, but helps catch typos)
        const validStoneTypes = [
          'NaturalRegular', 'NaturalLower', 'NaturalHigher', 'Natural',
          'CVDLabGrown', 'HPHTLabGrown', 'LabGrown',
          'Moissanite', 'Diamond', 'Other'
        ];
        const stoneType = stone.Type.trim();
        if (!validStoneTypes.some(valid => stoneType.toLowerCase().includes(valid.toLowerCase()))) {
          if (__DEV__) {
            console.warn(`Stone ${index} has unusual Type: ${stoneType}. Backend may reject it.`);
          }
        }
        
        // Parse and validate numeric fields
        const ctWeight = parseFloat(stone.CaratWeight);
        const weight = parseFloat(stone.Weight);
        const pcs = parseInt(stone.Pieces);
        const price = parseFloat(stone.Price);
        
        // Validate numeric values are valid numbers
        if (isNaN(ctWeight) || ctWeight < 0) {
          if (__DEV__) {
            console.warn(`Stone ${index} has invalid CaratWeight: ${stone.CaratWeight}`);
          }
        }
        if (isNaN(weight) || weight < 0) {
          if (__DEV__) {
            console.warn(`Stone ${index} has invalid Weight: ${stone.Weight}`);
          }
        }
        if (isNaN(pcs) || pcs < 0) {
          if (__DEV__) {
            console.warn(`Stone ${index} has invalid Pieces: ${stone.Pieces}`);
          }
        }
        if (isNaN(price) || price < 0) {
          if (__DEV__) {
            console.warn(`Stone ${index} has invalid Price: ${stone.Price}`);
          }
        }
        
        // Build transformed stone object - only include fields that have valid values
        const transformed = {
          Type: stone.Type.trim(),
        };
        
        // Only include Color if it's not empty (backend may not accept empty strings)
        if (stone.Color && stone.Color.trim() !== '') {
          transformed.Color = stone.Color.trim();
        }
        
        // Only include Shape if it's not empty
        if (stone.Shape && stone.Shape.trim() !== '') {
          transformed.Shape = stone.Shape.trim();
        }
        
        // MmSize - ensure it's a string, default to '0' if empty
        const mmSize = stone.MM ? stone.MM.toString().trim() : '';
        transformed.MmSize = mmSize !== '' ? mmSize : '0';
        
        // Only include SieveSize if it's not empty
        if (stone.Sieve && stone.Sieve.trim() !== '') {
          transformed.SieveSize = stone.Sieve.trim();
        }
        
        // Numeric fields - ensure they're valid numbers, default to 0 if invalid
        transformed.CtWeight = (isNaN(ctWeight) || ctWeight < 0) ? 0 : Math.max(0, ctWeight);
        transformed.Weight = (isNaN(weight) || weight < 0) ? 0 : Math.max(0, weight);
        transformed.Pcs = (isNaN(pcs) || pcs < 0) ? 0 : Math.max(0, Math.floor(pcs)); // Ensure integer
        transformed.Price = (isNaN(price) || price < 0) ? 0 : Math.max(0, price);
        
        return transformed;
      }).filter(stone => stone !== null && stone.Type); // Remove null entries and ensure Type exists

      // Get clientId from multiple possible sources
      const clientId = enquiry?.clientId || 
                       enquiry?.ClientId || 
                       originalData?.clientId || 
                       originalData?.ClientId ||
                       null;

      // Debug: Log enquiry structure to find clientId
      if (__DEV__ && !clientId) {
        console.warn('========== CLIENT ID DEBUG ==========');
        console.warn('Enquiry object keys:', Object.keys(enquiry || {}));
        console.warn('Original data keys:', Object.keys(originalData || {}));
        console.warn('enquiry.clientId:', enquiry?.clientId);
        console.warn('enquiry.ClientId:', enquiry?.ClientId);
        console.warn('originalData.clientId:', originalData?.clientId);
        console.warn('originalData.ClientId:', originalData?.ClientId);
        console.warn('Full enquiry object:', JSON.stringify(enquiry, null, 2).substring(0, 500));
        console.warn('=====================================');
      }

      // Validate required fields before sending
      if (!clientId) {
        Alert.alert(
          'Missing Client ID',
          'Client ID is required for pricing calculation. Please ensure the enquiry has a valid client assigned.\n\n' +
          'The enquiry object may not have the clientId field. Please check the enquiry data structure.'
        );
        return;
      }

      // Validate clientId format (should be a valid MongoDB ObjectId format)
      if (!/^[0-9a-fA-F]{24}$/.test(clientId)) {
        Alert.alert(
          'Invalid Client ID',
          `Client ID format is invalid: ${clientId}\n\nPlease ensure the enquiry has a valid client assigned.`
        );
        return;
      }

      // Additional validation: Log client ID for debugging
      if (__DEV__) {
        console.log('========== PRICING CALCULATION - CLIENT VALIDATION ==========');
        console.log('Client ID being used:', clientId);
        console.log('Client ID format valid:', /^[0-9a-fA-F]{24}$/.test(clientId));
        console.log('Note: Backend must have this client in database with Pricing configuration');
        console.log('============================================================');
      }

      if (metalWeight <= 0 && transformedStones.length === 0) {
        Alert.alert(
          'Missing Weight Data',
          'Please provide either metal weight or stone information for pricing calculation.'
        );
        return;
      }

      // Validate and parse numeric fields
      const loss = parseFloat(formData.lossPercent);
      const labour = parseFloat(formData.labour);
      const extraCharges = parseFloat(formData.extraCharges);
      const duties = parseFloat(formData.duties);
      const quantity = parseInt(formData.totalPieces);

      // Validate numeric values
      if (isNaN(loss) || loss < 0) {
        Alert.alert('Validation Error', 'Loss percentage must be a valid positive number');
        return;
      }
      if (isNaN(labour) || labour < 0) {
        Alert.alert('Validation Error', 'Labour must be a valid positive number');
        return;
      }
      if (isNaN(extraCharges) || extraCharges < 0) {
        Alert.alert('Validation Error', 'Extra charges must be a valid positive number');
        return;
      }
      if (isNaN(duties) || duties < 0) {
        Alert.alert('Validation Error', 'Duties must be a valid positive number');
        return;
      }
      if (isNaN(quantity) || quantity <= 0) {
        Alert.alert('Validation Error', 'Quantity must be a valid positive number greater than 0');
        return;
      }

      // Validate metal quality format (should be like "10K", "14K", "18K", "22K", "24K", etc.)
      const qualityMatch = metalQuality.match(/^(\d+)K$/i);
      if (!qualityMatch) {
        if (__DEV__) {
          console.warn(`Metal quality format may be invalid: ${metalQuality}`);
        }
      }

      // Prepare payload with validated data
      // Ensure all numeric values are properly formatted (no NaN, Infinity, etc.)
      payload = {
        clientId: clientId.trim(), // Ensure no whitespace
        details: {
          Metal: {
            Weight: Math.max(0, metalWeight), // Ensure non-negative
            Color: metalColor.trim(), // Remove whitespace
            Quality: metalQuality.trim(), // Remove whitespace
          },
          Stones: transformedStones,
          Loss: Math.max(0, loss),
          Labour: Math.max(0, labour),
          ExtraCharges: Math.max(0, extraCharges),
          Duties: Math.max(0, duties),
          Quantity: Math.max(1, Math.floor(quantity)), // Ensure integer and at least 1
        },
      };
      
      // Final payload validation - check for any invalid values
      if (!isFinite(payload.details.Metal.Weight) || 
          !isFinite(payload.details.Loss) ||
          !isFinite(payload.details.Labour) ||
          !isFinite(payload.details.ExtraCharges) ||
          !isFinite(payload.details.Duties) ||
          !isFinite(payload.details.Quantity)) {
        Alert.alert(
          'Validation Error',
          'One or more numeric fields contain invalid values (NaN or Infinity). Please check your inputs.'
        );
        return;
      }
      
      // Validate stones don't have invalid numeric values
      const hasInvalidStone = transformedStones.some(stone => 
        !isFinite(stone.CtWeight) || 
        !isFinite(stone.Weight) || 
        !isFinite(stone.Pcs) || 
        !isFinite(stone.Price)
      );
      
      if (hasInvalidStone) {
        Alert.alert(
          'Validation Error',
          'One or more stones contain invalid numeric values. Please check stone data.'
        );
        return;
      }

      // Final validation: ensure payload structure is correct
      if (!payload.details.Metal.Weight && payload.details.Stones.length === 0) {
        Alert.alert('Validation Error', 'At least one of Metal Weight or Stones must be provided');
        return;
      }

      if (__DEV__) {
        console.log('Pricing Calculate Payload:', JSON.stringify(payload, null, 2));
      }

      // Call API
      const response = await calculatePricing(payload).unwrap();

      if (__DEV__) {
        console.log('Pricing Calculate Response:', response);
      }

      // Update form data with calculated values from response
      // Backend returns: { MetalPrice, DiamondsPrice, TotalPrice, Metal, DiamondWeight, Client, Stones }
      if (response) {
        const updates = {};
        
        // Update metal price if in response
        if (response.MetalPrice !== undefined) {
          updates.metalPrice = response.MetalPrice.toString();
        }
        
        // Update diamond price if in response (note: backend uses DiamondsPrice, not DiamondPrice)
        if (response.DiamondsPrice !== undefined) {
          updates.diamondPrice = response.DiamondsPrice.toString();
        }
        
        // Update total price if in response
        if (response.TotalPrice !== undefined) {
          updates.totalPrice = response.TotalPrice.toString();
        }
        
        // Update metal weight from response if provided
        if (response.Metal?.Weight !== undefined) {
          updates.metalWeight = response.Metal.Weight.toString();
        }
        
        // Update diamond weight from response if provided
        if (response.DiamondWeight !== undefined) {
          updates.diamondWeight = response.DiamondWeight.toString();
        }
        
        // Update client-specific values if provided
        if (response.Client) {
          if (response.Client.Loss !== undefined) {
            updates.lossPercent = response.Client.Loss.toString();
          }
          if (response.Client.Labour !== undefined) {
            updates.labour = response.Client.Labour.toString();
          }
          if (response.Client.Duties !== undefined) {
            updates.duties = response.Client.Duties.toString();
          }
          if (response.Client.ExtraCharges !== undefined) {
            updates.extraCharges = response.Client.ExtraCharges.toString();
          }
        }
        
        // Update stones with calculated prices if provided
        // Backend returns full stone objects with calculated prices
        if (response.Stones && Array.isArray(response.Stones) && response.Stones.length > 0) {
          // Map backend stones to frontend format
          const updatedStones = response.Stones.map((backendStone, index) => {
            // Try to match with existing stone by index or find by matching properties
            const existingStone = stones[index] || stones.find(s => 
              s.Type === backendStone.Type && 
              s.MM === backendStone.MmSize
            ) || {};
            
            return {
              ...existingStone,
              Type: backendStone.Type || existingStone.Type,
              Color: backendStone.Color || existingStone.Color || '',
              Shape: backendStone.Shape || existingStone.Shape || '',
              MM: backendStone.MmSize || existingStone.MM || '',
              Sieve: backendStone.SieveSize || existingStone.Sieve || '',
              CaratWeight: backendStone.CtWeight?.toString() || existingStone.CaratWeight || '0',
              Weight: backendStone.Weight?.toString() || existingStone.Weight || '0',
              Pieces: backendStone.Pcs?.toString() || existingStone.Pieces || '0',
              Price: backendStone.Price?.toString() || existingStone.Price || '0',
            };
          });
          setStones(updatedStones);
        }

        // Update form data
        if (Object.keys(updates).length > 0) {
          setFormData(prev => ({ ...prev, ...updates }));
        }

        if (__DEV__) {
          console.log('✅ Pricing calculated successfully');
          console.log('Updated form data:', updates);
          console.log('Response summary:', {
            MetalPrice: response.MetalPrice,
            DiamondsPrice: response.DiamondsPrice,
            TotalPrice: response.TotalPrice,
            StonesCount: response.Stones?.length || 0,
          });
        }

        Alert.alert('Success', 'Pricing calculated successfully');
      } else {
        Alert.alert('Success', 'Calculation completed');
      }
    } catch (error) {
      console.error('========== PRICING CALCULATION ERROR ==========');
      console.error('Error object:', error);
      console.error('Error status:', error.status);
      console.error('Error data:', error.data);
      console.error('Error message:', error.message);
      console.error('Full error:', JSON.stringify(error, null, 2));
      console.error('Payload that was sent:', JSON.stringify(payload, null, 2));
      console.error('===============================================');
      
      // Provide more detailed error message with actionable suggestions
      let errorMessage = 'Failed to calculate pricing.';
      let suggestions = [];
      
      if (error.status === 500) {
        // Check for specific backend error about null client.Pricing
        const errorDataStr = JSON.stringify(error.data || {});
        const errorMessageStr = JSON.stringify(error.message || '');
        const isClientNullError = 
          errorDataStr.includes('Cannot read properties of null') ||
          errorDataStr.includes("reading 'Pricing'") ||
          errorMessageStr.includes('Cannot read properties of null') ||
          errorMessageStr.includes("reading 'Pricing'");
        
        if (isClientNullError) {
          // Specific error: Client is null or missing Pricing configuration
          errorMessage = 'Client Configuration Error\n\n';
          errorMessage += 'The backend cannot find the client or the client does not have pricing configuration set up.\n\n';
          if (payload && payload.clientId) {
            errorMessage += `Client ID: ${payload.clientId}\n\n`;
          }
          errorMessage += 'This is a backend configuration issue. Please:\n';
          errorMessage += '1. Verify the client exists in the database\n';
          errorMessage += '2. Ensure the client has pricing settings configured\n';
          errorMessage += '3. Contact the administrator to set up client pricing\n\n';
          errorMessage += 'Technical Details:\n';
          errorMessage += 'Backend tried to access client.Pricing but client was null or missing pricing configuration.\n';
          errorMessage += 'Location: enquiry.service.js:933';
        } else {
          // Generic 500 error
          errorMessage = 'Server error (500). This usually indicates a backend issue.\n\n';
          suggestions.push('Backend server may be experiencing issues');
          suggestions.push('Check if the client exists in the database');
          suggestions.push('Verify the client has pricing configuration');
          suggestions.push('Check backend logs for detailed error information');
          
          // Check payload for common issues
          if (payload) {
            if (payload.details.Metal.Weight <= 0 && payload.details.Stones.length === 0) {
              suggestions.push('Ensure at least Metal Weight or Stones are provided');
            }
            if (payload.details.Quantity <= 0) {
              suggestions.push('Quantity must be greater than 0');
            }
            if (payload.details.Stones.some(s => !s.Type || s.Type.trim() === '')) {
              suggestions.push('All stones must have a valid Type');
            }
          }
          
          errorMessage += 'Possible causes:\n';
          suggestions.forEach((suggestion, index) => {
            errorMessage += `${index + 1}. ${suggestion}\n`;
          });
          errorMessage += '\n';
          
          if (error.data) {
            if (typeof error.data === 'string') {
              errorMessage += `Backend error: ${error.data}`;
            } else if (error.data.message) {
              errorMessage += `Backend error: ${error.data.message}`;
            } else if (error.data.error) {
              errorMessage += `Backend error: ${error.data.error}`;
            } else {
              errorMessage += 'Please check backend server logs for detailed error information.';
            }
          } else {
            errorMessage += 'Please check backend server logs for detailed error information.';
          }
        }
      } else if (error.status === 400) {
        errorMessage = 'Bad Request (400). Please check your input data:\n\n';
        if (error.data) {
          if (typeof error.data === 'string') {
            errorMessage += error.data;
          } else if (error.data.message) {
            errorMessage += error.data.message;
          } else if (error.data.error) {
            errorMessage += error.data.error;
          } else {
            errorMessage += 'Invalid data format or missing required fields.';
          }
        }
      } else if (error.status === 404) {
        errorMessage = 'Not Found (404). The pricing calculation endpoint may not exist or the client may not be found.';
      } else if (error.data) {
        if (typeof error.data === 'string') {
          errorMessage = error.data;
        } else if (error.data.message) {
          errorMessage = error.data.message;
        } else if (error.data.error) {
          errorMessage = error.data.error;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      // Show detailed error alert
      Alert.alert(
        'Pricing Calculation Error',
        errorMessage,
        [
          { text: 'OK' },
          ...(payload && error.status === 500 ? [{
            text: 'View Payload',
            onPress: () => {
              if (__DEV__) {
                console.log('Full payload that caused error:', JSON.stringify(payload, null, 2));
              }
              Alert.alert(
                'Payload Details',
                `Check console for full payload details.\n\nClient ID: ${payload.clientId}\nMetal Weight: ${payload.details.Metal.Weight}\nStones: ${payload.details.Stones.length}\nQuantity: ${payload.details.Quantity}`,
                [{ text: 'OK' }]
              );
            }
          }] : [])
        ]
      );
    }
  };

  // Stone type options
  const stoneTypeOptions = [
    { label: 'Natural Regular', value: 'NaturalRegular' },
    { label: 'Natural Lower', value: 'NaturalLower' },
    { label: 'CVD Lab Grown', value: 'CVDLabGrown' },
    { label: 'HPHT Lab Grown', value: 'HPHTLabGrown' },
    { label: 'Moissanite', value: 'Moissanite' },
    { label: 'Other', value: 'Other' },
  ];

  const handleAddDiamond = () => {
    // Add a new stone row with default values
    const newStone = {
      Type: '',
      Color: '',
      Shape: '',
      MM: '',
      Sieve: '',
      Weight: '0',
      Pieces: '0',
      CaratWeight: '0',
      Price: '0',
    };
    setStones([...stones, newStone]);
  };

  const handleUpdateStone = (index, field, value) => {
    const updatedStones = [...stones];
    updatedStones[index] = {
      ...updatedStones[index],
      [field]: value,
    };
    setStones(updatedStones);
  };

  const handleDeleteStone = (index) => {
    Alert.alert(
      'Delete Stone',
      'Are you sure you want to delete this stone?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const newStones = stones.filter((_, i) => i !== index);
            setStones(newStones);
          },
        },
      ]
    );
  };

  // State for dropdown modals - one per row
  const [openDropdowns, setOpenDropdowns] = useState({});

  const toggleDropdown = (index) => {
    setOpenDropdowns(prev => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const renderTypeDropdown = (index, selectedValue) => {
    const isOpen = openDropdowns[index] || false;

    return (
      <View>
        <TouchableOpacity
          style={styles.dropdownButton}
          onPress={() => toggleDropdown(index)}
        >
          <Text style={styles.dropdownButtonText} numberOfLines={1}>
            {selectedValue || 'Select Type'}
          </Text>
          <Icon name="arrow-drop-down" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
        <Modal
          visible={isOpen}
          transparent
          animationType="fade"
          onRequestClose={() => toggleDropdown(index)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => toggleDropdown(index)}
          >
            <View style={styles.dropdownModal}>
              {stoneTypeOptions.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={styles.dropdownOption}
                  onPress={() => {
                    handleUpdateStone(index, 'Type', option.value);
                    toggleDropdown(index);
                  }}
                >
                  <Text style={styles.dropdownOptionText}>{option.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>
      </View>
    );
  };

  const handleSave = () => {
    // TODO: Implement save functionality
    Alert.alert('Info', 'Save functionality will be implemented');
  };

  const handleDownloadExcel = () => {
    if (!designCode) {
      Alert.alert('Error', 'Design code not available');
      return;
    }
    // TODO: Implement Excel download
    const excelUrl = `https://workflowapi-quhn.onrender.com/api/enquiries/files/${designCode}.xlsx?download=true`;
    Alert.alert('Info', 'Download Excel functionality will be implemented');
    if (__DEV__) {
      console.log('Excel URL:', excelUrl);
    }
  };

  const handleDownloadPricing = () => {
    // TODO: Implement pricing download
    Alert.alert('Info', 'Download Pricing functionality will be implemented');
  };

  const handleSyncClientPricing = () => {
    // TODO: Implement sync functionality
    Alert.alert('Info', 'Sync Client Pricing functionality will be implemented');
  };

  const handleApprove = async () => {
    if (!latestDesign) {
      Alert.alert('Error', 'No design version found to approve');
      return;
    }

    const version = latestDesign?.Version || `Version ${designData.length}`;
    const enquiryId = enquiry?.id || enquiry?._id;
    
    if (!enquiryId) {
      Alert.alert('Error', 'Enquiry ID not found');
      return;
    }

    Alert.alert(
      'Approve Design Version',
      `Are you sure you want to approve ${designType.toUpperCase()} ${version}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            try {
              if (__DEV__) {
                console.log('========== APPROVING DESIGN VERSION FROM PRICING SCREEN ==========');
                console.log('Enquiry ID:', enquiryId);
                console.log('Design Type:', designType);
                console.log('Version:', version);
              }

              await approveDesignVersion({
                enquiryId,
                designType,
                version,
              }).unwrap();

              Alert.alert('Success', `${designType.toUpperCase()} ${version} approved successfully`);
            } catch (error) {
              console.error('Error approving design version:', error);
              Alert.alert(
                'Error',
                error?.data?.error || error?.message || 'Failed to approve design version. Please try again.'
              );
            }
          },
        },
      ]
    );
  };

  const handleReject = () => {
    if (!latestDesign) {
      Alert.alert('Error', 'No design version found to reject');
      return;
    }
    setShowRejectModal(true);
  };

  const confirmReject = async () => {
    if (!rejectionReason.trim()) {
      Alert.alert('Error', 'Please provide a reason for rejection');
      return;
    }

    if (!latestDesign) {
      Alert.alert('Error', 'No design version found to reject');
      return;
    }

    const version = latestDesign?.Version || `Version ${designData.length}`;
    const enquiryId = enquiry?.id || enquiry?._id;
    
    if (!enquiryId) {
      Alert.alert('Error', 'Enquiry ID not found');
      return;
    }

    try {
      if (__DEV__) {
        console.log('========== REJECTING DESIGN VERSION FROM PRICING SCREEN ==========');
        console.log('Enquiry ID:', enquiryId);
        console.log('Design Type:', designType);
        console.log('Version:', version);
        console.log('Reason:', rejectionReason);
      }

      await rejectDesignVersion({
        enquiryId,
        designType,
        version,
        reason: rejectionReason.trim(),
      }).unwrap();

      Alert.alert('Success', `${designType.toUpperCase()} ${version} rejected successfully`);
      setShowRejectModal(false);
      setRejectionReason('');
    } catch (error) {
      console.error('Error rejecting design version:', error);
      Alert.alert(
        'Error',
        error?.data?.error || error?.message || 'Failed to reject design version. Please try again.'
      );
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header with Download Excel */}
        <View style={styles.header}>
          <Heading level={3} style={styles.headerTitle}>Pricing</Heading>
          {/* {designCode && (
            <Button
              title={`Download Excel - ${designCode}.xlsx`}
              onPress={handleDownloadExcel}
              style={styles.downloadExcelButton}
            />
          )} */}
          <></>
        </View>

        {/* Metal Rate Information */}
        <Card style={styles.infoCard}>
          {loadingMetalPrices ? (
            <CustomText variant="body" style={styles.infoText}>
              Loading metal rates...
            </CustomText>
          ) : (
            <CustomText variant="body" style={styles.infoText}>
              The Metal Rate considered for quotation was ₹{metalRateConsidered.toFixed(2)} per gram.{'\n'}
              The Latest Metal Rate is ₹{latestMetalRate.toFixed(2)} per gram.{'\n'}
              Please click on calculate to update calculations according to latest rates.
            </CustomText>
          )}
        </Card>

        {/* Pricing Input Fields */}
        <Card style={styles.pricingCard}>
          <Heading level={4} style={styles.sectionTitle}>Pricing Details</Heading>
          
          <View style={styles.pricingGrid}>
            {/* Row 1 */}
            <View style={styles.inputRow}>
              <Input
                label="Metal Price*"
                value={formData.metalPrice}
                onChangeText={(value) => handleInputChange('metalPrice', value)}
                keyboardType="numeric"
                style={styles.gridInput}
              />
              <Input
                label="Diamonds Price*"
                value={formData.diamondPrice}
                onChangeText={(value) => handleInputChange('diamondPrice', value)}
                keyboardType="numeric"
                style={styles.gridInput}
              />
              <Input
                label="Total Price*"
                value={formData.totalPrice}
                onChangeText={(value) => handleInputChange('totalPrice', value)}
                keyboardType="numeric"
                style={styles.gridInput}
                editable={false}
              />
            </View>

            {/* Row 2 */}
            <View style={styles.inputRow}>
              <Input
                label="Metal Weight"
                value={formData.metalWeight}
                onChangeText={(value) => handleInputChange('metalWeight', value)}
                keyboardType="numeric"
                style={styles.gridInput}
              />
              <Input
                label="Diamond Weight"
                value={formData.diamondWeight}
                onChangeText={(value) => handleInputChange('diamondWeight', value)}
                keyboardType="numeric"
                style={styles.gridInput}
              />
              <Input
                label="Total Pieces"
                value={formData.totalPieces}
                onChangeText={(value) => handleInputChange('totalPieces', value)}
                keyboardType="numeric"
                style={styles.gridInput}
              />
            </View>

            {/* Row 3 */}
            <View style={styles.inputRow}>
              <Input
                label="Loss (%)"
                value={formData.lossPercent}
                onChangeText={(value) => handleInputChange('lossPercent', value)}
                keyboardType="numeric"
                style={styles.gridInput}
              />
              <Input
                label="Labour"
                value={formData.labour}
                onChangeText={(value) => handleInputChange('labour', value)}
                keyboardType="numeric"
                style={styles.gridInput}
              />
              <Input
                label="Duties"
                value={formData.duties}
                onChangeText={(value) => handleInputChange('duties', value)}
                keyboardType="numeric"
                style={styles.gridInput}
              />
            </View>

            {/* Row 4 */}
            <View style={styles.inputRow}>
              <Input
                label="ExtraCharges"
                value={formData.extraCharges}
                onChangeText={(value) => handleInputChange('extraCharges', value)}
                keyboardType="numeric"
                style={styles.gridInput}
              />
            </View>
          </View>
        </Card>

        {/* Undercut Price Section */}
        <Card style={styles.undercutCard}>
          <View style={styles.undercutHeader}>
            <Switch
              value={undercutEnabled}
              onValueChange={setUndercutEnabled}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.textWhite}
            />
            <CustomText variant="label" style={styles.undercutLabel}>
              Undercut Price
            </CustomText>
          </View>
          {undercutEnabled && (
            <Input
              label="Undercut Price"
              value={formData.undercutPrice}
              onChangeText={(value) => handleInputChange('undercutPrice', value)}
              keyboardType="numeric"
              style={styles.undercutInput}
            />
          )}
        </Card>

        {/* Stones Section */}
        <Card style={styles.stonesCard}>
          <View style={styles.stonesHeader}>
            <Heading level={4} style={styles.sectionTitle}>Stones</Heading>
            <View style={styles.stonesButtons}>
              <Button
                title="Add Diamond"
                onPress={handleAddDiamond}
                style={[styles.stonesButton, styles.addButton]}
              />
              <Button
                title="Download Pricing"
                onPress={handleDownloadPricing}
                style={[styles.stonesButton, styles.downloadButton]}
              />
            </View>
          </View>

          <View style={styles.stonesTable}>
            <View style={styles.tableHeader}>
              <Text style={styles.tableHeaderText}>Type</Text>
              <Text style={styles.tableHeaderText}>Color</Text>
              <Text style={styles.tableHeaderText}>Shape</Text>
              <Text style={styles.tableHeaderText}>MM Size</Text>
              <Text style={styles.tableHeaderText}>Sieve Size</Text>
              <Text style={styles.tableHeaderText}>Weight</Text>
              <Text style={styles.tableHeaderText}>Pieces</Text>
              <Text style={styles.tableHeaderText}>Carat Weight</Text>
              <Text style={styles.tableHeaderText}>Price</Text>
              <Text style={styles.tableHeaderText}>Actions</Text>
            </View>
            {stones.length > 0 ? (
              stones.map((stone, index) => (
                <View key={index} style={styles.tableRow}>
                  {/* Type Dropdown */}
                  <View style={styles.tableCell}>
                    {renderTypeDropdown(index, stoneTypeOptions.find(opt => opt.value === stone.Type)?.label || '')}
                  </View>
                  
                  {/* Color Input */}
                  <TextInput
                    style={styles.tableInput}
                    value={stone.Color || ''}
                    onChangeText={(value) => handleUpdateStone(index, 'Color', value)}
                    placeholder=""
                    placeholderTextColor={colors.textLight}
                  />
                  
                  {/* Shape Input */}
                  <TextInput
                    style={styles.tableInput}
                    value={stone.Shape || ''}
                    onChangeText={(value) => handleUpdateStone(index, 'Shape', value)}
                    placeholder=""
                    placeholderTextColor={colors.textLight}
                  />
                  
                  {/* MM Size Input */}
                  <TextInput
                    style={styles.tableInput}
                    value={stone.MM || ''}
                    onChangeText={(value) => handleUpdateStone(index, 'MM', value)}
                    placeholder=""
                    placeholderTextColor={colors.textLight}
                    keyboardType="numeric"
                  />
                  
                  {/* Sieve Size Input */}
                  <TextInput
                    style={styles.tableInput}
                    value={stone.Sieve || ''}
                    onChangeText={(value) => handleUpdateStone(index, 'Sieve', value)}
                    placeholder=""
                    placeholderTextColor={colors.textLight}
                    keyboardType="numeric"
                  />
                  
                  {/* Weight Input */}
                  <TextInput
                    style={styles.tableInput}
                    value={stone.Weight || '0'}
                    onChangeText={(value) => handleUpdateStone(index, 'Weight', value)}
                    placeholder="0"
                    placeholderTextColor={colors.textLight}
                    keyboardType="numeric"
                    textAlign="center"
                  />
                  
                  {/* Pieces Input */}
                  <TextInput
                    style={styles.tableInput}
                    value={stone.Pieces || '0'}
                    onChangeText={(value) => handleUpdateStone(index, 'Pieces', value)}
                    placeholder="0"
                    placeholderTextColor={colors.textLight}
                    keyboardType="numeric"
                    textAlign="center"
                  />
                  
                  {/* Carat Weight Input */}
                  <TextInput
                    style={styles.tableInput}
                    value={stone.CaratWeight || '0'}
                    onChangeText={(value) => handleUpdateStone(index, 'CaratWeight', value)}
                    placeholder="0"
                    placeholderTextColor={colors.textLight}
                    keyboardType="numeric"
                    textAlign="center"
                  />
                  
                  {/* Price Input */}
                  <TextInput
                    style={styles.tableInput}
                    value={stone.Price || '0'}
                    onChangeText={(value) => handleUpdateStone(index, 'Price', value)}
                    placeholder="0"
                    placeholderTextColor={colors.textLight}
                    keyboardType="numeric"
                    textAlign="center"
                  />
                  
                  {/* Delete Button */}
                  <TouchableOpacity
                    onPress={() => handleDeleteStone(index)}
                    style={styles.deleteStoneButton}
                  >
                    <Icon name="delete" size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              ))
            ) : (
              <View style={styles.emptyStonesRow}>
                <Text style={styles.emptyStonesText}>No stones added yet</Text>
              </View>
            )}
          </View>
        </Card>

        {/* Client Pricing Message */}
        <Card style={styles.messageCard}>
          <CustomText variant="label" style={styles.label}>
            Client Pricing Message
          </CustomText>
          <Input
            value={formData.clientPricingMessage}
            onChangeText={(value) => handleInputChange('clientPricingMessage', value)}
            placeholder="Enter client pricing message..."
            multiline
            numberOfLines={6}
            style={styles.messageInput}
          />
        </Card>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <Button
            title="Save"
            onPress={handleSave}
            style={[styles.actionButton, styles.saveButton]}
          />
          <Button
            title="Cancel"
            onPress={() => navigation.goBack()}
            variant="outline"
            style={styles.actionButton}
          />
          <Button
            title={isCalculating ? "Calculating..." : "Calculate"}
            onPress={handleCalculate}
            style={[styles.actionButton, styles.calculateButton]}
            disabled={isCalculating}
          />
          <Button
            title="Sync Client Pricing"
            onPress={handleSyncClientPricing}
            style={[styles.actionButton, styles.syncButton]}
          />
          <Button
            title={isApproving ? "Approving..." : "Approve"}
            onPress={handleApprove}
            style={[styles.actionButton, styles.approveButton]}
            disabled={isApproving || isRejecting}
          />
          <Button
            title={isRejecting ? "Rejecting..." : "Reject"}
            onPress={handleReject}
            style={[styles.actionButton, styles.rejectButton]}
            disabled={isApproving || isRejecting}
          />
        </View>
      </ScrollView>

      {/* Reject Modal */}
      <Modal
        visible={showRejectModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowRejectModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Reject Design Version</Text>
            <Text style={styles.modalSubtitle}>
              {designType.toUpperCase()} {latestDesign?.Version || `Version ${designData.length}`}
            </Text>
            <Text style={styles.modalLabel}>
              Please provide a reason for rejection:
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Enter rejection reason..."
              value={rejectionReason}
              onChangeText={setRejectionReason}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <View style={styles.modalButtons}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => {
                  setShowRejectModal(false);
                  setRejectionReason('');
                }}
                style={styles.modalButton}
              />
              <Button
                title="Reject"
                onPress={confirmReject}
                style={[styles.modalButton, styles.rejectButton]}
                disabled={isRejecting}
              />
            </View>
          </View>
        </View>
      </Modal>
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
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    color: colors.textPrimary,
  },
  downloadExcelButton: {
    backgroundColor: colors.info || '#2196F3',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  infoCard: {
    marginBottom: 16,
    padding: 16,
  },
  infoText: {
    color: colors.textSecondary,
    fontSize: fonts.sm,
    lineHeight: 20,
  },
  pricingCard: {
    marginBottom: 16,
    padding: 16,
  },
  sectionTitle: {
    marginBottom: 16,
    color: colors.textPrimary,
  },
  pricingGrid: {
    gap: 16,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  gridInput: {
    flex: 1,
    minWidth: '30%',
  },
  undercutCard: {
    marginBottom: 16,
    padding: 16,
  },
  undercutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  undercutLabel: {
    marginLeft: 12,
    fontSize: fonts.base,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  undercutInput: {
    marginTop: 8,
  },
  stonesCard: {
    marginBottom: 16,
    padding: 16,
  },
  stonesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  stonesButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  stonesButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  addButton: {
    backgroundColor: colors.success,
  },
  downloadButton: {
    backgroundColor: colors.info || '#2196F3',
  },
  stonesTable: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.backgroundSecondary || '#f5f5f5',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tableHeaderText: {
    flex: 1,
    fontSize: fonts.xs,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.background || '#FFFFFF',
  },
  tableCell: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tableInput: {
    flex: 1,
    fontSize: fonts.xs,
    color: colors.textPrimary,
    textAlign: 'center',
    paddingVertical: 4,
    paddingHorizontal: 4,
    minHeight: 32,
    borderWidth: 0,
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    backgroundColor: colors.background,
    minWidth: 100,
  },
  dropdownButtonText: {
    fontSize: fonts.xs,
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
    borderRadius: 8,
    padding: 8,
    minWidth: 200,
    maxHeight: 300,
  },
  dropdownOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dropdownOptionText: {
    fontSize: fonts.base,
    color: colors.textPrimary,
  },
  deleteStoneButton: {
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStonesRow: {
    padding: 40,
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  emptyStonesText: {
    color: colors.textSecondary,
    fontSize: fonts.sm,
  },
  messageCard: {
    marginBottom: 16,
    padding: 16,
  },
  label: {
    marginBottom: 8,
    fontSize: fonts.base,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  messageInput: {
    minHeight: 120,
  },
  actionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
    minWidth: '30%',
  },
  saveButton: {
    backgroundColor: colors.success,
  },
  calculateButton: {
    backgroundColor: colors.info || '#2196F3',
  },
  syncButton: {
    backgroundColor: colors.primary,
  },
  approveButton: {
    backgroundColor: colors.success,
  },
  rejectButton: {
    backgroundColor: colors.error,
  },
  modalContent: {
    backgroundColor: colors.modalBackground || colors.backgroundPrimary,
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  modalLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: fonts.base,
    color: colors.textPrimary,
    backgroundColor: colors.backgroundSecondary,
    minHeight: 100,
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

export default PricingScreen;

