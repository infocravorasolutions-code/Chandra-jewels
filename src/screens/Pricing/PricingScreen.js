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
import { Input } from '../../components/common';
import { CustomText, Heading } from '../../components/common/Text';
import Icon from '../../components/common/Icon';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import { formatCurrency } from '../../utils/helpers';
import { useGetMetalPricesQuery, useCalculatePricingMutation } from '../../store/api';
import { API_BASE_URL } from '../../config/apiConfig';
import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as XLSX from 'xlsx';

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
  
  // Handle Pricing as both array and object formats
  const rawPricing = latestDesign?.Pricing || latestDesign?.pricing || {};
  const existingPricing = Array.isArray(rawPricing) && rawPricing.length > 0 
    ? rawPricing[rawPricing.length - 1] // Get the latest pricing if it's an array
    : rawPricing; // Use as-is if it's an object

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

  // Update form data when enquiry or design data changes
  useEffect(() => {
    if (latestDesign) {
      // Re-extract pricing in case it changed (handle array format)
      const rawPricing = latestDesign?.Pricing || latestDesign?.pricing || {};
      const currentPricing = Array.isArray(rawPricing) && rawPricing.length > 0 
        ? rawPricing[rawPricing.length - 1]
        : rawPricing;
      
      if (currentPricing && typeof currentPricing === 'object') {
        const updatedFormData = {
          metalPrice: (currentPricing?.MetalPrice || currentPricing?.metalPrice || 0).toString(),
          diamondPrice: (currentPricing?.DiamondPrice || currentPricing?.DiamondsPrice || currentPricing?.diamondPrice || 0).toString(),
          totalPrice: (currentPricing?.TotalPrice || currentPricing?.totalPrice || 0).toString(),
          metalWeight: (currentPricing?.MetalWeight || currentPricing?.metalWeight || 0).toString(),
          diamondWeight: (currentPricing?.DiamondWeight || currentPricing?.diamondWeight || 0).toString(),
          totalPieces: (currentPricing?.TotalPieces || currentPricing?.totalPieces || 0).toString(),
          lossPercent: (currentPricing?.LossPercent || currentPricing?.lossPercent || currentPricing?.Loss || 0).toString(),
          labour: (currentPricing?.Labour || currentPricing?.labour || 0).toString(),
          duties: (currentPricing?.Duties || currentPricing?.duties || 0).toString(),
          extraCharges: (currentPricing?.ExtraCharges || currentPricing?.extraCharges || 0).toString(),
          undercutPrice: (currentPricing?.UndercutPrice || currentPricing?.undercutPrice || 0).toString(),
          clientPricingMessage: currentPricing?.ClientPricingMessage || latestDesign?.ClientPricingMessage || '',
        };
        
        setFormData(prevFormData => {
          // Only update if values have changed to avoid unnecessary re-renders
          const hasChanges = Object.keys(updatedFormData).some(
            key => updatedFormData[key] !== prevFormData[key]
          );
          
          return hasChanges ? updatedFormData : prevFormData;
        });
        
        // Update stones if they exist - normalize field names
        const rawStones = currentPricing?.Stones || currentPricing?.stones || latestDesign?.Stones || latestDesign?.stones || [];
        const updatedStones = normalizeStones(rawStones);
        if (updatedStones.length > 0) {
          setStones(prevStones => {
            if (JSON.stringify(updatedStones) !== JSON.stringify(prevStones)) {
              return updatedStones;
            }
            return prevStones;
          });
        }
        
        // Update undercut enabled
        const hasUndercut = !!(currentPricing?.UndercutPrice || currentPricing?.undercutPrice);
        setUndercutEnabled(prev => hasUndercut !== prev ? hasUndercut : prev);
      }
    }
  }, [latestDesign]);

  // Fetch latest metal prices - API is called automatically when component mounts
  const { data: metalPricesData, isLoading: loadingMetalPrices, refetch: refetchMetalPrices } = useGetMetalPricesQuery(false);
  const metalPrices = metalPricesData?.prices || metalPricesData || {};
  
  // Pricing calculation mutation
  const [calculatePricing, { isLoading: isCalculating }] = useCalculatePricingMutation();
  
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

  // Debug: Log pricing data structure (after all useState hooks)
  useEffect(() => {
    if (__DEV__) {
      const rawPricing = latestDesign?.Pricing || latestDesign?.pricing || {};
      const pricingObj = Array.isArray(rawPricing) && rawPricing.length > 0 
        ? rawPricing[rawPricing.length - 1]
        : rawPricing;
      
      console.log('========== PRICING SCREEN DEBUG ==========');
      console.log('Design Type:', designType);
      console.log('Latest Design:', latestDesign ? 'Found' : 'Not Found');
      console.log('Raw Pricing Type:', Array.isArray(rawPricing) ? 'Array' : 'Object');
      console.log('Existing Pricing:', pricingObj);
      console.log('Pricing Keys:', Object.keys(pricingObj || {}));
      console.log('MetalPrice:', pricingObj?.MetalPrice);
      console.log('DiamondPrice:', pricingObj?.DiamondPrice);
      console.log('DiamondsPrice:', pricingObj?.DiamondsPrice);
      console.log('TotalPrice:', pricingObj?.TotalPrice);
      console.log('MetalWeight:', pricingObj?.MetalWeight);
      console.log('DiamondWeight:', pricingObj?.DiamondWeight);
      console.log('TotalPieces:', pricingObj?.TotalPieces);
      console.log('Loss:', pricingObj?.Loss);
      console.log('Labour:', pricingObj?.Labour);
      console.log('Duties:', pricingObj?.Duties);
      console.log('Stones:', pricingObj?.Stones?.length || 0);
      console.log('Full Pricing Object:', JSON.stringify(pricingObj, null, 2));
      console.log('==========================================');
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
    const excelUrl = `${API_BASE_URL}/api/enquiries/files/${designCode}.xlsx?download=true`;
    Alert.alert('Info', 'Download Excel functionality will be implemented');
    if (__DEV__) {
      console.log('Excel URL:', excelUrl);
    }
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
      console.warn('Backend Excel generation failed, using client-side Excel generation:', error.message);
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
      console.error('Error generating Excel file:', error);
      Alert.alert('Error', `Failed to generate Excel file: ${error.message}`);
    }
  };

  const handleSyncClientPricing = () => {
    // TODO: Implement sync functionality
    Alert.alert('Info', 'Sync Client Pricing functionality will be implemented');
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

          <View style={styles.stonesContainer}>
            {stones.length > 0 ? (
              stones.map((stone, index) => (
                <Card key={index} style={styles.stoneCard}>
                  <View style={styles.stoneCardHeader}>
                    <CustomText variant="label" style={styles.stoneCardTitle}>
                      Stone {index + 1}
                    </CustomText>
                    <TouchableOpacity
                      onPress={() => handleDeleteStone(index)}
                      style={styles.deleteStoneButton}
                    >
                      <Icon name="delete" size={20} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                  
                  <View style={styles.stoneFields}>
                  {/* Type Dropdown */}
                    <View style={styles.stoneField}>
                      <CustomText variant="caption" style={styles.stoneFieldLabel}>
                        Type *
                      </CustomText>
                    {renderTypeDropdown(index, stoneTypeOptions.find(opt => opt.value === stone.Type)?.label || '')}
                  </View>
                  
                    {/* Row 1: Color and Shape */}
                    <View style={styles.stoneFieldRow}>
                      <View style={[styles.stoneField, styles.stoneFieldHalf]}>
                        <CustomText variant="caption" style={styles.stoneFieldLabel}>
                          Color
                        </CustomText>
                  <TextInput
                          style={styles.stoneInput}
                    value={stone.Color || ''}
                    onChangeText={(value) => handleUpdateStone(index, 'Color', value)}
                          placeholder="Enter color"
                    placeholderTextColor={colors.textLight}
                  />
                      </View>
                  
                      <View style={[styles.stoneField, styles.stoneFieldHalf]}>
                        <CustomText variant="caption" style={styles.stoneFieldLabel}>
                          Shape
                        </CustomText>
                  <TextInput
                          style={styles.stoneInput}
                    value={stone.Shape || ''}
                    onChangeText={(value) => handleUpdateStone(index, 'Shape', value)}
                          placeholder="Enter shape"
                    placeholderTextColor={colors.textLight}
                  />
                      </View>
                    </View>
                    
                    {/* Row 2: MM Size and Sieve Size */}
                    <View style={styles.stoneFieldRow}>
                      <View style={[styles.stoneField, styles.stoneFieldHalf]}>
                        <CustomText variant="caption" style={styles.stoneFieldLabel}>
                          MM Size
                        </CustomText>
                  <TextInput
                          style={styles.stoneInput}
                    value={stone.MM || ''}
                    onChangeText={(value) => handleUpdateStone(index, 'MM', value)}
                          placeholder="0"
                    placeholderTextColor={colors.textLight}
                    keyboardType="numeric"
                  />
                      </View>
                  
                      <View style={[styles.stoneField, styles.stoneFieldHalf]}>
                        <CustomText variant="caption" style={styles.stoneFieldLabel}>
                          Sieve Size
                        </CustomText>
                  <TextInput
                          style={styles.stoneInput}
                    value={stone.Sieve || ''}
                    onChangeText={(value) => handleUpdateStone(index, 'Sieve', value)}
                          placeholder="0"
                    placeholderTextColor={colors.textLight}
                    keyboardType="numeric"
                  />
                      </View>
                    </View>
                    
                    {/* Row 3: Weight and Pieces */}
                    <View style={styles.stoneFieldRow}>
                      <View style={[styles.stoneField, styles.stoneFieldHalf]}>
                        <CustomText variant="caption" style={styles.stoneFieldLabel}>
                          Weight
                        </CustomText>
                  <TextInput
                          style={styles.stoneInput}
                    value={stone.Weight || '0'}
                    onChangeText={(value) => handleUpdateStone(index, 'Weight', value)}
                    placeholder="0"
                    placeholderTextColor={colors.textLight}
                    keyboardType="numeric"
                  />
                      </View>
                  
                      <View style={[styles.stoneField, styles.stoneFieldHalf]}>
                        <CustomText variant="caption" style={styles.stoneFieldLabel}>
                          Pieces
                        </CustomText>
                  <TextInput
                          style={styles.stoneInput}
                    value={stone.Pieces || '0'}
                    onChangeText={(value) => handleUpdateStone(index, 'Pieces', value)}
                    placeholder="0"
                    placeholderTextColor={colors.textLight}
                    keyboardType="numeric"
                        />
                      </View>
                    </View>
                    
                    {/* Row 4: Carat Weight and Price */}
                    <View style={styles.stoneFieldRow}>
                      <View style={[styles.stoneField, styles.stoneFieldHalf]}>
                        <CustomText variant="caption" style={styles.stoneFieldLabel}>
                          Carat Weight
                        </CustomText>
                  <TextInput
                          style={styles.stoneInput}
                    value={stone.CaratWeight || '0'}
                    onChangeText={(value) => handleUpdateStone(index, 'CaratWeight', value)}
                    placeholder="0"
                    placeholderTextColor={colors.textLight}
                    keyboardType="numeric"
                  />
                      </View>
                  
                      <View style={[styles.stoneField, styles.stoneFieldHalf]}>
                        <CustomText variant="caption" style={styles.stoneFieldLabel}>
                          Price
                        </CustomText>
                  <TextInput
                          style={styles.stoneInput}
                    value={stone.Price || '0'}
                    onChangeText={(value) => handleUpdateStone(index, 'Price', value)}
                    placeholder="0"
                    placeholderTextColor={colors.textLight}
                    keyboardType="numeric"
                        />
                </View>
                    </View>
                  </View>
                </Card>
              ))
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
                style={[styles.actionBtn, styles.actionBtnHalf, styles.saveBtn]}
                activeOpacity={0.8}
              >
                <View style={styles.btnContent}>
                  <Icon name="save" size={18} color={colors.textWhite} />
                  <Text style={styles.btnText}>Save</Text>
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
              style={[styles.actionBtn, styles.syncBtn]}
              activeOpacity={0.8}
            >
              <View style={styles.btnContent}>
                <Icon name="sync" size={20} color={colors.textWhite} />
                <Text style={styles.btnText}>Sync Client Pricing</Text>
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
  stonesContainer: {
    marginTop: 12,
    gap: 16,
  },
  stoneCard: {
    padding: 16,
    backgroundColor: colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stoneCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  stoneCardTitle: {
    fontSize: fonts.base,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
  },
  stoneFields: {
    gap: 12,
  },
  stoneField: {
    marginBottom: 0,
  },
  stoneFieldRow: {
    flexDirection: 'row',
    gap: 12,
  },
  stoneFieldHalf: {
    flex: 1,
  },
  stoneFieldLabel: {
    fontSize: fonts.xs,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  stoneInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: fonts.base,
    fontFamily: fonts.regular,
    color: colors.textPrimary,
    backgroundColor: colors.backgroundSecondary,
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    backgroundColor: colors.backgroundSecondary,
    minWidth: 100,
  },
  dropdownButtonText: {
    fontSize: fonts.xs,
    fontFamily: fonts.medium,
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

