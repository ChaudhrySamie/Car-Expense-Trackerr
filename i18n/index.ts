import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { I18nManager } from 'react-native';

import en from './locales/en.json';
import ur from './locales/ur.json';
import ar from './locales/ar.json';
import zh from './locales/zh.json';
import ko from './locales/ko.json';

const RESOURCES = {
  en: { translation: en },
  ur: { translation: ur },
  ar: { translation: ar },
  zh: { translation: zh },
  ko: { translation: ko },
};

const LANGUAGE_KEY = 'user_language';

const initI18n = async () => {
  let savedLanguage = await AsyncStorage.getItem(LANGUAGE_KEY);
  
  if (!savedLanguage) {
    savedLanguage = Localization.getLocales()[0].languageCode || 'en';
  }

  // Check if saved language is supported, otherwise fallback to en
  const isSupported = Object.keys(RESOURCES).includes(savedLanguage);
  if (!isSupported) savedLanguage = 'en';

  await i18n
    .use(initReactI18next)
    .init({
      resources: RESOURCES,
      lng: savedLanguage,
      fallbackLng: 'en',
      interpolation: {
        escapeValue: false,
      },
      react: {
        useSuspense: false,
      },
    });

  // Handle RTL for Arabic and Urdu (Urdu is also often RTL, but let's stick to Arabic as core RTL requirement first)
  // Actually, Urdu is also RTL.
  const isRTL = savedLanguage === 'ar' || savedLanguage === 'ur';
  if (I18nManager.isRTL !== isRTL) {
    I18nManager.forceRTL(isRTL);
    // Note: App usually needs restart to apply RTL changes correctly in all layouts
  }
};

initI18n();

export default i18n;
