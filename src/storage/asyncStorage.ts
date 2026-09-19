import AsyncStorage from '@react-native-async-storage/async-storage';

import { GameStorage } from './index';

export const gameStorage = new GameStorage(AsyncStorage);
