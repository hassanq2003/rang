# Project Context & Details: smdfinaproject

This document provides complete context on the codebase, architecture, dependencies, asset structure, and current state for AI assistants (such as Claude).

---

## 1. Project Overview

- **Project Name:** `smdfinaproject` (Mobile Application / Card Game Project)
- **Framework:** **Expo (React Native)** with TypeScript
- **Target Platforms:** Android, iOS, and Web
- **Current Core Feature:** Interactive Playing Card Deck on a casino green felt table with draw/deal mechanics, hand value calculation, deck shuffling, full card catalog browsing, and detail zoom modal.

---

## 2. Tech Stack & Environment

- **Expo SDK:** `58.0.26` (`~58.0.0`)
- **React:** `19.3.0`
- **React Native:** `0.88.1`
- **React Native Web / React DOM:** `react-native-web@^0.21.4`, `react-dom@19.3.0`
- **Expo Status Bar:** `expo-status-bar@~58.0.5`
- **TypeScript:** `~6.0.3`
- **Node.js Environment:** Windows, Node v24.20.0, npm 11.19.0

---

## 3. Directory & File Structure

```text
smdfinaproject/
├── App.tsx                        # Root application component rendering DeckScreen
├── index.ts                       # Entry point registering App with Expo
├── app.json                       # Expo application metadata and configuration
├── package.json                   # Dependencies, devDependencies, and npm scripts
├── tsconfig.json                  # TypeScript compiler settings
├── cards.json                     # JSON catalog of all 67 cards with names, paths & stats
├── cards.ts                       # TypeScript module with typed CARDS array & static require()
├── details.md                     # This documentation file for Claude / AI context
├── assets/                        # Default Expo app icons and splash screens
│   ├── adaptive-icon.png
│   ├── favicon.png
│   ├── icon.png
│   └── splash.png
├── src/
│   ├── components/
│   │   └── CardBack.tsx           # Stylized casino card back for face-down deck pile
│   └── screens/
│       └── DeckScreen.tsx         # Green felt table UI, dealer controls, card grid & modal
└── Playing Cards/                 # Card artwork assets
    ├── PNG-cards-1.3/             # 67 PNG playing card image files
    └── SVG-cards-1.3/             # 67 SVG playing card image files
```

---

## 4. Key Components & Implementation Details

### A. Card Data (`cards.json` & `cards.ts`)
- **Total Cards:** 67 cards:
  - 52 standard cards (Ace, 2-10, Jack, Queen, King across Clubs, Diamonds, Hearts, Spades)
  - 13 variant 2 court cards (e.g., `jack_of_clubs2.png`, `queen_of_spades2.png`, etc.)
  - 2 Jokers (`black_joker.png`, `red_joker.png`)
- **Format:**
  ```typescript
  export interface Card {
    id: string;               // e.g., "10_of_clubs"
    name: string;             // e.g., "10 of Clubs"
    path: string;             // "./Playing Cards/PNG-cards-1.3/10_of_clubs.png"
    file: string;             // "10_of_clubs.png"
    suit: string | null;      // "clubs" | "diamonds" | "hearts" | "spades" | null
    rank: string;             // "10", "Ace", "King", "Joker", etc.
    value: number;            // Numeric value for game logic (Ace=1, J=11, Q=12, K=13)
    image: ImageSourcePropType; // require(...) for React Native Metro bundler
  }
  ```
- **Important Metro Rule:** React Native's Metro bundler requires local assets to be statically imported via `require(...)`. `cards.ts` pre-binds every image to its static `require()` path so that components can simply render `<Image source={card.image} />`.

### B. Deck Screen (`src/screens/DeckScreen.tsx`)
- **Theme:** Casino green felt background (`#114a27` background, `#165e33` felt table, `#0a2e18` header, `#d4af37` gold accents).
- **Two View Modes:**
  1. **Table Felt (Play / Deal Mode):**
     - Interactive deck pile with 3D stacked shadow effect showing remaining card count.
     - **Draw Card:** Draws top card from deck to the table.
     - **Deal 5 Cards:** Deals 5 cards directly onto the table.
     - **Shuffle:** Shuffles remaining cards using Fisher-Yates algorithm.
     - **Reset:** Resets all cards back into the deck.
     - **Table Surface:** Shows cards placed on the table, a live **Total Hand Value** calculation badge, and individual discard (`✕`) buttons on each card.
  2. **All Cards (Browse Mode):**
     - Filter chips: `All (67)`, `♠ Spades`, `♥ Hearts`, `♦ Diamonds`, `♣ Clubs`, `🃏 Jokers`.
     - 3-column responsive card grid displaying card images, names, and values.
- **Card Detail Zoom Modal:**
  - Tapping any card opens a modal overlay displaying large card artwork, suit, rank, and value.

### C. Card Back (`src/components/CardBack.tsx`)
- Renders a stylized card back with deep red felt background, white borders, diamond/spade ornamental corner symbols, and an SMD logo badge. Used for the deck pile.

---

## 5. Available Scripts & Verification Commands

```bash
# Start development server
npx expo start

# Run on Web (opens http://localhost:8081)
npm run web

# Run on Android emulator / device
npm run android

# Run on iOS simulator (macOS only)
npm run ios

# Type checking (TypeScript)
npx tsc --noEmit

# Diagnose Expo dependencies and configuration
npx expo-doctor
```

---

## 6. Current Roadmap & Next Steps

The user has expressed interest in turning this application into an **Online Multiplayer Game**:
- **Recommended Stack:** Node.js + Express + `Socket.io` server with `socket.io-client` on the Expo client.
- **Key Features to Implement Next:**
  1. **Lobby / Room Management:** Create Room code (e.g., `ABCD`), Join Room, Player List.
  2. **Authoritative Server:** Manage deck and player hands on the server to prevent cheating.
  3. **Game Logic Selection:** Turn-based game (e.g., Blackjack, Poker/Teen Patti, War, or Uno-style shedding game).
  4. **Multiplayer State Sync:** Real-time updates for active player turns, public table cards, and scores.
