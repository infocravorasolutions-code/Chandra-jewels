// Dummy API service for now
export const api = {
  // Auth endpoints
  login: async (email, password) => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const users = {
      'admin@chandrajewels.com': { password: 'admin123', role: 'admin' },
      'john@example.com': { password: 'client123', role: 'client' },
      'coral@chandrajewels.com': { password: 'coral123', role: 'coral' },
      'cad@chandrajewels.com': { password: 'cad123', role: 'cad' },
    };
    
    const user = users[email];
    if (user && user.password === password) {
      return { success: true, role: user.role };
    }
    return { success: false, error: 'Invalid credentials' };
  },

  // Dashboard data
  getDashboardData: async (role) => {
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const dashboardData = {
      admin: {
        totalEnquiries: 45,
        pendingEnquiries: 12,
        completedEnquiries: 33,
        totalClients: 25,
        revenue: 125000,
      },
      client: {
        myEnquiries: 8,
        pendingApprovals: 3,
        completedOrders: 5,
        totalSpent: 45000,
      },
      coral: {
        assignedEnquiries: 15,
        completedDesigns: 12,
        pendingDesigns: 3,
        averageRating: 4.8,
      },
      cad: {
        assignedEnquiries: 18,
        completedDesigns: 15,
        pendingDesigns: 3,
        averageRating: 4.9,
      },
    };
    
    return dashboardData[role] || {};
  },

  // Enquiries
  getEnquiries: async (role, filters = {}) => {
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const enquiries = [
      {
        id: '1',
        title: 'Gold Necklace Design',
        client: 'John Smith',
        status: 'pending',
        priority: 'high',
        createdAt: '2024-01-15',
        estimatedPrice: 25000,
        images: ['jewellery1.jpg'],
        coralVersion: null,
        cadVersion: null,
      },
      {
        id: '2',
        title: 'Diamond Ring',
        client: 'Sarah Johnson',
        status: 'in_progress',
        priority: 'medium',
        createdAt: '2024-01-14',
        estimatedPrice: 15000,
        images: ['jewellery2.jpg'],
        coralVersion: 'coral_v1.xlsx',
        cadVersion: null,
      },
      {
        id: '3',
        title: 'Earrings Set',
        client: 'Mike Wilson',
        status: 'completed',
        priority: 'low',
        createdAt: '2024-01-13',
        estimatedPrice: 8000,
        images: ['jewellery3.jpg'],
        coralVersion: 'coral_v2.xlsx',
        cadVersion: 'cad_v1.xlsx',
      },
    ];
    
    // Filter based on role
    let filteredEnquiries = enquiries;
    if (role === 'coral' || role === 'cad') {
      filteredEnquiries = enquiries.filter(e => e.status !== 'completed');
    }
    
    return filteredEnquiries;
  },

  // Chat messages
  getChatMessages: async (enquiryId) => {
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const messages = [
      {
        id: '1',
        sender: 'John Smith',
        message: 'I would like to modify the design slightly',
        timestamp: '2024-01-15T10:30:00Z',
        isClient: true,
      },
      {
        id: '2',
        sender: 'Coral Designer',
        message: 'Sure, what changes would you like?',
        timestamp: '2024-01-15T10:35:00Z',
        isClient: false,
      },
    ];
    
    return messages;
  },

  // Chats list
  getChats: async (role) => {
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const chats = [
      {
        id: '1',
        enquiryId: '1',
        enquiryTitle: 'Gold Necklace Design',
        clientName: 'John Smith',
        lastMessage: 'I would like to modify the design slightly',
        lastMessageTime: '2024-01-15T10:30:00Z',
        unreadCount: 2,
        isClient: true,
      },
      {
        id: '2',
        enquiryId: '2',
        enquiryTitle: 'Diamond Ring',
        clientName: 'Sarah Johnson',
        lastMessage: 'The design looks perfect!',
        lastMessageTime: '2024-01-14T15:20:00Z',
        unreadCount: 0,
        isClient: false,
      },
      {
        id: '3',
        enquiryId: '3',
        enquiryTitle: 'Earrings Set',
        clientName: 'Mike Wilson',
        lastMessage: 'When will the CAD be ready?',
        lastMessageTime: '2024-01-13T09:45:00Z',
        unreadCount: 1,
        isClient: true,
      },
    ];
    
    return chats;
  },

  // Metal prices (Admin only)
  getMetalPrices: async () => {
    await new Promise(resolve => setTimeout(resolve, 400));
    
    return {
      gold: {
        price: 5500,
        unit: 'per gram',
        lastUpdated: '2024-01-15',
      },
      silver: {
        price: 75,
        unit: 'per gram',
        lastUpdated: '2024-01-15',
      },
      platinum: {
        price: 3200,
        unit: 'per gram',
        lastUpdated: '2024-01-15',
      },
    };
  },

  // Clients list (Admin only)
  getClients: async () => {
    await new Promise(resolve => setTimeout(resolve, 600));
    
    return [
      {
        id: '1',
        name: 'John Smith',
        email: 'john@example.com',
        phone: '+1234567890',
        totalOrders: 5,
        totalSpent: 45000,
        lastOrder: '2024-01-10',
      },
      {
        id: '2',
        name: 'Sarah Johnson',
        email: 'sarah@example.com',
        phone: '+1234567891',
        totalOrders: 3,
        totalSpent: 25000,
        lastOrder: '2024-01-12',
      },
    ];
  },
};
