import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from './Icon';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';

const CustomTabBar = ({ state, descriptors, navigation }) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      {/* Content area above tabs */}
      <View style={styles.contentArea} />
      
      {/* Tab bar */}
      <View style={styles.tabBar}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const label = options.tabBarLabel !== undefined
            ? options.tabBarLabel
            : options.title !== undefined
            ? options.title
            : route.name;

          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          };

          // Get icon name based on route
          let iconName;
          if (route.name === 'Dashboard') {
            iconName = 'homeIcon';
          } else if (route.name === 'Enquiries') {
            iconName = 'enquiryIcon';
          } else if (route.name === 'Chats') {
            iconName = 'chatIcon';
          }

          // Special handling for the middle tab (Search/Enquiries)
          if (index === 1) {
            return (
              <TouchableOpacity
                key={route.key}
                accessibilityRole="button"
                accessibilityState={isFocused ? { selected: true } : {}}
                accessibilityLabel={options.tabBarAccessibilityLabel}
                testID={options.tabBarTestID}
                onPress={onPress}
                onLongPress={onLongPress}
                style={styles.searchButtonContainer}>
                <View style={styles.searchButton}>
                  <Icon name="enquiryIcon" size={24} color={colors.textWhite} />
                </View>
                <Text style={styles.searchLabel}>INQUIRIES</Text>
              </TouchableOpacity>
            );
          }

          // Regular tabs
          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              testID={options.tabBarTestID}
              onPress={onPress}
              onLongPress={onLongPress}
              style={styles.tabButton}>
              <Icon 
                name={iconName} 
                size={28} 
                color={isFocused ? colors.primary : colors.textSecondary} 
              />
              <Text style={[styles.tabLabel, { color: isFocused ? colors.primary : colors.textSecondary }]}>
                {label.toUpperCase()}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
  },
  contentArea: {
    height: 12,
    backgroundColor: colors.backgroundSecondary,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.textWhite,
    paddingTop: 12,
    paddingBottom: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    marginHorizontal: 8,
    marginTop: -4,
    shadowColor: colors.textPrimary,
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.25,
    shadowRadius: 2,
    elevation: 10,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    minWidth: 60,
  },
  tabLabel: {
    fontSize: fonts.xs,
    fontFamily: fonts.bold,
    marginTop: 4,
    letterSpacing: 0.5,
  },
  searchButtonContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -20, // Pull the button up to create floating effect
    paddingHorizontal: 8,
  },
  searchButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  searchLabel: {
    fontSize: fonts.xs,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    marginTop: 4,
    letterSpacing: 0.5,
  },
});

export default CustomTabBar;
