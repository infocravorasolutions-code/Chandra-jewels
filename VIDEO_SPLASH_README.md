# Video Splash Screen for Chandra Jewels

## Overview
A professional video splash screen implementation for the Chandra Jewels jewelry business app, featuring local video playback with animated logo overlay.

## Features

### 🎬 Video Support
- **Local Video**: Uses `Splash.mp4` from `src/assets/videos/`
- **Cross-Platform**: Works on both iOS and Android
- **Error Handling**: Graceful fallback to static background if video fails
- **Performance**: Optimized video playback with proper cleanup

### 🎨 Visual Design
- **Background**: Deep teal (#113535) with semi-transparent overlay
- **Logo**: Animated geometric gold design (#C8A265)
- **Typography**: "CHANDRA JEWELS" with text shadows for readability
- **Responsive**: Adapts to all device sizes

### ✨ Animations
- **Logo Animation**: Scale-in effect with spring animation
- **Text Animation**: Fade-in with delay for smooth sequence
- **Video Integration**: Seamless overlay on video background
- **Fallback**: Static background if video doesn't load

## File Structure

```
src/
├── assets/
│   └── videos/
│       └── Splash.mp4          # Your custom video file
├── screens/
│   └── VideoSplashScreen.js    # Video splash screen component
└── App.tsx                     # Updated to use video splash
```

## Video Requirements

### Recommended Specifications:
- **Format**: MP4 (H.264 codec)
- **Resolution**: 1080x1920 (9:16 aspect ratio for mobile)
- **Duration**: 3-6 seconds
- **File Size**: Under 5MB for optimal performance
- **Content**: Should complement your jewelry brand

### Video Content Ideas:
- Jewelry craftsmanship process
- Elegant jewelry pieces rotating
- Brand logo animation
- Luxurious background with subtle movement
- Gold/diamond sparkle effects

## Implementation Details

### Video Component Features:
```javascript
// Key features implemented:
- Local video file support
- Error handling with fallback
- Cross-platform compatibility
- Performance optimization
- Proper cleanup on unmount
- Animation synchronization
```

### Error Handling:
- **Video Load Error**: Falls back to static background
- **Network Issues**: Uses local file (no network dependency)
- **Platform Differences**: Handles iOS/Android differences
- **Timeout Protection**: 6-second fallback timer

## Customization Options

### Video Source:
```javascript
const getVideoSource = () => {
  return Platform.OS === 'ios' 
    ? require('../assets/videos/Splash.mp4')
    : require('../assets/videos/Splash.mp4');
};
```

### Animation Timing:
```javascript
// Adjust animation delays and durations
Animated.timing(logoOpacity, {
  toValue: 1,
  duration: 1000,        // Logo fade duration
  useNativeDriver: true,
}),
Animated.timing(textOpacity, {
  toValue: 1,
  duration: 800,         // Text fade duration
  delay: 500,            // Delay after logo
  useNativeDriver: true,
}),
```

### Overlay Opacity:
```javascript
overlay: {
  flex: 1,
  backgroundColor: 'rgba(17, 53, 53, 0.6)', // Adjust opacity (0.6)
},
```

## Performance Considerations

### Optimization Tips:
1. **Video Size**: Keep video file under 5MB
2. **Resolution**: Use appropriate resolution for target devices
3. **Duration**: 3-6 seconds is optimal
4. **Codec**: H.264 provides best compatibility
5. **Compression**: Balance quality vs file size

### Memory Management:
- Video component properly unmounts
- No memory leaks on navigation
- Efficient animation cleanup
- Proper error handling prevents crashes

## Testing

### Test Scenarios:
1. **Normal Flow**: Video plays and transitions to app
2. **Video Error**: Falls back to static background
3. **Slow Loading**: Timeout protection works
4. **Different Devices**: Responsive design works
5. **Network Issues**: Local file works offline

### Debug Information:
```javascript
// Console logs for debugging:
console.log('Video load started');
console.log('Video loaded');
console.log('Video ended');
console.log('Video error:', error);
```

## Usage

The video splash screen is automatically integrated into your app:

1. **App.tsx**: Uses `VideoSplashScreen` component
2. **AuthContext**: Manages loading state with video timing
3. **Navigation**: Smooth transition to main app

## Future Enhancements

### Potential Improvements:
- **Multiple Videos**: Random video selection
- **Sound Support**: Optional audio for video
- **Loading Progress**: Video loading indicator
- **Brand Customization**: Dynamic logo/text overlay
- **Analytics**: Track video completion rates

## Troubleshooting

### Common Issues:

1. **Video Not Playing**:
   - Check file path: `src/assets/videos/Splash.mp4`
   - Verify file format (MP4 with H.264)
   - Check console for error messages

2. **Performance Issues**:
   - Reduce video file size
   - Lower video resolution
   - Check device memory

3. **Animation Issues**:
   - Verify animation timing
   - Check for conflicting animations
   - Test on different devices

## Brand Guidelines

The video splash screen follows Chandra Jewels brand guidelines:
- **Primary Color**: Deep teal (#113535) - luxury and trust
- **Accent Color**: Gold (#C8A265) - premium quality
- **Typography**: Bold, elegant fonts
- **Animation**: Smooth, sophisticated transitions
- **Video Content**: Should reflect jewelry craftsmanship and luxury

## Support

For issues or questions about the video splash screen implementation, check:
1. Console logs for error messages
2. Video file format and size
3. Device compatibility
4. React Native Video documentation
