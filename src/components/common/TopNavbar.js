import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Text,
  Image,
  Modal,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import AccountModal from '../modals/AccountModal';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import { images } from '../../constants/images';
import Icon from './Icon';

const TopNavbar = ({ navigation }) => {
  const { user, logout } = useAuth();
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [buttonPressed, setButtonPressed] = useState('');

  // Safety check - don't render if user is not loaded
  if (!user) {
    console.log('TopNavbar: User not loaded, returning null');
    return null;
  }
  
  console.log('TopNavbar: User loaded, rendering navbar for user:', user?.name || user?.email || 'Unknown');

  const handleNotificationPress = () => {
    navigation.navigate('Notifications');
  };

  const handleAccountPress = () => {
    console.log('Account icon pressed, opening account modal');
    console.log('Current showAccountModal state:', showAccountModal);
    setButtonPressed('Account');
    setShowAccountModal(true);
    console.log('Set showAccountModal to true');
  };

  const handleLogoutPress = () => {
    console.log('Logout icon pressed, showing logout modal');
    setButtonPressed('Logout');
    setShowLogoutModal(true);
  };

  const handleConfirmLogout = () => {
    console.log('User confirmed logout');
    setShowLogoutModal(false);
    setShowAccountModal(false);
    logout();
  };

  return (
    <>
      <View style={styles.navbar}>
        <View style={styles.leftSection}>
          <View style={styles.logoContainer}>
            <Image 
              source={images.logo}
              style={styles.logoImage}
              resizeMode="contain"
            />
            <Image 
              source={images.logoHeader}
              style={styles.logoHeaderImage}
              resizeMode="contain"
            />
            {/* {buttonPressed && (
              <Text style={{ color: colors.textWhite, fontSize: 10, marginLeft: 8 }}>
                {buttonPressed} pressed
              </Text>
            )} */}
          </View>
        </View>

        <View style={styles.rightSection}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={handleNotificationPress}
            activeOpacity={0.7}>
            <Icon name="notification" size={24} color={colors.textWhite} />
            <View style={styles.notificationBadge}>
              <Text style={[styles.badgeText, { color: colors.textWhite, fontSize: 10, fontFamily: fonts.bold }]}>
                3
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.iconButton, showAccountModal && styles.activeButton]}
            onPress={handleAccountPress}
            activeOpacity={0.7}>
            <Icon name="account" size={24} color={colors.textWhite} />
          </TouchableOpacity>

          {/* Logout button hidden as requested
          <TouchableOpacity
            style={[styles.iconButton, showLogoutModal && styles.activeButton]}
            onPress={handleLogoutPress}
            activeOpacity={0.7}>
            <Icon name="logout" size={24} color={colors.textWhite} />
          </TouchableOpacity>
          */}
        </View>
      </View>

      <AccountModal
        visible={showAccountModal}
        onClose={() => {
          console.log('Closing account modal');
          setShowAccountModal(false);
        }}
      />

      {/* Logout Confirmation Modal */}
      <Modal
        visible={showLogoutModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowLogoutModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.logoutModal}>
            <Text style={styles.logoutTitle}>Logout</Text>
            <Text style={styles.logoutMessage}>Are you sure you want to logout?</Text>
            <View style={styles.logoutButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowLogoutModal(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.logoutButton}
                onPress={handleConfirmLogout}>
                <Text style={styles.logoutButtonText}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  navbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.primaryDark,
  },
  leftSection: {
    flex: 1,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoImage: {
    width: 40,
    height: 40,
  },
  logoHeaderImage: {
    height: 40,
    width: 160,
    marginLeft: 8,
  },
  logoText: {
    marginLeft: 8,
    fontFamily: fonts.bold,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    padding: 12,
    marginLeft: 8,
    position: 'relative',
    borderRadius: 8,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  notificationBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: colors.error,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 10,
    fontFamily: fonts.bold,
  },
  // Logout Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutModal: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 24,
    width: '80%',
    maxWidth: 300,
    shadowColor: colors.textPrimary,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  logoutTitle: {
    fontSize: fonts.xl,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 12,
  },
  logoutMessage: {
    fontSize: fonts.base,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  logoutButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 8,
    paddingVertical: 12,
    marginRight: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: fonts.base,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
  },
  logoutButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    marginLeft: 8,
    alignItems: 'center',
  },
  logoutButtonText: {
    fontSize: fonts.base,
    fontFamily: fonts.medium,
    color: colors.textWhite,
  },
});

export default TopNavbar;
