import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AsyncKeyValueStore } from './gameStorage';

export const gameStore: AsyncKeyValueStore = AsyncStorage;
