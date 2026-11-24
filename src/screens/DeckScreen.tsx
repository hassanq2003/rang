import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  FlatList,
  Modal,
  StyleSheet,
  SafeAreaView,
  Platform,
  ScrollView,
  Dimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import CARDS, { Card } from '../../cards';
import { CardBack } from '../components/CardBack';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 48) / 3;
const CARD_HEIGHT = CARD_WIDTH * 1.42;

export default function DeckScreen() {
  const [viewMode, setViewMode] = useState<'table' | 'all'>('table');
  const [deck, setDeck] = useState<Card[]>(() => [...CARDS]);
  const [tableCards, setTableCards] = useState<Card[]>([]);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [suitFilter, setSuitFilter] = useState<string>('all');

  // Shuffle deck using Fisher-Yates
  const shuffleDeck = () => {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    setDeck(shuffled);
  };

  // Draw 1 card from deck to table
  const drawCard = () => {
    if (deck.length === 0) return;
    const drawn = deck[0];
    setDeck(deck.slice(1));
    setTableCards((prev) => [drawn, ...prev]);
  };

  // Deal 5 cards
  const dealHand = (count: number = 5) => {
    if (deck.length === 0) return;
    const toDraw = Math.min(count, deck.length);
    const drawnCards = deck.slice(0, toDraw);
    setDeck(deck.slice(toDraw));
    setTableCards((prev) => [...drawnCards, ...prev]);
  };

  // Reset all cards back to deck
  const resetAll = () => {
    setDeck([...CARDS]);
    setTableCards([]);
  };

  // Discard single card from table
  const removeCardFromTable = (id: string) => {
    setTableCards((prev) => prev.filter((c) => c.id !== id));
  };

  // Filter cards for Browse mode
  const filteredCards = useMemo(() => {
    if (suitFilter === 'all') return CARDS;
    if (suitFilter === 'joker') return CARDS.filter((c) => c.rank === 'Joker');
    return CARDS.filter((c) => c.suit === suitFilter);
  }, [suitFilter]);

  // Calculate table cards total value
  const tableTotalValue = useMemo(() => {
    return tableCards.reduce((acc, c) => acc + c.value, 0);
  }, [tableCards]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />

      {/* Casino Table Felt Container */}
      <View style={styles.tableBackground}>
        {/* Header Bar */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>♠ Playing Card Deck</Text>
            <Text style={styles.headerSubtitle}>
              {tableCards.length} on Table · {deck.length} in Deck
            </Text>
          </View>

          {/* Mode Switcher */}
          <View style={styles.modeTabs}>
            <TouchableOpacity
              style={[
                styles.modeTab,
                viewMode === 'table' && styles.modeTabActive,
              ]}
              onPress={() => setViewMode('table')}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.modeTabText,
                  viewMode === 'table' && styles.modeTabTextActive,
                ]}
              >
                Table Felt
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.modeTab,
                viewMode === 'all' && styles.modeTabActive,
              ]}
              onPress={() => setViewMode('all')}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.modeTabText,
                  viewMode === 'all' && styles.modeTabTextActive,
                ]}
              >
                All Cards ({CARDS.length})
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {viewMode === 'table' ? (
          /* ==================== TABLE / DEAL MODE ==================== */
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Dealer & Deck Section */}
            <View style={styles.deckSection}>
              {/* Stacked Deck Visualization */}
              <TouchableOpacity
                onPress={drawCard}
                activeOpacity={0.85}
                disabled={deck.length === 0}
                style={styles.deckPileContainer}
              >
                {deck.length > 2 && (
                  <View style={[styles.deckShadowCard, { top: -6, left: 6 }]} />
                )}
                {deck.length > 1 && (
                  <View style={[styles.deckShadowCard, { top: -3, left: 3 }]} />
                )}
                {deck.length > 0 ? (
                  <CardBack width={86} height={124} />
                ) : (
                  <View style={styles.emptyDeckBox}>
                    <Text style={styles.emptyDeckText}>Deck Empty</Text>
                  </View>
                )}
                <View style={styles.deckBadge}>
                  <Text style={styles.deckBadgeText}>{deck.length}</Text>
                </View>
              </TouchableOpacity>

              {/* Action Buttons */}
              <View style={styles.actionsGrid}>
                <TouchableOpacity
                  style={[
                    styles.actionBtn,
                    styles.primaryBtn,
                    deck.length === 0 && styles.disabledBtn,
                  ]}
                  onPress={drawCard}
                  disabled={deck.length === 0}
                  activeOpacity={0.8}
                >
                  <Text style={styles.primaryBtnText}>🃏 Draw Card</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.actionBtn,
                    styles.goldBtn,
                    deck.length === 0 && styles.disabledBtn,
                  ]}
                  onPress={() => dealHand(5)}
                  disabled={deck.length === 0}
                  activeOpacity={0.8}
                >
                  <Text style={styles.goldBtnText}>Deal 5 Cards</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, styles.secondaryBtn]}
                  onPress={shuffleDeck}
                  disabled={deck.length === 0}
                  activeOpacity={0.8}
                >
                  <Text style={styles.secondaryBtnText}>🔀 Shuffle</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, styles.outlineBtn]}
                  onPress={resetAll}
                  activeOpacity={0.8}
                >
                  <Text style={styles.outlineBtnText}>↺ Reset</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Table Area (Felt Surface) */}
            <View style={styles.feltTable}>
              <View style={styles.feltTableHeader}>
                <View>
                  <Text style={styles.feltTableTitle}>Table Surface</Text>
                  <Text style={styles.feltTableCount}>
                    {tableCards.length} cards placed
                  </Text>
                </View>
                {tableCards.length > 0 && (
                  <View style={styles.valueBadge}>
                    <Text style={styles.valueBadgeLabel}>Total Value</Text>
                    <Text style={styles.valueBadgeNumber}>{tableTotalValue}</Text>
                  </View>
                )}
              </View>

              {tableCards.length === 0 ? (
                <View style={styles.emptyTablePlaceholder}>
                  <Text style={styles.feltWatermark}>♠ ♥ ♦ ♣</Text>
                  <Text style={styles.emptyTableTitle}>The table is empty</Text>
                  <Text style={styles.emptyTableSub}>
                    Tap the deck pile or press "Draw Card" to place cards here
                  </Text>
                </View>
              ) : (
                <View style={styles.tableCardsGrid}>
                  {tableCards.map((card, idx) => (
                    <TouchableOpacity
                      key={`${card.id}-${idx}`}
                      style={styles.tableCardItem}
                      onPress={() => setSelectedCard(card)}
                      activeOpacity={0.85}
                    >
                      <Image
                        source={card.image}
                        style={styles.tableCardImage}
                        resizeMode="contain"
                      />
                      <Text
                        style={styles.tableCardName}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {card.name}
                      </Text>
                      <TouchableOpacity
                        style={styles.removeCardBtn}
                        onPress={() => removeCardFromTable(card.id)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text style={styles.removeCardBtnText}>✕</Text>
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </ScrollView>
        ) : (
          /* ==================== BROWSE ALL CARDS MODE ==================== */
          <View style={styles.browseContainer}>
            {/* Suit Filter Tabs */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.suitFilterScroll}
              contentContainerStyle={styles.suitFilterContainer}
            >
              {[
                { label: `All (${CARDS.length})`, val: 'all' },
                { label: '♠ Spades', val: 'spades' },
                { label: '♥ Hearts', val: 'hearts' },
                { label: '♦ Diamonds', val: 'diamonds' },
                { label: '♣ Clubs', val: 'clubs' },
                { label: '🃏 Jokers', val: 'joker' },
              ].map((tab) => (
                <TouchableOpacity
                  key={tab.val}
                  style={[
                    styles.suitChip,
                    suitFilter === tab.val && styles.suitChipActive,
                  ]}
                  onPress={() => setSuitFilter(tab.val)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.suitChipText,
                      suitFilter === tab.val && styles.suitChipTextActive,
                    ]}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Cards Grid */}
            <FlatList
              data={filteredCards}
              keyExtractor={(item) => item.id}
              numColumns={3}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.allCardsList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.gridCardItem}
                  onPress={() => setSelectedCard(item)}
                  activeOpacity={0.85}
                >
                  <Image
                    source={item.image}
                    style={styles.gridCardImage}
                    resizeMode="contain"
                  />
                  <Text
                    style={styles.gridCardName}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {item.name}
                  </Text>
                  <Text style={styles.gridCardMeta}>
                    Val: {item.value}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        )}
      </View>

      {/* Card Detail Modal */}
      <Modal
        visible={!!selectedCard}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedCard(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            {selectedCard && (
              <>
                <Text style={styles.modalTitle}>{selectedCard.name}</Text>
                <Image
                  source={selectedCard.image}
                  style={styles.modalCardImage}
                  resizeMode="contain"
                />
                <View style={styles.modalMetaRow}>
                  <View style={styles.modalMetaBox}>
                    <Text style={styles.modalMetaLabel}>Suit</Text>
                    <Text style={styles.modalMetaValue}>
                      {selectedCard.suit
                        ? selectedCard.suit.toUpperCase()
                        : 'JOKER'}
                    </Text>
                  </View>
                  <View style={styles.modalMetaBox}>
                    <Text style={styles.modalMetaLabel}>Rank</Text>
                    <Text style={styles.modalMetaValue}>
                      {selectedCard.rank}
                    </Text>
                  </View>
                  <View style={styles.modalMetaBox}>
                    <Text style={styles.modalMetaLabel}>Value</Text>
                    <Text style={styles.modalMetaValue}>
                      {selectedCard.value}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={() => setSelectedCard(null)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.modalCloseBtnText}>Close</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0a2e18',
    paddingTop: Platform.OS === 'android' ? 28 : 0,
  },
  tableBackground: {
    flex: 1,
    backgroundColor: '#114a27', // Rich casino felt green
  },
  header: {
    backgroundColor: '#0a2e18',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#1d733d',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    color: '#f5f5f5',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    color: '#a3d9b1',
    fontSize: 12,
    marginTop: 2,
  },
  modeTabs: {
    flexDirection: 'row',
    backgroundColor: '#0e3b20',
    borderRadius: 8,
    padding: 3,
  },
  modeTab: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  modeTabActive: {
    backgroundColor: '#1b6b38',
  },
  modeTabText: {
    color: '#82b794',
    fontSize: 12,
    fontWeight: '600',
  },
  modeTabTextActive: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  deckSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(7, 43, 21, 0.65)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    marginBottom: 16,
  },
  deckPileContainer: {
    width: 90,
    height: 128,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginRight: 14,
  },
  deckShadowCard: {
    position: 'absolute',
    width: 86,
    height: 124,
    borderRadius: 8,
    backgroundColor: '#5e1515',
    borderWidth: 1,
    borderColor: '#ffffff',
  },
  emptyDeckBox: {
    width: 86,
    height: 124,
    borderRadius: 8,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#4d8763',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  emptyDeckText: {
    color: '#a3d9b1',
    fontSize: 11,
    fontWeight: 'bold',
  },
  deckBadge: {
    position: 'absolute',
    bottom: -6,
    right: -4,
    backgroundColor: '#d4af37', // casino gold
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#ffffff',
    elevation: 4,
  },
  deckBadgeText: {
    color: '#1a1a1a',
    fontSize: 11,
    fontWeight: 'bold',
  },
  actionsGrid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionBtn: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '46%',
    flexGrow: 1,
  },
  primaryBtn: {
    backgroundColor: '#1e7e40',
    borderWidth: 1,
    borderColor: '#4ec779',
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  goldBtn: {
    backgroundColor: '#d4af37',
  },
  goldBtnText: {
    color: '#1a2e1a',
    fontSize: 13,
    fontWeight: 'bold',
  },
  secondaryBtn: {
    backgroundColor: '#144625',
    borderWidth: 1,
    borderColor: '#2b7543',
  },
  secondaryBtnText: {
    color: '#d1f2db',
    fontSize: 12,
    fontWeight: '600',
  },
  outlineBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#609a75',
  },
  outlineBtnText: {
    color: '#d1f2db',
    fontSize: 12,
    fontWeight: '600',
  },
  disabledBtn: {
    opacity: 0.4,
  },
  feltTable: {
    backgroundColor: '#165e33',
    borderRadius: 18,
    borderWidth: 3,
    borderColor: '#0b3d1f',
    padding: 14,
    minHeight: 340,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  feltTableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.15)',
  },
  feltTableTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  feltTableCount: {
    color: '#a3e0b8',
    fontSize: 12,
  },
  valueBadge: {
    backgroundColor: '#0c381c',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d4af37',
  },
  valueBadgeLabel: {
    color: '#d4af37',
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  valueBadgeNumber: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  emptyTablePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
  },
  feltWatermark: {
    fontSize: 40,
    color: 'rgba(255, 255, 255, 0.08)',
    letterSpacing: 8,
    marginBottom: 8,
  },
  emptyTableTitle: {
    color: '#c2e6cd',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyTableSub: {
    color: '#82b794',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 240,
  },
  tableCardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'flex-start',
  },
  tableCardItem: {
    width: (SCREEN_WIDTH - 84) / 3,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 4,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4,
    position: 'relative',
  },
  tableCardImage: {
    width: '100%',
    height: ((SCREEN_WIDTH - 84) / 3) * 1.35,
  },
  tableCardName: {
    fontSize: 10,
    color: '#333333',
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center',
    width: '100%',
  },
  removeCardBtn: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#b3261e',
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
  },
  removeCardBtnText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
    lineHeight: 12,
  },
  browseContainer: {
    flex: 1,
  },
  suitFilterScroll: {
    maxHeight: 52,
    backgroundColor: 'rgba(8, 41, 20, 0.75)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  suitFilterContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  suitChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginRight: 6,
  },
  suitChipActive: {
    backgroundColor: '#d4af37',
  },
  suitChipText: {
    color: '#d1f2db',
    fontSize: 12,
    fontWeight: '600',
  },
  suitChipTextActive: {
    color: '#1a2e1a',
    fontWeight: 'bold',
  },
  allCardsList: {
    padding: 12,
    gap: 12,
  },
  gridCardItem: {
    flex: 1 / 3,
    backgroundColor: '#ffffff',
    margin: 4,
    borderRadius: 8,
    padding: 6,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
  gridCardImage: {
    width: CARD_WIDTH - 16,
    height: (CARD_WIDTH - 16) * 1.35,
  },
  gridCardName: {
    fontSize: 10,
    color: '#222222',
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
  gridCardMeta: {
    fontSize: 9,
    color: '#666666',
    marginTop: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBox: {
    width: '88%',
    backgroundColor: '#0c381c',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#d4af37',
    padding: 20,
    alignItems: 'center',
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalCardImage: {
    width: 180,
    height: 250,
    marginBottom: 16,
  },
  modalMetaRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-around',
    marginBottom: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 10,
    paddingVertical: 10,
  },
  modalMetaBox: {
    alignItems: 'center',
  },
  modalMetaLabel: {
    color: '#a3d9b1',
    fontSize: 10,
    textTransform: 'uppercase',
  },
  modalMetaValue: {
    color: '#d4af37',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 2,
  },
  modalCloseBtn: {
    backgroundColor: '#1e7e40',
    paddingVertical: 10,
    paddingHorizontal: 28,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4ec779',
  },
  modalCloseBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
