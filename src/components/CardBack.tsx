import React from 'react';
import { View, StyleSheet, Text } from 'react-native';

interface CardBackProps {
  width?: number;
  height?: number;
  color?: string;
}

export const CardBack: React.FC<CardBackProps> = ({
  width = 80,
  height = 116,
  color = '#8b1e1e', // classic casino deep red
}) => {
  return (
    <View style={[styles.card, { width, height }]}>
      <View style={[styles.innerBorder, { backgroundColor: color }]}>
        <View style={styles.patternBox}>
          <Text style={styles.patternSymbol}>♠</Text>
          <View style={styles.centerBadge}>
            <Text style={styles.centerText}>SMD</Text>
          </View>
          <Text style={styles.patternSymbol}>♦</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  innerBorder: {
    width: '100%',
    height: '100%',
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#ffffff',
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  patternBox: {
    width: '100%',
    height: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    borderRadius: 4,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  patternSymbol: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
  },
  centerBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
});
