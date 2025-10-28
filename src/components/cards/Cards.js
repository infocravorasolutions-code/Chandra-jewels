import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
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
      <View style={[styles.statusIcon, { backgroundColor: color }]}>
        {icon}
      </View>
      <View style={styles.statusText}>
        <Text style={{ color: colors.textSecondary, fontSize: fonts.xs, fontFamily: fonts.regular, textAlign: 'center' }}>
          {title}
        </Text>
        <Text style={{ color: colors.textPrimary, fontSize: fonts.lg, fontFamily: fonts.bold, textAlign: 'center' }}>
          {value}
        </Text>
      </View>
    </View>
  </Card>
);

export const EnquiryCard = ({
  title,
  client,
  status,
  priority,
  createdAt,
  estimatedPrice,
  onPress,
}) => (
  <Card style={styles.enquiryCard} onPress={onPress}>
    <View style={styles.enquiryHeader}>
      <Text style={{ color: colors.textPrimary, fontSize: fonts.xl, fontFamily: fonts.bold }}>
        {title}
      </Text>
      <View style={[styles.statusBadge, { backgroundColor: getStatusColor(status) }]}>
        <Text style={{ color: colors.textWhite, fontSize: fonts.sm }}>
          {status.toUpperCase()}
        </Text>
      </View>
    </View>
    
    <View style={styles.enquiryDetails}>
      <View style={styles.enquiryRow}>
        <Icon name="account" size={14} color={colors.textSecondary} />
        <Text style={[styles.enquiryText, { color: colors.textSecondary, fontSize: fonts.base }]}>
          {client}
        </Text>
      </View>
      
      <View style={styles.enquiryRow}>
        <Icon name="warning" size={14} color={colors.textSecondary} />
        <Text style={[styles.enquiryText, { color: colors.textSecondary, fontSize: fonts.base }]}>
          {formatDate(createdAt)}
        </Text>
      </View>
      
      <View style={styles.enquiryRow}>
        <Icon name="dashboard" size={14} color={colors.textSecondary} />
        <Text style={[styles.enquiryText, { color: colors.textSecondary, fontSize: fonts.base }]}>
          {formatCurrency(estimatedPrice)}
        </Text>
      </View>
    </View>
    
    <View style={styles.enquiryFooter}>
      <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(priority) }]}>
        <Text style={{ color: colors.textWhite, fontSize: fonts.sm }}>
          {priority.toUpperCase()}
        </Text>
      </View>
    </View>
  </Card>
);

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
    paddingVertical: 12,
    paddingHorizontal: 8,
    minHeight: 80,
  },
  statusCardContent: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  iconText: {
    fontSize: 12,
    color: colors.textWhite,
  },
  statusText: {
    flex: 1,
  },
  
  // Enquiry Card
  enquiryCard: {
    marginHorizontal: 16,
  },
  enquiryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  enquiryDetails: {
    marginBottom: 12,
  },
  enquiryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  enquiryText: {
    marginLeft: 8,
  },
  enquiryFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
});
