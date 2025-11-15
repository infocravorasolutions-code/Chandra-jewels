import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Text,
  Modal,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Input } from '../common';
import Icon from '../common/Icon';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import { useGetClientsQuery, useGetUsersQuery } from '../../store/api';

const EnquiryFiltersModal = ({
  visible,
  onClose,
  filters,
  onApplyFilters,
  onClearFilters,
  user,
}) => {
  const [localFilters, setLocalFilters] = useState(filters);
  const [showDropdown, setShowDropdown] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(null); // Track which date picker is open
  const [tempDate, setTempDate] = useState(new Date()); // Temporary date for picker

  // Fetch clients and users for dropdowns
  const { data: clientsData = [] } = useGetClientsQuery(undefined, {
    skip: !user,
  });
  const { data: usersData = [] } = useGetUsersQuery(undefined, {
    skip: !user,
  });

  const clients = Array.isArray(clientsData) ? clientsData : [];
  const users = Array.isArray(usersData) ? usersData : [];

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  // Close date picker when modal closes
  useEffect(() => {
    if (!visible) {
      setShowDatePicker(null);
      setShowDropdown(null);
    }
  }, [visible]);

  const handleFilterChange = (key, value) => {
    setLocalFilters(prev => ({ ...prev, [key]: value }));
    setShowDropdown(null);
  };

  const handleApply = () => {
    onApplyFilters(localFilters);
    onClose();
  };

  const handleClear = () => {
    const clearedFilters = {
      status: 'all',
      category: 'all',
      priority: 'all',
      clientId: 'all',
      assignedTo: 'all',
      stoneType: 'all',
      metalColor: 'all',
      metalQuality: 'all',
      shippingDateFrom: null,
      shippingDateTo: null,
      assignedDateFrom: null,
      assignedDateTo: null,
      createdDateFrom: null,
      createdDateTo: null,
    };
    setLocalFilters(clearedFilters);
    onClearFilters();
    onClose();
  };

  const statusOptions = [
    { label: 'All Status', value: 'all' },
    { label: 'Pending', value: 'pending' },
    { label: 'In Progress', value: 'in_progress' },
    { label: 'Completed', value: 'completed' },
    ...(user?.role === 'admin' ? [{ label: 'Rejected', value: 'rejected' }] : []),
  ];

  const categoryOptions = [
    { label: 'All Categories', value: 'all' },
    { label: 'Ring', value: 'Ring' },
    { label: 'Necklace', value: 'Necklace' },
    { label: 'Earring', value: 'Earring' },
    { label: 'Bracelet', value: 'Bracelet' },
    { label: 'Pendant', value: 'Pendant' },
    { label: 'Other', value: 'Other' },
  ];

  const priorityOptions = [
    { label: 'All Priority', value: 'all' },
    { label: 'High', value: 'high' },
    { label: 'Medium', value: 'medium' },
    { label: 'Low', value: 'low' },
  ];

  const stoneTypeOptions = [
    { label: 'All Stone Types', value: 'all' },
    { label: 'Natural Regular', value: 'NaturalRegular' },
    { label: 'Natural Premium', value: 'NaturalPremium' },
    { label: 'Lab Grown', value: 'LabGrown' },
    { label: 'No Stone', value: 'NoStone' },
  ];

  const metalColorOptions = [
    { label: 'All Colors', value: 'all' },
    { label: 'Gold', value: 'Gold' },
    { label: 'Silver', value: 'Silver' },
    { label: 'Platinum', value: 'Platinum' },
    { label: 'Rose Gold', value: 'RoseGold' },
    { label: 'White Gold', value: 'WhiteGold' },
  ];

  const metalQualityOptions = [
    { label: 'All Qualities', value: 'all' },
    { label: '10K', value: '10K' },
    { label: '14K', value: '14K' },
    { label: '18K', value: '18K' },
    { label: '22K', value: '22K' },
    { label: '24K', value: '24K' },
  ];

  const renderDropdown = (key, options, label) => {
    const isOpen = showDropdown === key;
    const selectedOption = options.find(opt => opt.value === localFilters[key]) || options[0];

    return (
      <View style={styles.filterField}>
        <Text style={styles.filterLabel}>{label}</Text>
        <TouchableOpacity
          style={styles.dropdownButton}
          onPress={() => {
            setShowDatePicker(null); // Close any open date picker
            setShowDropdown(isOpen ? null : key);
          }}>
          <Text style={styles.dropdownText}>
            {selectedOption?.label || 'Select...'}
          </Text>
          <Icon
            name={isOpen ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
            size={20}
            color={colors.textSecondary}
          />
        </TouchableOpacity>
        {isOpen && (
          <View style={styles.dropdownList}>
            <ScrollView style={styles.dropdownScroll} nestedScrollEnabled>
              {options.map(option => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.dropdownOption,
                    localFilters[key] === option.value && styles.dropdownOptionActive,
                  ]}
                  onPress={() => handleFilterChange(key, option.value)}>
                  <Text
                    style={[
                      styles.dropdownOptionText,
                      localFilters[key] === option.value && styles.dropdownOptionTextActive,
                    ]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </View>
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '';
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch (e) {
      return '';
    }
  };

  const handleDateChange = (event, selectedDate, dateKey) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(null);
      if (event.type === 'set' && selectedDate) {
        const formattedDate = formatDate(selectedDate.toISOString());
        handleFilterChange(dateKey, formattedDate);
      }
    } else {
      // iOS - show picker in modal
      if (event.type === 'set' && selectedDate) {
        const formattedDate = formatDate(selectedDate.toISOString());
        handleFilterChange(dateKey, formattedDate);
        setShowDatePicker(null);
      } else if (event.type === 'dismissed') {
        setShowDatePicker(null);
      }
    }
  };

  const openDatePicker = (dateKey) => {
    setShowDropdown(null); // Close any open dropdown
    const currentDate = localFilters[dateKey] 
      ? new Date(localFilters[dateKey]) 
      : new Date();
    setTempDate(currentDate);
    setShowDatePicker(dateKey);
  };

  const renderDateInput = (dateKey, placeholder) => {
    const isOpen = showDatePicker === dateKey;
    const dateValue = localFilters[dateKey] || '';

    return (
      <View style={styles.dateInputContainer}>
        <TouchableOpacity
          style={styles.dateInputButton}
          onPress={() => openDatePicker(dateKey)}>
          <Text style={[styles.dateInputText, !dateValue && styles.dateInputPlaceholder]}>
            {dateValue || placeholder}
          </Text>
          <Icon name="calendar-today" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
        {isOpen && Platform.OS === 'ios' && (
          <Modal
            transparent={true}
            animationType="slide"
            visible={isOpen}
            onRequestClose={() => setShowDatePicker(null)}>
            <TouchableOpacity
              style={styles.datePickerModal}
              activeOpacity={1}
              onPress={() => setShowDatePicker(null)}>
              <TouchableOpacity
                activeOpacity={1}
                onPress={(e) => e.stopPropagation()}
                style={styles.datePickerContainer}>
                <View style={styles.datePickerHeader}>
                  <TouchableOpacity
                    onPress={() => setShowDatePicker(null)}
                    style={styles.datePickerCancel}>
                    <Text style={styles.datePickerCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <Text style={styles.datePickerTitle}>Select Date</Text>
                  <TouchableOpacity
                    onPress={() => {
                      const formattedDate = formatDate(tempDate.toISOString());
                      handleFilterChange(dateKey, formattedDate);
                      setShowDatePicker(null);
                    }}
                    style={styles.datePickerDone}>
                    <Text style={styles.datePickerDoneText}>Done</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={tempDate}
                  mode="date"
                  display="spinner"
                  onChange={(event, date) => {
                    if (date) setTempDate(date);
                  }}
                  style={styles.datePicker}
                />
              </TouchableOpacity>
            </TouchableOpacity>
          </Modal>
        )}
        {isOpen && Platform.OS === 'android' && (
          <DateTimePicker
            value={tempDate}
            mode="date"
            display="default"
            onChange={(event, date) => handleDateChange(event, date, dateKey)}
          />
        )}
      </View>
    );
  };

  const renderDateRange = (fromKey, toKey, label) => {
    return (
      <View style={styles.filterField}>
        <Text style={styles.filterLabel}>{label}</Text>
        <View style={styles.dateRangeContainer}>
          {renderDateInput(fromKey, 'From Date')}
          <Text style={styles.dateRangeSeparator}>to</Text>
          {renderDateInput(toKey, 'To Date')}
        </View>
      </View>
    );
  };

  const renderClientDropdown = () => {
    const clientOptions = [
      { label: 'All Clients', value: 'all' },
      ...clients.map(client => ({
        label: client.name || client.Name || 'Unknown',
        value: client.id || client._id || client.Id,
      })),
    ];
    return renderDropdown('clientId', clientOptions, 'Client');
  };

  const renderAssignedToDropdown = () => {
    const assignedToOptions = [
      { label: 'All Users', value: 'all' },
      ...users.map(user => ({
        label: user.name || user.Name || user.email || 'Unknown',
        value: user.id || user._id || user.Id,
      })),
    ];
    return renderDropdown('assignedTo', assignedToOptions, 'Assigned To');
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Filters</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Icon name="close" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Basic Filters */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Basic Filters</Text>
            
            {renderDropdown('status', statusOptions, 'Status')}
            {renderDropdown('category', categoryOptions, 'Category')}
            {renderDropdown('priority', priorityOptions, 'Priority')}
            {renderClientDropdown()}
            {renderAssignedToDropdown()}
            {renderDropdown('stoneType', stoneTypeOptions, 'Stone Type')}
            {renderDropdown('metalColor', metalColorOptions, 'Metal Color')}
            {renderDropdown('metalQuality', metalQualityOptions, 'Metal Quality')}
          </View>

          {/* Date Range Filters */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Date Ranges</Text>
            
            {renderDateRange('shippingDateFrom', 'shippingDateTo', 'Shipping Date')}
            {renderDateRange('assignedDateFrom', 'assignedDateTo', 'Assigned Date')}
            {renderDateRange('createdDateFrom', 'createdDateTo', 'Created Date')}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Button
            title="Clear All"
            onPress={handleClear}
            style={[styles.footerButton, styles.clearButton]}
            textStyle={styles.clearButtonText}
          />
          <Button
            title="Apply Filters"
            onPress={handleApply}
            style={[styles.footerButton, styles.applyButton]}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: fonts.lg,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginTop: 24,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: fonts.base,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    marginBottom: 16,
  },
  filterField: {
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: fonts.sm,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  dropdownButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  dropdownText: {
    fontSize: fonts.sm,
    fontFamily: fonts.regular,
    color: colors.textPrimary,
    flex: 1,
  },
  dropdownList: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    marginTop: 4,
    maxHeight: 200,
    elevation: 4,
    shadowColor: colors.textPrimary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  dropdownScroll: {
    maxHeight: 200,
  },
  dropdownOption: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  dropdownOptionActive: {
    backgroundColor: colors.backgroundSecondary,
  },
  dropdownOptionText: {
    fontSize: fonts.sm,
    fontFamily: fonts.regular,
    color: colors.textPrimary,
  },
  dropdownOptionTextActive: {
    fontFamily: fonts.medium,
    color: colors.primary,
  },
  dateRangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateInputContainer: {
    flex: 1,
  },
  dateInputButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  dateInputText: {
    fontSize: fonts.sm,
    fontFamily: fonts.regular,
    color: colors.textPrimary,
    flex: 1,
  },
  dateInputPlaceholder: {
    color: colors.textLight,
  },
  dateRangeSeparator: {
    fontSize: fonts.sm,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
    marginHorizontal: 4,
  },
  datePickerModal: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  datePickerContainer: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 20 : 0,
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  datePickerCancel: {
    padding: 4,
  },
  datePickerCancelText: {
    fontSize: fonts.base,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
  },
  datePickerTitle: {
    fontSize: fonts.base,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
  },
  datePickerDone: {
    padding: 4,
  },
  datePickerDoneText: {
    fontSize: fonts.base,
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  datePicker: {
    width: '100%',
    backgroundColor: colors.background,
  },
  textInput: {
    backgroundColor: colors.backgroundSecondary,
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 12,
  },
  footerButton: {
    flex: 1,
  },
  clearButton: {
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  clearButtonText: {
    color: colors.textSecondary,
  },
  applyButton: {
    backgroundColor: colors.primary,
  },
});

export default EnquiryFiltersModal;

