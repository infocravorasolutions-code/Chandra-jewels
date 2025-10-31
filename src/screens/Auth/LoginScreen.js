import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { Input, Button } from '../../components/common';
import { Heading, BodyText } from '../../components/common/Text';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import { images } from '../../constants/images';
import { validateEmail, validatePassword } from '../../utils/helpers';

const LoginScreen = ({ navigation }) => {
  const { login, isLoading } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
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

    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (!validatePassword(formData.password)) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validateForm()) return;

    const result = await login(formData.email, formData.password);
    
    if (!result.success) {
      Alert.alert('Login Failed', result.error || 'Invalid credentials');
    }
    // Navigation will be handled automatically by AuthContext
  };

  const demoCredentials = [
    { role: 'Admin', email: 'admin@chandrajewels.com', password: 'admin123' },
    { role: 'Client', email: 'john@example.com', password: 'client123' },
    { role: 'Coral Designer', email: 'coral@chandrajewels.com', password: 'coral123' },
    { role: 'CAD Designer', email: 'cad@chandrajewels.com', password: 'cad123' },
  ];

  const fillDemoCredentials = (email, password) => {
    setFormData({ email, password });
    setErrors({});
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled">
        
        <View style={styles.header}>
          <Image 
            source={images.logo} 
            style={styles.logo}
            resizeMode="contain"
          />
          <Image 
            source={images.loginLogo} 
            style={styles.loginLogoImage}
            resizeMode="contain"
          />
          <BodyText color="secondary" style={styles.subtitle}>
            Welcome back! Please sign in to continue.
          </BodyText>
        </View>

        <View style={styles.form}>
          <Input
            label="Email"
            placeholder="Enter your email"
            value={formData.email}
            onChangeText={(value) => handleInputChange('email', value)}
            keyboardType="email-address"
            autoCapitalize="none"
            error={errors.email}
          />

          <Input
            label="Password"
            placeholder="Enter your password"
            value={formData.password}
            onChangeText={(value) => handleInputChange('password', value)}
            secureTextEntry
            error={errors.password}
          />

          <Button
            title="Sign In"
            onPress={handleLogin}
            loading={isLoading}
            style={styles.loginButton}
          />
        </View>

        <View style={styles.demoSection}>
          <BodyText color="secondary" style={styles.demoTitle}>
            Demo Credentials:
          </BodyText>
          {demoCredentials.map((cred, index) => (
            <Button
              key={index}
              title={`Login as ${cred.role}`}
              variant="outline"
              size="small"
              onPress={() => fillDemoCredentials(cred.email, cred.password)}
              style={styles.demoButton}
            />
          ))}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: 8,
  },
  loginLogoImage: {
    width: 200,
    height: 60,
    marginBottom: 12,
  },
  subtitle: {
    textAlign: 'center',
    fontSize: fonts.base,
  },
  form: {
    marginBottom: 32,
  },
  loginButton: {
    marginTop: 8,
    borderRadius: 20,
  },
  demoSection: {
    alignItems: 'center',
  },
  demoTitle: {
    marginBottom: 16,
    fontWeight: fonts.medium,
  },
  demoButton: {
    marginBottom: 8,
    minWidth: 200,
  },
});

export default LoginScreen;
