import { responsiveFonts } from '../utils/responsive';

export const fonts = {
  // Font families - Avenir (without .otf extension)
  regular: 'AvenirLTStd-Roman',
  medium: 'AvenirLTStd-Medium',
  bold: 'AvenirLTStd-Heavy',
  light: 'AvenirLTStd-Light',
  black: 'AvenirLTStd-Black',
  book: 'AvenirLTStd-Book',
  
  // Responsive font sizes
  xs: responsiveFonts.xs,
  sm: responsiveFonts.sm,
  base: responsiveFonts.base,
  lg: responsiveFonts.lg,
  xl: responsiveFonts.xl,
  '2xl': responsiveFonts['2xl'],
  '3xl': responsiveFonts['3xl'],
  '4xl': responsiveFonts['4xl'],
  
  // Line heights
  lineHeight: {
    tight: 1.2,
    normal: 1.4,
    relaxed: 1.6,
  },
};
