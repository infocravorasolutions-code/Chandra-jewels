import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Text,
  Alert,
  TextInput,
  ActivityIndicator,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import { Input, Button } from '../../components/common';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useGetClientByIdQuery, useUpdateClientPricingMutation } from '../../store/api';
import RNFS from 'react-native-fs';
import * as XLSX from 'xlsx';

// DocumentPicker is optional
let DocumentPicker;
try {
  DocumentPicker = require('react-native-document-picker').default;
} catch (e) {
  DocumentPicker = null;
}

const ClientPricingScreen = ({ route, navigation }) => {
  const { clientId, clientName } = route.params || {};
  const [loss, setLoss] = useState('0');
  const [labour, setLabour] = useState('0');
  const [extraCharges, setExtraCharges] = useState('0');
  const [duties, setDuties] = useState('0');
  const [diamonds, setDiamonds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isDownloadingExcel, setIsDownloadingExcel] = useState(false);
  const [isImportingExcel, setIsImportingExcel] = useState(false);

  // Fetch client data
  const { data: clientData, isLoading: isLoadingClient, refetch } = useGetClientByIdQuery(clientId, {
    skip: !clientId,
  });

  const [updateClientPricing, { isLoading: isUpdating }] = useUpdateClientPricingMutation();

  // Initialize form data when client data is loaded
  useEffect(() => {
    if (clientData) {
      const pricing = clientData.Pricing || clientData.pricing || {};
      setLoss(pricing.Loss?.toString() || pricing.loss?.toString() || '0');
      setLabour(pricing.Labour?.toString() || pricing.labour?.toString() || '0');
      setExtraCharges(pricing.ExtraCharges?.toString() || pricing.extraCharges?.toString() || '0');
      setDuties(pricing.Duties?.toString() || pricing.duties?.toString() || '0');
      
      const diamondsData = pricing.Diamonds || pricing.diamonds || [];
      setDiamonds(diamondsData.length > 0 ? diamondsData : []);
    }
  }, [clientData]);

  const handleAddDiamond = () => {
    setDiamonds([
      ...diamonds,
      {
        Type: '',
        Shape: '',
        Carat: 0,
        MmSize: 0,
        SieveSize: '',
        Price: 0,
      },
    ]);
  };

  const handleDeleteDiamond = (index) => {
    Alert.alert(
      'Delete Diamond',
      'Are you sure you want to delete this diamond entry?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const newDiamonds = diamonds.filter((_, i) => i !== index);
            setDiamonds(newDiamonds);
          },
        },
      ]
    );
  };

  const handleDiamondChange = (index, field, value) => {
    const newDiamonds = diamonds.map((diamond, i) => {
      if (i === index) {
        // Create a new object for the modified diamond
        const updatedDiamond = { ...diamond };
        if (field === 'Carat' || field === 'MmSize' || field === 'Price') {
          updatedDiamond[field] = parseFloat(value) || 0;
        } else {
          updatedDiamond[field] = value;
        }
        return updatedDiamond;
      }
      return diamond;
    });
    setDiamonds(newDiamonds);
  };

  const handleDownloadExcelFormat = async () => {
    try {
      setIsDownloadingExcel(true);

      // Create Excel data with headers
      const excelData = [
        ['Type', 'Shape', 'Carat', 'Mm Size', 'Sieve Size', 'Price'],
      ];

      // Add sample row
      excelData.push(['LabGrown', 'RD', 0.5, 5.0, '0000-000', 100]);

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(excelData);

      // Set column widths
      ws['!cols'] = [
        { wch: 15 }, // Type
        { wch: 10 }, // Shape
        { wch: 12 }, // Carat
        { wch: 12 }, // Mm Size
        { wch: 15 }, // Sieve Size
        { wch: 12 }, // Price
      ];

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Diamonds');

      // Generate Excel file buffer
      const excelBuffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

      // Create filename
      const clientNameForFile = (clientData?.Name || clientData?.name || clientName || 'Client').replace(/[^a-zA-Z0-9]/g, '_');
      const excelFilename = `Diamond_Format_${clientNameForFile}.xlsx`;
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
      
      const base64String = base64;

      // Write Excel file
      await RNFS.writeFile(downloadPath, base64String, 'base64');

      Alert.alert(
        'Success',
        `Excel format downloaded successfully!\n\nSaved to: Downloads/${excelFilename}\n\nYou can now fill in the diamond data and import it.`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error downloading Excel format:', error);
      Alert.alert('Error', `Failed to download Excel format: ${error.message}`);
    } finally {
      setIsDownloadingExcel(false);
    }
  };

  const requestStoragePermission = async () => {
    if (Platform.OS !== 'android') {
      return true;
    }

    try {
      const androidVersion = Platform.Version;
      
      // For Android 13+ (API 33+), document picker doesn't require explicit storage permissions
      // The system handles file access through the picker
      if (androidVersion >= 33) {
        return true;
      }

      // For Android 12 and below, check if permission is already granted
      const checkResult = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE
      );
      
      if (checkResult) {
        return true;
      }

      // Request permission
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
        {
          title: 'Storage Permission',
          message: 'App needs access to storage to import Excel files',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        }
      );
      
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      // On newer Android versions or if permission system fails, allow to proceed
      // Document picker might work without explicit permissions
      console.warn('Permission request error:', err);
      return true; // Allow to proceed - document picker might handle it
    }
  };

  const handleImportDiamondsFromExcel = async () => {
    if (!DocumentPicker) {
      Alert.alert(
        'Feature Not Available',
        'Document picker is not installed. Please install react-native-document-picker to use this feature.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Request permission (but don't block if it fails on newer Android)
    const hasPermission = await requestStoragePermission();
    if (!hasPermission && Platform.OS === 'android' && Platform.Version < 33) {
      Alert.alert(
        'Permission Denied',
        'Storage permission is required to import Excel files. Please grant permission in app settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Open Settings',
            onPress: () => {
              // You can use Linking.openSettings() if needed
            },
          },
        ]
      );
      return;
    }

    try {
      setIsImportingExcel(true);

      // Use pickSingle for better compatibility and to avoid permission issues
      const result = await DocumentPicker.pickSingle({
        type: [DocumentPicker.types.xls, DocumentPicker.types.xlsx, DocumentPicker.types.csv],
        copyTo: 'cachesDirectory', // Copy file to cache for better access
      });

      if (result) {
        const file = result;
        
        // Get the file URI - use copyUri if available (from copyTo), otherwise use uri
        const fileUri = file.copyUri || file.uri;
        
        if (!fileUri) {
          Alert.alert('Error', 'Could not access the selected file');
          return;
        }
        
        // Read file
        const fileContent = await RNFS.readFile(fileUri, 'base64');
        const workbook = XLSX.read(fileContent, { type: 'base64' });
        
        // Get first sheet
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (jsonData.length < 2) {
          Alert.alert('Error', 'Excel file must have at least a header row and one data row');
          return;
        }

        // Skip header row and parse data
        const importedDiamonds = [];
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (row && row.length > 0) {
            importedDiamonds.push({
              Type: row[0]?.toString() || '',
              Shape: row[1]?.toString() || '',
              Carat: parseFloat(row[2]) || 0,
              MmSize: parseFloat(row[3]) || 0,
              SieveSize: row[4]?.toString() || '',
              Price: parseFloat(row[5]) || 0,
            });
          }
        }

        if (importedDiamonds.length === 0) {
          Alert.alert('Error', 'No valid diamond data found in Excel file');
          return;
        }

        // Replace existing diamonds with imported ones
        setDiamonds(importedDiamonds);

        Alert.alert(
          'Success',
          `Imported ${importedDiamonds.length} diamond(s) from Excel.\n\nPlease click on Save after importing to persist the changes.`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      if (DocumentPicker && DocumentPicker.isCancel && DocumentPicker.isCancel(error)) {
        return; // User cancelled
      }
      console.error('Error importing Excel:', error);
      Alert.alert('Error', `Failed to import Excel file: ${error.message}`);
    } finally {
      setIsImportingExcel(false);
    }
  };

  const handleSave = async () => {
    if (!clientId) {
      Alert.alert('Error', 'Client ID is missing');
      return;
    }

    try {
      setLoading(true);

      const pricingData = {
        Name: clientData?.Name || clientData?.name || clientName || '',
        Pricing: {
          Loss: parseFloat(loss) || 0,
          Labour: parseFloat(labour) || 0,
          ExtraCharges: parseFloat(extraCharges) || 0,
          Duties: parseFloat(duties) || 0,
          Diamonds: diamonds.map(d => ({
            Type: d.Type || '',
            Shape: d.Shape || '',
            Carat: d.Carat || 0,
            MmSize: d.MmSize || 0,
            SieveSize: d.SieveSize || '',
            Price: d.Price || 0,
          })),
        },
      };

      await updateClientPricing({
        clientId,
        ...pricingData,
      }).unwrap();

      Alert.alert('Success', 'Client pricing updated successfully', [
        {
          text: 'OK',
          onPress: () => {
            refetch();
          },
        },
      ]);
    } catch (error) {
      console.error('Error updating client pricing:', error);
      Alert.alert(
        'Error',
        error?.data?.message || error?.data?.error || 'Failed to update client pricing'
      );
    } finally {
      setLoading(false);
    }
  };

  if (isLoadingClient) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading client pricing...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Pricing for {clientData?.Name || clientData?.name || clientName || 'Client'}</Text>
      </View>

      <View style={styles.form}>
        {/* Pricing Input Fields */}
        <View style={styles.pricingFields}>
          <View style={styles.fieldRow}>
            <View style={styles.field}>
              <Text style={styles.label}>Loss*</Text>
              <Input
                value={loss}
                onChangeText={setLoss}
                keyboardType="numeric"
                placeholder="0"
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Labour*</Text>
              <Input
                value={labour}
                onChangeText={setLabour}
                keyboardType="numeric"
                placeholder="0"
              />
            </View>
          </View>
          <View style={styles.fieldRow}>
            <View style={styles.field}>
              <Text style={styles.label}>Extra Charges*</Text>
              <Input
                value={extraCharges}
                onChangeText={setExtraCharges}
                keyboardType="numeric"
                placeholder="0"
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Duties*</Text>
              <Input
                value={duties}
                onChangeText={setDuties}
                keyboardType="numeric"
                placeholder="0"
              />
            </View>
          </View>
        </View>

        {/* Excel Download and Import Buttons */}
        <View style={styles.excelButtonsContainer}>
          <TouchableOpacity
            style={[styles.excelButton, styles.downloadButton]}
            onPress={handleDownloadExcelFormat}
            disabled={isDownloadingExcel}
          >
            {isDownloadingExcel ? (
              <ActivityIndicator size="small" color={colors.textWhite} />
            ) : (
              <Icon name="download" size={18} color={colors.textWhite} />
            )}
            <Text style={styles.excelButtonText}>
              {isDownloadingExcel ? 'Downloading...' : 'Download Excel Format'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.excelButton, styles.importButton]}
            onPress={handleImportDiamondsFromExcel}
            disabled={isImportingExcel}
          >
            {isImportingExcel ? (
              <ActivityIndicator size="small" color={colors.textWhite} />
            ) : (
              <Icon name="upload" size={18} color={colors.textWhite} />
            )}
            <Text style={styles.excelButtonText}>
              {isImportingExcel ? 'Importing...' : 'Import Diamonds from Excel'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Import Message */}
        <View style={styles.importMessage}>
          <Text style={styles.importMessageText}>
            Please Click on Save after importing to persist the changes.
          </Text>
        </View>

        {/* Diamond Data Section */}
        <View style={styles.diamondSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Diamond Data</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={handleAddDiamond}
            >
              <Icon name="add" size={20} color={colors.textWhite} />
              <Text style={styles.addButtonText}>Add Diamond</Text>
            </TouchableOpacity>
          </View>

          {/* Diamond Table */}
          {diamonds.length > 0 ? (
            <View style={styles.tableContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                <View>
                  {/* Table Header */}
                  <View style={styles.tableHeader}>
                    <View style={[styles.tableCell, styles.headerCell]}>
                      <Text style={styles.headerText}>Type</Text>
                    </View>
                    <View style={[styles.tableCell, styles.headerCell]}>
                      <Text style={styles.headerText}>Shape</Text>
                    </View>
                    <View style={[styles.tableCell, styles.headerCell]}>
                      <Text style={styles.headerText}>Carat</Text>
                    </View>
                    <View style={[styles.tableCell, styles.headerCell]}>
                      <Text style={styles.headerText}>Mm Size</Text>
                    </View>
                    <View style={[styles.tableCell, styles.headerCell]}>
                      <Text style={styles.headerText}>Sieve Size</Text>
                    </View>
                    <View style={[styles.tableCell, styles.headerCell]}>
                      <Text style={styles.headerText}>Price</Text>
                    </View>
                    <View style={[styles.tableCell, styles.headerCell, styles.actionsCell]}>
                      <Text style={styles.headerText}>Actions</Text>
                    </View>
                  </View>

                  {/* Table Rows */}
                  {diamonds.map((diamond, index) => (
                    <View
                      key={index}
                      style={[
                        styles.tableRow,
                        index % 2 === 0 ? styles.evenRow : styles.oddRow,
                      ]}
                    >
                      <View style={styles.tableCell}>
                        <TextInput
                          style={styles.tableInput}
                          value={diamond.Type || ''}
                          onChangeText={(value) => handleDiamondChange(index, 'Type', value)}
                          placeholder="Type"
                        />
                      </View>
                      <View style={styles.tableCell}>
                        <TextInput
                          style={styles.tableInput}
                          value={diamond.Shape || ''}
                          onChangeText={(value) => handleDiamondChange(index, 'Shape', value)}
                          placeholder="Shape"
                        />
                      </View>
                      <View style={styles.tableCell}>
                        <TextInput
                          style={styles.tableInput}
                          value={diamond.Carat?.toString() || '0'}
                          onChangeText={(value) => handleDiamondChange(index, 'Carat', value)}
                          keyboardType="numeric"
                          placeholder="0"
                        />
                      </View>
                      <View style={styles.tableCell}>
                        <TextInput
                          style={styles.tableInput}
                          value={diamond.MmSize?.toString() || '0'}
                          onChangeText={(value) => handleDiamondChange(index, 'MmSize', value)}
                          keyboardType="numeric"
                          placeholder="0"
                        />
                      </View>
                      <View style={styles.tableCell}>
                        <TextInput
                          style={styles.tableInput}
                          value={diamond.SieveSize || ''}
                          onChangeText={(value) => handleDiamondChange(index, 'SieveSize', value)}
                          placeholder="Sieve Size"
                        />
                      </View>
                      <View style={styles.tableCell}>
                        <TextInput
                          style={styles.tableInput}
                          value={diamond.Price?.toString() || '0'}
                          onChangeText={(value) => handleDiamondChange(index, 'Price', value)}
                          keyboardType="numeric"
                          placeholder="0"
                        />
                      </View>
                      <View style={[styles.tableCell, styles.actionsCell]}>
                        <TouchableOpacity
                          style={styles.deleteButton}
                          onPress={() => handleDeleteDiamond(index)}
                        >
                          <Icon name="delete" size={18} color={colors.error} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              </ScrollView>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No diamonds added yet</Text>
              <Text style={styles.emptyStateSubtext}>Click "Add Diamond" to add diamond entries</Text>
            </View>
          )}
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, (loading || isUpdating) && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={loading || isUpdating}
        >
          {loading || isUpdating ? (
            <ActivityIndicator size="small" color={colors.textWhite} />
          ) : (
            <>
              <Icon name="save" size={20} color={colors.textWhite} />
              <Text style={styles.saveButtonText}>Save</Text>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: 12,
    fontSize: fonts.base,
    color: colors.textSecondary,
  },
  header: {
    padding: 20,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: fonts.lg,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
  },
  form: {
    padding: 20,
  },
  pricingFields: {
    marginBottom: 24,
  },
  fieldRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  field: {
    flex: 1,
  },
  label: {
    fontSize: fonts.sm,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
    marginBottom: 8,
  },
  diamondSection: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: fonts.base,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  addButtonText: {
    color: colors.textWhite,
    fontSize: fonts.sm,
    fontFamily: fonts.medium,
  },
  tableContainer: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  evenRow: {
    backgroundColor: colors.white,
  },
  oddRow: {
    backgroundColor: colors.background,
  },
  tableCell: {
    padding: 12,
    minWidth: 100,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  headerCell: {
    backgroundColor: colors.primary,
  },
  headerText: {
    fontSize: fonts.sm,
    fontFamily: fonts.bold,
    color: colors.textWhite,
  },
  tableInput: {
    fontSize: fonts.sm,
    color: colors.textPrimary,
    padding: 0,
    minHeight: 20,
  },
  actionsCell: {
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButton: {
    padding: 4,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyStateText: {
    fontSize: fonts.base,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: fonts.sm,
    color: colors.textSecondary,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 24,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: colors.textWhite,
    fontSize: fonts.base,
    fontFamily: fonts.bold,
  },
  excelButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  excelButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  downloadButton: {
    backgroundColor: colors.primary,
  },
  importButton: {
    backgroundColor: colors.secondary || '#4CAF50',
  },
  excelButtonText: {
    color: colors.textWhite,
    fontSize: fonts.sm,
    fontFamily: fonts.medium,
  },
  importMessage: {
    backgroundColor: colors.background,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  importMessageText: {
    fontSize: fonts.sm,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
});

export default ClientPricingScreen;

