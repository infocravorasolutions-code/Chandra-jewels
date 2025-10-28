import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Button } from '../../components/common';
import { Heading, CustomText, BodyText } from '../../components/common/Text';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';

const AddEnquiryStep2Screen = ({ route, navigation }) => {
  const { formData } = route.params;
  const [selectedImages, setSelectedImages] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleImagePicker = () => {
    Alert.alert(
      'Select Image Source',
      'Choose how you want to add images',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Camera',
          onPress: () => {
            // Simulate camera capture
            const newImage = `camera_${Date.now()}.jpg`;
            setSelectedImages(prev => [...prev, newImage]);
            Alert.alert('Success', 'Image captured from camera');
          },
        },
        {
          text: 'Gallery',
          onPress: () => {
            // Simulate gallery selection
            const newImage = `gallery_${Date.now()}.jpg`;
            setSelectedImages(prev => [...prev, newImage]);
            Alert.alert('Success', 'Image selected from gallery');
          },
        },
      ]
    );
  };

  const removeImage = (index) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    setLoading(true);
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      Alert.alert(
        'Enquiry Created',
        'Your enquiry has been submitted successfully!',
        [
          {
            text: 'OK',
            onPress: () => {
              // Navigate back to enquiries list
              navigation.navigate('MainTabs', { screen: 'Enquiries' });
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to create enquiry. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderFormSummary = () => (
    <View style={styles.summaryCard}>
      <Heading level={4} style={styles.summaryTitle}>
        Enquiry Summary
      </Heading>
      
      <View style={styles.summaryItem}>
        <CustomText variant="label" color="secondary">
          Title
        </CustomText>
        <CustomText variant="body" color="primary">
          {formData.title}
        </CustomText>
      </View>

      <View style={styles.summaryItem}>
        <CustomText variant="label" color="secondary">
          Client
        </CustomText>
        <CustomText variant="body" color="primary">
          {formData.clientName}
        </CustomText>
      </View>

      <View style={styles.summaryItem}>
        <CustomText variant="label" color="secondary">
          Budget
        </CustomText>
        <CustomText variant="body" color="primary">
          ₹{formData.estimatedBudget}
        </CustomText>
      </View>

      <View style={styles.summaryItem}>
        <CustomText variant="label" color="secondary">
          Priority
        </CustomText>
        <CustomText variant="body" color="primary">
          {formData.priority.charAt(0).toUpperCase() + formData.priority.slice(1)}
        </CustomText>
      </View>

      <View style={styles.summaryItem}>
        <CustomText variant="label" color="secondary">
          Description
        </CustomText>
        <BodyText color="secondary" style={styles.descriptionText}>
          {formData.description}
        </BodyText>
      </View>
    </View>
  );

  const renderImageUpload = () => (
    <View style={styles.imageCard}>
      <Heading level={4} style={styles.sectionTitle}>
        Reference Images/Videos
      </Heading>
      
      <CustomText variant="caption" color="secondary" style={styles.sectionSubtitle}>
        Upload reference images or videos to help designers understand your requirements
      </CustomText>

      <TouchableOpacity style={styles.uploadButton} onPress={handleImagePicker}>
        <Icon name="add-a-photo" size={32} color={colors.primary} />
        <CustomText variant="body" color="primary" style={styles.uploadText}>
          Add Images/Videos
        </CustomText>
        <CustomText variant="caption" color="secondary">
          Tap to select from camera or gallery
        </CustomText>
      </TouchableOpacity>

      {selectedImages.length > 0 && (
        <View style={styles.imagesGrid}>
          {selectedImages.map((image, index) => (
            <View key={index} style={styles.imageContainer}>
              <Image
                source={{ uri: `https://via.placeholder.com/100x100?text=${image}` }}
                style={styles.image}
              />
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => removeImage(index)}>
                <Icon name="close" size={16} color={colors.textWhite} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  const renderInstructions = () => (
    <View style={styles.instructionsCard}>
      <Heading level={4} style={styles.sectionTitle}>
        Instructions
      </Heading>
      
      <View style={styles.instructionItem}>
        <Icon name="info" size={20} color={colors.info} />
        <CustomText variant="body" color="secondary" style={styles.instructionText}>
          Make sure to provide clear and detailed descriptions
        </CustomText>
      </View>

      <View style={styles.instructionItem}>
        <Icon name="photo-camera" size={20} color={colors.info} />
        <CustomText variant="body" color="secondary" style={styles.instructionText}>
          Upload high-quality reference images for better results
        </CustomText>
      </View>

      <View style={styles.instructionItem}>
        <Icon name="schedule" size={20} color={colors.info} />
        <CustomText variant="body" color="secondary" style={styles.instructionText}>
          Our team will review and respond within 24 hours
        </CustomText>
      </View>
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Heading level={3}>Upload References</Heading>
        <CustomText variant="caption" color="secondary">
          Step 2 of 2 - Add Reference Materials
        </CustomText>
      </View>

      {renderFormSummary()}
      {renderImageUpload()}
      {renderInstructions()}

      <View style={styles.footer}>
        <Button
          title="Submit Enquiry"
          onPress={handleSubmit}
          loading={loading}
          style={styles.submitButton}
        />
        
        <Button
          title="Back to Step 1"
          variant="outline"
          onPress={() => navigation.goBack()}
          style={styles.backButton}
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
  summaryCard: {
    margin: 16,
    padding: 16,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 8,
  },
  summaryTitle: {
    marginBottom: 16,
  },
  summaryItem: {
    marginBottom: 12,
  },
  descriptionText: {
    marginTop: 4,
    fontStyle: 'italic',
  },
  imageCard: {
    margin: 16,
  },
  sectionTitle: {
    marginBottom: 8,
  },
  sectionSubtitle: {
    marginBottom: 16,
  },
  uploadButton: {
    alignItems: 'center',
    padding: 32,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: 8,
    backgroundColor: colors.backgroundSecondary,
  },
  uploadText: {
    marginTop: 8,
    marginBottom: 4,
  },
  imagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 16,
    gap: 12,
  },
  imageContainer: {
    position: 'relative',
  },
  image: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  removeButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.error,
    justifyContent: 'center',
    alignItems: 'center',
  },
  instructionsCard: {
    margin: 16,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  instructionText: {
    marginLeft: 12,
    flex: 1,
  },
  footer: {
    padding: 20,
    gap: 12,
  },
  submitButton: {
    marginBottom: 8,
  },
  backButton: {
    marginTop: 8,
  },
});

export default AddEnquiryStep2Screen;
