import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Card } from '../../components/cards/Cards';
import { Input } from '../../components/common';
import { CustomText, Heading } from '../../components/common/Text';
import Icon from '../../components/common/Icon'; 
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import { formatCurrency } from '../../utils/helpers';
import { useGetMetalPricesQuery, useCalculatePricingMutation, useSavePricingMutation, useGetEnquiryByIdQuery, useGetStoneTypesQuery } from '../../store/api';
import { API_BASE_URL } from '../../config/apiConfig';
import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as XLSX from 'xlsx';
import { useAlert } from '../../context/AlertContext';

const PricingScreen = ({ route, navigation }) => {
  const { enquiry: routeEnquiry, designType, enquiryId } = route.params || {}; // designType: 'coral' or 'cad'
  
  // Alert context for better user feedback (may be null if not in AlertProvider)
  let alert = null;
  try {
    alert = useAlert();
  } catch (error) {
    // Alert context not available, will use native Alert.alert as fallback
    if (__DEV__) {
      console.warn('[PricingScreen] AlertContext not available, using native alerts');
    }
  }
  
  // Get enquiry ID
  const finalEnquiryId = enquiryId || routeEnquiry?.id || routeEnquiry?._id;
  
  // Fetch fresh enquiry data - this will refetch when cache is invalidated
  const { data: fetchedEnquiry, refetch: refetchEnquiry, isLoading: isLoadingEnquiry } = useGetEnquiryByIdQuery(finalEnquiryId, {
    skip: !finalEnquiryId,
    refetchOnFocus: true, // Refetch when screen comes into focus
    refetchOnMountOrArgChange: true, // Refetch when enquiryId changes
  });
  
  // Log when enquiry data is loaded
  useEffect(() => {
    if (fetchedEnquiry) {
      console.log('📥 [LOAD] ========== ENQUIRY DATA LOADED ==========');
      console.log('📥 [LOAD] Timestamp:', new Date().toISOString());
      console.log('📥 [LOAD] Enquiry ID:', fetchedEnquiry?.id || fetchedEnquiry?._id);
      console.log('📥 [LOAD] Design Type:', designType);
      
      const enquiryDesignData = designType === 'coral' 
        ? (fetchedEnquiry?.Coral || fetchedEnquiry?.coral || [])
        : (fetchedEnquiry?.Cad || fetchedEnquiry?.cad || []);
      
      console.log('📥 [LOAD] Design Data:', JSON.stringify(enquiryDesignData, null, 2));
      
      if (enquiryDesignData && enquiryDesignData.length > 0) {
        const latestDesignData = enquiryDesignData[enquiryDesignData.length - 1];
        const pricingData = latestDesignData?.Pricing || latestDesignData?.pricing || {};
        
        console.log('📥 [LOAD] Latest Design:', JSON.stringify(latestDesignData, null, 2));
        console.log('📥 [LOAD] Pricing Data:', JSON.stringify(pricingData, null, 2));
        
        if (Array.isArray(pricingData)) {
          console.log('📥 [LOAD] Pricing Entries Count:', pricingData.length);
          pricingData.forEach((entry, index) => {
            console.log(`📥 [LOAD] Pricing Entry ${index + 1}:`, JSON.stringify(entry, null, 2));
          });
        } else if (pricingData && typeof pricingData === 'object') {
          console.log('📥 [LOAD] Single Pricing Object:', JSON.stringify(pricingData, null, 2));
        }
      }
      
      console.log('📥 [LOAD] ========== ENQUIRY DATA LOAD COMPLETE ==========');
    }
  }, [fetchedEnquiry, designType]);

  // Fetch stone types from API
  const { data: stoneTypesData = [] } = useGetStoneTypesQuery();
  
  // Metal quality options
  const metalQualityOptions = [
    { label: '10K', value: '10K' },
    { label: '14K', value: '14K' },
    { label: '18K', value: '18K' },
    { label: '22K', value: '22K' },
    { label: 'Silver 925', value: 'Silver 925' },
    { label: 'Platinum', value: 'Platinum' },
  ];
  
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
  // Priority: Find version with pricing data, otherwise use latest version
  const latestDesign = useMemo(() => {
    if (!designData || designData.length === 0) return null;
    
    // First, try to find the latest version that has pricing data
    for (let i = designData.length - 1; i >= 0; i--) {
      const design = designData[i];
      const pricing = design?.Pricing || design?.pricing;
      
      // Check if this version has pricing data
      if (pricing && (
        (Array.isArray(pricing) && pricing.length > 0) ||
        (typeof pricing === 'object' && Object.keys(pricing).length > 0)
      )) {
        return design;
      }
    }
    
    // If no version has pricing, fall back to the latest version
    return designData[designData.length - 1];
  }, [designData]);
  
  // Memoize pricing extraction to ensure it updates when latestDesign changes
  const rawPricing = useMemo(() => {
    const pricing = latestDesign?.Pricing || latestDesign?.pricing || {};
    return pricing;
  }, [latestDesign]);
  
  // Get all pricing entries as an array
  const allPricingEntries = useMemo(() => {
    console.log('🔄 [STATE] Processing rawPricing:', JSON.stringify(rawPricing, null, 2));
    
    let entries = [];
    if (Array.isArray(rawPricing) && rawPricing.length > 0) {
      entries = rawPricing; // Return all pricing entries
      console.log('🔄 [STATE] Found array of pricing entries, count:', entries.length);
    } else if (rawPricing && typeof rawPricing === 'object' && Object.keys(rawPricing).length > 0) {
      entries = [rawPricing]; // Convert single object to array
      console.log('🔄 [STATE] Found single pricing object, converted to array');
    } else {
      entries = []; // Return empty array if no pricing
      console.log('🔄 [STATE] No pricing data found, returning empty array');
    }
    
    console.log('🔄 [STATE] allPricingEntries:', JSON.stringify(entries, null, 2));
    return entries;
  }, [rawPricing]);
  
  // Use the latest (last) pricing entry since new saves are appended to the array
  const existingPricing = useMemo(() => {
    return allPricingEntries.length > 0 ? allPricingEntries[allPricingEntries.length - 1] : {};
  }, [allPricingEntries]);
  
  
  // Normalize stones data - map API field names to UI field names
  // Memoized with useCallback to prevent function recreation on every render
  const normalizeStones = useCallback((rawStones) => {
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
  }, []);
  
  // Initialize state for all pricing entries - each entry has its own formData and stones
  // Memoized with useCallback to prevent function recreation on every render
  const initializePricingEntryState = useCallback((pricingEntry) => {
    // Get metal quality from pricing entry or fallback to enquiry
    const entryMetalQuality = pricingEntry?.Metal?.Quality || 
                              originalData?.Metal?.Quality || 
                              enquiry?.Metal?.Quality || 
                              '10K';
    
    return {
      formData: {
        metalPrice: (pricingEntry?.MetalPrice || pricingEntry?.metalPrice || 0).toString(),
        diamondPrice: (pricingEntry?.DiamondPrice || pricingEntry?.DiamondsPrice || pricingEntry?.diamondPrice || 0).toString(),
        totalPrice: (pricingEntry?.TotalPrice || pricingEntry?.totalPrice || 0).toString(),
        metalWeight: (pricingEntry?.Metal?.Weight || pricingEntry?.MetalWeight || pricingEntry?.metalWeight || 0).toString(),
        diamondWeight: (pricingEntry?.DiamondWeight || pricingEntry?.diamondWeight || 0).toString(),
        totalPieces: (pricingEntry?.TotalPieces || pricingEntry?.totalPieces || 0).toString(),
        lossPercent: (pricingEntry?.LossPercent || pricingEntry?.lossPercent || pricingEntry?.Loss || 0).toString(),
        labour: (pricingEntry?.Labour || pricingEntry?.labour || 0).toString(),
        duties: (pricingEntry?.Duties || pricingEntry?.duties || 0).toString(),
        extraCharges: (pricingEntry?.ExtraCharges || pricingEntry?.extraCharges || 0).toString(),
        undercutPrice: (pricingEntry?.UndercutPrice || pricingEntry?.undercutPrice || 0).toString(),
        clientPricingMessage: pricingEntry?.ClientPricingMessage || '',
        metalQuality: entryMetalQuality,
        metalRateOverride: (pricingEntry?.Metal?.Rate || pricingEntry?.MetalRate || '').toString(),
      },
      stones: normalizeStones(pricingEntry?.Stones || pricingEntry?.stones || []),
      undercutEnabled: !!(pricingEntry?.UndercutPrice || pricingEntry?.undercutPrice),
    };
  }, [normalizeStones, originalData, enquiry]);

  // State for all pricing entries - array of { formData, stones, undercutEnabled }
  const [pricingEntriesState, setPricingEntriesState] = useState(() => {
    console.log('🔄 [STATE] ========== INITIALIZING PRICING ENTRIES STATE ==========');
    console.log('🔄 [STATE] allPricingEntries.length:', allPricingEntries.length);
    console.log('🔄 [STATE] allPricingEntries:', JSON.stringify(allPricingEntries, null, 2));
    
    if (allPricingEntries.length > 0) {
      const initialized = allPricingEntries.map(entry => initializePricingEntryState(entry));
      console.log('🔄 [STATE] Initialized from existing entries:', JSON.stringify(initialized, null, 2));
      return initialized;
    }
    
    // If no existing entries, create one empty entry for new pricing
    const defaultMetalQuality = originalData?.Metal?.Quality || enquiry?.Metal?.Quality || '10K';
    const emptyEntry = [{
      formData: {
        metalPrice: '0',
        diamondPrice: '0',
        totalPrice: '0',
        metalWeight: '0',
        diamondWeight: '0',
        totalPieces: '0',
        lossPercent: '0',
        labour: '0',
        duties: '0',
        extraCharges: '0',
        undercutPrice: '0',
        clientPricingMessage: '',
        metalQuality: defaultMetalQuality,
        metalRateOverride: '',
      },
      stones: [],
      undercutEnabled: false,
    }];
    
    console.log('🔄 [STATE] Created empty entry (no existing entries):', JSON.stringify(emptyEntry, null, 2));
    console.log('🔄 [STATE] ========== STATE INITIALIZATION COMPLETE ==========');
    return emptyEntry;
  });
  
  // Update pricingEntriesState when allPricingEntries changes (e.g., after refetch)
  useEffect(() => {
    console.log('🔄 [STATE] ========== CHECKING IF STATE NEEDS UPDATE ==========');
    console.log('🔄 [STATE] Current pricingEntriesState.length:', pricingEntriesState.length);
    console.log('🔄 [STATE] Current allPricingEntries.length:', allPricingEntries.length);
    
    // Only update if allPricingEntries has changed and has data
    if (allPricingEntries.length > 0) {
      // Deep comparison: Check if data has actually changed by comparing all entries
      let hasChanged = pricingEntriesState.length !== allPricingEntries.length;
      
      if (!hasChanged) {
        // Compare each entry to detect any changes
        for (let i = 0; i < allPricingEntries.length; i++) {
          const currentEntry = pricingEntriesState[i];
          const newEntry = allPricingEntries[i];
          
          if (!currentEntry) {
            hasChanged = true;
            break;
          }
          
          // Compare key fields that might change
          const currentTotalPrice = currentEntry?.formData?.totalPrice;
          const newTotalPrice = (newEntry?.TotalPrice || newEntry?.totalPrice || 0).toString();
          
          const currentMessage = currentEntry?.formData?.clientPricingMessage || '';
          const newMessage = newEntry?.ClientPricingMessage || newEntry?.clientPricingMessage || '';
          
          const currentMetalPrice = currentEntry?.formData?.metalPrice;
          const newMetalPrice = (newEntry?.MetalPrice || newEntry?.metalPrice || 0).toString();
          
          const currentStonesCount = currentEntry?.stones?.length || 0;
          const newStonesCount = (newEntry?.Stones || newEntry?.stones || []).length;
          
          // Log detailed comparison for debugging
          console.log(`🔄 [STATE] Entry ${i + 1} comparison:`, {
            totalPrice: { current: currentTotalPrice, new: newTotalPrice, match: currentTotalPrice === newTotalPrice },
            message: { current: currentMessage, new: newMessage, match: currentMessage === newMessage, currentLength: currentMessage.length, newLength: newMessage.length },
            metalPrice: { current: currentMetalPrice, new: newMetalPrice, match: currentMetalPrice === newMetalPrice },
            stonesCount: { current: currentStonesCount, new: newStonesCount, match: currentStonesCount === newStonesCount },
          });
          
          // Check if any field has changed
          if (
            currentTotalPrice !== newTotalPrice ||
            currentMessage !== newMessage ||
            currentMetalPrice !== newMetalPrice ||
            currentStonesCount !== newStonesCount
          ) {
            hasChanged = true;
            console.log(`🔄 [STATE] ✅ Entry ${i + 1} CHANGED - will update state`);
            break;
          } else {
            console.log(`🔄 [STATE] ⏭️ Entry ${i + 1} unchanged - skipping update`);
          }
        }
      }
      
      console.log('🔄 [STATE] Has changed?', hasChanged);
      
      if (hasChanged) {
        console.log('🔄 [STATE] Updating state from allPricingEntries...');
        const updatedState = allPricingEntries.map(entry => initializePricingEntryState(entry));
        console.log('🔄 [STATE] Updated state:', JSON.stringify(updatedState, null, 2));
        setPricingEntriesState(updatedState);
        console.log('🔄 [STATE] ========== STATE UPDATE COMPLETE ==========');
      } else {
        console.log('🔄 [STATE] No update needed, data is the same');
      }
    } else if (allPricingEntries.length === 0 && pricingEntriesState.length > 0) {
      // If allPricingEntries is empty but state has data, check if we should clear it
      // Only clear if the first entry is also empty (all zeros)
      const firstEntryIsEmpty = 
        pricingEntriesState[0]?.formData?.totalPrice === '0' &&
        pricingEntriesState[0]?.formData?.metalPrice === '0' &&
        pricingEntriesState[0]?.stones?.length === 0;
      
      if (firstEntryIsEmpty) {
        console.log('🔄 [STATE] Clearing empty state...');
        const defaultMetalQuality = originalData?.Metal?.Quality || enquiry?.Metal?.Quality || '10K';
        setPricingEntriesState([{
          formData: {
            metalPrice: '0',
            diamondPrice: '0',
            totalPrice: '0',
            metalWeight: '0',
            diamondWeight: '0',
            totalPieces: '0',
            lossPercent: '0',
            labour: '0',
            duties: '0',
            extraCharges: '0',
            undercutPrice: '0',
            clientPricingMessage: '',
            metalQuality: defaultMetalQuality,
            metalRateOverride: '',
          },
          stones: [],
          undercutEnabled: false,
        }]);
      }
    }
    // NOTE: pricingEntriesState is NOT in dependencies to prevent overwriting user input while typing
    // This effect only runs when allPricingEntries changes (i.e., after API refetch)
  }, [allPricingEntries, initializePricingEntryState, originalData, enquiry]);

  // For backward compatibility, keep existing formData and stones for the latest/new entry
  const latestEntryIndex = pricingEntriesState.length - 1;
  const formData = pricingEntriesState[latestEntryIndex]?.formData || {
    metalPrice: '0', diamondPrice: '0', totalPrice: '0', metalWeight: '0',
    diamondWeight: '0', totalPieces: '0', lossPercent: '0', labour: '0',
    duties: '0', extraCharges: '0', undercutPrice: '0', clientPricingMessage: '',
    metalRateOverride: '',
  };
  const stones = pricingEntriesState[latestEntryIndex]?.stones || [];
  const undercutEnabled = pricingEntriesState[latestEntryIndex]?.undercutEnabled || false;

  // Helper to update formData (updates latest entry)
  const setFormData = (newFormData) => {
    setPricingEntriesState(prev => {
      const updated = [...prev];
      updated[latestEntryIndex] = {
        ...updated[latestEntryIndex],
        formData: typeof newFormData === 'function' ? newFormData(updated[latestEntryIndex].formData) : newFormData,
      };
      return updated;
    });
  };

  // Helper to update stones (updates latest entry)
  const setStones = (newStones) => {
    setPricingEntriesState(prev => {
      const updated = [...prev];
      updated[latestEntryIndex] = {
        ...updated[latestEntryIndex],
        stones: typeof newStones === 'function' ? newStones(updated[latestEntryIndex].stones) : newStones,
      };
      return updated;
    });
  };

  // Helper to set undercut enabled (updates latest entry)
  const setUndercutEnabled = (value) => {
    setPricingEntriesState(prev => {
      const updated = [...prev];
      updated[latestEntryIndex] = {
        ...updated[latestEntryIndex],
        undercutEnabled: typeof value === 'function' ? value(updated[latestEntryIndex].undercutEnabled) : value,
      };
      return updated;
    });
  };

  // Refetch enquiry data when screen comes into focus (after saving)
  useFocusEffect(
    React.useCallback(() => {
      if (finalEnquiryId) {
        
        // Refetch enquiry data to get latest pricing
        refetchEnquiry();
      }
    }, [finalEnquiryId, refetchEnquiry])
  );

  // NOTE: State update logic moved to the useEffect at line 259-355
  // This prevents duplicate updates and preserves user input when editing

  // Fetch latest metal prices - API is called automatically when component mounts
  const { data: metalPricesData, isLoading: loadingMetalPrices, refetch: refetchMetalPrices } = useGetMetalPricesQuery(false);
  const metalPrices = metalPricesData?.prices || metalPricesData || {};
  
  // Pricing calculation mutation
  const [calculatePricing, { isLoading: isCalculating }] = useCalculatePricingMutation();
  
  // Save pricing mutation
  const [savePricing, { isLoading: isSaving }] = useSavePricingMutation();
  
  // Sync client pricing loading state
  const [isSyncing, setIsSyncing] = useState(false);

  // Validation function to check if save should be disabled
  // Returns true if save should be disabled (i.e., if any price is 0)
  const shouldDisableSave = useCallback(() => {
    // Check all pricing entries
    for (const entryState of pricingEntriesState) {
      const entryFormData = entryState.formData;
      const entryStones = entryState.stones;
      
      // Check metal price
      const metalPrice = parseFloat(entryFormData.metalPrice) || 0;
      if (metalPrice === 0) {
        return true; // Disable save
      }
      
      // Check total price
      const totalPrice = parseFloat(entryFormData.totalPrice) || 0;
      if (totalPrice === 0) {
        return true; // Disable save
      }
      
      // Check if any stone has price === 0
      if (entryStones && entryStones.length > 0) {
        for (const stone of entryStones) {
          const stonePrice = parseFloat(stone.Price || stone.price || 0);
          if (stonePrice === 0) {
            return true; // Disable save
          }
        }
      }
    }
    
    return false; // Allow save
  }, [pricingEntriesState]);
  
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

  // Duties considered for quotation - provided by backend pricing (falls back to 0)
  const dutiesConsidered =
    parseFloat(existingPricing?.Duties ?? existingPricing?.duties ?? formData?.duties ?? 0) || 0;
  
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
    }
  }, [latestDesign, designType]);

  // Get design code for Excel filename
  const designCode = designType === 'coral'
    ? (originalData?.CoralCode || enquiry?.CoralCode || enquiry?.coralCode || '')
    : (originalData?.CadCode || enquiry?.CadCode || enquiry?.cadCode || '');

  const handleInputChange = useCallback((field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

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
      // Quantity comes from "Total Pieces" input field (formData.totalPieces)
      // const quantity = parseInt(formData.totalPieces);
      const quantity = 1;

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
        clientId: null, // Calculate button does not send client ID
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
          // Quantity is added to payload from "Total Pieces" input field (formData.totalPieces)
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


        Alert.alert('Success', 'Pricing calculated successfully');
      } else {
        Alert.alert('Success', 'Calculation completed');
      }
    } catch (error) {
      if (__DEV__) {
        console.error('Full error:', JSON.stringify(error, null, 2));
        console.error('Payload that was sent:', JSON.stringify(payload, null, 2));
      }
      
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
              // Payload details available in error message
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

  // Stone type options from API
  const stoneTypeOptions = stoneTypesData || [];

  // Individual stone filters for each pricing entry - { entryIndex: filterValue }
  const [entryStoneFilters, setEntryStoneFilters] = useState({});
  // Individual dropdown visibility for each pricing entry - { entryIndex: isVisible }
  const [entryFilterDropdowns, setEntryFilterDropdowns] = useState({});
  const [entryMetalQualityDropdowns, setEntryMetalQualityDropdowns] = useState({});
  // Modal state for editing pricing entry
  const [editingEntryIndex, setEditingEntryIndex] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  // Modal state for adding new pricing entry
  const [showAddModal, setShowAddModal] = useState(false);

  const stoneFilterOptions = useMemo(
    () => [{ label: 'All Stone Types', value: 'all' }, ...(stoneTypeOptions || [])],
    [stoneTypeOptions]
  );

  // Helper to get filter value for a specific entry
  const getEntryFilter = (entryIndex) => {
    return entryStoneFilters[entryIndex] || 'all';
  };

  // Helper to set filter value for a specific entry
  const setEntryFilter = (entryIndex, filterValue) => {
    setEntryStoneFilters(prev => ({
      ...prev,
      [entryIndex]: filterValue,
    }));
  };

  // Helper to toggle dropdown for a specific entry
  const toggleEntryFilterDropdown = (entryIndex) => {
    setEntryFilterDropdowns(prev => ({
      ...prev,
      [entryIndex]: !prev[entryIndex],
    }));
  };

  // Helper to toggle metal quality dropdown for a specific entry
  const toggleEntryMetalQualityDropdown = (entryIndex) => {
    setEntryMetalQualityDropdowns(prev => ({
      ...prev,
      [entryIndex]: !prev[entryIndex],
    }));
  };

  // Helper to get filtered stones for a given stones array and filter value
  // Memoized to avoid recalculating on every render
  const getFilteredStones = useCallback((stonesArray, filterValue = 'all') => {
    if (filterValue === 'all') {
      return stonesArray.map((stone, index) => ({ stone, originalIndex: index }));
    }
    return stonesArray
      .map((stone, index) => ({ stone, originalIndex: index }))
      .filter(({ stone }) => {
        const typeValue = (stone?.Type || '').toString().toLowerCase();
        return typeValue === filterValue.toLowerCase();
      });
  }, []);

  // For the latest entry (backward compatibility)
  const stonesToRender = useMemo(() => {
    const latestFilter = getEntryFilter(pricingEntriesState.length - 1);
    return getFilteredStones(stones, latestFilter);
  }, [stones, entryStoneFilters, pricingEntriesState.length]);

  const handleAddDiamond = useCallback(() => {
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
    setStones(prev => [...prev, newStone]);
  }, []);

  const handleUpdateStone = useCallback((index, field, value) => {
    setStones(prev => {
      const updatedStones = [...prev];
    updatedStones[index] = {
      ...updatedStones[index],
      [field]: value,
    };
      return updatedStones;
    });
  }, []);

  const handleDeleteStone = useCallback((index) => {
    Alert.alert(
      'Delete Stone',
      'Are you sure you want to delete this stone?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setStones(prev => prev.filter((_, i) => i !== index));
          },
        },
      ]
    );
  }, []);

  // State for dropdown modals - one per row
  const [openDropdowns, setOpenDropdowns] = useState({});

  const toggleDropdown = useCallback((index) => {
    setOpenDropdowns(prev => ({
      ...prev,
      [index]: !prev[index],
    }));
  }, []);

  const renderTypeDropdown = useCallback((identifier, selectedValue, entryIndex = null, stoneIndex = null) => {
    const isOpen = openDropdowns[identifier] || false;
    // If entryIndex and stoneIndex are provided, this is for a specific pricing entry
    // Otherwise, it's for the latest entry (backward compatibility)
    const handleTypeChange = (value) => {
      if (entryIndex !== null && stoneIndex !== null) {
        updatePricingEntryStone(entryIndex, stoneIndex, 'Type', value);
      } else {
        // Backward compatibility - update latest entry
        const latestIndex = pricingEntriesState.length - 1;
        handleUpdateStone(stoneIndex !== null ? stoneIndex : parseInt(identifier), 'Type', value);
      }
    };

    return (
      <View>
        <TouchableOpacity
          style={styles.dropdownButton}
          onPress={() => toggleDropdown(identifier)}
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
          onRequestClose={() => toggleDropdown(identifier)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => toggleDropdown(identifier)}
          >
            <View style={styles.dropdownModal}>
              <ScrollView 
                showsVerticalScrollIndicator={true}
                nestedScrollEnabled={true}
                style={styles.dropdownScrollView}
              >
              {stoneTypeOptions.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={styles.dropdownOption}
                  onPress={() => {
                      handleTypeChange(option.value);
                      toggleDropdown(identifier);
                  }}
                >
                  <Text style={styles.dropdownOptionText}>{option.label}</Text>
                </TouchableOpacity>
              ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>
      </View>
    );
  }, [openDropdowns, stoneTypeOptions, updatePricingEntryStone, handleUpdateStone, pricingEntriesState, toggleDropdown]);

  const handleSave = async (shouldNavigateBack = true) => {
    // Prevent multiple simultaneous saves
    if (isSaving) {
      if (__DEV__) {
        console.warn('⚠️ [handleSave] Save already in progress, ignoring duplicate call');
      }
      return;
    }
    
    console.log('💾 [SAVE] ========== STARTING SAVE OPERATION ==========');
    console.log('💾 [SAVE] Timestamp:', new Date().toISOString());
    
    try {
      // Get enquiry ID
      const enquiryId = enquiry?.id || enquiry?._id;
      
      console.log('💾 [SAVE] Enquiry ID:', enquiryId);
      console.log('💾 [SAVE] Design Type:', designType);
      console.log('💾 [SAVE] Current pricingEntriesState count:', pricingEntriesState.length);
      
      if (!enquiryId) {
        console.error('❌ [SAVE] ERROR: Enquiry ID is missing');
        Alert.alert('Error', 'Enquiry ID is missing');
        return;
      }

      // Get version from latest design
      // Send version exactly as it appears in the database (web sends as-is from this.data?.coral?.Version)
      // Database can have "3", "Version 3", "1", "Version 1", etc. - send exactly as stored
      let version = latestDesign?.Version || latestDesign?.version || '1';
      const versionToSend = version; // Send as-is, don't modify
      
      console.log('💾 [SAVE] Version:', versionToSend);
      console.log('💾 [SAVE] Latest Design:', JSON.stringify(latestDesign, null, 2));
      
      // Get metal details from enquiry (fallback only)
      const metalColor = originalData?.Metal?.Color || enquiry?.Metal?.Color || 'Gold';
      
      // Get default metal rate for fallback (from latest entry or metalRateConsidered)
      const defaultMetalWeight = parseFloat(formData.metalWeight) || 0;
      const defaultMetalPrice = parseFloat(formData.metalPrice) || 0;
      let defaultMetalRate = existingPricing?.Metal?.Rate || existingPricing?.MetalRate || 0;
      if (!defaultMetalRate || defaultMetalRate === 0) {
        defaultMetalRate = parseFloat(metalRateConsidered) || 0;
      }
      if (!defaultMetalRate || defaultMetalRate === 0) {
        defaultMetalRate = defaultMetalWeight > 0 ? defaultMetalPrice / defaultMetalWeight : 0;
      }
      
      // Convert all pricing entries from state to API format
      console.log('💾 [SAVE] Converting pricingEntriesState to API format...');
      console.log('💾 [SAVE] pricingEntriesState:', JSON.stringify(pricingEntriesState, null, 2));
      
      const pricingArray = pricingEntriesState.map((entryState, entryIndex) => {
        const entryFormData = entryState.formData;
        const entryStones = entryState.stones;
        const entryUndercutEnabled = entryState.undercutEnabled;
        
        console.log(`💾 [SAVE] Processing entry ${entryIndex + 1}:`, {
          formData: entryFormData,
          stonesCount: entryStones.length,
          undercutEnabled: entryUndercutEnabled,
        });
        
        // Get metal quality from entry state (per version), fallback to enquiry if not set
        const entryMetalQuality = entryFormData.metalQuality || 
                                  originalData?.Metal?.Quality || 
                                  enquiry?.Metal?.Quality || 
                                  '10K';
        
        // Get metal rate for this entry
        // Priority: metalRateOverride > original entry rate > calculated from price/weight > default
        const originalEntry = allPricingEntries[entryIndex];
        let entryMetalRate = 0;
        
        // First, check if user provided a metal rate override
        if (entryFormData.metalRateOverride && entryFormData.metalRateOverride.trim() !== '') {
          entryMetalRate = parseFloat(entryFormData.metalRateOverride) || 0;
        }
        
        // If no override, try to preserve from original entry
        if (!entryMetalRate || entryMetalRate === 0) {
          entryMetalRate = originalEntry?.Metal?.Rate || originalEntry?.MetalRate || 0;
        }
        
        // If still not found, calculate from price/weight, or use default
        if (!entryMetalRate || entryMetalRate === 0) {
          const entryMetalWeight = parseFloat(entryFormData.metalWeight) || 0;
          const entryMetalPrice = parseFloat(entryFormData.metalPrice) || 0;
          entryMetalRate = entryMetalWeight > 0 ? entryMetalPrice / entryMetalWeight : defaultMetalRate;
      }
      
      // Format stones data according to API structure
        const formattedStones = entryStones.map(stone => ({
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
      // IMPORTANT: Field order matches web payload structure exactly
      // Note: DutiesAmount is included in web payload but calculated by backend
      // We include it as null/0 to match web structure, backend will recalculate
        return {
          MetalPrice: parseFloat(entryFormData.metalPrice) || 0,
          DiamondsPrice: parseFloat(entryFormData.diamondPrice) || 0,
          TotalPrice: parseFloat(entryFormData.totalPrice) || 0,
          DutiesAmount: parseFloat(entryFormData.dutiesAmount) || 0, // Match web structure, backend will recalculate
          DiamondWeight: parseFloat(entryFormData.diamondWeight) || 0,
          TotalPieces: parseInt(entryFormData.totalPieces) || 0,
        Metal: {
            Weight: parseFloat(entryFormData.metalWeight) || 0,
          Quality: entryMetalQuality,
            Rate: entryMetalRate,
          },
          ExtraCharges: parseFloat(entryFormData.extraCharges) || 0,
          Duties: parseFloat(entryFormData.duties) || 0,
          Loss: parseFloat(entryFormData.lossPercent) || 0,
          Labour: parseFloat(entryFormData.labour) || 0,
          UndercutPrice: entryUndercutEnabled ? (parseFloat(entryFormData.undercutPrice) || 0) : 0,
        Stones: formattedStones,
          ClientPricingMessage: entryFormData.clientPricingMessage ? String(entryFormData.clientPricingMessage).trim() : null, // Match web: send null instead of empty string
        };
      });
      
      // Log each entry's ClientPricingMessage before sending with detailed info
      pricingArray.forEach((entry, idx) => {
        const msg = entry.ClientPricingMessage;
        console.log(`💾 [SAVE] Entry ${idx + 1} ClientPricingMessage:`, msg);
        console.log(`💾 [SAVE] Entry ${idx + 1} Message Details:`, {
          value: msg,
          type: typeof msg,
          length: msg?.length || 0,
          isString: typeof msg === 'string',
          isEmpty: !msg || msg.trim() === '',
          hasValue: !!msg && msg.trim() !== '',
        });
      });
      
      console.log('💾 [SAVE] ========== PAYLOAD TO SEND ==========');
      console.log('💾 [SAVE] Payload:', JSON.stringify({
          enquiryId,
          designType,
          version: versionToSend,
        pricingData: pricingArray,
      }, null, 2));
      console.log('💾 [SAVE] Pricing Array Length:', pricingArray.length);
      console.log('💾 [SAVE] Pricing Array:', JSON.stringify(pricingArray, null, 2));

      // Call API to save pricing
      console.log('💾 [SAVE] Calling savePricing API...');
      const saveResult = await savePricing({
        enquiryId,
        designType,
        version: versionToSend,
        pricingData: pricingArray,
      }).unwrap();
      
      console.log('💾 [SAVE] ========== API RESPONSE ==========');
      console.log('💾 [SAVE] Save Result:', JSON.stringify(saveResult, null, 2));

      // Refetch enquiry data to get updated pricing before navigating back
      if (finalEnquiryId) {
        console.log('💾 [SAVE] Refetching enquiry data...');
        // Add a delay to ensure backend has finished processing
        // Increased delay since backend seems to need more time to persist and return pricing data
        await new Promise(resolve => setTimeout(resolve, 2000));
        const refetchResult = await refetchEnquiry();
        console.log('💾 [SAVE] ========== REFETCH RESULT ==========');
        console.log('💾 [SAVE] Refetch Result:', JSON.stringify(refetchResult, null, 2));
        
        if (refetchResult?.data) {
          const refetchedEnquiry = refetchResult.data;
          const refetchedDesignData = designType === 'coral' 
            ? (refetchedEnquiry?.Coral || refetchedEnquiry?.coral || [])
            : (refetchedEnquiry?.Cad || refetchedEnquiry?.cad || []);
          
          console.log('💾 [SAVE] Refetched Design Data:', JSON.stringify(refetchedDesignData, null, 2));
          
          if (refetchedDesignData && refetchedDesignData.length > 0) {
            const refetchedLatestDesign = refetchedDesignData[refetchedDesignData.length - 1];
            const refetchedPricing = refetchedLatestDesign?.Pricing || refetchedLatestDesign?.pricing || {};
            
            console.log('💾 [SAVE] Refetched Latest Design:', JSON.stringify(refetchedLatestDesign, null, 2));
            console.log('💾 [SAVE] Refetched Pricing:', JSON.stringify(refetchedPricing, null, 2));
            
            if (Array.isArray(refetchedPricing)) {
              console.log('💾 [SAVE] Refetched Pricing Entries Count:', refetchedPricing.length);
              
              // Compare sent vs received ClientPricingMessage for each entry
              const saveIssues = [];
              refetchedPricing.forEach((entry, idx) => {
                const sentMessage = pricingArray[idx]?.ClientPricingMessage || '';
                const receivedMessage = entry.ClientPricingMessage || entry.clientPricingMessage || '';
                const message = receivedMessage;
                
                console.log(`💾 [SAVE] Refetched Entry ${idx + 1} ClientPricingMessage:`, message);
                console.log(`💾 [SAVE] Refetched Entry ${idx + 1} Full Entry:`, JSON.stringify({
                  MetalPrice: entry.MetalPrice,
                  TotalPrice: entry.TotalPrice,
                  ClientPricingMessage: message,
                }, null, 2));
                
                // Check if the message was saved correctly
                if (sentMessage && sentMessage.trim() !== '' && sentMessage !== receivedMessage) {
                  console.error(`💾 [SAVE] ❌ Entry ${idx + 1} ClientPricingMessage MISMATCH!`, {
                    sent: sentMessage,
                    received: receivedMessage,
                    issue: 'Backend did not save the ClientPricingMessage correctly',
                  });
                  saveIssues.push({
                    entryIndex: idx + 1,
                    sentMessage,
                    receivedMessage,
                  });
                }
              });
              
              // If there are save issues, show a warning
              if (saveIssues.length > 0) {
                console.error('💾 [SAVE] ❌ ========== SAVE ISSUES DETECTED ==========');
                console.error('💾 [SAVE] ❌ Some ClientPricingMessage fields were not saved correctly by the backend');
                console.error('💾 [SAVE] ❌ Issues:', saveIssues);
                console.error('💾 [SAVE] ❌ This is a BACKEND issue - the frontend sent the correct data');
                console.error('💾 [SAVE] ❌ ============================================');
              }
            }
          }
        }
      }
      
      console.log('💾 [SAVE] ========== SAVE SUCCESSFUL ==========');
      
      // Show success message with better feedback
      try {
        if (alert && alert.success) {
          alert.success(
            'Success!',
            'Pricing saved successfully. Your changes have been saved.',
            [
              {
                text: 'OK',
                onPress: () => {
                  // Navigate back only if shouldNavigateBack is true
                  if (shouldNavigateBack) {
                    console.log('💾 [SAVE] Navigating back...');
                    navigation.goBack();
                  }
                },
              },
            ]
          );
        } else {
          // Fallback to native alert if alert context not available
      Alert.alert(
        'Success',
        'Pricing saved successfully',
        [
          {
            text: 'OK',
            onPress: () => {
              // Navigate back only if shouldNavigateBack is true
              if (shouldNavigateBack) {
                    console.log('💾 [SAVE] Navigating back...');
                navigation.goBack();
              }
            },
          },
        ]
      );
        }
      } catch (alertError) {
        // If alert fails, use native alert
        console.error('💾 [SAVE] Alert error:', alertError);
        Alert.alert(
          'Success',
          'Pricing saved successfully',
          [
            {
              text: 'OK',
              onPress: () => {
                if (shouldNavigateBack) {
                  console.log('💾 [SAVE] Navigating back...');
                  navigation.goBack();
                }
              },
            },
          ]
        );
      }
      
      console.log('💾 [SAVE] ========== SAVE OPERATION COMPLETE ==========');
    } catch (error) {
      console.error('❌ [SAVE] ========== SAVE ERROR ==========');
      console.error('❌ [SAVE] Error Object:', JSON.stringify(error, null, 2));
      console.error('❌ [SAVE] Error Message:', error?.message);
      console.error('❌ [SAVE] Error Data:', error?.data);
      console.error('❌ [SAVE] Error Status:', error?.status);
      
      let errorMessage = 'Failed to save pricing. Please try again.';
      
      if (error?.data?.message) {
        errorMessage = error.data.message;
      } else if (error?.data?.error) {
        errorMessage = error.data.error;
      } else if (error?.message) {
        errorMessage = error.message;
      } else if (error?.status) {
        errorMessage = `Server error (${error.status}). Please try again.`;
      }
      
      console.error('❌ [SAVE] Final Error Message:', errorMessage);
      
      // Show error message with better feedback
      try {
        if (alert && alert.error) {
          alert.error('Save Failed', errorMessage);
        } else {
          // Fallback to native alert if alert context not available
      Alert.alert('Save Failed', errorMessage);
        }
      } catch (alertError) {
        // If alert fails, use native alert
        console.error('❌ [SAVE] Alert error:', alertError);
        Alert.alert('Save Failed', errorMessage);
      }
      
      console.error('❌ [SAVE] ========== SAVE OPERATION FAILED ==========');
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

  // Download pricing for a specific entry
  const handleDownloadPricingForEntry = async (pricingEntry, entryStones) => {
    if (entryStones.length === 0) {
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
      const stonesData = entryStones.map(stone => ({
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
        // Share modal is already opened in saveExcelFile function
      }
    } catch (error) {
      // Fallback to client-side Excel generation for this entry
      const entryStonesData = entryStones.map(stone => ({
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
      
      const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
      const excelFilename = designCode 
        ? `Pricing_${designCode}_${timestamp}.xlsx`
        : `Pricing_${timestamp}.xlsx`;
      
      // Generate Excel using XLSX library
      const ws = XLSX.utils.json_to_sheet(entryStonesData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Pricing');
      const wbout = XLSX.write(wb, { type: 'binary', bookType: 'xlsx' });
      
      // Convert to base64
      const base64 = btoa(wbout);
      const downloadPath = `${RNFS.DownloadDirectoryPath}/${excelFilename}`;
      
      // Write file to device
      await RNFS.writeFile(downloadPath, base64, 'base64');
      
      // Share/open the file using share modal
      try {
        await Share.open({
          url: `file://${downloadPath}`,
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          filename: excelFilename,
          title: 'Share Pricing Excel File',
          message: `Pricing data: ${excelFilename}`,
          subject: `Pricing Data - ${excelFilename}`,
        });
      } catch (shareError) {
        if (shareError.message !== 'User did not share') {
          Alert.alert(
            'Success',
            `Excel file generated successfully!\n\nSaved to: Downloads/${excelFilename}\n\nYou can share it from your file manager.`,
            [{ text: 'OK' }]
          );
        }
      }
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

  // Calculate pricing for a specific entry
  const handleCalculateForEntry = async (entryIndex) => {
    if (entryIndex === null || !pricingEntriesState[entryIndex]) {
      Alert.alert('Error', 'Invalid pricing entry');
      return;
    }
    
    try {
      const entryState = pricingEntriesState[entryIndex];
      const entryFormData = entryState.formData;
      const entryStones = entryState.stones;

      // Get metal details from enquiry
      const metalColor = originalData?.Metal?.Color || enquiry?.Metal?.Color || 'Gold';
      const metalQuality = entryFormData.metalQuality || originalData?.Metal?.Quality || enquiry?.Metal?.Quality || '10K';
      const metalWeight = parseFloat(entryFormData.metalWeight) || 0;
      
      // Get metal rate - use override if provided, otherwise calculate or use default
      let metalRate = null;
      if (entryFormData.metalRateOverride && entryFormData.metalRateOverride.trim() !== '') {
        metalRate = parseFloat(entryFormData.metalRateOverride);
      }

      // Transform stones array to match API format
      const transformedStones = entryStones.map((stone) => {
        if (!stone.Type || stone.Type.trim() === '') {
          return null;
        }

        return {
          Type: stone.Type.trim(),
          Color: stone.Color?.trim() || '',
          Shape: stone.Shape?.trim() || '',
          MmSize: stone.MM?.toString().trim() || '0',
          SieveSize: (stone.Sieve && stone.Sieve.trim() !== '') ? stone.Sieve.trim() : '', // Use empty string for empty sieve (matches web)
          CtWeight: parseFloat(stone.CaratWeight) || 0,
          Weight: parseFloat(stone.Weight) || 0,
          Pcs: parseInt(stone.Pieces) || 0,
          Price: parseFloat(stone.Price) || 0,
        };
      }).filter(stone => stone !== null && stone.Type);

      // Build payload
      const metalPayload = {
        Weight: metalWeight,
        Quality: metalQuality,
        Color: metalColor,
      };
      
      // Add Rate to Metal payload if override is provided
      if (metalRate !== null && !isNaN(metalRate)) {
        metalPayload.Rate = metalRate.toString();
      }

      // Get undercut price - use 0 if not enabled
      const entryUndercutEnabled = entryState.undercutEnabled || false;
      const undercutPrice = entryUndercutEnabled ? (parseFloat(entryFormData.undercutPrice) || 0) : 0;

      // Quantity should be the number of jewelry items, not total stone pieces
      const quantity = enquiry?.Quantity || enquiry?.quantity || 1;

      const payload = {
        clientId: null,
        details: {
          Metal: metalPayload,
          Stones: transformedStones,
          Loss: parseFloat(entryFormData.lossPercent) || 0,
          Labour: parseFloat(entryFormData.labour) || 0,
          ExtraCharges: parseFloat(entryFormData.extraCharges) || 0,
          Duties: parseFloat(entryFormData.duties) || 0,
          Quantity: parseInt(quantity) || 1,
          UndercutPrice: undercutPrice,
        },
      };

      // Call API to calculate pricing
      const response = await calculatePricing(payload).unwrap();
      
      // Log response for Calculate button
      console.log('=== CALCULATE BUTTON RESPONSE ===');
      console.log(JSON.stringify(response, null, 2));

      // Update the specific entry's form data with ALL response fields
      if (response) {
        // Update all fields in a single state update to ensure UI refreshes
        setPricingEntriesState(prev => {
          const updated = [...prev];
          if (!updated[entryIndex]) {
            return prev;
          }
          
          const currentFormData = updated[entryIndex].formData;
          const updatedFormData = { ...currentFormData };
          
          // OVERWRITE all pricing fields with calculated values from API response
          if (response.MetalPrice !== undefined && response.MetalPrice !== null) {
            updatedFormData.metalPrice = parseFloat(response.MetalPrice).toFixed(2);
          }
          
          if (response.DiamondsPrice !== undefined && response.DiamondsPrice !== null) {
            updatedFormData.diamondPrice = parseFloat(response.DiamondsPrice).toFixed(2);
          }
          
          if (response.TotalPrice !== undefined && response.TotalPrice !== null) {
            updatedFormData.totalPrice = parseFloat(response.TotalPrice).toFixed(2);
          }
          
          // Diamond Weight - This can be updated as it's calculated, not user input
          if (response.DiamondWeight !== undefined && response.DiamondWeight !== null) {
            updatedFormData.diamondWeight = parseFloat(response.DiamondWeight).toString();
          }
          
          // CRITICAL: Update stones based on API response
          // If API response includes Stones array, REPLACE entire stones table
          let updatedStones = updated[entryIndex].stones || [];
          
          if (response.Stones && Array.isArray(response.Stones) && response.Stones.length > 0) {
            // REPLACE entire stones array with stones from API response
            updatedStones = response.Stones.map((responseStone) => {
              const getResponsePrice = (rs) => {
                if (rs.Price !== undefined && rs.Price !== null) return rs.Price;
                if (rs.price !== undefined && rs.price !== null) return rs.price;
                return 0;
              };
              
              const normalizeMM = (mm) => {
                if (!mm) return '0';
                return mm.toString().trim();
              };
              
              return {
                Type: (responseStone.Type || responseStone.type || '').toString().trim(),
                Color: (responseStone.Color || responseStone.color || '').toString().trim(),
                Shape: (responseStone.Shape || responseStone.shape || '').toString().trim(),
                MM: normalizeMM(responseStone.MmSize || responseStone.MM || responseStone.mmSize || responseStone.mm || '0'),
                Sieve: (responseStone.SieveSize || responseStone.Sieve || responseStone.sieveSize || responseStone.sieve || '0').toString().trim(),
                Weight: (responseStone.Weight !== undefined && responseStone.Weight !== null) ? responseStone.Weight.toString() : '0',
                Pieces: (responseStone.Pcs !== undefined && responseStone.Pcs !== null) ? responseStone.Pcs.toString() : (responseStone.Pieces !== undefined && responseStone.Pieces !== null) ? responseStone.Pieces.toString() : '0',
                CaratWeight: (responseStone.CtWeight !== undefined && responseStone.CtWeight !== null) ? responseStone.CtWeight.toString() : (responseStone.CaratWeight !== undefined && responseStone.CaratWeight !== null) ? responseStone.CaratWeight.toString() : '0',
                Price: getResponsePrice(responseStone).toString(),
              };
            });
          }
          
          // Update the entry with BOTH form data AND stones in a single update
          updated[entryIndex] = {
            ...updated[entryIndex],
            formData: { ...updatedFormData },
            stones: [...updatedStones],
          };
          
          return updated;
        });
        
        Alert.alert('Success', 'All fields updated with calculated values');
      }
    } catch (error) {
      const errorMessage = error?.data?.message || error?.data?.error || error?.message || 'Failed to calculate pricing';
      Alert.alert('Error', errorMessage);
    }
  };

  // Sync client pricing for a specific entry
  const handleSyncClientPricingForEntry = async (entryIndex) => {
    if (entryIndex === null || !pricingEntriesState[entryIndex]) {
      Alert.alert('Error', 'Invalid pricing entry');
      return;
    }

    setIsSyncing(true);
    try {
      const entryState = pricingEntriesState[entryIndex];
      const entryFormData = entryState.formData;
      const entryStones = entryState.stones;

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

      // Get metal details - use formData quality (user can change it), fallback to enquiry
      const metalColor = originalData?.Metal?.Color || enquiry?.Metal?.Color || 'Gold';
      const metalQuality = entryFormData.metalQuality || originalData?.Metal?.Quality || enquiry?.Metal?.Quality || '10K';
      const metalWeight = parseFloat(entryFormData.metalWeight) || 0;

      // Get metal rate - use override if provided
      let metalRate = null;
      if (entryFormData.metalRateOverride && entryFormData.metalRateOverride.trim() !== '') {
        metalRate = parseFloat(entryFormData.metalRateOverride);
      }

      // Format stones array according to API specification
      const formattedStones = entryStones.map(stone => ({
        Type: stone.Type || '',
        Color: stone.Color || '',
        Shape: stone.Shape || '',
        MmSize: stone.MM || '0',
        SieveSize: stone.Sieve || '', // Use empty string for empty sieve (matches web)
        CtWeight: parseFloat(stone.CaratWeight) || 0,
        Weight: parseFloat(stone.Weight) || 0,
        Pcs: parseInt(stone.Pieces) || 0,
        Price: parseFloat(stone.Price) || 0,
      })).filter(stone => stone.Type); // Only include stones with Type

      // Get undercut price - use 0 if not enabled
      const entryUndercutEnabled = entryState.undercutEnabled || false;
      const undercutPrice = entryUndercutEnabled ? (parseFloat(entryFormData.undercutPrice) || 0) : 0;

      // Quantity should be the number of jewelry items, not total stone pieces
      const quantity = enquiry?.Quantity || enquiry?.quantity || 1;

      // Build Metal payload
      const metalPayload = {
        Weight: metalWeight,
        Quality: metalQuality,
      };

      // Add Rate to Metal payload if override is provided (matches web format)
      if (metalRate !== null && !isNaN(metalRate)) {
        metalPayload.Rate = metalRate.toString();
      }

      // Build payload according to API specification
      const payload = {
        clientId: clientId,
        details: {
          Metal: metalPayload,
          Stones: formattedStones,
          Loss: parseFloat(entryFormData.lossPercent) || 0,
          Labour: parseFloat(entryFormData.labour) || 0,
          ExtraCharges: parseFloat(entryFormData.extraCharges) || 0,
          Duties: parseFloat(entryFormData.duties) || 0,
          Quantity: parseInt(quantity) || 1,
          UndercutPrice: undercutPrice,
        },
      };

      // Call API to sync client pricing
      const response = await calculatePricing(payload).unwrap();

      // Log response for Sync Client Pricing button
      console.log('=== SYNC CLIENT PRICING BUTTON RESPONSE ===');
      console.log(JSON.stringify(response, null, 2));

      // Update the specific entry's form data with response
      if (response) {
        // Update metal price
        if (response.MetalPrice !== undefined && response.MetalPrice !== null) {
          updatePricingEntryFormData(entryIndex, 'metalPrice', parseFloat(response.MetalPrice).toFixed(2));
        }

        // Update diamonds price
        if (response.DiamondsPrice !== undefined && response.DiamondsPrice !== null) {
          updatePricingEntryFormData(entryIndex, 'diamondPrice', parseFloat(response.DiamondsPrice).toFixed(2));
        } else if (response.DiamondPrice !== undefined && response.DiamondPrice !== null) {
            updatePricingEntryFormData(entryIndex, 'diamondPrice', parseFloat(response.DiamondPrice).toFixed(2));
          } else {
            updatePricingEntryFormData(entryIndex, 'diamondPrice', '0.00');
        }

        // Update total price
        if (response.TotalPrice !== undefined && response.TotalPrice !== null) {
          updatePricingEntryFormData(entryIndex, 'totalPrice', parseFloat(response.TotalPrice).toFixed(2));
        } else {
          const metalPrice = parseFloat(response.MetalPrice || 0);
          const diamondsPrice = parseFloat(response.DiamondsPrice || response.DiamondPrice || 0);
          const totalPrice = (metalPrice + diamondsPrice).toFixed(2);
          updatePricingEntryFormData(entryIndex, 'totalPrice', totalPrice);
        }

        // Update metal weight if provided
        if (response.Metal?.Weight !== undefined) {
            updatePricingEntryFormData(entryIndex, 'metalWeight', response.Metal.Weight.toString());
        }

        // Update diamond weight
        if (response.DiamondWeight !== undefined) {
          updatePricingEntryFormData(entryIndex, 'diamondWeight', response.DiamondWeight.toString());
        }

        // Update client-specific charges if provided
        if (response.Client) {
          if (response.Client.Loss !== undefined) {
            updatePricingEntryFormData(entryIndex, 'lossPercent', response.Client.Loss.toString());
          }
          if (response.Client.Labour !== undefined) {
            updatePricingEntryFormData(entryIndex, 'labour', response.Client.Labour.toString());
          }
          if (response.Client.ExtraCharges !== undefined) {
            updatePricingEntryFormData(entryIndex, 'extraCharges', response.Client.ExtraCharges.toString());
          }
          if (response.Client.Duties !== undefined) {
            updatePricingEntryFormData(entryIndex, 'duties', response.Client.Duties.toString());
          }
        }

        // CRITICAL: Update stones based on API response
        if (response.Stones && Array.isArray(response.Stones) && response.Stones.length > 0) {
          // REPLACE entire stones array with stones from API response
          const updatedStones = response.Stones.map((responseStone) => {
            const getResponsePrice = (rs) => {
              if (rs.Price !== undefined && rs.Price !== null) {
                const price = typeof rs.Price === 'number' ? rs.Price : parseFloat(rs.Price);
                return isNaN(price) ? 0 : price;
              }
              if (rs.price !== undefined && rs.price !== null) {
                const price = typeof rs.price === 'number' ? rs.price : parseFloat(rs.price);
                return isNaN(price) ? 0 : price;
              }
              return 0;
            };
            
            const normalizeMM = (mm) => {
              if (!mm) return '0';
              return mm.toString().trim();
            };
            
            const responsePrice = getResponsePrice(responseStone);
            const priceStr = responsePrice.toString();
            
            return {
              Type: (responseStone.Type || responseStone.type || '').toString().trim(),
              Color: (responseStone.Color || responseStone.color || '').toString().trim(),
              Shape: (responseStone.Shape || responseStone.shape || '').toString().trim(),
              MM: normalizeMM(responseStone.MmSize || responseStone.MM || responseStone.mmSize || responseStone.mm || '0'),
              Sieve: (responseStone.SieveSize || responseStone.Sieve || responseStone.sieveSize || responseStone.sieve || '0').toString().trim(),
              Weight: (responseStone.Weight !== undefined && responseStone.Weight !== null) ? responseStone.Weight.toString() : '0',
              Pieces: (responseStone.Pcs !== undefined && responseStone.Pcs !== null) ? responseStone.Pcs.toString() : (responseStone.Pieces !== undefined && responseStone.Pieces !== null) ? responseStone.Pieces.toString() : '0',
              CaratWeight: (responseStone.CtWeight !== undefined && responseStone.CtWeight !== null) ? responseStone.CtWeight.toString() : (responseStone.CaratWeight !== undefined && responseStone.CaratWeight !== null) ? responseStone.CaratWeight.toString() : '0',
              Price: priceStr,
            };
          });
          
          // Update the entry's stones array
          setPricingEntriesState(prev => {
            const updated = [...prev];
            updated[entryIndex] = {
              ...updated[entryIndex],
              stones: [...updatedStones],
            };
            return updated;
          });
        } else {
          // API response does NOT include Stones array - RESET all stone prices to 0
          setPricingEntriesState(prev => {
            const updated = [...prev];
            const existingStones = updated[entryIndex].stones || [];
            
            const updatedStones = existingStones.map((stone) => {
              return {
                ...stone,
                Price: '0',
              };
            });
            
            updated[entryIndex] = {
              ...updated[entryIndex],
              stones: [...updatedStones],
            };
            
            return updated;
          });
        }

        Alert.alert('Success', 'Client pricing synced successfully');
      }
    } catch (error) {
      const errorMessage = error?.data?.message || error?.message || 'Failed to sync client pricing';
      Alert.alert('Error', errorMessage);
    } finally {
      setIsSyncing(false);
    }
  };

  // Legacy handleSyncClientPricing - kept for backward compatibility but now uses entry-specific function
  const handleSyncClientPricing = async () => {
    // If we're in edit modal, use entry-specific function
    if (editingEntryIndex !== null && pricingEntriesState[editingEntryIndex]) {
      await handleSyncClientPricingForEntry(editingEntryIndex);
      return;
    }
    
    // Otherwise, use the first entry or show error
    if (pricingEntriesState.length > 0) {
      await handleSyncClientPricingForEntry(0);
    } else {
      Alert.alert('Error', 'No pricing entries available');
    }
  };

  // Function to get pricing entry label
  const getPricingEntryLabel = (pricingEntry, index) => {
    const entryNumber = index + 1;
    if (pricingEntry?.ClientPricingMessage) {
      return `Pricing Entry #${entryNumber} - ${pricingEntry.ClientPricingMessage}`;
    }
    return `Pricing Entry #${entryNumber}`;
  };

  // Helper to update a specific pricing entry's formData - memoized
  const updatePricingEntryFormData = useCallback((index, field, value) => {
    setPricingEntriesState(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        formData: {
          ...updated[index].formData,
          [field]: value,
        },
      };
      return updated;
    });
  }, []);

  // Helper to update a specific pricing entry's stones - memoized
  const updatePricingEntryStone = useCallback((entryIndex, stoneIndex, field, value) => {
    setPricingEntriesState(prev => {
      const updated = [...prev];
      const newStones = [...updated[entryIndex].stones];
      newStones[stoneIndex] = {
        ...newStones[stoneIndex],
        [field]: value,
      };
      updated[entryIndex] = {
        ...updated[entryIndex],
        stones: newStones,
      };
      return updated;
    });
  }, []);

  // Helper to add a stone to a specific pricing entry - memoized
  const addStoneToPricingEntry = useCallback((entryIndex) => {
    setPricingEntriesState(prev => {
      const updated = [...prev];
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
      updated[entryIndex] = {
        ...updated[entryIndex],
        stones: [...updated[entryIndex].stones, newStone],
      };
      return updated;
    });
  }, []);

  // Helper to delete a stone from a specific pricing entry - memoized
  const deleteStoneFromPricingEntry = useCallback((entryIndex, stoneIndex) => {
    setPricingEntriesState(prev => {
      const updated = [...prev];
      updated[entryIndex] = {
        ...updated[entryIndex],
        stones: updated[entryIndex].stones.filter((_, i) => i !== stoneIndex),
      };
      return updated;
    });
  }, []);

  // Function to render an editable pricing entry
  const renderEditablePricingEntry = (entryState, index, originalPricingEntry) => {
    const entryFormData = entryState.formData;
    const entryStones = entryState.stones;
    const entryUndercutEnabled = entryState.undercutEnabled;
    const pricingMetalRate = originalPricingEntry?.Metal?.Rate || originalPricingEntry?.MetalRate || 0;
    
    
    return (
      <Card key={index} style={styles.pricingEntryCard}>
        <Heading level={4} style={styles.pricingEntryTitle}>
          {getPricingEntryLabel(originalPricingEntry, index)} - Editable
        </Heading>
        
        {/* Metal Rate and Quality Info for this pricing entry */}
        <View style={styles.pricingEntryInfo}>
          {pricingMetalRate > 0 && (
            <CustomText variant="body" style={styles.pricingEntryInfoText}>
              Metal Rate: ${pricingMetalRate.toFixed(2)} per gram
            </CustomText>
          )}
          <CustomText variant="body" style={styles.pricingEntryInfoText}>
            Metal Quality: {entryFormData.metalQuality || '10K'}
          </CustomText>
          {originalPricingEntry?.DutiesAmount !== undefined && (
            <CustomText variant="body" style={styles.pricingEntryInfoText}>
              DutiesAmount: ${originalPricingEntry.DutiesAmount.toFixed(2)}
            </CustomText>
          )}
        </View>
        
        {/* Editable Pricing Details Grid */}
        <View style={styles.pricingGrid}>
          {/* Row 1 */}
          <View style={styles.inputRowThree}>
            <Input
              label="Metal Price*"
              value={entryFormData.metalPrice}
              onChangeText={(value) => updatePricingEntryFormData(index, 'metalPrice', value)}
              keyboardType="numeric"
              style={styles.gridInputThird}
            />
            <Input
              label="Diamonds Price*"
              value={entryFormData.diamondPrice}
              onChangeText={(value) => updatePricingEntryFormData(index, 'diamondPrice', value)}
              keyboardType="numeric"
              style={styles.gridInputThird}
            />
            <Input
              label="Total Price*"
              value={entryFormData.totalPrice}
              onChangeText={(value) => updatePricingEntryFormData(index, 'totalPrice', value)}
              keyboardType="numeric"
              style={styles.gridInputThird}
              editable={true}
            />
          </View>

          {/* Row 2 */}
          <View style={styles.inputRowThree}>
            <Input
              label="Metal Weight"
              value={entryFormData.metalWeight}
              onChangeText={(value) => updatePricingEntryFormData(index, 'metalWeight', value)}
              keyboardType="numeric"
              style={styles.gridInputThird}
            />
            <Input
              label="Diamond Weight"
              value={entryFormData.diamondWeight}
              onChangeText={(value) => updatePricingEntryFormData(index, 'diamondWeight', value)}
              keyboardType="numeric"
              style={styles.gridInputThird}
            />
            <Input
              label="Total Pieces"
              value={entryFormData.totalPieces}
              onChangeText={(value) => updatePricingEntryFormData(index, 'totalPieces', value)}
              keyboardType="numeric"
              style={styles.gridInputThird}
            />
          </View>

          {/* Row 3 */}
          <View style={styles.inputRowFour}>
            <Input
              label="Loss (%)"
              value={entryFormData.lossPercent}
              onChangeText={(value) => updatePricingEntryFormData(index, 'lossPercent', value)}
              keyboardType="numeric"
              style={styles.gridInputQuarter}
            />
            <Input
              label="Labour"
              value={entryFormData.labour}
              onChangeText={(value) => updatePricingEntryFormData(index, 'labour', value)}
              keyboardType="numeric"
              style={styles.gridInputQuarter}
            />
            <Input
              label="Duties"
              value={entryFormData.duties}
              onChangeText={(value) => updatePricingEntryFormData(index, 'duties', value)}
              keyboardType="numeric"
              style={styles.gridInputQuarter}
            />
            <Input
              label="Extra Charges"
              value={entryFormData.extraCharges}
              onChangeText={(value) => updatePricingEntryFormData(index, 'extraCharges', value)}
              keyboardType="numeric"
              style={styles.gridInputQuarter}
            />
          </View>
        </View>

        {/* Editable Stones Table for this pricing entry */}
        <View style={styles.pricingEntryStonesContainer}>
          <View style={styles.stonesHeader}>
            <Heading level={5} style={styles.pricingEntryStonesTitle}>Stones</Heading>
            <TouchableOpacity
              onPress={() => addStoneToPricingEntry(index)}
              style={[styles.stonesButton, styles.addButton]}
              activeOpacity={0.8}
            >
              <View style={styles.stonesBtnContent}>
                <Icon name="add" size={18} color={colors.textWhite} />
                <Text style={styles.stonesBtnText}>Add Stone</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Change Stone Type and Metal Quality for All Stones in this pricing entry */}
          <View style={styles.stoneFilterRow}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.stoneFilterLabel}>Change All Stones</Text>
              <TouchableOpacity
                style={styles.stoneFilterButton}
                onPress={() => toggleEntryFilterDropdown(index)}
                activeOpacity={0.8}
              >
                <Text style={styles.stoneFilterButtonText} numberOfLines={1}>
                  Select Stone Type
                </Text>
                <Icon name="arrow-drop-down" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={styles.stoneFilterLabel}>Metal Quality</Text>
              <TouchableOpacity
                style={styles.stoneFilterButton}
                onPress={() => toggleEntryMetalQualityDropdown(index)}
                activeOpacity={0.8}
              >
                <Text style={styles.stoneFilterButtonText} numberOfLines={1}>
                  {entryFormData.metalQuality || 'Select Quality'}
                </Text>
                <Icon name="arrow-drop-down" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Metal Rate Override */}
          <View style={styles.metalRateOverrideContainer}>
            <Text style={styles.stoneFilterLabel}>Metal Rate Override</Text>
            <TextInput
              style={styles.metalRateOverrideInput}
              placeholder="Enter metal rate (optional)"
              placeholderTextColor={colors.textLight}
              value={entryFormData.metalRateOverride || ''}
              onChangeText={(value) => updatePricingEntryFormData(index, 'metalRateOverride', value)}
              keyboardType="numeric"
            />
          </View>

          <Modal
            visible={entryFilterDropdowns[index] || false}
            transparent
            animationType="fade"
            onRequestClose={() => toggleEntryFilterDropdown(index)}
          >
            <TouchableOpacity
              style={styles.modalOverlay}
              activeOpacity={1}
              onPress={() => toggleEntryFilterDropdown(index)}
            >
              <View style={styles.dropdownModal}>
                <ScrollView 
                  showsVerticalScrollIndicator={true}
                  nestedScrollEnabled={true}
                  style={styles.dropdownScrollView}
                >
                  {stoneTypeOptions.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={styles.dropdownOption}
                      onPress={() => {
                        // Update all stones' Type to the selected value
                        // Use setPricingEntriesState directly to update all stones at once
                        setPricingEntriesState(prev => {
                          const updated = [...prev];
                          if (updated[index] && updated[index].stones.length > 0) {
                            updated[index] = {
                              ...updated[index],
                              stones: updated[index].stones.map(stone => ({
                                ...stone,
                                Type: option.value,
                              })),
                            };
                          }
                          return updated;
                        });
                        toggleEntryFilterDropdown(index);
                      }}
                    >
                      <Text style={styles.dropdownOptionText}>{option.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </TouchableOpacity>
          </Modal>

          {/* Metal Quality Dropdown Modal */}
          <Modal
            visible={entryMetalQualityDropdowns[index] || false}
            transparent
            animationType="fade"
            onRequestClose={() => toggleEntryMetalQualityDropdown(index)}
          >
            <TouchableOpacity
              style={styles.modalOverlay}
              activeOpacity={1}
              onPress={() => toggleEntryMetalQualityDropdown(index)}
            >
              <View style={styles.dropdownModal}>
                <ScrollView 
                  showsVerticalScrollIndicator={true}
                  nestedScrollEnabled={true}
                  style={styles.dropdownScrollView}
                >
                  {metalQualityOptions.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={styles.dropdownOption}
                      onPress={() => {
                        // Update metal quality for this pricing entry
                        updatePricingEntryFormData(index, 'metalQuality', option.value);
                        toggleEntryMetalQualityDropdown(index);
                      }}
                    >
                      <Text style={styles.dropdownOptionText}>{option.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </TouchableOpacity>
          </Modal>
          
          {entryStones.length > 0 ? (
              <View style={styles.tableWrapper}>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={true}
                  style={styles.tableScrollContainer}
                >
                  <View>
                    {/* Table Header - same as in main form */}
                    <View style={styles.tableHeader}>
                      <View style={[styles.tableHeaderCell, styles.tableCellNumber]}>
                        <CustomText variant="caption" style={styles.tableHeaderText}>#</CustomText>
                      </View>
                      <View style={[styles.tableHeaderCell, styles.tableCellType]}>
                        <CustomText variant="caption" style={styles.tableHeaderText}>Type</CustomText>
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
                    
                    {/* Table Body - Editable */}
                    <View style={styles.tableBody}>
                      {entryStones.map((stone, originalIndex) => (
                      <View key={originalIndex} style={[styles.tableRow, originalIndex % 2 === 1 && styles.tableRowEven]}>
                        <View style={[styles.tableCell, styles.tableCellNumber]}>
                          <CustomText variant="body" style={styles.tableCellText}>
                            {originalIndex + 1}
                          </CustomText>
                        </View>
                        <View style={[styles.tableCell, styles.tableCellType]}>
                          {renderTypeDropdown(`${index}-${originalIndex}`, stoneTypeOptions.find(opt => opt.value === stone.Type)?.label || '', index, originalIndex)}
                        </View>
                        <View style={[styles.tableCell, styles.tableCellSmall]}>
                          <TextInput
                            style={styles.tableInput}
                            value={stone.Color || ''}
                            onChangeText={(value) => updatePricingEntryStone(index, originalIndex, 'Color', value)}
                            placeholder="Color"
                            placeholderTextColor={colors.textLight}
                          />
                        </View>
                        <View style={[styles.tableCell, styles.tableCellSmall]}>
                          <TextInput
                            style={styles.tableInput}
                            value={stone.Shape || ''}
                            onChangeText={(value) => updatePricingEntryStone(index, originalIndex, 'Shape', value)}
                            placeholder="Shape"
                            placeholderTextColor={colors.textLight}
                          />
                        </View>
                        <View style={[styles.tableCell, styles.tableCellSmall]}>
                          <TextInput
                            style={styles.tableInput}
                            value={stone.MM || ''}
                            onChangeText={(value) => updatePricingEntryStone(index, originalIndex, 'MM', value)}
                            placeholder="0"
                            placeholderTextColor={colors.textLight}
                            keyboardType="numeric"
                          />
                        </View>
                        <View style={[styles.tableCell, styles.tableCellMedium]}>
                          <TextInput
                            style={styles.tableInput}
                            value={stone.Sieve || ''}
                            onChangeText={(value) => updatePricingEntryStone(index, originalIndex, 'Sieve', value)}
                            placeholder="0"
                            placeholderTextColor={colors.textLight}
                            keyboardType="numeric"
                          />
                        </View>
                        <View style={[styles.tableCell, styles.tableCellSmall]}>
                          <TextInput
                            style={styles.tableInput}
                            value={stone.Weight || '0'}
                            onChangeText={(value) => updatePricingEntryStone(index, originalIndex, 'Weight', value)}
                            placeholder="0"
                            placeholderTextColor={colors.textLight}
                            keyboardType="numeric"
                          />
                        </View>
                        <View style={[styles.tableCell, styles.tableCellSmall]}>
                          <TextInput
                            style={styles.tableInput}
                            value={stone.Pieces || '0'}
                            onChangeText={(value) => updatePricingEntryStone(index, originalIndex, 'Pieces', value)}
                            placeholder="0"
                            placeholderTextColor={colors.textLight}
                            keyboardType="numeric"
                          />
                        </View>
                        <View style={[styles.tableCell, styles.tableCellSmall]}>
                          <TextInput
                            style={styles.tableInput}
                            value={stone.CaratWeight || '0'}
                            onChangeText={(value) => updatePricingEntryStone(index, originalIndex, 'CaratWeight', value)}
                            placeholder="0"
                            placeholderTextColor={colors.textLight}
                            keyboardType="numeric"
                          />
                        </View>
                        <View style={[styles.tableCell, styles.tableCellSmall]}>
                          <TextInput
                            style={styles.tableInput}
                            value={stone.Price || '0'}
                            onChangeText={(value) => updatePricingEntryStone(index, originalIndex, 'Price', value)}
                            placeholder="0"
                            placeholderTextColor={colors.textLight}
                            keyboardType="numeric"
                          />
                        </View>
                        <View style={[styles.tableCell, styles.tableCellAction]}>
                          <TouchableOpacity
                            onPress={() => {
                              Alert.alert(
                                'Delete Stone',
                                'Are you sure you want to delete this stone?',
                                [
                                  { text: 'Cancel', style: 'cancel' },
                                  {
                                    text: 'Delete',
                                    style: 'destructive',
                                    onPress: () => deleteStoneFromPricingEntry(index, originalIndex),
                                  },
                                ]
                              );
                            }}
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
              <CustomText variant="body" style={styles.noStonesText}>
                No stones added yet. Click "Add Stone" to add stones.
              </CustomText>
            )}
        </View>

        {/* Client Pricing Message Section */}
        <View style={styles.messageCard}>
          <CustomText variant="label" style={styles.messageLabel}>
            Client Pricing Message
          </CustomText>
          <View style={styles.messageInputWrapper}>
            <TextInput
              style={styles.messageInput}
              placeholder="Enter client pricing message..."
              placeholderTextColor={colors.textLight}
              value={entryFormData.clientPricingMessage || ''}
              onChangeText={(value) => updatePricingEntryFormData(index, 'clientPricingMessage', value)}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>
        </View>
      </Card>
    );
  };

  // Function to render a single pricing entry (read-only display) - kept for backward compatibility
  const renderPricingEntry = (pricingEntry, index) => {
    const pricingStones = normalizeStones(pricingEntry?.Stones || pricingEntry?.stones || []);
    const pricingMetalRate = pricingEntry?.Metal?.Rate || pricingEntry?.MetalRate || 0;
    
    return (
      <View key={index}>
        {/* Metal Rate and Quality Info for this pricing entry */}
        <View style={styles.pricingEntryInfo}>
          {pricingMetalRate > 0 && (
            <CustomText variant="body" style={styles.pricingEntryInfoText}>
              Metal Rate: ${pricingMetalRate.toFixed(2)} per gram
            </CustomText>
          )}
          <CustomText variant="body" style={styles.pricingEntryInfoText}>
            Metal Quality: {pricingEntry?.Metal?.Quality || originalData?.Metal?.Quality || enquiry?.Metal?.Quality || '10K'}
          </CustomText>
          {pricingEntry?.DutiesAmount !== undefined && (
            <CustomText variant="body" style={styles.pricingEntryInfoText}>
              DutiesAmount: ${pricingEntry.DutiesAmount.toFixed(2)}
            </CustomText>
          )}
        </View>
        
        {/* Pricing Details Grid */}
        <View style={styles.pricingGrid}>
          {/* Row 1 */}
          <View style={styles.inputRowThree}>
            <View style={styles.gridInputThird}>
              <CustomText variant="label" style={styles.pricingEntryLabel}>Metal Price</CustomText>
              <CustomText variant="body" style={styles.pricingEntryValue}>
                ${(pricingEntry?.MetalPrice || pricingEntry?.metalPrice || 0).toFixed(2)}
              </CustomText>
            </View>
            <View style={styles.gridInputThird}>
              <CustomText variant="label" style={styles.pricingEntryLabel}>Diamonds Price</CustomText>
              <CustomText variant="body" style={styles.pricingEntryValue}>
                ${(pricingEntry?.DiamondsPrice || pricingEntry?.DiamondPrice || pricingEntry?.diamondsPrice || pricingEntry?.diamondPrice || 0).toFixed(2)}
              </CustomText>
            </View>
            <View style={styles.gridInputThird}>
              <CustomText variant="label" style={styles.pricingEntryLabel}>Total Price</CustomText>
              <CustomText variant="body" style={styles.pricingEntryValue}>
                ${(pricingEntry?.TotalPrice || pricingEntry?.totalPrice || 0).toFixed(2)}
              </CustomText>
            </View>
          </View>

          {/* Row 2 */}
          <View style={styles.inputRowThree}>
            <View style={styles.gridInputThird}>
              <CustomText variant="label" style={styles.pricingEntryLabel}>Metal Weight</CustomText>
              <CustomText variant="body" style={styles.pricingEntryValue}>
                {(pricingEntry?.Metal?.Weight || pricingEntry?.MetalWeight || pricingEntry?.metalWeight || 0).toFixed(3)}
              </CustomText>
            </View>
            <View style={styles.gridInputThird}>
              <CustomText variant="label" style={styles.pricingEntryLabel}>Diamond Weight</CustomText>
              <CustomText variant="body" style={styles.pricingEntryValue}>
                {(pricingEntry?.DiamondWeight || pricingEntry?.diamondWeight || 0).toFixed(3)}
              </CustomText>
            </View>
            <View style={styles.gridInputThird}>
              <CustomText variant="label" style={styles.pricingEntryLabel}>Total Pieces</CustomText>
              <CustomText variant="body" style={styles.pricingEntryValue}>
                {pricingEntry?.TotalPieces || pricingEntry?.totalPieces || 0}
              </CustomText>
            </View>
          </View>

          {/* Row 3 */}
          <View style={styles.inputRowFour}>
            <View style={styles.gridInputQuarter}>
              <CustomText variant="label" style={styles.pricingEntryLabel}>Loss (%)</CustomText>
              <CustomText variant="body" style={styles.pricingEntryValue}>
                {(pricingEntry?.Loss || pricingEntry?.lossPercent || pricingEntry?.loss || 0).toFixed(1)}%
              </CustomText>
            </View>
            <View style={styles.gridInputQuarter}>
              <CustomText variant="label" style={styles.pricingEntryLabel}>Labour</CustomText>
              <CustomText variant="body" style={styles.pricingEntryValue}>
                ${(pricingEntry?.Labour || pricingEntry?.labour || 0).toFixed(2)}
              </CustomText>
            </View>
            <View style={styles.gridInputQuarter}>
              <CustomText variant="label" style={styles.pricingEntryLabel}>Duties</CustomText>
              <CustomText variant="body" style={styles.pricingEntryValue}>
                {(pricingEntry?.Duties || pricingEntry?.duties || 0).toFixed(2)}%
              </CustomText>
            </View>
            <View style={styles.gridInputQuarter}>
              <CustomText variant="label" style={styles.pricingEntryLabel}>Extra Charges</CustomText>
              <CustomText variant="body" style={styles.pricingEntryValue}>
                ${(pricingEntry?.ExtraCharges || pricingEntry?.extraCharges || 0).toFixed(2)}
              </CustomText>
            </View>
          </View>
        </View>

        {/* Stones Table for this pricing entry */}
        {pricingStones.length > 0 && (
          <View style={styles.pricingEntryStonesContainer}>
            <Heading level={5} style={styles.pricingEntryStonesTitle}>Stones</Heading>
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
                      <CustomText variant="caption" style={styles.tableHeaderText}>Type</CustomText>
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
                  </View>
                  
                  {/* Table Body */}
                  <View style={styles.tableBody}>
                    {pricingStones.map((stone, stoneIndex) => (
                      <View key={stoneIndex} style={[styles.tableRow, stoneIndex % 2 === 1 && styles.tableRowEven]}>
                        <View style={[styles.tableCell, styles.tableCellNumber]}>
                          <CustomText variant="body" style={styles.tableCellText}>
                            {stoneIndex + 1}
                          </CustomText>
                        </View>
                        <View style={[styles.tableCell, styles.tableCellType]}>
                          <CustomText variant="body" style={styles.tableCellText}>
                            {stone.Type || '-'}
                          </CustomText>
                        </View>
                        <View style={[styles.tableCell, styles.tableCellSmall]}>
                          <CustomText variant="body" style={styles.tableCellText}>
                            {stone.Color || '-'}
                          </CustomText>
                        </View>
                        <View style={[styles.tableCell, styles.tableCellSmall]}>
                          <CustomText variant="body" style={styles.tableCellText}>
                            {stone.Shape || '-'}
                          </CustomText>
                        </View>
                        <View style={[styles.tableCell, styles.tableCellSmall]}>
                          <CustomText variant="body" style={styles.tableCellText}>
                            {stone.MM || '-'}
                          </CustomText>
                        </View>
                        <View style={[styles.tableCell, styles.tableCellMedium]}>
                          <CustomText variant="body" style={styles.tableCellText}>
                            {stone.Sieve || '-'}
                          </CustomText>
                        </View>
                        <View style={[styles.tableCell, styles.tableCellSmall]}>
                          <CustomText variant="body" style={styles.tableCellText}>
                            {parseFloat(stone.Weight || 0).toFixed(3)}
                          </CustomText>
                        </View>
                        <View style={[styles.tableCell, styles.tableCellSmall]}>
                          <CustomText variant="body" style={styles.tableCellText}>
                            {stone.Pieces || 0}
                          </CustomText>
                        </View>
                        <View style={[styles.tableCell, styles.tableCellSmall]}>
                          <CustomText variant="body" style={styles.tableCellText}>
                            {parseFloat(stone.CaratWeight || 0).toFixed(3)}
                          </CustomText>
                        </View>
                        <View style={[styles.tableCell, styles.tableCellSmall]}>
                          <CustomText variant="body" style={styles.tableCellText}>
                            ${parseFloat(stone.Price || 0).toFixed(2)}
                          </CustomText>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              </ScrollView>
            </View>
          </View>
        )}
      </View>
    );
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
              {/* The Metal Rate considered for quotation was ${metalRateConsidered.toFixed(2)} per gram.{'\n'} */}
              The Latest Metal Rate is ${latestMetalRate.toFixed(2)} per gram.{'\n'}
              Please click on calculate to update calculations according to latest rates.{'\n'}
              {/* The Duties considered for quotation was ${dutiesConsidered.toFixed(2)}. */}
            </CustomText>
          )}
        </Card>

        {/* Display All Existing Pricing Entries - View Mode with Edit Button */}
        <View style={styles.allPricingEntriesContainer}>
          <Heading level={4} style={styles.allPricingEntriesTitle}>
            Pricing Entries ({allPricingEntries.length})
          </Heading>
          <View style={styles.pricingButtonsContainer}>
            {allPricingEntries.length > 0 && (
              <TouchableOpacity
                style={[styles.addPricingButton, styles.copyPricingButton]}
                onPress={() => {
                  // Copy the last pricing entry
                  const lastPricingEntry = allPricingEntries[allPricingEntries.length - 1];
                  if (lastPricingEntry) {
                    // Initialize state from the last pricing entry (deep copy)
                    const copiedEntryState = initializePricingEntryState(lastPricingEntry);
                    
                    // Deep copy stones array to avoid reference issues
                    const copiedStones = copiedEntryState.stones.map(stone => ({ ...stone }));
                    
                    const newEntryState = {
                      formData: { ...copiedEntryState.formData },
                      stones: copiedStones,
                      undercutEnabled: copiedEntryState.undercutEnabled,
                    };
                    
                    // Calculate the new index before updating state
                    const newIndex = pricingEntriesState.length;
                    
                    // Add to state temporarily for editing
                    setPricingEntriesState(prev => [...prev, newEntryState]);
                    setEditingEntryIndex(newIndex);
                    setShowAddModal(true);
                  }
                }}
                activeOpacity={0.8}
              >
                <Icon name="content-copy" size={20} color={colors.textWhite} />
                <Text style={styles.addPricingButtonText}>Copy Last Pricing</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.addPricingButton}
              onPress={() => {
                // Create a new empty pricing entry
                const defaultMetalQuality = originalData?.Metal?.Quality || enquiry?.Metal?.Quality || '10K';
                const newEntryState = {
                  formData: {
                    metalPrice: '0',
                    diamondPrice: '0',
                    totalPrice: '0',
                    metalWeight: '0',
                    diamondWeight: '0',
                    totalPieces: '0',
                    lossPercent: '0',
                    labour: '0',
                    duties: '0',
                    extraCharges: '0',
                    undercutPrice: '0',
                    clientPricingMessage: '',
                    metalQuality: defaultMetalQuality,
                  },
                  stones: [],
                  undercutEnabled: false,
                };
                // Add to state temporarily for editing
                setPricingEntriesState(prev => [...prev, newEntryState]);
                setEditingEntryIndex(pricingEntriesState.length);
                setShowAddModal(true);
              }}
              activeOpacity={0.8}
            >
              <Icon name="add" size={20} color={colors.textWhite} />
              <Text style={styles.addPricingButtonText}>+ Add Pricing</Text>
            </TouchableOpacity>
          </View>
          {pricingEntriesState.length > 0 ? (
            pricingEntriesState.map((entryState, index) => {
              // Convert state format to raw format for renderPricingEntry
              const entryFormData = entryState.formData;
              const entryStones = entryState.stones;
              // Get original pricing entry to access DutiesAmount
              const originalEntry = allPricingEntries[index] || {};
              const pricingEntry = {
                MetalPrice: parseFloat(entryFormData.metalPrice) || 0,
                DiamondsPrice: parseFloat(entryFormData.diamondPrice) || 0,
                TotalPrice: parseFloat(entryFormData.totalPrice) || 0,
                DutiesAmount: originalEntry?.DutiesAmount !== undefined ? parseFloat(originalEntry.DutiesAmount) : (parseFloat(entryFormData.dutiesAmount) || 0),
                DiamondWeight: parseFloat(entryFormData.diamondWeight) || 0,
                TotalPieces: parseInt(entryFormData.totalPieces) || 0,
                Metal: {
                  Weight: parseFloat(entryFormData.metalWeight) || 0,
                  Quality: entryFormData.metalQuality || '10K',
                  Rate: parseFloat(entryFormData.metalRateOverride) || 0,
                },
                Loss: parseFloat(entryFormData.lossPercent) || 0,
                Labour: parseFloat(entryFormData.labour) || 0,
                Duties: parseFloat(entryFormData.duties) || 0,
                ExtraCharges: parseFloat(entryFormData.extraCharges) || 0,
                ClientPricingMessage: entryFormData.clientPricingMessage || '',
                Stones: entryStones.map(stone => ({
                  Type: stone.Type || '',
                  Color: stone.Color || '',
                  Shape: stone.Shape || '',
                  MmSize: stone.MM || '',
                  SieveSize: stone.Sieve || '',
                  CtWeight: parseFloat(stone.CaratWeight) || 0,
                  Weight: parseFloat(stone.Weight) || 0,
                  Pcs: parseInt(stone.Pieces) || 0,
                  Price: parseFloat(stone.Price) || 0,
                })),
              };
              
              return (
                <Card key={index} style={styles.pricingEntryCard}>
                  <View style={styles.pricingEntryHeader}>
                    <Heading level={4} style={styles.pricingEntryTitle}>
                      {getPricingEntryLabel(pricingEntry, index)}
                    </Heading>
                    <TouchableOpacity
                      style={styles.editButton}
                      onPress={() => {
                        setEditingEntryIndex(index);
                        setShowEditModal(true);
                      }}
                      activeOpacity={0.8}
                    >
                      <Icon name="edit" size={18} color={colors.primary} />
                      <Text style={styles.editButtonText}>Edit</Text>
                    </TouchableOpacity>
                  </View>
                  {renderPricingEntry(pricingEntry, index)}
                  
                  {/* Download Button for View Mode */}
                  <View style={styles.pricingEntryActions}>
                    <TouchableOpacity
                      onPress={() => {
                        // Download pricing for this specific entry
                        handleDownloadPricingForEntry(pricingEntry, entryStones);
                      }}
                      style={[styles.pricingEntryActionButton, styles.downloadButton]}
                      activeOpacity={0.8}
                    >
                      <Icon name="file-download" size={18} color={colors.textWhite} />
                      <Text style={styles.pricingEntryActionButtonText}>Download Pricing</Text>
                    </TouchableOpacity>
                  </View>
                </Card>
              );
            })
          ) : (
            <Card style={styles.pricingEntryCard}>
              <CustomText variant="body" style={styles.noPricingText}>
                No pricing entries yet. Click "Add Pricing" to create your first pricing entry.
              </CustomText>
            </Card>
          )}
        </View>

        {/* Modal for Editing Pricing Entry */}
        <Modal
          visible={showEditModal}
          animationType="slide"
          transparent={false}
          onRequestClose={() => {
            setShowEditModal(false);
            setEditingEntryIndex(null);
          }}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Heading level={3} style={styles.modalTitle}>
                Edit Pricing Entry {editingEntryIndex !== null ? editingEntryIndex + 1 : ''}
              </Heading>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => {
                  setShowEditModal(false);
                  setEditingEntryIndex(null);
                }}
                activeOpacity={0.8}
              >
                <Icon name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalContentContainer}>
              {editingEntryIndex !== null && pricingEntriesState[editingEntryIndex] && (
                renderEditablePricingEntry(
                  pricingEntriesState[editingEntryIndex],
                  editingEntryIndex,
                  allPricingEntries[editingEntryIndex]
                )
              )}
            </ScrollView>
            <View style={styles.modalFooter}>
              <View style={styles.modalFooterTopRow}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelModalButton]}
                  onPress={() => {
                    setShowEditModal(false);
                    setEditingEntryIndex(null);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.modalButtonText, styles.cancelModalButtonText]}>Close</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modalButton, 
                    styles.saveModalButton,
                    (isSaving || shouldDisableSave()) && styles.btnDisabled
                  ]}
                  onPress={async () => {
                    try {
                      // Save without navigating back (stay on pricing screen)
                      await handleSave(false);
                      // Close modal after successful save
                      setShowEditModal(false);
                      setEditingEntryIndex(null);
                    } catch (error) {
                      // Error is already handled in handleSave
                      // Modal stays open so user can fix and retry
                    }
                  }}
                  disabled={isSaving || shouldDisableSave()}
                  activeOpacity={0.7}
                >
                  {isSaving ? (
                    <View style={styles.saveButtonContent}>
                      <ActivityIndicator size="small" color={colors.textWhite} style={styles.saveButtonSpinner} />
                  <Text style={[
                    styles.modalButtonText, 
                        styles.saveModalButtonText,
                        (isSaving || shouldDisableSave()) && styles.disabledButtonText
                  ]}>
                        Saving...
                  </Text>
                    </View>
                  ) : (
                    <Text style={[
                      styles.modalButtonText, 
                      styles.saveModalButtonText,
                      (isSaving || shouldDisableSave()) && styles.disabledButtonText
                    ]}>
                      Save Changes
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
              
              {/* Calculate and Sync Buttons */}
              <View style={styles.modalFooterActionRow}>
                <TouchableOpacity
                  onPress={async () => {
                    if (editingEntryIndex !== null && pricingEntriesState[editingEntryIndex]) {
                      await handleCalculateForEntry(editingEntryIndex);
                    } else {
                      Alert.alert('Error', 'Please select a valid pricing entry to calculate');
                    }
                  }}
                  disabled={isCalculating || isSyncing}
                  style={[styles.modalActionButton, styles.calculateBtn, (isCalculating || isSyncing) && styles.btnDisabled]}
                  activeOpacity={0.7}
                >
                  <Icon name="calculate" size={16} color={colors.textWhite} />
                  <Text style={styles.modalActionButtonText}>
                    {isCalculating ? "Calculating..." : "Calculate"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={async () => {
                    if (editingEntryIndex !== null && pricingEntriesState[editingEntryIndex]) {
                      await handleSyncClientPricingForEntry(editingEntryIndex);
                    }
                  }}
                  disabled={isCalculating || isSyncing}
                  style={[styles.modalActionButton, styles.syncBtn, (isCalculating || isSyncing) && styles.btnDisabled]}
                  activeOpacity={0.7}
                >
                  <Icon name="sync" size={16} color={colors.textWhite} />
                  <Text style={styles.modalActionButtonText}>
                    {isSyncing ? 'Syncing...' : 'Sync Client Pricing'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Modal for Adding New Pricing Entry */}
        <Modal
          visible={showAddModal}
          animationType="slide"
          transparent={false}
          onRequestClose={() => {
            setShowAddModal(false);
            // Remove the temporary new entry if modal is closed without saving
            if (editingEntryIndex !== null && editingEntryIndex >= allPricingEntries.length) {
              setPricingEntriesState(prev => prev.slice(0, -1));
            }
            setEditingEntryIndex(null);
          }}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Heading level={3} style={styles.modalTitle}>
                Add New Pricing Entry
              </Heading>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => {
                  setShowAddModal(false);
                  // Remove the temporary new entry if modal is closed without saving
                  if (editingEntryIndex !== null && editingEntryIndex >= allPricingEntries.length) {
                    setPricingEntriesState(prev => prev.slice(0, -1));
                  }
                  setEditingEntryIndex(null);
                }}
                activeOpacity={0.8}
              >
                <Icon name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalContentContainer}>
              {editingEntryIndex !== null && pricingEntriesState[editingEntryIndex] && (
                renderEditablePricingEntry(
                  pricingEntriesState[editingEntryIndex],
                  editingEntryIndex,
                  null // No original pricing entry for new entries
                )
              )}
            </ScrollView>
            <View style={styles.modalFooter}>
              <View style={styles.modalFooterTopRow}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelModalButton]}
                  onPress={() => {
                    setShowAddModal(false);
                    // Remove the temporary new entry if modal is closed without saving
                    if (editingEntryIndex !== null && editingEntryIndex >= allPricingEntries.length) {
                      setPricingEntriesState(prev => prev.slice(0, -1));
                    }
                    setEditingEntryIndex(null);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.modalButtonText, styles.cancelModalButtonText]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modalButton, 
                    styles.saveModalButton,
                    (isSaving || shouldDisableSave()) && styles.btnDisabled
                  ]}
                  onPress={async () => {
                    try {
                      // Save the new pricing entry
                      await handleSave(false);
                      // Close modal after successful save
                      setShowAddModal(false);
                      setEditingEntryIndex(null);
                    } catch (error) {
                      // Error is already handled in handleSave
                      // Modal stays open so user can fix and retry
                    }
                  }}
                  disabled={isSaving || shouldDisableSave()}
                  activeOpacity={0.7}
                >
                  {isSaving ? (
                    <View style={styles.saveButtonContent}>
                      <ActivityIndicator size="small" color={colors.textWhite} style={styles.saveButtonSpinner} />
                  <Text style={[
                    styles.modalButtonText, 
                        styles.saveModalButtonText,
                        (isSaving || shouldDisableSave()) && styles.disabledButtonText
                  ]}>
                        Saving...
                  </Text>
                    </View>
                  ) : (
                    <Text style={[
                      styles.modalButtonText, 
                      styles.saveModalButtonText,
                      (isSaving || shouldDisableSave()) && styles.disabledButtonText
                    ]}>
                      Save New Pricing
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
              
              {/* Calculate and Sync Buttons */}
              <View style={styles.modalFooterActionRow}>
                <TouchableOpacity
                  onPress={async () => {
                    if (editingEntryIndex !== null && pricingEntriesState[editingEntryIndex]) {
                      await handleCalculateForEntry(editingEntryIndex);
                    } else {
                      Alert.alert('Error', 'Please select a valid pricing entry to calculate');
                    }
                  }}
                  disabled={isCalculating}
                  style={[styles.modalActionButton, styles.calculateBtn, isCalculating && styles.btnDisabled]}
                  activeOpacity={0.7}
                >
                  <Icon name="calculate" size={16} color={colors.textWhite} />
                  <Text style={styles.modalActionButtonText}>
                    {isCalculating ? "Calculating..." : "Calculate"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={async () => {
                    if (editingEntryIndex !== null && pricingEntriesState[editingEntryIndex]) {
                      await handleSyncClientPricingForEntry(editingEntryIndex);
                    }
                  }}
                  disabled={isSyncing}
                  style={[styles.modalActionButton, styles.syncBtn, isSyncing && styles.btnDisabled]}
                  activeOpacity={0.7}
                >
                  <Icon name="sync" size={16} color={colors.textWhite} />
                  <Text style={styles.modalActionButtonText}>
                    {isSyncing ? 'Syncing...' : 'Sync Client Pricing'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Pricing Input Fields - REMOVED (only shown in modals now) */}
        {/* All form sections (Pricing Details, Stones, Action Buttons) removed from main screen */}
        {/* All editing happens in modals - use "Add Pricing" button or "Edit" button on existing entries */}
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
  inputRowThree: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'nowrap',
  },
  gridInputThird: {
    flexBasis: '32%',
  },
  inputRowFour: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'nowrap',
  },
  gridInputQuarter: {
    flexBasis: '24%',
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
  stoneFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 12,
  },
  stoneFilterLabel: {
    flex: 1,
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: fonts.sm,
  },
  stoneFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minWidth: 170,
    backgroundColor: colors.backgroundSecondary,
  },
  stoneFilterButtonText: {
    flex: 1,
    marginRight: 4,
    fontFamily: fonts.medium,
  },
  metalRateOverrideContainer: {
    marginBottom: 12,
  },
  metalRateOverrideInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: fonts.base,
    fontFamily: fonts.regular,
    color: colors.textPrimary,
    backgroundColor: colors.background,
    marginTop: 8,
    color: colors.textPrimary,
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
    // Removed maxHeight to allow all stone rows to be visible and scrollable
  },
  tableBody: {
    backgroundColor: colors.background,
  },
  noFilteredDataRow: {
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noFilteredDataText: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
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
    maxWidth: '80%',
    maxHeight: '70%',
    shadowColor: colors.textPrimary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  dropdownScrollView: {
    maxHeight: 400,
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
    marginBottom: 20,
    padding: 20,
    backgroundColor: colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  messageLabel: {
    marginBottom: 12,
    fontSize: fonts.base,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
  },
  messageInputWrapper: {
    marginTop: 8,
  },
  messageInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: fonts.base,
    fontFamily: fonts.regular,
    color: colors.textPrimary,
    backgroundColor: colors.background,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  messageDisplayBox: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.background,
    minHeight: 60,
    marginTop: 8,
  },
  messageDisplayText: {
    fontSize: fonts.base,
    fontFamily: fonts.regular,
    color: colors.textPrimary,
    lineHeight: 20,
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
    shadowColor: colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  syncBtn: {
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  btnDisabled: {
    opacity: 0.5,
    shadowOpacity: 0.1,
    elevation: 1,
  },
  filterCard: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  allPricingEntriesContainer: {
    marginBottom: 24,
  },
  allPricingEntriesTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: fonts.xl,
    marginBottom: 16,
  },
  pricingButtonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  addPricingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.primary,
    gap: 8,
    minHeight: 44,
    flex: 1,
    minWidth: 140,
  },
  copyPricingButton: {
    backgroundColor: colors.accent || '#D4AF37',
  },
  addPricingButtonText: {
    color: colors.textWhite,
    fontFamily: fonts.bold,
    fontSize: fonts.base,
  },
  noPricingText: {
    textAlign: 'center',
    color: colors.textSecondary,
    padding: 20,
    fontFamily: fonts.medium,
  },
  pricingEntryCard: {
    marginBottom: 20,
    padding: 20,
    backgroundColor: colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pricingEntryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },
  pricingEntryTitle: {
    flex: 1,
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: fonts.lg,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.primary + '20',
    gap: 6,
  },
  editButtonText: {
    color: colors.primary,
    fontFamily: fonts.medium,
    fontSize: fonts.sm,
  },
  pricingEntryActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  pricingEntryActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
    flex: 1,
    minWidth: '30%',
  },
  pricingEntryActionButtonText: {
    color: colors.textWhite,
    fontFamily: fonts.medium,
    fontSize: fonts.sm,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 50,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    flex: 1,
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: fonts.xl,
  },
  closeButton: {
    padding: 8,
  },
  modalContent: {
    flex: 1,
  },
  modalContentContainer: {
    padding: 20,
  },
  modalFooter: {
    padding: 20,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  modalFooterTopRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  modalFooterActionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.textPrimary,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    minHeight: 44,
  },
  cancelModalButton: {
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  saveModalButton: {
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  modalButtonText: {
    fontFamily: fonts.bold,
    fontSize: 15,
    letterSpacing: 0.3,
  },
  cancelModalButtonText: {
    color: colors.textPrimary,
  },
  saveModalButtonText: {
    color: colors.textWhite,
  },
  disabledButtonText: {
    opacity: 0.5,
  },
  saveButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveButtonSpinner: {
    marginRight: 0,
  },
  saveButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveButtonSpinner: {
    marginRight: 0,
  },
  modalActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    gap: 8,
    shadowColor: colors.textPrimary,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
    minHeight: 42,
  },
  modalActionButtonText: {
    color: colors.textWhite,
    fontFamily: fonts.semibold || fonts.bold,
    fontSize: 14,
    letterSpacing: 0.2,
  },
  pricingEntryInfo: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 8,
  },
  pricingEntryInfoText: {
    color: colors.textSecondary,
    fontSize: fonts.sm,
    fontFamily: fonts.medium,
  },
  pricingEntryLabel: {
    marginBottom: 4,
    color: colors.textSecondary,
    fontSize: fonts.xs,
    fontFamily: fonts.medium,
  },
  pricingEntryValue: {
    color: colors.textPrimary,
    fontSize: fonts.base,
    fontFamily: fonts.bold,
  },
  pricingEntryStonesContainer: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  pricingEntryStonesTitle: {
    marginBottom: 12,
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: fonts.base,
  },
});

export default PricingScreen;