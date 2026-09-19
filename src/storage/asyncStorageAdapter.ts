import AsyncStorage from '@react-native-async-storage/async-storage';

import { GameStorage } from './gameStorage';

export const gameStorage = new GameStorage(AsyncStorage);
