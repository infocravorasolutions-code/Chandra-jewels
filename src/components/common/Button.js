import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
} from 'react-native';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';

export const Button = ({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  style,
  textStyle,
  ...props
}) => {
  const buttonStyle = [
    styles.button,
    styles[variant],
    styles[size],
    disabled && styles.disabled,
    style,
  ];

  const buttonTextStyle = [
    styles.text,
    styles[`${variant}Text`],
    styles[`${size}Text`],
    disabled && styles.disabledText,
    textStyle,
  ];

  return (
    <TouchableOpacity
      style={buttonStyle}
      onPress={onPress}
      disabled={disabled || loading}
      {...props}>
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? colors.textWhite : colors.primary}
          size="small"
        />
      ) : (
        <Text style={buttonTextStyle}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

export const SecondaryButton = ({ title, onPress, style, ...props }) => (
  <Button
    title={title}
    onPress={onPress}
    variant="secondary"
    style={style}
    {...props}
  />
);

export const OutlineButton = ({ title, onPress, style, ...props }) => (
  <Button
    title={title}
    onPress={onPress}
    variant="outline"
    style={style}
    {...props}
  />
);

const styles = StyleSheet.create({
  button: {
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  text: {
    fontFamily: fonts.medium,
    textAlign: 'center',
  },
  
  // Variants
  primary: {
    backgroundColor: colors.primary, // Chandra green
  },
  primaryText: {
    color: colors.textWhite,
  },
  
  secondary: {
    backgroundColor: colors.textSecondary, // Grey
  },
  secondaryText: {
    color: colors.textWhite,
  },
  
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  outlineText: {
    color: colors.primary,
  },
  
  // Sizes
  small: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  smallText: {
    fontSize: fonts.sm,
  },
  
  medium: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  mediumText: {
    fontSize: fonts.base,
  },
  
  large: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  largeText: {
    fontSize: fonts.lg,
  },
  
  // States
  disabled: {
    opacity: 0.6,
  },
  disabledText: {
    opacity: 0.6,
  },
});
