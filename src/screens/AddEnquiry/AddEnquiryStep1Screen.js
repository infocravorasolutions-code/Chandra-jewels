import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Input, Button } from '../../components/common';
import { Heading, CustomText } from '../../components/common/Text';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import { validateEmail } from '../../utils/helpers';

const AddEnquiryStep1Screen = ({ navigation }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    estimatedBudget: '',
    priority: 'medium',
    deadline: '',
  });
  const [errors, setErrors] = useState({});

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

    if (!formData.clientName.trim()) {
      newErrors.clientName = 'Client name is required';
    }

    if (!formData.clientEmail.trim()) {
      newErrors.clientEmail = 'Client email is required';
    } else if (!validateEmail(formData.clientEmail)) {
      newErrors.clientEmail = 'Please enter a valid email';
    }

    if (!formData.clientPhone.trim()) {
      newErrors.clientPhone = 'Client phone is required';
    }

    if (!formData.estimatedBudget.trim()) {
      newErrors.estimatedBudget = 'Estimated budget is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateForm()) {
      navigation.navigate('AddEnquiryStep2', { formData });
    }
  };

  const priorityOptions = [
    { label: 'Low', value: 'low' },
    { label: 'Medium', value: 'medium' },
    { label: 'High', value: 'high' },
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Heading level={3}>Enquiry Details</Heading>
        <CustomText variant="caption" color="secondary">
          Step 1 of 2 - Basic Information
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
          
          <Input
            label="Client Name"
            placeholder="Enter client name"
            value={formData.clientName}
            onChangeText={(value) => handleInputChange('clientName', value)}
            error={errors.clientName}
          />

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
            label="Deadline (Optional)"
            placeholder="Enter deadline date"
            value={formData.deadline}
            onChangeText={(value) => handleInputChange('deadline', value)}
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
});

export default AddEnquiryStep1Screen;
