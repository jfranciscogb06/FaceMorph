import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';

export default function FadeView({ children }: { children: React.ReactNode }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 230, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 230, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{ flex: 1, opacity, transform: [{ translateY }], backgroundColor: '#fff' }}>
      {children}
    </Animated.View>
  );
}
