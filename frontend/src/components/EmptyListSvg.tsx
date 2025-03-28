// src/components/EmptyListSvg.tsx
import React from 'react';
import Svg, { Path, Circle, G, Rect, Defs, LinearGradient, Stop } from 'react-native-svg';

interface EmptyListSvgProps {
  width?: number;
  height?: number;
  primaryColor?: string;
  secondaryColor?: string;
}

const EmptyListSvg: React.FC<EmptyListSvgProps> = ({
  width = 200,
  height = 200,
  primaryColor = '#4285F4',
  secondaryColor = '#34A853'
}) => {
  return (
    <Svg width={width} height={height} viewBox="0 0 400 400">
      <Defs>
        <LinearGradient id="gradPrimary" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor={primaryColor} stopOpacity="0.8" />
          <Stop offset="100%" stopColor={primaryColor} stopOpacity="0.4" />
        </LinearGradient>
        <LinearGradient id="gradSecondary" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor={secondaryColor} stopOpacity="0.8" />
          <Stop offset="100%" stopColor={secondaryColor} stopOpacity="0.4" />
        </LinearGradient>
      </Defs>
      
      {/* Base elements */}
      <Circle cx="200" cy="200" r="150" fill="#f5f5f5" />
      
      {/* Empty folder */}
      <G>
        <Path 
          d="M280 160 L280 280 L120 280 L120 160 L180 160 L200 180 L280 160 Z" 
          fill="url(#gradPrimary)" 
          strokeWidth="3"
          stroke={primaryColor}
        />
        <Path 
          d="M120 160 L120 140 L180 140 L200 160 L280 160" 
          fill="none" 
          strokeWidth="3"
          stroke={primaryColor}
        />
      </G>
      
      {/* Document icons */}
      <G>
        {/* Document 1 */}
        <Rect x="140" y="200" width="40" height="50" rx="4" fill="white" stroke={primaryColor} strokeWidth="1.5" />
        <Rect x="148" y="210" width="24" height="3" rx="1.5" fill={primaryColor} />
        <Rect x="148" y="218" width="24" height="3" rx="1.5" fill={primaryColor} />
        <Rect x="148" y="226" width="18" height="3" rx="1.5" fill={primaryColor} />
        <Circle cx="155" cy="240" r="6" fill="url(#gradSecondary)" />
        
        {/* Document 2 */}
        <Rect x="190" y="200" width="40" height="50" rx="4" fill="white" stroke={primaryColor} strokeWidth="1.5" />
        <Rect x="198" y="210" width="24" height="3" rx="1.5" fill={primaryColor} />
        <Rect x="198" y="218" width="24" height="3" rx="1.5" fill={primaryColor} />
        <Rect x="198" y="226" width="18" height="3" rx="1.5" fill={primaryColor} />
        <Circle cx="205" cy="240" r="6" fill="url(#gradSecondary)" />
        
        {/* Document 3 */}
        <Rect x="240" y="200" width="40" height="50" rx="4" fill="white" stroke={primaryColor} strokeWidth="1.5" />
        <Rect x="248" y="210" width="24" height="3" rx="1.5" fill={primaryColor} />
        <Rect x="248" y="218" width="24" height="3" rx="1.5" fill={primaryColor} />
        <Rect x="248" y="226" width="18" height="3" rx="1.5" fill={primaryColor} />
        <Circle cx="255" cy="240" r="6" fill="url(#gradSecondary)" />
      </G>
      
      {/* Search icon */}
      <G transform="translate(200, 120) scale(0.8)">
        <Circle 
          cx="0" 
          cy="0" 
          r="25" 
          fill="white" 
          stroke={primaryColor} 
          strokeWidth="6" 
        />
        <Path 
          d="M18 18 L30 30" 
          stroke={primaryColor} 
          strokeWidth="8" 
          strokeLinecap="round" 
        />
      </G>
      
      {/* User icon with "+" symbol */}
      <G transform="translate(200, 330)">
        <Circle cx="0" cy="0" r="25" fill="url(#gradSecondary)" />
        <Circle cx="0" cy="-8" r="10" fill="white" />
        <Path d="M-20 10 C-20 -5, 20 -5, 20 10" fill="white" />
        <Path d="M-10 0 L10 0 M0 -10 L0 10" 
          stroke={primaryColor} 
          strokeWidth="3" 
          strokeLinecap="round" 
        />
      </G>
    </Svg>
  );
};

export default EmptyListSvg;