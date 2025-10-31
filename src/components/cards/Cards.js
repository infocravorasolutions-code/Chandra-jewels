import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import { spacing, responsivePadding, imageSizes } from '../../utils';
import { formatCount } from '../../utils/helpers';
import Icon from '../common/Icon';

export const Card = ({ children, style, onPress, ...props }) => {
  const CardComponent = onPress ? TouchableOpacity : View;
  
  return (
    <CardComponent
      style={[styles.card, style]}
      onPress={onPress}
      {...props}>
      {children}
    </CardComponent>
  );
};

export const StatusCard = ({ title, value, icon, color = colors.primary, onPress }) => (
  <Card style={styles.statusCard} onPress={onPress}>
    <View style={styles.statusCardContent}>
      <View style={styles.statusHeader}>
        <View style={[styles.statusIcon, { backgroundColor: color }]}>
          {icon}
        </View>
        <Text style={styles.statusTitle}>
          {title}
        </Text>
      </View>
      <Text style={styles.statusValue}>
        {formatCount(value)}
      </Text>
    </View>
  </Card>
);

export const EnquiryStatusCard = ({ status, value, color, icon, onPress, style }) => (
  <Card style={[styles.enquiryStatusCard, style]} onPress={onPress}>
    <View style={styles.enquiryStatusHeader}>
      <View style={styles.statusIndicatorContainer}>
        <View style={[styles.statusIndicator, { backgroundColor: color }]} />
        {icon && (
          <View style={styles.statusIconContainer}>
            {icon}
          </View>
        )}
      </View>
      <Text style={styles.statusLabel}>{status}</Text>
    </View>
    <Text style={styles.statusValue}>{formatCount(value)}</Text>
  </Card>
);

export const EnquiryCard = ({
  enquiry,
  onPress,
  getStatusColor,
  getStatusIcon,
  getPriorityColor,
  getPriorityIcon,
  formatCurrency,
  formatDate,
}) => {
  // Safety checks to prevent undefined errors
  if (!enquiry) {
    return null;
  }

  const statusColor = getStatusColor ? getStatusColor(enquiry.status || 'pending') : colors.primary;
  const statusIcon = getStatusIcon ? getStatusIcon(enquiry.status || 'pending') : 'help';
  const priorityColor = getPriorityColor ? getPriorityColor(enquiry.priority || 'medium') : colors.textSecondary;
  const priorityIcon = getPriorityIcon ? getPriorityIcon(enquiry.priority || 'medium') : 'help';
  const formattedPrice = formatCurrency ? formatCurrency(enquiry.budget || 0) : `₹${enquiry.budget || 0}`;
  const formattedDate = formatDate ? formatDate(enquiry.createdAt || new Date().toISOString()) : (enquiry.createdAt || 'Recently');

  return (
    <Card style={styles.enquiryCard} onPress={onPress}>
      {/* Header with Status and Priority */}
      <View style={styles.enquiryHeader}>
        <View style={styles.enquiryTitleContainer}>
          <Text style={styles.enquiryTitle} numberOfLines={2}>
            {enquiry.title || 'Untitled Enquiry'}
          </Text>
          <Text style={styles.enquiryClient}>
            {enquiry.clientName || 'Unknown Client'}
          </Text>
        </View>
        <View style={styles.enquiryBadges}>
          <View style={styles.statusIndicator}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {(enquiry.status || 'pending').replace('_', ' ').toUpperCase()}
            </Text>
          </View>
          <View style={styles.priorityIndicator}>
            <View style={[styles.priorityDot, { backgroundColor: priorityColor }]} />
            <Text style={[styles.priorityText, { color: priorityColor }]}>
              {(enquiry.priority || 'medium').toUpperCase()}
            </Text>
          </View>
        </View>
      </View>

      {/* Description */}
      <Text style={styles.enquiryDescription} numberOfLines={2}>
        {enquiry.description || 'No description available'}
      </Text>

      {/* Details Row */}
      <View style={styles.enquiryDetails}>
        <View style={styles.detailItem}>
          <Icon name="workspace-premium" size={14} color={colors.primary} />
          <Text style={styles.detailText}>{enquiry.metalType || 'Gold'}</Text>
        </View>
        <View style={styles.detailItem}>
          <Icon name="lens" size={14} color={colors.primary} />
          <Text style={styles.detailText}>{enquiry.category || 'General'}</Text>
        </View>
        <View style={styles.detailItem}>
          <Icon name="diamond" size={14} color={colors.primary} />
          <Text style={styles.detailText}>{enquiry.stoneType || 'Diamond'}</Text>
        </View>
      </View>

      {/* Footer with Price and Date */}
      <View style={styles.enquiryFooter}>
        <View style={styles.enquiryPriceContainer}>
          <Text style={styles.enquiryPriceLabel}>Budget</Text>
          <Text style={styles.enquiryPrice}>{formattedPrice}</Text>
        </View>
        <View style={styles.enquiryDateContainer}>
          <Icon name="schedule" size={14} color={colors.textLight} />
          <Text style={styles.enquiryDate}>{formattedDate}</Text>
        </View>
      </View>

      {/* Progress Indicator */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View 
            style={[
              styles.progressFill, 
              { 
                width: (enquiry.status || 'pending') === 'completed' ? '100%' : 
                      (enquiry.status || 'pending') === 'in_progress' ? '60%' : '20%',
                backgroundColor: statusColor 
              }
            ]} 
          />
        </View>
        <Text style={styles.progressText}>
          {(enquiry.status || 'pending') === 'completed' ? 'Completed' : 
           (enquiry.status || 'pending') === 'in_progress' ? 'In Progress' : 'Pending'}
        </Text>
      </View>
    </Card>
  );
};

const getStatusColor = (status) => {
  const colors = {
    pending: '#F59E0B',
    in_progress: '#3B82F6',
    completed: '#10B981',
    rejected: '#EF4444',
  };
  return colors[status] || '#6B7280';
};

const getPriorityColor = (priority) => {
  const colors = {
    high: '#EF4444',
    medium: '#F59E0B',
    low: '#10B981',
  };
  return colors[priority] || '#6B7280';
};

const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', {
    month: 'short',
    day: 'numeric',
  });
};

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
  }).format(amount);
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: colors.cardShadow,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  
  // Status Card
  statusCard: {
    width: '48%',
    marginHorizontal: '1%',
    marginVertical: 4,
    aspectRatio: 1.2,
    minHeight: 100,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  statusCardContent: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: 15,
    paddingHorizontal: 10,
    height: '100%',
  },
  statusHeader: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  statusIcon: {
    width: 32,
    height: 32,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  statusTitle: {
    color: colors.textPrimary,
    fontSize: fonts.xs,
    fontFamily: fonts.medium,
    textAlign: 'left',
    maxWidth: '100%',
  },
  
  // Enquiry Status Card (like the image)
  enquiryStatusCard: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    shadowColor: colors.cardShadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    minHeight: 110,
    justifyContent: 'center',
    alignItems: 'center',
  },
  enquiryStatusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusIndicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusIconContainer: {
    marginLeft: 2,
  },
  statusLabel: {
    fontSize: fonts.xs,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    letterSpacing: 0.5,
  },
  statusValue: {
    fontSize: fonts.lg,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  
  // Modern Enquiry Card
  enquiryCard: {
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 16,
    padding: 20,
    backgroundColor: colors.background,
    shadowColor: colors.cardShadow,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  
  // Header Styles
  enquiryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  enquiryTitleContainer: {
    flex: 1,
    marginRight: 12,
  },
  enquiryTitle: {
    fontSize: fonts.lg,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    marginBottom: 4,
    lineHeight: 22,
  },
  enquiryClient: {
    fontSize: fonts.sm,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
  },
  enquiryBadges: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 6,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: fonts.xs,
    fontFamily: fonts.medium,
    letterSpacing: 0.5,
  },
  priorityIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  priorityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  priorityText: {
    fontSize: fonts.xs,
    fontFamily: fonts.medium,
    letterSpacing: 0.5,
  },
  
  // Description
  enquiryDescription: {
    fontSize: fonts.base,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  
  // Details Row
  enquiryDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingVertical: 12,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    gap: 4,
  },
  detailText: {
    fontSize: fonts.xs,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  
  // Footer
  enquiryFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  enquiryPriceContainer: {
    alignItems: 'flex-start',
  },
  enquiryPriceLabel: {
    fontSize: fonts.xs,
    fontFamily: fonts.regular,
    color: colors.textLight,
    marginBottom: 2,
  },
  enquiryPrice: {
    fontSize: fonts.lg,
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  enquiryDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  enquiryDate: {
    fontSize: fonts.sm,
    fontFamily: fonts.regular,
    color: colors.textLight,
  },
  
  // Progress Indicator
  progressContainer: {
    marginTop: 4,
  },
  progressBar: {
    height: 6,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: fonts.xs,
    fontFamily: fonts.medium,
    color: colors.textLight,
    textAlign: 'center',
  },
});
