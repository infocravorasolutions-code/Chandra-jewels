import React, { useMemo } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Text,
} from 'react-native';
import { Card } from '../../components/cards/Cards';
import Icon from '../../components/common/Icon';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import { formatDateTime } from '../../utils/helpers';
import { useGetClientsQuery } from '../../store/api';
import { useAuth } from '../../context/AuthContext';

const EnquiryHistoryModal = ({ visible, onClose, enquiry }) => {
  const { user } = useAuth();
  
  // Fetch clients for name lookup
  const { data: clientsData = [] } = useGetClientsQuery(undefined, {
    skip: !visible, // Only fetch when modal is visible
  });

  // Extract StatusHistory from enquiry
  const statusHistory = enquiry?.StatusHistory || enquiry?._originalData?.StatusHistory || [];
  
  // Create a user ID to name lookup map
  const userNameMap = useMemo(() => {
    const map = new Map();
    
    // Add clients to map
    if (Array.isArray(clientsData)) {
      clientsData.forEach(client => {
        if (client && client.id && client.name) {
          const idStr = String(client.id).trim();
          map.set(idStr, client.name);
          // Handle MongoDB ObjectId format variations
          const cleanId = idStr.replace(/^ObjectId\(/, '').replace(/\)$/, '').replace(/\s/g, '');
          if (cleanId !== idStr) {
            map.set(cleanId, client.name);
          }
          // Try with spaces removed
          map.set(idStr.replace(/\s/g, ''), client.name);
        }
      });
    }
    
    // Add current user to map
    if (user && user.id) {
      const userIdStr = String(user.id).trim();
      const userName = user.name || user.email || 'You';
      map.set(userIdStr, userName);
      const cleanId = userIdStr.replace(/^ObjectId\(/, '').replace(/\)$/, '').replace(/\s/g, '');
      if (cleanId !== userIdStr) {
        map.set(cleanId, userName);
      }
      map.set(userIdStr.replace(/\s/g, ''), userName);
    }
    
    return map;
  }, [clientsData, user]);

  // Helper function to get user name from ID
  const getUserName = (userId) => {
    if (!userId) return '-';
    
    const idStr = String(userId).trim();
    
    // Try exact match
    if (userNameMap.has(idStr)) {
      return userNameMap.get(idStr);
    }
    
    // Try with spaces removed (for IDs like "68717c58079 8b31bfa7fe5ef")
    const noSpacesId = idStr.replace(/\s/g, '');
    if (userNameMap.has(noSpacesId)) {
      return userNameMap.get(noSpacesId);
    }
    
    // Try ObjectId format cleanup
    const cleanId = idStr.replace(/^ObjectId\(/, '').replace(/\)$/, '').replace(/\s/g, '');
    if (userNameMap.has(cleanId)) {
      return userNameMap.get(cleanId);
    }
    
    // If it looks like an ObjectId but we don't have a name, return a truncated version
    if (noSpacesId.length > 12) {
      return `User ${noSpacesId.substring(0, 8)}...`;
    }
    
    return userId; // Fallback to original ID if short
  };
  
  // Sort history by timestamp (oldest first, newest last)
  const sortedHistory = useMemo(() => {
    return [...statusHistory].sort((a, b) => {
      const dateA = new Date(a.Timestamp || a.timestamp || 0);
      const dateB = new Date(b.Timestamp || b.timestamp || 0);
      return dateA - dateB; // Ascending order (oldest first, newest last)
    });
  }, [statusHistory]);

  const renderHistoryItem = (item, index) => {
    const status = item.Status || item.status || 'N/A';
    const details = item.Details || item.details || '';
    const assignedToId = item.AssignedTo || item.assignedTo || '';
    const addedById = item.AddedBy || item.addedBy || '';
    const timestamp = item.Timestamp || item.timestamp || '';
    
    // Get names from IDs
    const assignedToName = getUserName(assignedToId);
    const addedByName = getUserName(addedById);
    
    return (
      <View key={index} style={styles.historyItem}>
        <View style={styles.historyRow}>
          <View style={styles.column}>
            <Text style={[styles.columnLabel, { color: colors.textSecondary, fontSize: 11 }]}>
              Status
            </Text>
            <Text style={[styles.columnValue, { color: colors.textPrimary, fontSize: 13 }]}>
              {status}
            </Text>
          </View>
          
          <View style={styles.column}>
            <Text style={[styles.columnLabel, { color: colors.textSecondary, fontSize: 11 }]}>
              Details
            </Text>
            <Text style={[styles.columnValue, { color: colors.textSecondary, fontSize: 13 }]}>
              {details || '-'}
            </Text>
          </View>
          
          <View style={styles.column}>
            <Text style={[styles.columnLabel, { color: colors.textSecondary, fontSize: 11 }]}>
              Assigned To
            </Text>
            <Text style={[styles.columnValue, { color: colors.textPrimary, fontSize: 13 }]}>
              {assignedToName || '-'}
            </Text>
          </View>
          
          <View style={styles.column}>
            <Text style={[styles.columnLabel, { color: colors.textSecondary, fontSize: 11 }]}>
              Added By
            </Text>
            <Text style={[styles.columnValue, { color: colors.textPrimary, fontSize: 13 }]}>
              {addedByName || 'N/A'}
            </Text>
          </View>
          
          <View style={styles.column}>
            <Text style={[styles.columnLabel, { color: colors.textSecondary, fontSize: 11 }]}>
              Timestamp
            </Text>
            <Text style={[styles.columnValue, { color: colors.textSecondary, fontSize: 13 }]}>
              {timestamp ? formatDateTime(timestamp) : '-'}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.textPrimary }}>
            Enquiry History
          </Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={{ fontSize: 20, color: colors.textPrimary }}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          {sortedHistory.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Icon name="history" size={40} color={colors.textLight} />
              <Text style={[styles.emptyText, { color: colors.textSecondary, fontSize: fonts.base }]}>
                No history available
              </Text>
              <Text style={{ color: colors.textLight, fontSize: fonts.sm }}>
                History will appear here as the enquiry progresses
              </Text>
            </Card>
          ) : (
            <View style={styles.historyContainer}>
              <View style={styles.tableHeader}>
                <Text style={[styles.headerText, { color: colors.textSecondary, fontSize: 11, fontWeight: '600' }]}>
                  STATUS
                </Text>
                <Text style={[styles.headerText, { color: colors.textSecondary, fontSize: 11, fontWeight: '600' }]}>
                  DETAILS
                </Text>
                <Text style={[styles.headerText, { color: colors.textSecondary, fontSize: 11, fontWeight: '600' }]}>
                  ASSIGNED TO
                </Text>
                <Text style={[styles.headerText, { color: colors.textSecondary, fontSize: 11, fontWeight: '600' }]}>
                  ADDED BY
                </Text>
                <Text style={[styles.headerText, { color: colors.textSecondary, fontSize: 11, fontWeight: '600' }]}>
                  TIMESTAMP
                </Text>
              </View>
              
              {sortedHistory.map((item, index) => renderHistoryItem(item, index))}
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  historyContainer: {
    padding: 16,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 8,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerText: {
    flex: 1,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  historyItem: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  historyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  column: {
    flex: 1,
    minWidth: 100,
    marginBottom: 4,
  },
  columnLabel: {
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  columnValue: {
    lineHeight: 18,
  },
  emptyCard: {
    margin: 16,
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    marginTop: 16,
    marginBottom: 8,
  },
});

export default EnquiryHistoryModal;

