import React, { useState, useEffect, useMemo } from 'react';
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
  FlatList,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Card } from '../../components/cards/Cards';
import { Input } from '../../components/common';
import { CustomText, Heading } from '../../components/common/Text';
import Icon from '../../components/common/Icon';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import { formatCurrency } from '../../utils/helpers';
import { useGetMetalPricesQuery, useCalculatePricingMutation, useSavePricingMutation, useGetEnquiryByIdQuery } from '../../store/api';
import { API_BASE_URL } from '../../config/apiConfig';
import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as XLSX from 'xlsx';

const PricingScreen = ({ route, navigation }) => {
  const { enquiry: routeEnquiry, designType, enquiryId } = route.params || {}; // designType: 'coral' or 'cad'
  
  // Get enquiry ID
  const finalEnquiryId = enquiryId || routeEnquiry?.id || routeEnquiry?._id;
  
  // Fetch fresh enquiry data - this will refetch when cache is invalidated
  const { data: fetchedEnquiry, refetch: refetchEnquiry, isLoading: isLoadingEnquiry } = useGetEnquiryByIdQuery(finalEnquiryId, {
    skip: !finalEnquiryId,
    refetchOnFocus: true, // Refetch when screen comes into focus
    refetchOnMountOrArgChange: true, // Refetch when enquiryId changes
  });
  
  // Use fetched enquiry if available, otherwise fall back to route params
  const enquiry = fetchedEnquiry || routeEnquiry;
  const originalData = enquiry?._originalData || enquiry;

  // Memoize design data to ensure it updates when enquiry changes
  const designData = useMemo(() => {
    return designType === 'coral' 
    ? (originalData?.Coral || enquiry?.Coral || [])
    : (originalData?.Cad || enquiry?.Cad || []);
  }, [designType, originalData, enquiry]);
  
  // Memoize latest design to ensure it updates when designData changes
  const latestDesign = useMemo(() => {
    return designData && designData.length > 0 
    ? designData[designData.length - 1] 
    : null;
  }, [designData]);
  
  // Memoize pricing extraction to ensure it updates when latestDesign changes
  const rawPricing = useMemo(() => {
    return latestDesign?.Pricing || latestDesign?.pricing || {};
  }, [latestDesign]);
  
  const existingPricing = useMemo(() => {
    return Array.isArray(rawPricing) && rawPricing.length > 0 
    ? rawPricing[rawPricing.length - 1] // Get the latest pricing if it's an array
    : rawPricing; // Use as-is if it's an object
  }, [rawPricing]);
  
  // Debug logging when enquiry data changes
  useEffect(() => {
    if (__DEV__ && enquiry) {
      if (latestDesign) {
        console.log('🔄 Latest Design Pricing Type:', Array.isArray(latestDesign?.Pricing || latestDesign?.pricing) ? 'Array' : typeof (latestDesign?.Pricing || latestDesign?.pricing));
      }
      console.log('🔄 Raw Pricing Type:', Array.isArray(rawPricing) ? 'Array' : typeof rawPricing);
      if (existingPricing && typeof existingPricing === 'object') {
        console.log('🔄 Pricing Keys:', Object.keys(existingPricing));
      }
    }
  }, [enquiry, fetchedEnquiry, designType, designData, latestDesign, rawPricing, existingPricing, originalData]);

  // Form state - initialize with existing pricing data
  const [formData, setFormData] = useState({
    metalPrice: (existingPricing?.MetalPrice || existingPricing?.metalPrice || 0).toString(),
    diamondPrice: (existingPricing?.DiamondPrice || existingPricing?.DiamondsPrice || existingPricing?.diamondPrice || 0).toString(),
    totalPrice: (existingPricing?.TotalPrice || existingPricing?.totalPrice || 0).toString(),
    metalWeight: (existingPricing?.MetalWeight || existingPricing?.metalWeight || 0).toString(),
    diamondWeight: (existingPricing?.DiamondWeight || existingPricing?.diamondWeight || 0).toString(),
    totalPieces: (existingPricing?.TotalPieces || existingPricing?.totalPieces || 0).toString(),
    lossPercent: (existingPricing?.LossPercent || existingPricing?.lossPercent || existingPricing?.Loss || 0).toString(),
    labour: (existingPricing?.Labour || existingPricing?.labour || 0).toString(),
    duties: (existingPricing?.Duties || existingPricing?.duties || 0).toString(),
    extraCharges: (existingPricing?.ExtraCharges || existingPricing?.extraCharges || 0).toString(),
    undercutPrice: (existingPricing?.UndercutPrice || existingPricing?.undercutPrice || 0).toString(),
    clientPricingMessage: existingPricing?.ClientPricingMessage || latestDesign?.ClientPricingMessage || '',
  });

  const [undercutEnabled, setUndercutEnabled] = useState(!!(existingPricing?.UndercutPrice || existingPricing?.undercutPrice));
  
  // Normalize stones data - map API field names to UI field names
  const normalizeStones = (rawStones) => {
    if (!Array.isArray(rawStones) || rawStones.length === 0) return [];
    return rawStones.map(stone => ({
      Type: stone.Type || stone.type || '',
      Color: stone.Color || stone.color || '',
      Shape: stone.Shape || stone.shape || '',
      MM: (stone.MmSize || stone.MM || stone.mmSize || stone.mm || '').toString(),
      Sieve: (stone.SieveSize || stone.Sieve || stone.sieveSize || stone.sieve || '').toString(),
      Weight: (stone.Weight || stone.weight || 0).toString(),
      Pieces: (stone.Pcs || stone.Pieces || stone.pcs || stone.pieces || 0).toString(),
      CaratWeight: (stone.CtWeight || stone.CaratWeight || stone.ctWeight || stone.caratWeight || 0).toString(),
      Price: (stone.Price || stone.price || 0).toString(),
    }));
  };
  
  const [stones, setStones] = useState(() => {
    const rawStones = existingPricing?.Stones || existingPricing?.stones || latestDesign?.Stones || latestDesign?.stones || [];
    return normalizeStones(rawStones);
  });

  // Refetch enquiry data when screen comes into focus (after saving)
  useFocusEffect(
    React.useCallback(() => {
      if (finalEnquiryId) {
        
        // Refetch enquiry data to get latest pricing
        refetchEnquiry();
      }
    }, [finalEnquiryId, refetchEnquiry])
  );

  // Update form data when pricing data changes
  useEffect(() => {
    if (existingPricing && typeof existingPricing === 'object' && Object.keys(existingPricing).length > 0) {
      
      
        const updatedFormData = {
        metalPrice: (existingPricing?.MetalPrice || existingPricing?.metalPrice || 0).toString(),
        diamondPrice: (existingPricing?.DiamondPrice || existingPricing?.DiamondsPrice || existingPricing?.diamondPrice || 0).toString(),
        totalPrice: (existingPricing?.TotalPrice || existingPricing?.totalPrice || 0).toString(),
        metalWeight: (existingPricing?.Metal?.Weight || existingPricing?.MetalWeight || existingPricing?.metalWeight || 0).toString(),
        diamondWeight: (existingPricing?.DiamondWeight || existingPricing?.diamondWeight || 0).toString(),
        totalPieces: (existingPricing?.TotalPieces || existingPricing?.totalPieces || 0).toString(),
        lossPercent: (existingPricing?.LossPercent || existingPricing?.lossPercent || existingPricing?.Loss || 0).toString(),
        labour: (existingPricing?.Labour || existingPricing?.labour || 0).toString(),
        duties: (existingPricing?.Duties || existingPricing?.duties || 0).toString(),
        extraCharges: (existingPricing?.ExtraCharges || existingPricing?.extraCharges || 0).toString(),
        undercutPrice: (existingPricing?.UndercutPrice || existingPricing?.undercutPrice || 0).toString(),
        clientPricingMessage: existingPricing?.ClientPricingMessage || latestDesign?.ClientPricingMessage || '',
        };
      
      
        
        setFormData(prevFormData => {
        // Always update to ensure latest data is shown
          const hasChanges = Object.keys(updatedFormData).some(
            key => updatedFormData[key] !== prevFormData[key]
          );
        
        
          
          return hasChanges ? updatedFormData : prevFormData;
        });
        
        // Update stones if they exist - normalize field names
      const rawStones = existingPricing?.Stones || existingPricing?.stones || latestDesign?.Stones || latestDesign?.stones || [];
        const updatedStones = normalizeStones(rawStones);
        if (updatedStones.length > 0) {
          setStones(prevStones => {
          const stonesChanged = JSON.stringify(updatedStones) !== JSON.stringify(prevStones);
          
          return stonesChanged ? updatedStones : prevStones;
          });
        }
        
        // Update undercut enabled
      const hasUndercut = !!(existingPricing?.UndercutPrice || existingPricing?.undercutPrice);
      setUndercutEnabled(prev => {
        if (hasUndercut !== prev && __DEV__) {
          // Debug log if needed
        }
        return hasUndercut;
      });
    }
  }, [existingPricing, latestDesign]);

  // Fetch latest metal prices - API is called automatically when component mounts
  const { data: metalPricesData, isLoading: loadingMetalPrices, refetch: refetchMetalPrices } = useGetMetalPricesQuery(false);
  const metalPrices = metalPricesData?.prices || metalPricesData || {};
  
  // Pricing calculation mutation
  const [calculatePricing, { isLoading: isCalculating }] = useCalculatePricingMutation();
  
  // Save pricing mutation
  const [savePricing, { isLoading: isSaving }] = useSavePricingMutation();
  
  // Sync client pricing loading state
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Determine metal type from enquiry (default to gold)
  const metalColor = originalData?.Metal?.Color || enquiry?.Metal?.Color || 'Gold';
  const metalType = metalColor.toLowerCase().includes('gold') ? 'gold' 
    : metalColor.toLowerCase().includes('silver') ? 'silver'
    : metalColor.toLowerCase().includes('platinum') ? 'platinum'
    : 'gold'; // Default to gold
  
  // Get metal rate from API
  const apiMetalRate = metalPrices[metalType]?.price || 0;
  
  // Metal Rate considered for quotation - use existing pricing data if available, otherwise use API rate
  // Priority: Metal.Rate from existing pricing > MetalRateConsidered > API rate
  const [metalRateConsidered, setMetalRateConsidered] = useState(
    existingPricing?.Metal?.Rate || existingPricing?.MetalRate || existingPricing?.MetalRateConsidered || 0
  );
  
  // Latest Metal Rate - always from current API call
  const latestMetalRate = apiMetalRate || 0;
  
  // Refetch metal prices when screen loads (when Pricing button is pressed)
  useEffect(() => {
    refetchMetalPrices();
  }, [refetchMetalPrices]);
  
  // Update metalRateConsidered from existing pricing or API if not set
  useEffect(() => {
    // First, try to get from existing pricing
    const rateFromPricing = existingPricing?.Metal?.Rate || existingPricing?.MetalRate || existingPricing?.MetalRateConsidered;
    if (rateFromPricing && rateFromPricing > 0) {
      setMetalRateConsidered(rateFromPricing);
    } else if (apiMetalRate > 0) {
      // Fallback to API rate if no existing pricing rate
      setMetalRateConsidered(apiMetalRate);
    }
  }, [apiMetalRate, existingPricing?.Metal?.Rate, existingPricing?.MetalRate, existingPricing?.MetalRateConsidered]);

  // Debug: Log pricing data structure (after all useState hooks)
  useEffect(() => {
    if (__DEV__) {
      const rawPricing = latestDesign?.Pricing || latestDesign?.pricing || {};
      const pricingObj = Array.isArray(rawPricing) && rawPricing.length > 0 
        ? rawPricing[rawPricing.length - 1]
        : rawPricing;
      
      console.log('Raw Pricing Type:', Array.isArray(rawPricing) ? 'Array' : 'Object');
      console.log('Pricing Keys:', Object.keys(pricingObj || {}));
      console.log('Full Pricing Object:', JSON.stringify(pricingObj, null, 2));
    }
  }, [latestDesign, designType]);

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
          
        }
        
        // Parse and validate numeric fields
        const ctWeight = parseFloat(stone.CaratWeight);
        const weight = parseFloat(stone.Weight);
        const pcs = parseInt(stone.Pieces);
        const price = parseFloat(stone.Price);
        
        // Validate numeric values are valid numbers
        if (isNaN(ctWeight) || ctWeight < 0) {
          
        }
        if (isNaN(weight) || weight < 0) {
          
        }
        if (isNaN(pcs) || pcs < 0) {
          
        }
        if (isNaN(price) || price < 0) {
          
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
        console.warn('Enquiry object keys:', Object.keys(enquiry || {}));
        console.warn('Original data keys:', Object.keys(originalData || {}));
        console.warn('Full enquiry object:', JSON.stringify(enquiry, null, 2).substring(0, 500));
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
        console.log('Client ID format valid:', /^[0-9a-fA-F]{24}$/.test(clientId));
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
      console.error('Full error:', JSON.stringify(error, null, 2));
      console.error('Payload that was sent:', JSON.stringify(payload, null, 2));
      
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

  const handleSave = async () => {
    try {
      // Get enquiry ID
      const enquiryId = enquiry?.id || enquiry?._id;
      if (!enquiryId) {
        Alert.alert('Error', 'Enquiry ID is missing');
        return;
      }

      // Get version from latest design - ensure it's in "Version X" format
      let version = latestDesign?.Version || latestDesign?.version || 'Version 1';
      // If version is just a number, convert it to "Version X" format
      if (typeof version === 'number' || (typeof version === 'string' && /^\d+$/.test(version.trim()))) {
        version = `Version ${version}`;
      } else if (typeof version === 'string' && !version.toLowerCase().startsWith('version')) {
        // If it's a string but doesn't start with "Version", add it
        version = `Version ${version}`;
      }
      
      // Get metal details from enquiry
      const metalColor = originalData?.Metal?.Color || enquiry?.Metal?.Color || 'Gold';
      const metalQuality = originalData?.Metal?.Quality || enquiry?.Metal?.Quality || '14K';
      
      // Get metal rate - prioritize existing pricing rate, then metalRateConsidered, then calculate
      const metalWeight = parseFloat(formData.metalWeight) || 0;
      const metalPrice = parseFloat(formData.metalPrice) || 0;
      
      // Try to get rate from existing pricing first
      let metalRate = existingPricing?.Metal?.Rate || existingPricing?.MetalRate || 0;
      
      // If not found, use metalRateConsidered (from form state)
      if (!metalRate || metalRate === 0) {
        metalRate = parseFloat(metalRateConsidered) || 0;
      }
      
      // If still not found, calculate from price/weight (fallback)
      if (!metalRate || metalRate === 0) {
        metalRate = metalWeight > 0 ? metalPrice / metalWeight : 0;
      }
      
      if (__DEV__) {
        console.log('💰 Metal Rate Calculation:', {
          fromExistingPricing: existingPricing?.Metal?.Rate || existingPricing?.MetalRate,
          fromMetalRateConsidered: metalRateConsidered,
          calculated: metalWeight > 0 ? metalPrice / metalWeight : 0,
          finalRate: metalRate,
        });
      }
      
      // Format stones data according to API structure
      const formattedStones = stones.map(stone => ({
        Type: stone.Type || '',
        Color: stone.Color || '',
        Shape: stone.Shape || '',
        MmSize: stone.MM || '',
        SieveSize: stone.Sieve || '',
        CtWeight: parseFloat(stone.CaratWeight) || 0,
        Weight: parseFloat(stone.Weight) || 0,
        Pcs: parseInt(stone.Pieces) || 0,
        Price: parseFloat(stone.Price) || 0,
      }));

      // Build pricing object according to API structure
      const pricingObject = {
        MetalPrice: parseFloat(formData.metalPrice) || 0,
        DiamondsPrice: parseFloat(formData.diamondPrice) || 0,
        TotalPrice: parseFloat(formData.totalPrice) || 0,
        DiamondWeight: parseFloat(formData.diamondWeight) || 0,
        TotalPieces: parseInt(formData.totalPieces) || 0,
        Metal: {
          Weight: parseFloat(formData.metalWeight) || 0,
          Quality: metalQuality,
          Rate: metalRate,
        },
        ExtraCharges: parseFloat(formData.extraCharges) || 0,
        Duties: parseFloat(formData.duties) || 0,
        Loss: parseFloat(formData.lossPercent) || 0,
        Labour: parseFloat(formData.labour) || 0,
        UndercutPrice: undercutEnabled ? (parseFloat(formData.undercutPrice) || 0) : 0,
        Stones: formattedStones,
        ClientPricingMessage: formData.clientPricingMessage || '',
      };

      // API expects an array of pricing objects
      // For now, we'll send a single pricing object in an array
      // If there are multiple pricing sets (regular + client), they can be added later
      const pricingArray = [pricingObject];

      if (__DEV__) {
        console.log('Version (formatted):', version);
        console.log('Version (raw from design):', latestDesign?.Version || latestDesign?.version);
        console.log('Metal Details:', {
          Color: metalColor,
          Quality: metalQuality,
          Weight: formData.metalWeight,
          Rate: metalRate,
          Price: formData.metalPrice,
        });
        console.log('Pricing Object Structure:', {
          MetalPrice: pricingObject.MetalPrice,
          DiamondsPrice: pricingObject.DiamondsPrice,
          TotalPrice: pricingObject.TotalPrice,
          Metal: pricingObject.Metal,
          StonesCount: pricingObject.Stones?.length || 0,
        });
        console.log('Full Pricing Data:', JSON.stringify(pricingArray, null, 2));
      }

      // Call API to save pricing
      await savePricing({
        enquiryId,
        designType,
        version,
        pricingData: pricingArray,
      }).unwrap();

      // Refetch enquiry data to get updated pricing before navigating back
      if (finalEnquiryId) {
        await refetchEnquiry();
      }
      
      Alert.alert(
        'Success',
        'Pricing saved successfully',
        [
          {
            text: 'OK',
            onPress: () => {
              // Navigate back - data will be fresh when user returns
              navigation.goBack();
            },
          },
        ]
      );
    } catch (error) {
      
      let errorMessage = 'Failed to save pricing. Please try again.';
      if (error?.data?.message) {
        errorMessage = error.data.message;
      } else if (error?.data?.error) {
        errorMessage = error.data.error;
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      Alert.alert('Save Failed', errorMessage);
    }
  };

  const handleDownloadExcel = () => {
    if (!designCode) {
      Alert.alert('Error', 'Design code not available');
      return;
    }
    // TODO: Implement Excel download
    const excelUrl = `${API_BASE_URL}/api/enquiries/files/${designCode}.xlsx?download=true`;
    Alert.alert('Info', 'Download Excel functionality will be implemented');
    
  };

  const handleDownloadPricing = async () => {
    if (stones.length === 0) {
      Alert.alert('No Data', 'No stones data available to download');
      return;
    }

    try {
      // Get auth token
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Error', 'Authentication token not found');
      return;
    }

      // Prepare stones data for Excel generation
      const stonesData = stones.map(stone => ({
        Type: stone.Type || '',
        Color: stone.Color || '',
        Shape: stone.Shape || '',
        MmSize: stone.MM || '',
        SieveSize: stone.Sieve || '',
        Weight: parseFloat(stone.Weight) || 0,
        Pcs: parseInt(stone.Pieces) || 0,
        CtWeight: parseFloat(stone.CaratWeight) || 0,
        Price: parseFloat(stone.Price) || 0,
      }));

      // Create filename with design code and timestamp
      const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
      const excelFilename = designCode 
        ? `Pricing_${designCode}_${timestamp}.xlsx`
        : `Pricing_${timestamp}.xlsx`;

      // Try to call backend API to generate Excel
      const excelUrl = `${API_BASE_URL}/api/pricing/generate-excel`;
      
              if (__DEV__) {
        console.log('Generating Excel for pricing:', {
          stonesCount: stonesData.length,
          designCode,
          excelFilename,
        });
      }

      const response = await fetch(excelUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          stones: stonesData,
          designCode: designCode || '',
          designType: designType || '',
          enquiryId: enquiry?.id || enquiry?._id || '',
        }),
      });

      if (!response.ok) {
        // If backend API doesn't exist, generate CSV as fallback
        throw new Error(`Backend API not available (${response.status}), using CSV fallback`);
      }

      const contentType = response.headers.get('content-type') || '';
      
      if (contentType.includes('application/json')) {
        // Backend returned JSON (possibly with signed URL)
        const jsonData = await response.json();
        if (jsonData.url) {
          // Download from signed URL
          const s3Response = await fetch(jsonData.url);
          if (!s3Response.ok) {
            throw new Error('Failed to download from signed URL');
          }
          const arrayBuffer = await s3Response.arrayBuffer();
          await saveExcelFile(arrayBuffer, excelFilename);
        } else {
          throw new Error('Backend did not return a valid URL');
        }
      } else {
        // Backend returned Excel file directly
        const arrayBuffer = await response.arrayBuffer();
        await saveExcelFile(arrayBuffer, excelFilename);
      }
    } catch (error) {
      // Fallback to client-side Excel generation
      await generateExcelFile();
    }
  };

  const saveExcelFile = async (arrayBuffer, filename) => {
    const downloadPath = `${RNFS.DownloadDirectoryPath}/${filename}`;
    
    // Convert array buffer to base64
    const bytes = new Uint8Array(arrayBuffer);
    const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let base64 = '';
    let i = 0;
    
    while (i < bytes.length) {
      const a = bytes[i++];
      const b = i < bytes.length ? bytes[i++] : 0;
      const c = i < bytes.length ? bytes[i++] : 0;
      
      const bitmap = (a << 16) | (b << 8) | c;
      
      base64 += base64Chars.charAt((bitmap >> 18) & 63);
      base64 += base64Chars.charAt((bitmap >> 12) & 63);
      base64 += i - 2 < bytes.length ? base64Chars.charAt((bitmap >> 6) & 63) : '=';
      base64 += i - 1 < bytes.length ? base64Chars.charAt(bitmap & 63) : '=';
    }

    // Write file to device
    await RNFS.writeFile(downloadPath, base64, 'base64');

    // Share/open the file
    try {
      await Share.open({
        url: `file://${downloadPath}`,
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        filename: filename,
        title: 'Open Excel File',
        message: `Downloaded: ${filename}`,
      });
    } catch (shareError) {
      if (shareError.message !== 'User did not share') {
        Alert.alert(
          'Success',
          `Excel file downloaded successfully!\n\nSaved to: Downloads/${filename}`,
          [{ text: 'OK' }]
        );
      }
    }
  };

  const generateExcelFile = async () => {
    if (stones.length === 0) {
      Alert.alert('No Data', 'No stones data available');
      return;
    }

    try {
      // Prepare data array with headers matching the Excel structure
      const excelData = [
        ['Type', 'Color', 'Shape', 'MM Size', 'Sieve Size', 'Weight', 'Pieces', 'Carat Weight', 'Price']
      ];

      // Add stone data rows
      stones.forEach(stone => {
        excelData.push([
          stone.Type || '',
          stone.Color || '',
          stone.Shape || '',
          stone.MM || '',
          stone.Sieve || '',
          parseFloat(stone.Weight) || 0,
          parseInt(stone.Pieces) || 0,
          parseFloat(stone.CaratWeight) || 0,
          parseFloat(stone.Price) || 0,
        ]);
      });

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(excelData);

      // Set column widths for better readability
      ws['!cols'] = [
        { wch: 15 }, // Type
        { wch: 10 }, // Color
        { wch: 10 }, // Shape
        { wch: 12 }, // MM Size
        { wch: 15 }, // Sieve Size
        { wch: 12 }, // Weight
        { wch: 10 }, // Pieces
        { wch: 15 }, // Carat Weight
        { wch: 12 }, // Price
      ];

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Pricing');

      // Generate Excel file buffer
      const excelBuffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

      // Create filename
      const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
      const excelFilename = designCode 
        ? `Pricing_${designCode}_${timestamp}.xlsx`
        : `Pricing_${timestamp}.xlsx`;
      
      const downloadPath = `${RNFS.DownloadDirectoryPath}/${excelFilename}`;

      // Convert array buffer to base64
      const bytes = new Uint8Array(excelBuffer);
      const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
      let base64 = '';
      let i = 0;
      
      while (i < bytes.length) {
        const a = bytes[i++];
        const b = i < bytes.length ? bytes[i++] : 0;
        const c = i < bytes.length ? bytes[i++] : 0;
        
        const bitmap = (a << 16) | (b << 8) | c;
        
        base64 += base64Chars.charAt((bitmap >> 18) & 63);
        base64 += base64Chars.charAt((bitmap >> 12) & 63);
        base64 += i - 2 < bytes.length ? base64Chars.charAt((bitmap >> 6) & 63) : '=';
        base64 += i - 1 < bytes.length ? base64Chars.charAt(bitmap & 63) : '=';
      }

      // Write Excel file
      await RNFS.writeFile(downloadPath, base64, 'base64');

      // Share/open the file
      try {
        await Share.open({
          url: `file://${downloadPath}`,
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          filename: excelFilename,
          title: 'Open Excel File',
          message: `Downloaded: ${excelFilename}`,
        });
      } catch (shareError) {
        if (shareError.message !== 'User did not share') {
          Alert.alert(
            'Success',
            `Excel file downloaded successfully!\n\nSaved to: Downloads/${excelFilename}`,
            [{ text: 'OK' }]
          );
        }
      }
    } catch (error) {
      Alert.alert('Error', `Failed to generate Excel file: ${error.message}`);
    }
  };

  const handleSyncClientPricing = async () => {
    setIsSyncing(true);
    try {
      // Get clientId from multiple possible sources
      const clientId = enquiry?.clientId || 
                       enquiry?.ClientId || 
                       originalData?.clientId || 
                       originalData?.ClientId ||
                       null;

      if (!clientId) {
        Alert.alert(
          'Missing Client ID',
          'Client ID is required for syncing client pricing. Please ensure the enquiry has a valid client assigned.'
        );
        return;
      }

      // Get metal details from enquiry
      const metalColor = originalData?.Metal?.Color || enquiry?.Metal?.Color || 'Gold';
      const metalQuality = originalData?.Metal?.Quality || enquiry?.Metal?.Quality || '24K';
      const metalWeight = parseFloat(formData.metalWeight) || 0;

      // Format stones array according to API specification
      const formattedStones = stones.map(stone => ({
        Type: stone.Type || '',
        Color: stone.Color || '',
        Shape: stone.Shape || '',
        MmSize: stone.MM || '0',
        SieveSize: stone.Sieve || '0',
        CtWeight: parseFloat(stone.CaratWeight) || 0,
        Weight: parseFloat(stone.Weight) || 0,
        Pcs: parseInt(stone.Pieces) || 0,
        Price: parseFloat(stone.Price) || 0,
      })).filter(stone => stone.Type); // Only include stones with Type

      // Build payload according to API specification
      const payload = {
        clientId: clientId,
        details: {
          Metal: {
            Weight: metalWeight,
            Quality: metalQuality,
          },
          Stones: formattedStones,
          Loss: parseFloat(formData.lossPercent) || 0,
          Labour: parseFloat(formData.labour) || 0,
          ExtraCharges: parseFloat(formData.extraCharges) || 0,
          Duties: parseFloat(formData.duties) || 0,
          Quantity: parseInt(formData.totalPieces) || 1,
        },
      };

      if (__DEV__) {
        console.log('Payload:', JSON.stringify(payload, null, 2));
      }

      // Call API to sync client pricing
      const response = await calculatePricing(payload).unwrap();

      

      // Update form data with response
      if (response) {
        // Update metal price
        if (response.MetalPrice !== undefined) {
          setFormData(prev => ({
            ...prev,
            metalPrice: response.MetalPrice.toString(),
          }));
        }

        // Update diamonds price
        if (response.DiamondsPrice !== undefined) {
          setFormData(prev => ({
            ...prev,
            diamondPrice: response.DiamondsPrice.toString(),
          }));
        }

        // Update total price
        if (response.TotalPrice !== undefined) {
          setFormData(prev => ({
            ...prev,
            totalPrice: response.TotalPrice.toString(),
          }));
        }

        // Update metal weight and rate if provided
        if (response.Metal) {
          if (response.Metal.Weight !== undefined) {
            setFormData(prev => ({
              ...prev,
              metalWeight: response.Metal.Weight.toString(),
            }));
          }
          if (response.Metal.Rate !== undefined) {
            setMetalRateConsidered(parseFloat(response.Metal.Rate) || 0);
          }
        }

        // Update diamond weight
        if (response.DiamondWeight !== undefined) {
          setFormData(prev => ({
            ...prev,
            diamondWeight: response.DiamondWeight.toString(),
          }));
        }

        // Update client-specific charges if provided
        if (response.Client) {
          if (response.Client.Loss !== undefined) {
            setFormData(prev => ({
              ...prev,
              lossPercent: response.Client.Loss.toString(),
            }));
          }
          if (response.Client.Labour !== undefined) {
            setFormData(prev => ({
              ...prev,
              labour: response.Client.Labour.toString(),
            }));
          }
          if (response.Client.ExtraCharges !== undefined) {
            setFormData(prev => ({
              ...prev,
              extraCharges: response.Client.ExtraCharges.toString(),
            }));
          }
          if (response.Client.Duties !== undefined) {
            setFormData(prev => ({
              ...prev,
              duties: response.Client.Duties.toString(),
            }));
          }
        }

        // Update stones if provided
        if (response.Stones && Array.isArray(response.Stones) && response.Stones.length > 0) {
          const normalizedStones = normalizeStones(response.Stones);
          setStones(normalizedStones);
        }

        Alert.alert(
          'Success',
          'Client pricing synced successfully. The form has been updated with client-specific pricing.'
        );
      } else {
        Alert.alert('Warning', 'No pricing data received from server.');
      }
    } catch (error) {
      
      let errorMessage = 'Failed to sync client pricing. Please try again.';
      if (error?.data?.message) {
        errorMessage = error.data.message;
      } else if (error?.data?.error) {
        errorMessage = error.data.error;
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      Alert.alert('Sync Failed', errorMessage);
    } finally {
      setIsSyncing(false);
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
          </View>
          <View style={styles.stonesButtonsContainer}>
            <TouchableOpacity
                onPress={handleAddDiamond}
                style={[styles.stonesButton, styles.addButton]}
              activeOpacity={0.8}
            >
              <View style={styles.stonesBtnContent}>
                <Icon name="add" size={18} color={colors.textWhite} />
                <Text style={styles.stonesBtnText}>Add Diamond</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
                onPress={handleDownloadPricing}
                style={[styles.stonesButton, styles.downloadButton]}
              activeOpacity={0.8}
            >
              <View style={styles.stonesBtnContent}>
                <Icon name="file-download" size={18} color={colors.textWhite} />
                <Text style={styles.stonesBtnText}>Download Pricing</Text>
            </View>
            </TouchableOpacity>
          </View>

          <View style={styles.stonesTableContainer}>
            {stones.length > 0 ? (
              <View style={styles.tableWrapper}>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={true}
                  style={styles.tableScrollContainer}
                >
                  <View>
                    {/* Table Header */}
                    <View style={styles.tableHeader}>
                      <View style={[styles.tableHeaderCell, styles.tableCellNumber]}>
                        <CustomText variant="caption" style={styles.tableHeaderText}>#</CustomText>
                      </View>
                      <View style={[styles.tableHeaderCell, styles.tableCellType]}>
                        <CustomText variant="caption" style={styles.tableHeaderText}>Type *</CustomText>
                      </View>
                      <View style={[styles.tableHeaderCell, styles.tableCellSmall]}>
                        <CustomText variant="caption" style={styles.tableHeaderText}>Color</CustomText>
                      </View>
                      <View style={[styles.tableHeaderCell, styles.tableCellSmall]}>
                        <CustomText variant="caption" style={styles.tableHeaderText}>Shape</CustomText>
                      </View>
                      <View style={[styles.tableHeaderCell, styles.tableCellSmall]}>
                        <CustomText variant="caption" style={styles.tableHeaderText}>MM</CustomText>
                      </View>
                      <View style={[styles.tableHeaderCell, styles.tableCellMedium]}>
                        <CustomText variant="caption" style={styles.tableHeaderText}>Sieve</CustomText>
                      </View>
                      <View style={[styles.tableHeaderCell, styles.tableCellSmall]}>
                        <CustomText variant="caption" style={styles.tableHeaderText}>Weight</CustomText>
                      </View>
                      <View style={[styles.tableHeaderCell, styles.tableCellSmall]}>
                        <CustomText variant="caption" style={styles.tableHeaderText}>Pieces</CustomText>
                      </View>
                      <View style={[styles.tableHeaderCell, styles.tableCellSmall]}>
                        <CustomText variant="caption" style={styles.tableHeaderText}>Carat</CustomText>
                      </View>
                      <View style={[styles.tableHeaderCell, styles.tableCellSmall]}>
                        <CustomText variant="caption" style={styles.tableHeaderText}>Price</CustomText>
                      </View>
                      <View style={[styles.tableHeaderCell, styles.tableCellAction]}>
                        <CustomText variant="caption" style={styles.tableHeaderText}>Action</CustomText>
                      </View>
                  </View>
                  
                    {/* Table Body */}
                    <View style={styles.tableBody}>
                      {stones.map((stone, index) => (
                      <View key={index} style={[styles.tableRow, index % 2 === 1 && styles.tableRowEven]}>
                        {/* Row Number */}
                        <View style={[styles.tableCell, styles.tableCellNumber]}>
                          <CustomText variant="body" style={styles.tableCellText}>
                            {index + 1}
                      </CustomText>
                        </View>

                        {/* Type Dropdown */}
                        <View style={[styles.tableCell, styles.tableCellType]}>
                    {renderTypeDropdown(index, stoneTypeOptions.find(opt => opt.value === stone.Type)?.label || '')}
                  </View>
                  
                        {/* Color */}
                        <View style={[styles.tableCell, styles.tableCellSmall]}>
                  <TextInput
                            style={styles.tableInput}
                    value={stone.Color || ''}
                    onChangeText={(value) => handleUpdateStone(index, 'Color', value)}
                            placeholder="Color"
                    placeholderTextColor={colors.textLight}
                  />
                      </View>
                  
                        {/* Shape */}
                        <View style={[styles.tableCell, styles.tableCellSmall]}>
                  <TextInput
                            style={styles.tableInput}
                    value={stone.Shape || ''}
                    onChangeText={(value) => handleUpdateStone(index, 'Shape', value)}
                            placeholder="Shape"
                    placeholderTextColor={colors.textLight}
                  />
                    </View>
                    
                        {/* MM Size */}
                        <View style={[styles.tableCell, styles.tableCellSmall]}>
                  <TextInput
                            style={styles.tableInput}
                    value={stone.MM || ''}
                    onChangeText={(value) => handleUpdateStone(index, 'MM', value)}
                          placeholder="0"
                    placeholderTextColor={colors.textLight}
                    keyboardType="numeric"
                  />
                      </View>
                  
                        {/* Sieve Size */}
                        <View style={[styles.tableCell, styles.tableCellMedium]}>
                  <TextInput
                            style={styles.tableInput}
                    value={stone.Sieve || ''}
                    onChangeText={(value) => handleUpdateStone(index, 'Sieve', value)}
                          placeholder="0"
                    placeholderTextColor={colors.textLight}
                    keyboardType="numeric"
                  />
                    </View>
                    
                        {/* Weight */}
                        <View style={[styles.tableCell, styles.tableCellSmall]}>
                  <TextInput
                            style={styles.tableInput}
                    value={stone.Weight || '0'}
                    onChangeText={(value) => handleUpdateStone(index, 'Weight', value)}
                    placeholder="0"
                    placeholderTextColor={colors.textLight}
                    keyboardType="numeric"
                  />
                      </View>
                  
                        {/* Pieces */}
                        <View style={[styles.tableCell, styles.tableCellSmall]}>
                  <TextInput
                            style={styles.tableInput}
                    value={stone.Pieces || '0'}
                    onChangeText={(value) => handleUpdateStone(index, 'Pieces', value)}
                    placeholder="0"
                    placeholderTextColor={colors.textLight}
                    keyboardType="numeric"
                        />
                    </View>
                    
                        {/* Carat Weight */}
                        <View style={[styles.tableCell, styles.tableCellSmall]}>
                  <TextInput
                            style={styles.tableInput}
                    value={stone.CaratWeight || '0'}
                    onChangeText={(value) => handleUpdateStone(index, 'CaratWeight', value)}
                    placeholder="0"
                    placeholderTextColor={colors.textLight}
                    keyboardType="numeric"
                  />
                      </View>
                  
                        {/* Price */}
                        <View style={[styles.tableCell, styles.tableCellSmall]}>
                  <TextInput
                            style={styles.tableInput}
                    value={stone.Price || '0'}
                    onChangeText={(value) => handleUpdateStone(index, 'Price', value)}
                    placeholder="0"
                    placeholderTextColor={colors.textLight}
                    keyboardType="numeric"
                        />
                </View>

                        {/* Delete Action */}
                        <View style={[styles.tableCell, styles.tableCellAction]}>
                          <TouchableOpacity
                            onPress={() => handleDeleteStone(index)}
                            style={styles.tableDeleteButton}
                          >
                            <Icon name="delete" size={18} color={colors.error} />
                          </TouchableOpacity>
                    </View>
                  </View>
                      ))}
                    </View>
                  </View>
                </ScrollView>
              </View>
            ) : (
              <View style={styles.emptyStonesContainer}>
                <Icon name="diamond" size={48} color={colors.textLight} />
                <Text style={styles.emptyStonesText}>No stones added yet</Text>
                <Text style={styles.emptyStonesSubtext}>
                  Click "Add Diamond" to add your first stone
                </Text>
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
        <Card style={styles.actionButtonsCard}>
        <View style={styles.actionButtons}>
            <View style={styles.actionButtonsRow}>
              <TouchableOpacity
            onPress={handleSave}
                disabled={isSaving}
                style={[styles.actionBtn, styles.actionBtnHalf, styles.saveBtn, isSaving && styles.btnDisabled]}
                activeOpacity={0.8}
              >
                <View style={styles.btnContent}>
                  <Icon name="save" size={18} color={colors.textWhite} />
                  <Text style={styles.btnText}>{isSaving ? 'Saving...' : 'Save'}</Text>
                </View>
              </TouchableOpacity>
              
              <TouchableOpacity
            onPress={() => navigation.goBack()}
                style={[styles.actionBtn, styles.actionBtnHalf, styles.cancelBtn]}
                activeOpacity={0.8}
              >
                <View style={styles.btnContent}>
                  <Icon name="close" size={18} color={colors.textWhite} />
                  <Text style={styles.btnText}>Cancel</Text>
                </View>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
            onPress={handleCalculate}
            disabled={isCalculating}
              style={[styles.actionBtn, styles.calculateBtn, isCalculating && styles.btnDisabled]}
              activeOpacity={0.8}
            >
              <View style={styles.btnContent}>
                <Icon name="calculate" size={20} color={colors.textWhite} />
                <Text style={styles.btnText}>
                  {isCalculating ? "Calculating..." : "Calculate"}
                </Text>
        </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSyncClientPricing}
              disabled={isSyncing}
              style={[styles.actionBtn, styles.syncBtn, isSyncing && styles.btnDisabled]}
              activeOpacity={0.8}
            >
              <View style={styles.btnContent}>
                <Icon name="sync" size={20} color={colors.textWhite} />
                <Text style={styles.btnText}>
                  {isSyncing ? 'Syncing...' : 'Sync Client Pricing'}
                </Text>
            </View>
            </TouchableOpacity>

          </View>
        </Card>
      </ScrollView>
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
    padding: 20,
    backgroundColor: colors.background,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  infoText: {
    color: colors.textSecondary,
    fontSize: fonts.sm,
    fontFamily: fonts.regular,
    lineHeight: 20,
  },
  pricingCard: {
    marginBottom: 16,
    padding: 20,
    backgroundColor: colors.background,
    borderRadius: 12,
  },
  sectionTitle: {
    marginBottom: 16,
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: fonts.lg,
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
    padding: 20,
    backgroundColor: colors.background,
    borderRadius: 12,
  },
  undercutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  undercutLabel: {
    marginLeft: 12,
    fontSize: fonts.base,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
  },
  undercutInput: {
    marginTop: 8,
  },
  stonesCard: {
    marginBottom: 16,
    padding: 20,
    backgroundColor: colors.background,
    borderRadius: 12,
  },
  stonesHeader: {
    marginBottom: 12,
  },
  stonesButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  stonesButton: {
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
    minWidth: '45%',
  },
  stonesBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  stonesBtnText: {
    color: colors.textWhite,
    fontFamily: fonts.bold,
    fontSize: fonts.sm,
    letterSpacing: 0.2,
  },
  addButton: {
    backgroundColor: colors.primary,
  },
  downloadButton: {
    backgroundColor: colors.primary,
  },
  stonesTableContainer: {
    marginTop: 12,
  },
  tableWrapper: {
    backgroundColor: colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.primary || '#2196F3',
    borderBottomWidth: 2,
    borderBottomColor: colors.primaryDark || '#1976D2',
  },
  tableHeaderCell: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tableHeaderText: {
    color: colors.textWhite,
    fontFamily: fonts.bold,
    fontSize: fonts.xs,
    textAlign: 'center',
  },
  tableScrollContainer: {
    maxHeight: 500,
  },
  tableBody: {
    backgroundColor: colors.background,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    minHeight: 50,
  },
  tableRowEven: {
    backgroundColor: colors.backgroundSecondary,
  },
  tableCell: {
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 50,
  },
  tableCellText: {
    fontSize: fonts.xs,
    fontFamily: fonts.regular,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  tableInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 6,
    fontSize: fonts.xs,
    fontFamily: fonts.regular,
    color: colors.textPrimary,
    backgroundColor: colors.backgroundSecondary,
    textAlign: 'center',
    minWidth: 60,
    width: '100%',
  },
  tableCellNumber: {
    width: 40,
    minWidth: 40,
  },
  tableCellType: {
    width: 120,
    minWidth: 120,
  },
  tableCellSmall: {
    width: 80,
    minWidth: 80,
  },
  tableCellMedium: {
    width: 100,
    minWidth: 100,
  },
  tableCellAction: {
    width: 60,
    minWidth: 60,
    borderRightWidth: 0,
  },
  tableDeleteButton: {
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
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
    backgroundColor: colors.backgroundSecondary,
    minWidth: 100,
    width: '100%',
  },
  dropdownButtonText: {
    fontSize: fonts.xs,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
    flex: 1,
    textAlign: 'left',
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
    padding: 8,
    minWidth: 200,
    maxHeight: 300,
    shadowColor: colors.textPrimary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  dropdownOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dropdownOptionText: {
    fontSize: fonts.base,
    fontFamily: fonts.regular,
    color: colors.textPrimary,
  },
  deleteStoneButton: {
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
  },
  emptyStonesContainer: {
    padding: 40,
    alignItems: 'center',
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  emptyStonesText: {
    color: colors.textSecondary,
    fontSize: fonts.base,
    fontFamily: fonts.bold,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStonesSubtext: {
    color: colors.textLight,
    fontSize: fonts.sm,
    fontFamily: fonts.regular,
    textAlign: 'center',
  },
  messageCard: {
    marginBottom: 16,
    padding: 20,
    backgroundColor: colors.background,
    borderRadius: 12,
  },
  label: {
    marginBottom: 12,
    fontSize: fonts.base,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
  },
  messageInput: {
    minHeight: 120,
  },
  actionButtonsCard: {
    marginTop: 8,
    padding: 20,
    backgroundColor: colors.background,
    borderRadius: 12,
  },
  actionButtons: {
    gap: 12,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtn: {
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 18,
    minHeight: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnHalf: {
    flex: 1,
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  btnText: {
    color: colors.textWhite,
    fontFamily: fonts.bold,
    fontSize: fonts.base,
    letterSpacing: 0.2,
  },
  saveBtn: {
    backgroundColor: colors.primary,
    width: '100%',
  },
  cancelBtn: {
    backgroundColor: colors.textSecondary,
    width: '100%',
  },
  calculateBtn: {
    backgroundColor: colors.primary,
    width: '100%',
  },
  syncBtn: {
    backgroundColor: colors.primary,
    width: '100%',
  },
  btnDisabled: {
    opacity: 0.6,
  },
});

export default PricingScreen;

